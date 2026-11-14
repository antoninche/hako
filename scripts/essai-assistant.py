#!/usr/bin/env python3
"""HakOS : essai de bout en bout de l'assistant de première installation, sur une box NEUVE.

Lancé par « test-sur-boitier.sh --assistant N [--coupure] », en root, juste après le premier
démarrage. Il CRÉE LES COMPTES de N personnes d'essai (1 à 8) : la box est ensuite installée,
avec des comptes d'essai. Jamais sur la box d'une famille ; regraver la box après l'essai.

Ce qui est vérifié, par l'API de la page (http://127.0.0.1/api/installation/, comme la page) :
 1. avant : phase ready, Immich sans administrateur, Nextcloud sans compte, ports 2283 et 8080
    fermés à un voisin du réseau (IPv4 privée), tout fermé à une IPv4 publique et en IPv6 ;
 2. register : un compte par prénom, identifiants de la page, mots de passe au bon format ;
 3. deuxième appareil : « busy », register refusé (409), accounts refusé (401) ;
 4. page rouverte : le mot de passe de la responsable donne la main, l'ancienne page la perd ;
 5. création suivie (avancement) ; un appareil sans la main voit « creating » ;
    avec --coupure : service tué (SIGKILL) au milieu des fichiers, redémarré par systemd, puis
    nouveaux mots de passe pour les mêmes prénoms et création reprise, sans doublon ;
 6. après : phase installed servie par nginx, accueil sur le port 80, service arrêté et masqué,
    ports ouverts au réseau de la maison seulement ; chaque personne se connecte à Immich et à
    Nextcloud avec son mot de passe (anciens mots de passe refusés), une seule administratrice ;
 7. aucun prénom, identifiant ni mot de passe dans le journal ni sur le disque ;
 8. frein d'Immich : 10 essais de mot de passe par minute et par adresse, puis 429 ;
 9. noms des applications (port 80) : hako-photos.local et hako-fichiers.local ne mènent à rien
    avant l'installation ; après, ils mènent à Immich et à Nextcloud, depuis le voisin aussi, et
    chacun s'y connecte.
Durées mesurées : attente de la phase ready, création des comptes.
Aucun mot de passe ni jeton n'est affiché.
"""

import argparse
import base64
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

API = 'http://127.0.0.1/api/installation/'
HOTE = '127.0.0.1'
IMMICH_INTERNE = 'http://127.0.0.1:12283'
IMMICH = 'http://127.0.0.1:2283'
NEXTCLOUD = 'http://127.0.0.1:8080'
MOT_DE_PASSE = r'^[a-z]+(?:-[a-z]+){3}-[1-9][0-9]$'
FOYERS = {
    1: (['Hélène'], ['helene@hako.local']),
    8: (['Hélène', 'Zoé', 'Zoë', 'Jean-Marc', ' Anne  Sophie ', 'Œdipe', 'D’Artagnan', 'Camille'],
        ['helene@hako.local', 'zoe@hako.local', 'zoe2@hako.local', 'jean-marc@hako.local',
         'annesophie@hako.local', 'oedipe@hako.local', 'dartagnan@hako.local', 'camille@hako.local']),
}
NS = 'hakos-voisin'
VOISIN = {'prive': ('192.168.77.1', '192.168.77.2/24'), 'public': ('203.0.113.1', '203.0.113.2/24'),
          'ipv6': ('fd77::1', 'fd77::2/64')}


class Bilan:
    def __init__(self):
        self.reussis = self.echecs = 0

    def verifier(self, condition, libelle):
        if condition:
            self.reussis += 1
            print(f'OK     {libelle}', flush=True)
        else:
            self.echecs += 1
            print(f'ÉCHEC  {libelle}', flush=True)
        return condition

    def note(self, texte):
        print(f'NOTE   {texte}', flush=True)


def http(methode, url, corps=None, entetes=None, delai=30):
    donnees = None if corps is None else json.dumps(corps).encode()
    requete = urllib.request.Request(url, data=donnees, method=methode)
    if donnees is not None:
        requete.add_header('Content-Type', 'application/json')
    for nom, valeur in (entetes or {}).items():
        requete.add_header(nom, valeur)
    try:
        with urllib.request.urlopen(requete, timeout=delai) as reponse:
            code, texte, tete = reponse.status, reponse.read().decode(), reponse.headers
    except urllib.error.HTTPError as erreur:
        code, texte, tete = erreur.code, erreur.read().decode(errors='replace'), erreur.headers
    except (urllib.error.URLError, OSError):
        return 0, None, {}
    try:
        return code, (json.loads(texte) if texte else None), tete
    except ValueError:
        return code, texte, tete


