#!/usr/bin/env python3
"""HakOS, lot 5, essai a : comptes Immich créés par l'API, sans navigateur.

À lancer dans la VM Colima, après « spikes/preparer.sh demarrer » (Immich neuf, port 2283) :
    colima ssh -- python3 ~/Code/mabox-os-lot5/spikes/a_immich.py

Contrôles, avec Immich v3.4.1 :
 1. Immich neuf : isInitialized vaut false ;
 2. la personne responsable s'inscrit comme administrateur (POST /api/auth/admin-sign-up),
    avec l'identifiant de la page (helene@hako.local) ;
 3. son drapeau shouldChangePassword est mis à false s'il le faut ;
 4. une deuxième personne est créée (POST /api/admin/users), sans changement de mot de passe
    imposé ni courriel ;
 5. chacune se connecte avec son mot de passe ;
 6. ensuite, l'inscription d'un administrateur et la restauration publique sont refusées ;
 7. durée d'une connexion refusée (bcrypt), pour estimer le rythme d'une attaque en ligne.
Les mots de passe sont tirés en mémoire et ne sont jamais affichés ni écrits.
"""

import time

from essai import Bilan, appel, mot_de_passe

BASE = 'http://127.0.0.1:2283'
RESPONSABLE = {'email': 'helene@hako.local', 'name': 'Hélène'}
DEUXIEME = {'email': 'camille@hako.local', 'name': 'Camille'}


def connexion(email, mot):
    return appel(BASE, 'POST', '/api/auth/login', {'email': email, 'password': mot})


def main():
    bilan = Bilan()
    code, ping = appel(BASE, 'GET', '/api/server/ping')
    if not bilan.verifier(code == 200 and ping == {'res': 'pong'}, 'Immich répond (ping)'):
        bilan.finir()

    code, config = appel(BASE, 'GET', '/api/server/config')
    bilan.verifier(code == 200 and config.get('isInitialized') is False,
                   'Immich neuf : isInitialized vaut false')

    mots = {RESPONSABLE['email']: mot_de_passe(), DEUXIEME['email']: mot_de_passe()}

    # 2. Inscription de la personne responsable, directement administratrice.
    code, admin = appel(BASE, 'POST', '/api/auth/admin-sign-up',
                        {**RESPONSABLE, 'password': mots[RESPONSABLE['email']]})
    bilan.verifier(code == 201 and admin.get('isAdmin') is True
                   and admin.get('email') == RESPONSABLE['email'],
                   f'admin-sign-up : {code}, administrateur {RESPONSABLE["email"]}')
    bilan.note(f'admin-sign-up rend shouldChangePassword={admin.get("shouldChangePassword")}')

    code, session = connexion(RESPONSABLE['email'], mots[RESPONSABLE['email']])
    if not bilan.verifier(code == 201 and session.get('accessToken'),
                          f'connexion de la responsable : {code}'):
        bilan.finir()
    jeton = session['accessToken']

    # 3. Pas de changement de mot de passe imposé : la fiche de secours doit rester juste.
    if session.get('shouldChangePassword'):
        code, _ = appel(BASE, 'PUT', f'/api/admin/users/{session["userId"]}',
                        {'shouldChangePassword': False}, jeton=jeton)
        bilan.note(f'shouldChangePassword corrigé par PUT /api/admin/users/{{id}} : {code}')
    code2, fiche = appel(BASE, 'GET', f'/api/admin/users/{session["userId"]}', jeton=jeton)
    bilan.verifier(code2 == 200 and fiche.get('shouldChangePassword') is False,
                   'responsable : shouldChangePassword vaut false')

    # Écrans d'accueil d'Immich déjà passés (facultatif).
    code, _ = appel(BASE, 'POST', '/api/system-metadata/admin-onboarding',
                    {'isOnboarded': True}, jeton=jeton)
    bilan.verifier(200 <= code < 300, f'accueil de l\'administrateur passé : {code}')

    # 4. Deuxième personne.
    code, cree = appel(BASE, 'POST', '/api/admin/users',
                       {**DEUXIEME, 'password': mots[DEUXIEME['email']],
                        'shouldChangePassword': False, 'notify': False}, jeton=jeton)
    bilan.verifier(code == 201 and cree.get('isAdmin') is False
                   and cree.get('shouldChangePassword') is False,
                   f'POST /api/admin/users : {code}, {DEUXIEME["email"]}, ni admin ni changement imposé')
    code, _ = appel(BASE, 'POST', '/api/admin/users',
                    {**DEUXIEME, 'password': mots[DEUXIEME['email']]}, jeton=jeton)
    bilan.verifier(code in (400, 409), f'même identifiant une deuxième fois : refusé ({code})')

    # 5. Connexion de la deuxième personne.
    code, session2 = connexion(DEUXIEME['email'], mots[DEUXIEME['email']])
    bilan.verifier(code == 201 and session2.get('shouldChangePassword') is False,
                   f'connexion de la deuxième personne : {code}, sans changement imposé')
    if code == 201:
        appel(BASE, 'POST', '/api/auth/logout', jeton=session2['accessToken'])

    # 6. Plus aucune porte ouverte à un inconnu.
    code, config = appel(BASE, 'GET', '/api/server/config')
    bilan.verifier(config.get('isInitialized') is True, 'isInitialized vaut true')
    code, reponse = appel(BASE, 'POST', '/api/auth/admin-sign-up',
                          {'email': 'intrus@hako.local', 'name': 'Intrus',
                           'password': mot_de_passe()})
    bilan.verifier(code == 400, f'nouvel admin-sign-up refusé : {code} '
                   f'« {(reponse or {}).get("message")} »')
    code, reponse = appel(BASE, 'POST', '/api/admin/database-backups/start-restore', {})
    bilan.verifier(code in (400, 401, 403), f'restauration sans session refusée : {code} '
                   f'« {(reponse or {}).get("message")} »')

    # 7. Durée d'une connexion refusée : bcrypt est le seul frein, Immich ne limite rien.
    durees = []
    for _ in range(5):
        debut = time.monotonic()
        code, _ = connexion(RESPONSABLE['email'], mot_de_passe())
        durees.append(time.monotonic() - debut)
    bilan.verifier(code == 401, f'mauvais mot de passe refusé : {code}')
    moyenne = sum(durees) / len(durees)
    bilan.note(f'connexion refusée en {moyenne * 1000:.0f} ms en moyenne (5 essais, VM du Mac), '
               f'aucun blocage après 5 échecs')

    code, _ = appel(BASE, 'POST', '/api/auth/logout', jeton=jeton)
    bilan.verifier(code == 200, f'déconnexion de la session de l\'assistant : {code}')
    bilan.finir()


if __name__ == '__main__':
    main()
