"""Création des comptes dans Immich (par son API) et Nextcloud (par occ), puis fin de l'installation.

Même identifiant et même mot de passe dans les deux applications. Chaque étape se rejoue sans
doublon : après une création arrêtée ou une coupure de courant, les comptes déjà créés reçoivent
les nouveaux mots de passe, ceux qui ne sont plus voulus sont supprimés.

Les mots de passe ne passent que par la mémoire : corps des requêtes vers Immich (127.0.0.1),
environnement de « docker exec » (jamais la ligne de commande), entrée standard de psql pour une
empreinte bcrypt. Rien n'est écrit sur le disque ; le journal ne cite ni prénom ni identifiant.
"""

import json
import os
import re
import secrets
import subprocess
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

from installation import EchecCreation

PROJET_ACCUEIL = 'hakos-accueil'
PROJET_IMMICH = 'hakos-immich'
PROJET_NEXTCLOUD = 'hakos-nextcloud'
GROUPE_ADMIN = 'admin'
EMPREINTE_BCRYPT = re.compile(r'\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}')
# Empreinte bcrypt calculée par le module d'Immich, dans son conteneur (même format que les siennes).
SCRIPT_BCRYPT = ("process.stdout.write(require('bcrypt').hashSync(process.env.HAKOS_MDP, 10))")
SQL_ADMIN = ('UPDATE "user" SET password = \'{}\' WHERE "isAdmin" AND "deletedAt" IS NULL '
             'RETURNING email;\n')
INCLUDE_ACCUEIL = 'include /etc/nginx/hakos/accueil.conf;\n'