class Appareil:
    """Un navigateur : garde son jeton en mémoire, comme la page."""

    def __init__(self):
        self.jeton = None

    def appel(self, methode, route, corps=None):
        entetes = {'Host': HOTE, 'Accept': 'application/json'}
        if self.jeton:
            entetes['X-Hako-Session'] = self.jeton
        if methode == 'POST':
            entetes['Origin'] = f'http://{HOTE}'
        code, donnees, _ = http(methode, API + route, corps, entetes)
        return code, donnees

    def etat(self):
        return self.appel('GET', 'status')

    def inscrire(self, prenoms):
        code, donnees = self.appel('POST', 'register', {'firstNames': prenoms})
        if code == 201:
            self.jeton = donnees['token']
        return code, donnees

    def verifier(self, tape):
        code, donnees = self.appel('POST', 'check', {'typed': tape})
        if code == 200 and donnees.get('token'):
            self.jeton = donnees['token']
        return code, donnees


def lancer(*commande, entree=None, env=None):
    environnement = dict(os.environ)
    environnement.update(env or {})
    return subprocess.run(commande, input=entree, env=environnement, capture_output=True,
                          text=True, check=False)


def occ(*arguments):
    ident = lancer('docker', 'ps', '-q', '--filter', 'label=com.docker.compose.project=hakos-nextcloud',
                   '--filter', 'label=com.docker.compose.service=nextcloud').stdout.strip()
    return lancer('docker', 'exec', '-u', 'www-data', ident, 'php', 'occ', '--no-interaction', *arguments)


def connexion_immich(login, mot, base=IMMICH, hote='hako.local:2283'):
    """Connexion par le nginx (2283 ou nom sur le port 80, freinés : 10 par minute en tout) ou
    directement (12283, sans frein)."""
    code, donnees, _ = http('POST', base + '/api/auth/login', {'email': login, 'password': mot},
                            {'Host': hote})
    if code == 201 and isinstance(donnees, dict):
        http('POST', base + '/api/auth/logout', entetes={'Authorization': f'Bearer {donnees["accessToken"]}'})
    return code, donnees if isinstance(donnees, dict) else {}


def connexion_nextcloud(login, mot, base=NEXTCLOUD, hote=None):
    valeur = base64.b64encode(f'{login}:{mot}'.encode()).decode()
    entetes = {'Authorization': f'Basic {valeur}', 'OCS-APIRequest': 'true'}
    if hote:
        entetes['Host'] = hote
    code, donnees, _ = http('GET', base + '/ocs/v2.php/cloud/user?format=json', entetes=entetes)
    ident = (((donnees or {}).get('ocs') or {}).get('data') or {}).get('id') if isinstance(donnees, dict) else None
    return code, ident


# --- Voisin simulé : espace de noms réseau relié par une paire veth ---

def voisin_creer():
    voisin_defaire()
    for commande in (['ip', 'netns', 'add', NS], ['ip', 'link', 'add', 'hv0', 'type', 'veth', 'peer', 'name', 'hv1'],
                     ['ip', 'link', 'set', 'hv1', 'netns', NS], ['ip', 'link', 'set', 'hv0', 'up'],
                     ['ip', '-n', NS, 'link', 'set', 'hv1', 'up'], ['ip', '-n', NS, 'link', 'set', 'lo', 'up']):
        lancer(*commande)
    for boite, voisin in VOISIN.values():
        famille = '-6' if ':' in boite else '-4'
        prefixe = voisin.split('/')[1]
        lancer('ip', famille, 'addr', 'add', f'{boite}/{prefixe}', 'dev', 'hv0', *(['nodad'] if famille == '-6' else []))
        lancer('ip', famille, '-n', NS, 'addr', 'add', voisin, 'dev', 'hv1', *(['nodad'] if famille == '-6' else []))


def voisin_defaire():
    lancer('ip', 'netns', 'del', NS)
    lancer('ip', 'link', 'del', 'hv0')


