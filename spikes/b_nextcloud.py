#!/usr/bin/env python3
"""HakOS, lot 5, essai b : Nextcloud installé sans navigateur, puis comptes créés par occ.

À lancer en root dans la VM Colima, après « spikes/preparer.sh demarrer » :
    colima ssh -- sudo python3 ~/Code/mabox-os-lot5/spikes/b_nextcloud.py

preparer.sh a donné à Nextcloud un administrateur technique (hakos-installation, mot de passe
tiré au hasard dans .env) : l'image installe alors Nextcloud avant de démarrer Apache, si bien
qu'aucune page d'installation n'est jamais servie. Contrôles, avec Nextcloud 34.0.5 :
 1. Nextcloud est installé (status.php), domaine de confiance hako.local en place ;
 2. has_internet_connection passe à false (pas de requête vers haveibeenpwned) ;
 3. occ user:add --password-from-env crée la personne responsable (groupe admin) et une
    deuxième personne, avec les identifiants d'Immich (helene@hako.local, camille@hako.local).
    Le mot de passe passe par l'environnement de docker exec, jamais par la ligne de commande ;
 4. le compte technique est supprimé : le groupe admin ne contient plus que la responsable ;
 5. chaque personne se connecte par l'API OCS ; un mauvais mot de passe est refusé ;
 6. les lignes NEXTCLOUD_ADMIN_* sont retirées du .env et le conteneur est recréé :
    Nextcloud reste installé, sans compte technique.
Les mots de passe sont tirés en mémoire et ne sont jamais affichés ni écrits.
"""

import json
import os
import subprocess

from essai import Bilan, appel, mot_de_passe

ESSAI = '/opt/hakos-lot5-essai/nextcloud'
BASE = 'http://127.0.0.1:8080'
OCS = {'OCS-APIRequest': 'true'}
TECHNIQUE = 'hakos-installation'
PERSONNES = [
    {'login': 'helene@hako.local', 'nom': 'Hélène', 'responsable': True},
    {'login': 'camille@hako.local', 'nom': 'Camille', 'responsable': False},
]


def conteneur():
    sortie = subprocess.run(['docker', 'compose', 'ps', '-q', 'nextcloud'], cwd=ESSAI,
                            capture_output=True, text=True, check=True)
    return sortie.stdout.strip()


def occ(*arguments, mot=None):
    """occ dans le conteneur, en www-data. Un mot de passe ne passe que par l'environnement."""
    commande = ['docker', 'exec', '-u', 'www-data']
    environnement = dict(os.environ)
    if mot is not None:
        commande += ['-e', 'OC_PASS']  # sans valeur : docker reprend celle de l'appelant
        environnement['OC_PASS'] = mot
    commande += [conteneur(), 'php', 'occ', '--no-interaction', *arguments]
    return subprocess.run(commande, env=environnement, capture_output=True, text=True)


def compose_up():
    return subprocess.run(['docker', 'compose', 'up', '-d', '--wait', '--wait-timeout', '600'],
                          cwd=ESSAI, capture_output=True, text=True).returncode


def main():
    bilan = Bilan()
    code, statut = appel(BASE, 'GET', '/status.php')
    if not bilan.verifier(code == 200 and statut and statut.get('installed') is True,
                          f'status.php : {code}, installed={statut and statut.get("installed")}, '
                          f'version {statut and statut.get("versionstring")}'):
        bilan.finir()
    domaines = occ('config:system:get', 'trusted_domains').stdout.split()
    bilan.verifier('hako.local' in domaines,
                   f'trusted_domains appliqué à l\'installation : {" ".join(domaines)}')

    resultat = occ('config:system:set', 'has_internet_connection', '--type=boolean', '--value=false')
    bilan.verifier(resultat.returncode == 0, 'has_internet_connection = false')

    mots = {p['login']: mot_de_passe() for p in PERSONNES}
    for personne in PERSONNES:
        options = ['--display-name', personne['nom']]
        if personne['responsable']:
            options += ['--group', 'admin']
        resultat = occ('user:add', '--password-from-env', *options, personne['login'],
                       mot=mots[personne['login']])
        bilan.verifier(resultat.returncode == 0,
                       f'occ user:add {personne["login"]} : code {resultat.returncode}'
                       + ('' if resultat.returncode == 0 else f' ({resultat.stderr.strip()[:120]})'))
    resultat = occ('user:add', '--password-from-env', PERSONNES[1]['login'], mot=mot_de_passe())
    bilan.verifier(resultat.returncode != 0, 'même identifiant une deuxième fois : refusé')

    resultat = occ('user:delete', TECHNIQUE)
    bilan.verifier(resultat.returncode == 0, f'compte technique {TECHNIQUE} supprimé')
    groupes = json.loads(occ('group:list', '--output=json').stdout or '{}')
    admins = groupes.get('admin') or []
    admins = sorted(admins.keys() if isinstance(admins, dict) else admins)
    bilan.verifier(admins == ['helene@hako.local'], f'groupe admin : {admins}')

    for personne in PERSONNES:
        code, reponse = appel(BASE, 'GET', '/ocs/v2.php/cloud/user?format=json',
                              basic=(personne['login'], mots[personne['login']]), entetes=OCS)
        identifiant = (((reponse or {}).get('ocs') or {}).get('data') or {}).get('id')
        bilan.verifier(code == 200 and identifiant == personne['login'],
                       f'connexion OCS de {personne["login"]} : {code}')
    code, _ = appel(BASE, 'GET', '/ocs/v2.php/cloud/user?format=json',
                    basic=(PERSONNES[0]['login'], mot_de_passe()), entetes=OCS)
    bilan.verifier(code == 401, f'mauvais mot de passe refusé : {code}')

    # 6. Plus de trace du compte technique dans .env ; le conteneur recréé reste installé.
    chemin = os.path.join(ESSAI, '.env')
    with open(chemin, encoding='utf-8') as fichier:
        lignes = [l for l in fichier if not l.startswith('NEXTCLOUD_ADMIN_')]
    provisoire = chemin + '.provisoire'
    descripteur = os.open(provisoire, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descripteur, 'w', encoding='utf-8') as fichier:
        fichier.writelines(lignes)
    os.replace(provisoire, chemin)
    bilan.verifier(compose_up() == 0, '.env sans NEXTCLOUD_ADMIN_*, conteneur recréé et sain')
    code, statut = appel(BASE, 'GET', '/status.php')
    bilan.verifier(code == 200 and statut.get('installed') is True, 'toujours installé')
    liste = occ('user:list', '--output=json').stdout
    bilan.verifier(TECHNIQUE not in liste and PERSONNES[0]['login'] in liste,
                   'comptes : les personnes seulement, aucun compte technique')
    bilan.finir()


if __name__ == '__main__':
    main()