def ecrire_atomique(chemin, contenu, mode=0o644):
    """Écrit un fichier entier ou pas du tout (fichier provisoire du même dossier, puis renommage)."""
    chemin = Path(chemin)
    provisoire = chemin.with_name(f'.{chemin.name}.{secrets.token_hex(4)}')
    descripteur = os.open(provisoire, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
    with os.fdopen(descripteur, 'w', encoding='utf-8') as fichier:
        fichier.write(contenu)
        fichier.flush()
        os.fsync(fichier.fileno())
    os.chmod(provisoire, mode)
    os.replace(provisoire, chemin)


class Docker:
    """Appels à la commande docker. Les valeurs sensibles ne passent que par env ou entree."""

    def __init__(self, commande='docker'):
        self.commande = commande

    def lancer(self, *arguments, env=None, entree=None, delai=180):
        environnement = dict(os.environ)
        environnement.update(env or {})
        return subprocess.run([self.commande, *arguments], input=entree, env=environnement,
                              capture_output=True, text=True, timeout=delai, check=False)

    def conteneur(self, projet, service):
        resultat = self.lancer('ps', '-q', '--filter', f'label=com.docker.compose.project={projet}',
                               '--filter', f'label=com.docker.compose.service={service}', delai=30)
        ids = resultat.stdout.split()
        if resultat.returncode != 0 or len(ids) != 1:
            raise EchecCreation(f'conteneur {projet}/{service} introuvable')
        return ids[0]

    def sante(self, projet, service):
        try:
            ident = self.conteneur(projet, service)
        except EchecCreation:
            return ''
        resultat = self.lancer('inspect', '--format', '{{if .State.Health}}{{.State.Health.Status}}'
                               '{{else}}{{.State.Status}}{{end}}', ident, delai=30)
        return resultat.stdout.strip()


class Immich:
    """Comptes des photos, par l'API d'Immich publiée sur 127.0.0.1 seulement."""

    def __init__(self, base, docker):
        self.base = base.rstrip('/')
        self.docker = docker

    def appel(self, methode, chemin, corps=None, jeton=None, delai=60):
        donnees = None if corps is None else json.dumps(corps).encode()
        requete = urllib.request.Request(self.base + chemin, data=donnees, method=methode)
        requete.add_header('Accept', 'application/json')
        if donnees is not None:
            requete.add_header('Content-Type', 'application/json')
        if jeton:
            requete.add_header('Authorization', f'Bearer {jeton}')
        try:
            with urllib.request.urlopen(requete, timeout=delai) as reponse:
                code, texte = reponse.status, reponse.read().decode()
        except urllib.error.HTTPError as erreur:
            code, texte = erreur.code, erreur.read().decode(errors='replace')
        except (urllib.error.URLError, OSError) as erreur:
            raise EchecCreation(f'Immich injoignable ({methode} {chemin.split("/")[2]})') from erreur
        try:
            return code, (json.loads(texte) if texte else None)
        except ValueError:
            return code, None

    def repond(self):
        try:
            code, corps = self.appel('GET', '/api/server/ping', delai=3)
        except EchecCreation:
            return False
        return code == 200 and corps == {'res': 'pong'}

    def attendre(self, delai=180):
        echeance = time.monotonic() + delai
        while not self.repond():
            if time.monotonic() > echeance:
                raise EchecCreation('Immich ne répond pas')
            time.sleep(2)

    def _attendu(self, code, attendus, quoi):
        if code not in attendus:
            raise EchecCreation(f'Immich : {quoi} refusé ({code})')

    def _reprendre_admin(self, mot):
        """Immich déjà initialisé (création reprise) : l'administrateur reçoit ce mot de passe.

        Son mot de passe d'avant est perdu (il ne vivait qu'en mémoire). L'empreinte bcrypt est
        calculée dans le conteneur d'Immich, puis posée dans sa base par psql, sur l'entrée
        standard. Rend l'adresse de l'administrateur.
        """
        serveur = self.docker.conteneur(PROJET_IMMICH, 'immich-server')
        resultat = self.docker.lancer('exec', '-i', '-w', '/usr/src/app/server', '-e', 'HAKOS_MDP',
                                      serveur, 'node', '-e', SCRIPT_BCRYPT, env={'HAKOS_MDP': mot})
        empreinte = resultat.stdout.strip()
        if resultat.returncode != 0 or not EMPREINTE_BCRYPT.fullmatch(empreinte):
            raise EchecCreation("Immich : empreinte du mot de passe de l'administrateur impossible")
        base = self.docker.conteneur(PROJET_IMMICH, 'database')
        resultat = self.docker.lancer(
            'exec', '-i', base, 'sh', '-c',
            'exec psql -X -q -v ON_ERROR_STOP=1 -At -U "$POSTGRES_USER" -d "$POSTGRES_DB"',
            entree=SQL_ADMIN.format(empreinte))
        adresses = resultat.stdout.split()
        if resultat.returncode != 0 or len(adresses) != 1:
            raise EchecCreation(f"Immich : administrateur introuvable dans la base ({len(adresses)})")
        return adresses[0]

    def _retirer(self, utilisateur, jeton):
        """Supprime un compte plus voulu ; son adresse est d'abord libérée (la suppression est différée)."""
        code, _ = self.appel('PUT', f'/api/admin/users/{utilisateur["id"]}',
                             {'email': f'retire-{secrets.token_hex(6)}@hako.local'}, jeton)
        self._attendu(code, (200,), 'renommage du compte à supprimer')
        code, _ = self.appel('DELETE', f'/api/admin/users/{utilisateur["id"]}', {'force': True}, jeton)
        self._attendu(code, (200, 204), 'suppression du compte en trop')

    def creer(self, comptes):
        self.attendre()
        responsable = comptes[0]
        code, config = self.appel('GET', '/api/server/config')
        self._attendu(code, (200,), 'lecture de la configuration')
        if not config.get('isInitialized'):
            code, _ = self.appel('POST', '/api/auth/admin-sign-up', {
                'email': responsable.identifiant, 'name': responsable.prenom,
                'password': responsable.mot_de_passe})
            self._attendu(code, (201,), "inscription de l'administrateur")
            adresse_admin = responsable.identifiant
        else:
            adresse_admin = self._reprendre_admin(responsable.mot_de_passe)
        code, session = self.appel('POST', '/api/auth/login', {
            'email': adresse_admin, 'password': responsable.mot_de_passe})
        self._attendu(code, (201,), "connexion de l'administrateur")
        jeton = session['accessToken']
        try:
            self._accorder(comptes, adresse_admin, session['userId'], jeton)
        finally:
            self.appel('POST', '/api/auth/logout', jeton=jeton)

    def _accorder(self, comptes, adresse_admin, id_admin, jeton):
        responsable = comptes[0]
        voulus = {c.identifiant: c for c in comptes[1:]}
        code, utilisateurs = self.appel('GET', '/api/admin/users', jeton=jeton)
        self._attendu(code, (200,), 'liste des comptes')
        existants = {}
        for utilisateur in utilisateurs:
            if utilisateur['id'] == id_admin:
                continue
            adresse = utilisateur['email']
            if adresse in voulus and not utilisateur.get('isAdmin'):
                existants[adresse] = utilisateur
            else:
                # Plus voulu, ou adresse que doit prendre la personne responsable.
                self._retirer(utilisateur, jeton)
        # La personne responsable d'abord : son adresse peut être celle que veut une autre personne.
        # Son mot de passe est déjà posé (inscription ou reprise) : la session reste valable.
        corps = {'name': responsable.prenom, 'shouldChangePassword': False}
        if adresse_admin != responsable.identifiant:
            corps['email'] = responsable.identifiant
        code, _ = self.appel('PUT', f'/api/admin/users/{id_admin}', corps, jeton)
        self._attendu(code, (200,), 'réglage du compte de la personne responsable')
        for compte in comptes[1:]:
            corps = {'name': compte.prenom, 'password': compte.mot_de_passe,
                     'shouldChangePassword': False}
            if compte.identifiant in existants:
                code, _ = self.appel('PUT', f'/api/admin/users/{existants[compte.identifiant]["id"]}',
                                     corps, jeton)
                self._attendu(code, (200,), "mise à jour d'un compte")
            else:
                code, _ = self.appel('POST', '/api/admin/users',
                                     {**corps, 'email': compte.identifiant, 'notify': False}, jeton)
                self._attendu(code, (201,), "création d'un compte")
        code, _ = self.appel('POST', '/api/system-metadata/admin-onboarding', {'isOnboarded': True}, jeton)
        self._attendu(code, (200, 201, 204), "accueil de l'administrateur")


class Nextcloud:
    """Comptes des fichiers, par occ dans le conteneur de Nextcloud (utilisateur www-data)."""

    def __init__(self, docker):
        self.docker = docker

    def occ(self, *arguments, mot=None, quoi='occ'):
        conteneur = self.docker.conteneur(PROJET_NEXTCLOUD, 'nextcloud')
        commande = ['exec', '-u', 'www-data']
        env = {}
        if mot is not None:
            commande += ['-e', 'NC_PASS']  # sans valeur : docker reprend celle de l'environnement
            env['NC_PASS'] = mot
        resultat = self.docker.lancer(*commande, conteneur, 'php', 'occ', '--no-interaction',
                                      '--no-ansi', *arguments, env=env)
        if resultat.returncode != 0:
            raise EchecCreation(f'Nextcloud : {quoi} a échoué (code {resultat.returncode})')
        return resultat.stdout

    def creer(self, comptes):
        existants = json.loads(self.occ('user:list', '--output=json', quoi='liste des comptes') or '{}')
        voulus = {c.identifiant for c in comptes}
        for identifiant in existants:
            if identifiant not in voulus:
                self.occ('user:delete', identifiant, quoi='suppression d\'un compte en trop')
        for compte in comptes:
            if compte.identifiant in existants:
                self.occ('user:resetpassword', '--password-from-env', compte.identifiant,
                         mot=compte.mot_de_passe, quoi='nouveau mot de passe')
                if existants[compte.identifiant] != compte.prenom:
                    self.occ('user:profile', compte.identifiant, 'displayname', compte.prenom,
                             quoi='nom affiché')
            else:
                options = ['--display-name', compte.prenom]
                if compte.responsable:
                    options += ['--group', GROUPE_ADMIN]
                self.occ('user:add', '--password-from-env', *options, compte.identifiant,
                         mot=compte.mot_de_passe, quoi="création d'un compte")
        groupes = json.loads(self.occ('group:list', '--output=json', quoi='liste des groupes') or '{}')
        admins = groupes.get(GROUPE_ADMIN) or []
        admins = set(admins.keys() if isinstance(admins, dict) else admins)
        responsable = comptes[0].identifiant
        if responsable not in admins:
            self.occ('group:adduser', GROUPE_ADMIN, responsable, quoi='groupe admin')
        for identifiant in admins - {responsable}:
            self.occ('group:removeuser', GROUPE_ADMIN, identifiant, quoi='groupe admin')


class Createur:
    """Les trois lignes de l'avancement : photos, fichiers, fin de l'installation."""

    def __init__(self, immich, nextcloud, etat, docker, nft, journal):
        self.immich = immich
        self.nextcloud = nextcloud
        self.etat = Path(etat)
        self.docker = docker
        self.nft = nft
        self.journal = journal

    def creer(self, comptes, signaler):
        for tache, application in (('photos', self.immich), ('files', self.nextcloud)):
            signaler(tache, 'running')
            debut = time.monotonic()
            application.creer(comptes)
            signaler(tache, 'done')
            self.journal(f'{tache} : comptes prêts en {time.monotonic() - debut:.1f} s')

    def terminer(self):
        """Marque la HAKO installée, puis bascule l'accueil et ouvre les ports.

        Le marqueur fait foi : si la suite échoue, /opt/box/lib/phase.sh la refait en root à
        l'arrêt du service et à chaque démarrage de la box.
        """
        quand = datetime.now().astimezone().isoformat(timespec='seconds')
        ecrire_atomique(self.etat / 'installee', f'HakOS installée le {quand}\n')
        ecrire_atomique(self.etat / 'accueil' / 'phase.conf', INCLUDE_ACCUEIL)
        try:
            nginx = self.docker.conteneur(PROJET_ACCUEIL, 'nginx')
            resultat = self.docker.lancer('kill', '--signal', 'HUP', nginx, delai=30)
            if resultat.returncode != 0:
                raise EchecCreation('rechargement de nginx refusé')
        except EchecCreation as erreur:
            self.journal(f'attention : {erreur} (repris à l\'arrêt du service)')
        resultat = subprocess.run([self.nft, 'flush', 'set', 'inet', 'hakos', 'ports_fermes'],
                                  capture_output=True, text=True, timeout=30, check=False)
        if resultat.returncode != 0:
            self.journal('attention : ports 2283 et 8080 pas encore ouverts (repris à l\'arrêt du service)')