SONDE = ('import socket,sys\n'
         's=socket.socket(socket.AF_INET6 if ":" in sys.argv[1] else socket.AF_INET)\n'
         's.settimeout(3)\n'
         'try:\n s.connect((sys.argv[1],int(sys.argv[2])));print("ouvert")\n'
         'except Exception as e:print("fermé")\n')


VOISIN_HTTP = ('import sys,urllib.request\n'
               'r=urllib.request.Request(sys.argv[1],headers={"Host":sys.argv[2]})\n'
               'try:print(urllib.request.urlopen(r,timeout=10).read(300).decode(errors="replace"))\n'
               'except Exception as e:print(type(e).__name__)\n')
NOMS = (('hako-photos.local', '/api/server/ping', 'pong'), ('hako-fichiers.local', '/status.php', '"installed":true'))


def voisin_noms(bilan, installee):
    """Le voisin (IPv4 privée) demande chaque application par son nom, sur le port 80."""
    for nom, chemin, signe in NOMS:
        obtenu = lancer('ip', 'netns', 'exec', NS, sys.executable, '-c', VOISIN_HTTP,
                        f'http://{VOISIN["prive"][0]}{chemin}', nom).stdout.strip()
        if installee:
            bilan.verifier(signe in obtenu, f'voisin : http://{nom}{chemin} mène à l\'application')
        else:
            bilan.verifier(signe not in obtenu, f'voisin : http://{nom} ne mène pas à l\'application avant l\'installation')


def voisin_sonde(adresse, port):
    return lancer('ip', 'netns', 'exec', NS, sys.executable, '-c', SONDE, adresse, str(port)).stdout.strip()


def ports_voisin(bilan, installee):
    attendu_apps = 'ouvert' if installee else 'fermé'
    prive = VOISIN['prive'][0]
    for port, attendu in ((80, 'ouvert'), (2283, attendu_apps), (8080, attendu_apps), (12283, 'fermé')):
        obtenu = voisin_sonde(prive, port)
        bilan.verifier(obtenu == attendu, f'voisin IPv4 privée → {prive}:{port} : {obtenu} (attendu {attendu})')
    for nom in ('public', 'ipv6'):
        adresse = VOISIN[nom][0]
        obtenus = {port: voisin_sonde(adresse, port) for port in (80, 2283, 8080)}
        bilan.verifier(set(obtenus.values()) == {'fermé'},
                       f'voisin {nom} → {adresse} : 80, 2283 et 8080 fermés ({obtenus})')


# --- Le parcours ---

def attendre(condition, delai, pas=0.5):
    echeance = time.monotonic() + delai
    while time.monotonic() < echeance:
        resultat = condition()
        if resultat:
            return resultat
        time.sleep(pas)
    return None


def suivre(appareil, bilan, coupure=None):
    """Suit la création jusqu'à « installed » ; coupure() est appelé une fois les fichiers commencés."""
    vus = set()
    echeance = time.monotonic() + 1800
    while time.monotonic() < echeance:
        code, etat = appareil.etat()
        if code == 200 and etat.get('phase') == 'creating':
            vus.add(tuple(sorted(etat['progress'].items())))
            if coupure and etat['progress'].get('files') == 'running':
                return coupure()
        elif code == 200 and etat.get('phase') == 'installed':
            return vus
        elif code == 200 and etat.get('phase') == 'registered':
            bilan.verifier(False, 'création arrêtée seule (phase registered) : journalctl -u hakos-assistant')
            return None
        time.sleep(0.2)
    return None


