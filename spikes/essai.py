"""Outils communs aux essais du lot 5 : mots de passe d'essai, appels HTTP, bilan.

Bibliothèque standard de Python seulement, comme le futur service de l'assistant.
Aucun mot de passe ni jeton n'est jamais affiché.
"""

import base64
import json
import secrets
import sys
import urllib.error
import urllib.request

# Liste d'ESSAI de 32 mots, seulement pour former des mots de passe au bon format
# (4 mots, un nombre de 10 à 99, des tirets). Ce n'est PAS la liste de la box :
# voir docs/lot5-assistant.md, partie « Mots de passe ».
MOTS_ESSAI = (
    'tulipe', 'melon', 'givre', 'carton', 'prairie', 'falaise', 'citron', 'brioche',
    'lanterne', 'mouette', 'cerise', 'galet', 'colline', 'tambour', 'abricot', 'cascade',
    'rivage', 'noisette', 'chalet', 'boussole', 'luciole', 'pinceau', 'verger', 'flocon',
    'hibou', 'radeau', 'sapin', 'velours', 'pommier', 'grenier', 'plume', 'castor',
)


def mot_de_passe():
    """4 mots et un nombre de 10 à 99, tirés par secrets (getrandom du noyau)."""
    mots = [secrets.choice(MOTS_ESSAI) for _ in range(4)]
    return '-'.join(mots + [str(10 + secrets.randbelow(90))])


def appel(base, methode, chemin, corps=None, jeton=None, basic=None, entetes=None):
    """Requête HTTP ; rend (code, JSON ou None). N'affiche rien."""
    donnees = None if corps is None else json.dumps(corps).encode()
    requete = urllib.request.Request(base + chemin, data=donnees, method=methode)
    if donnees is not None:
        requete.add_header('Content-Type', 'application/json')
    if jeton:
        requete.add_header('Authorization', f'Bearer {jeton}')
    if basic:
        valeur = base64.b64encode(f'{basic[0]}:{basic[1]}'.encode()).decode()
        requete.add_header('Authorization', f'Basic {valeur}')
    for nom, valeur in (entetes or {}).items():
        requete.add_header(nom, valeur)
    try:
        with urllib.request.urlopen(requete, timeout=120) as reponse:
            code, texte = reponse.status, reponse.read().decode()
    except urllib.error.HTTPError as erreur:
        code, texte = erreur.code, erreur.read().decode(errors='replace')
    try:
        return code, (json.loads(texte) if texte else None)
    except ValueError:
        return code, None


class Bilan:
    """Compte les contrôles réussis et échoués, et donne le code de sortie."""

    def __init__(self):
        self.reussis = 0
        self.echecs = 0

    def verifier(self, condition, libelle):
        if condition:
            self.reussis += 1
            print(f'OK     {libelle}')
        else:
            self.echecs += 1
            print(f'ÉCHEC  {libelle}')
        return condition

    def note(self, texte):
        print(f'NOTE   {texte}')

    def finir(self):
        print(f'Bilan : {self.reussis} contrôles réussis, {self.echecs} échec(s).')
        sys.exit(1 if self.echecs else 0)