def main():
    parametres = argparse.ArgumentParser()
    parametres.add_argument('--personnes', type=int, choices=sorted(FOYERS), default=1)
    parametres.add_argument('--coupure', action='store_true')
    arguments = parametres.parse_args()
    if os.geteuid() != 0:
        sys.exit('Erreur : à lancer en root.')
    prenoms, logins = FOYERS[arguments.personnes]
    bilan = Bilan()
    secrets_vus = list(prenoms) + list(logins)
    print(f'Essai de l\'assistant : {arguments.personnes} personne(s)'
          + (', création coupée puis reprise' if arguments.coupure else '') + '.', flush=True)

    # 1. Avant
    debut = time.monotonic()
    pret = attendre(lambda: (lambda r: r[0] == 200 and r[1].get('phase') == 'ready')(Appareil().etat()), 900)
    bilan.verifier(pret, f'phase ready en {time.monotonic() - debut:.0f} s après le lancement de l\'essai')
    if not pret:
        return fin(bilan, secrets_vus)
    code, config, _ = http('GET', IMMICH_INTERNE + '/api/server/config')
    bilan.verifier(code == 200 and config.get('isInitialized') is False, 'Immich sans administrateur')
    liste = occ('user:list', '--output=json').stdout.strip()
    bilan.verifier(liste in ('[]', '{}'), f'Nextcloud sans aucun compte ({liste[:40]})')
    voisin_creer()
    try:
        ports_voisin(bilan, installee=False)
        voisin_noms(bilan, installee=False)
        intrus = ('import json,urllib.request\n'
                  'r=urllib.request.Request("http://192.168.77.1:2283/api/auth/admin-sign-up",'
                  'data=json.dumps({"email":"intrus@hako.local","name":"Intrus","password":"x"}).encode(),'
                  'headers={"Content-Type":"application/json"},method="POST")\n'
                  'try:print(urllib.request.urlopen(r,timeout=5).status)\n'
                  'except Exception as e:print(type(e).__name__)\n')
        obtenu = lancer('ip', 'netns', 'exec', NS, sys.executable, '-c', intrus).stdout.strip()
        bilan.verifier(not obtenu.isdigit(), f'voisin : inscription d\'un administrateur Immich impossible ({obtenu})')

        # 2. register
        page = Appareil()
        code, reponse = page.inscrire(prenoms)
        comptes = (reponse or {}).get('accounts') or []
        bilan.verifier(code == 201 and [c['login'] for c in comptes] == logins
                       and [c['owner'] for c in comptes] == [True] + [False] * (len(logins) - 1),
                       f'register : {code}, identifiants de la page, une seule responsable')
        bilan.verifier(len(comptes) == len(logins) and all(re.match(MOT_DE_PASSE, c['password']) for c in comptes)
                       and len({c['password'] for c in comptes}) == len(comptes),
                       'mots de passe : 4 mots et un nombre, tous différents')
        anciens = {c['login']: c['password'] for c in comptes}
        secrets_vus += list(anciens.values()) + [page.jeton or '']

        # 3. deuxième appareil
        autre = Appareil()
        bilan.verifier(autre.etat() == (200, {'phase': 'registered', 'busy': True}), 'deuxième appareil : busy')
        bilan.verifier(autre.inscrire(['Intrus']) == (409, {'error': 'busy'}), 'deuxième appareil : register refusé (409 busy)')
        bilan.verifier(autre.appel('POST', 'accounts', {}) == (401, {'error': 'no_session'}),
                       'deuxième appareil : accounts refusé (401)')
        bilan.verifier(autre.verifier('faux-faux-faux-faux-12') == (200, {'result': 'wrong'}),
                       'deuxième appareil : mauvais mot de passe de la fiche refusé')

        # 4. page rouverte : la fiche donne la main
        rouverte = Appareil()
        code, reponse = rouverte.verifier(anciens[logins[0]])
        bilan.verifier(code == 200 and reponse.get('result') == 'ok' and rouverte.jeton,
                       'page rouverte : la fiche de la responsable donne la main')
        secrets_vus.append(rouverte.jeton or '')
        bilan.verifier(page.etat()[1].get('busy') is True and rouverte.etat()[1].get('busy') is False,
                       'l\'ancienne page a perdu la main, la page rouverte l\'a')
        bilan.verifier(page.appel('POST', 'accounts', {})[0] == 401, 'l\'ancienne page ne peut plus créer les comptes')

        # 5. création
        debut = time.monotonic()
        code, reponse = rouverte.appel('POST', 'accounts', {})
        bilan.verifier(code == 202 and set((reponse or {}).get('progress', {})) == {'photos', 'files', 'finish'},
                       f'accounts : {code}, avancement')
        code, etat = Appareil().etat()
        bilan.verifier(code == 200 and etat.get('busy') is True and 'progress' in etat,
                       'un autre appareil voit la création en cours (creating, busy)')

        if arguments.coupure:
            def couper():
                time.sleep(1.5)
                lancer('systemctl', 'kill', '--signal=KILL', 'hakos-assistant.service')
                return 'coupé'
            bilan.verifier(suivre(rouverte, bilan, couper) == 'coupé', 'service tué au milieu de la création des fichiers')
            redemarre = attendre(lambda: (lambda r: r[0] == 200 and r[1].get('phase') == 'ready')(Appareil().etat()), 180)
            bilan.verifier(redemarre, 'service redémarré par systemd : phase ready (mots de passe oubliés)')
            code, reponse = rouverte.inscrire(prenoms)
            nouveaux = {c['login']: c['password'] for c in (reponse or {}).get('accounts') or []}
            secrets_vus += list(nouveaux.values()) + [rouverte.jeton or '']
            bilan.verifier(code == 201 and list(nouveaux) == logins
                           and not set(nouveaux.values()) & set(anciens.values()),
                           'mêmes prénoms : nouveaux mots de passe pour tout le monde')
            reprise = time.monotonic()
            code, _ = rouverte.appel('POST', 'accounts', {})
            bilan.verifier(code == 202, f'création reprise : {code}')
            vus = suivre(rouverte, bilan)
            bilan.note(f'création reprise en {time.monotonic() - reprise:.1f} s')
        else:
            nouveaux = anciens
            vus = suivre(rouverte, bilan)
        duree = time.monotonic() - debut
        bilan.verifier(vus is not None, f'HAKO installée : création des comptes en {duree:.1f} s '
                       f'({len(vus or ())} états d\'avancement vus)')

        # 6. après
        # « deactivating » : phase.sh fin (ExecStopPost) n'a pas encore masqué le service.
        attendre(lambda: lancer('systemctl', 'is-active', 'hakos-assistant.service').stdout.strip()
                 in ('inactive', 'failed'), 60)
        code, etat = Appareil().etat()
        bilan.verifier((code, etat) == (200, {'phase': 'installed', 'busy': False}), 'status : installed (réponse de nginx)')
        bilan.verifier(Appareil().inscrire(['Intrus']) == (409, {'error': 'wrong_phase'}), 'register après : 409 wrong_phase')
        code, page_accueil, _ = http('GET', 'http://127.0.0.1/', entetes={'Host': 'hako.local'})
        bilan.verifier(code == 200 and 'Mes photos' in str(page_accueil), 'port 80 : la page d\'accueil')
        actif = lancer('systemctl', 'is-active', 'hakos-assistant.service').stdout.strip()
        masque = lancer('systemctl', 'is-enabled', 'hakos-assistant.service').stdout.strip()
        bilan.verifier(actif != 'active' and masque == 'masked', f'service arrêté ({actif}) et masqué ({masque})')
        elements = lancer('nft', '-j', 'list', 'set', 'inet', 'hakos', 'ports_fermes').stdout
        bilan.verifier('"elem"' not in elements, 'pare-feu : ensemble ports_fermes vide')
        ports_voisin(bilan, installee=True)
        voisin_noms(bilan, installee=True)

        # Par les noms, sur le port 80 : une connexion à Immich (le frein compte aussi celles du
        # port 2283 : 8 + 1 restent sous les 10), et chacun dans Nextcloud.
        code, session = connexion_immich(logins[0], nouveaux[logins[0]], 'http://127.0.0.1', 'hako-photos.local')
        bilan.verifier(code == 201 and session.get('isAdmin') is True, 'Immich par hako-photos.local : connexion de la responsable')
        connectes = [connexion_nextcloud(login, mot, 'http://127.0.0.1', 'hako-fichiers.local') for login, mot in nouveaux.items()]
        bilan.verifier(connectes == [(200, login) for login in nouveaux],
                       f'Nextcloud par hako-fichiers.local : {len(connectes)} connexion(s)')

        for login, mot in nouveaux.items():
            code, session = connexion_immich(login, mot)
            responsable = login == logins[0]
            bilan.verifier(code == 201 and session.get('isAdmin') is responsable
                           and session.get('shouldChangePassword') is False,
                           f'Immich : connexion {"de la responsable (admin)" if responsable else "d’une personne"} '
                           f'n°{logins.index(login) + 1}, sans changement imposé')
            code, ident = connexion_nextcloud(login, mot)
            bilan.verifier(code == 200 and ident == login, f'Nextcloud : connexion n°{logins.index(login) + 1}')
        if arguments.coupure:
            refuses = [connexion_immich(l, anciens[l], IMMICH_INTERNE)[0] for l in logins]
            bilan.verifier(set(refuses) == {401}, f'Immich : anciens mots de passe refusés ({sorted(set(refuses))})')
        utilisateurs = json.loads(occ('user:list', '--output=json').stdout or '{}')
        bilan.verifier(sorted(utilisateurs) == sorted(logins), f'Nextcloud : {len(utilisateurs)} comptes, aucun en trop')
        groupes = json.loads(occ('group:list', '--output=json').stdout or '{}')
        admins = groupes.get('admin') or []
        admins = sorted(admins.keys() if isinstance(admins, dict) else admins)
        bilan.verifier(admins == [logins[0]], 'Nextcloud : seule la responsable est dans le groupe admin')
        code, session = http('POST', IMMICH_INTERNE + '/api/auth/login',
                             {'email': logins[0], 'password': nouveaux[logins[0]]})[:2]
        jeton = session.get('accessToken', '') if isinstance(session, dict) else ''
        code, utilisateurs, _ = http('GET', IMMICH_INTERNE + '/api/admin/users',
                                     entetes={'Authorization': f'Bearer {jeton}'})
        actifs = sorted(u['email'] for u in utilisateurs or [] if not u.get('deletedAt'))
        bilan.verifier(actifs == sorted(logins), f'Immich : {len(actifs)} comptes, aucun en trop')
        code, cles, _ = http('GET', IMMICH_INTERNE + '/api/api-keys', entetes={'Authorization': f'Bearer {jeton}'})
        bilan.verifier(code == 200 and cles == [], 'Immich : aucune clé d\'API laissée')
        http('POST', IMMICH_INTERNE + '/api/auth/logout', entetes={'Authorization': f'Bearer {jeton}'})

        # 8. frein d'Immich, depuis le voisin
        script = ('import json,urllib.request,urllib.error\n'
                  'codes=[]\n'
                  'for i in range(11):\n'
                  ' r=urllib.request.Request("http://192.168.77.1:2283/api/auth/login",'
                  'data=json.dumps({"email":"personne@hako.local","password":"faux"}).encode(),'
                  'headers={"Content-Type":"application/json"},method="POST")\n'
                  ' try:urllib.request.urlopen(r,timeout=10);codes.append(200)\n'
                  ' except urllib.error.HTTPError as e:codes.append(e.code)\n'
                  'print(json.dumps(codes))\n')
        codes = json.loads(lancer('ip', 'netns', 'exec', NS, sys.executable, '-c', script).stdout or '[]')
        bilan.verifier(codes[:10] == [401] * 10 and codes[10:] == [429],
                       f'frein d\'Immich : 10 essais refusés (401), le 11e freiné (429) : {codes}')
    finally:
        voisin_defaire()
    return fin(bilan, secrets_vus)


def fin(bilan, secrets_vus):
    # 7. ni journal ni disque
    journal = lancer('journalctl', '-u', 'hakos-assistant', '-u', 'hakos-parefeu', '-o', 'cat', '--no-pager').stdout
    fuites = [s for s in secrets_vus if s and s.strip() in journal]
    bilan.verifier(not fuites and journal, f'journal de l\'assistant sans prénom, identifiant, mot de passe ni jeton '
                   f'({len(journal.splitlines())} lignes, {len(fuites)} fuite(s))')
    mots = [s for s in secrets_vus if s and '-' in s and len(s) > 15 and '@' not in s]
    trouves = []
    for mot in mots:
        resultat = lancer('grep', '-rlsF', '--', mot, '/var/lib/hakos', '/run', '/tmp', '/var/tmp', '/var/log', '/opt/box')
        trouves += resultat.stdout.split()
    bilan.verifier(not trouves, f'aucun mot de passe sur le disque ({len(mots)} cherchés dans /opt/box, /var, /run, /tmp)'
                   + (f' : {sorted(set(trouves))[:3]}' if trouves else ''))
    print(f'Bilan : {bilan.reussis} contrôles réussis, {bilan.echecs} échec(s).', flush=True)
    return 1 if bilan.echecs else 0


if __name__ == '__main__':
    sys.exit(main())
