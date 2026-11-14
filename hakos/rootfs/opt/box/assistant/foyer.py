"""Les personnes de la maison : prénoms, identifiants et mots de passe.

Mêmes règles que la page de la HAKO (src/lib/assistant/household.ts du dépôt hako-site, au
commit HAKO_SITE_COMMIT de versions.env) : la page refuse une réponse dont les prénoms ou les
identifiants diffèrent des siens. Toute modification se fait des deux côtés.

- prénom : lettres (accents compris), séparées au besoin par une espace, un trait d'union ou une
  apostrophe ; espaces en trop retirées ; 40 caractères au plus ;
- identifiant : le prénom en minuscules, sans accent, espace ni apostrophe, puis « @hako.local » ;
  « 2 », « 3 »… pour un identifiant déjà pris ;
- mot de passe : 4 mots de la liste mots.txt et un nombre de 10 à 99, avec des tirets, tirés par
  le module secrets (getrandom du noyau).

Logique pure, sans réseau ni disque (sauf la lecture de la liste de mots).
"""

import re
import secrets
import unicodedata
from dataclasses import dataclass

MIN_PERSONNES = 1
MAX_PERSONNES = 8
LONGUEUR_MAX_PRENOM = 40
LONGUEUR_MAX_IDENTIFIANT = 64
DOMAINE = '@hako.local'

# Espaces reconnues par \s et trim() en JavaScript, pour nettoyer un prénom comme la page.
_ESPACES = frozenset(
    '\t\n\v\f\r       　﻿'
    + ''.join(chr(c) for c in range(0x2000, 0x200B))
)
_SEPARATEURS = frozenset(" '’-")
_LETTRES_SPECIALES = {
    'æ': 'ae', 'œ': 'oe', 'ß': 'ss', 'ø': 'o', 'đ': 'd', 'ð': 'd', 'ł': 'l', 'þ': 'th', 'ı': 'i',
}
MOT_DE_PASSE = re.compile(r'[a-z]+(?:-[a-z]+){3}-[1-9][0-9]')
MOT = re.compile(r'[a-z]{4,8}')
TAILLE_LISTE = 4096


@dataclass(frozen=True)
class Compte:
    prenom: str
    identifiant: str
    responsable: bool
    mot_de_passe: str


def nettoyer_prenom(brut):
    """Forme Unicode composée, sans espace au début ni à la fin, ni espaces doublées."""
    texte = unicodedata.normalize('NFC', brut)
    morceaux, courant = [], []
    for car in texte:
        if car in _ESPACES:
            if courant:
                morceaux.append(''.join(courant))
                courant = []
        else:
            courant.append(car)
    if courant:
        morceaux.append(''.join(courant))
    return ' '.join(morceaux)


def _lettre(car):
    return unicodedata.category(car)[0] in 'LM'


def _forme_valide(prenom):
    """Lettres, séparées au besoin par un seul séparateur entre deux lettres."""
    if not prenom or not _lettre(prenom[0]) or not _lettre(prenom[-1]):
        return False
    precedent_separateur = False
    for car in prenom:
        if _lettre(car):
            precedent_separateur = False
        elif car in _SEPARATEURS and not precedent_separateur:
            precedent_separateur = True
        else:
            return False
    return True


def base_identifiant(prenom):
    """Début de l'identifiant : minuscules sans accent, ni espace ni apostrophe ; vide sans lettre latine."""
    ascii_ = []
    for car in unicodedata.normalize('NFD', nettoyer_prenom(prenom).lower()):
        if unicodedata.category(car)[0] == 'M':
            continue
        ascii_.append(_LETTRES_SPECIALES.get(car, car))
    texte = re.sub(r'[^a-z-]', '', ''.join(ascii_))
    texte = re.sub(r'-{2,}', '-', texte)
    return texte.strip('-')


def erreur_prenom(prenom):
    """Raison de refuser un prénom déjà nettoyé, ou None."""
    if prenom == '':
        return 'missing'
    if len(prenom) > LONGUEUR_MAX_PRENOM:
        return 'tooLong'
    if not _forme_valide(prenom) or base_identifiant(prenom) == '':
        return 'characters'
    return None


def identifiants(prenoms, domaine=DOMAINE):
    """Identifiants, dans l'ordre des prénoms (chaîne vide pour un prénom refusé)."""
    place = max(1, LONGUEUR_MAX_IDENTIFIANT - len(domaine) - 1)
    pris = set()
    resultat = []
    for prenom in prenoms:
        base = base_identifiant(prenom)[:place].rstrip('-')
        if base == '':
            resultat.append('')
            continue
        candidat, rang = base, 2
        while candidat in pris:
            candidat = f'{base}{rang}'
            rang += 1
        pris.add(candidat)
        resultat.append(candidat + domaine)
    return resultat


def verifier_prenoms(liste):
    """Prénoms nettoyés si la liste est acceptable (1 à 8 prénoms valides), sinon None."""
    if not isinstance(liste, list) or not MIN_PERSONNES <= len(liste) <= MAX_PERSONNES:
        return None
    if not all(isinstance(p, str) and len(p) <= 4 * LONGUEUR_MAX_PRENOM for p in liste):
        return None
    prenoms = [nettoyer_prenom(p) for p in liste]
    if any(erreur_prenom(p) for p in prenoms):
        return None
    return prenoms


def lire_mots(chemin):
    """Liste de mots de l'image : TAILLE_LISTE mots distincts de 4 à 8 lettres a-z, sans « exemple »."""
    with open(chemin, encoding='utf-8') as fichier:
        mots = [ligne.strip() for ligne in fichier if ligne.strip()]
    if len(mots) != TAILLE_LISTE or len(set(mots)) != TAILLE_LISTE:
        raise ValueError(f'{chemin} : {TAILLE_LISTE} mots distincts attendus, {len(set(mots))} trouvés')
    if 'exemple' in mots or not all(MOT.fullmatch(m) for m in mots):
        raise ValueError(f'{chemin} : mot hors format (4 à 8 lettres a-z, sans « exemple »)')
    return tuple(mots)


def tirer_mot_de_passe(mots):
    """4 mots et un nombre de 10 à 99, avec des tirets."""
    choisis = [secrets.choice(mots) for _ in range(4)]
    return '-'.join(choisis + [str(10 + secrets.randbelow(90))])


def creer_comptes(prenoms, mots, domaine=DOMAINE):
    """Un compte par prénom (déjà vérifié), chacun avec un mot de passe différent."""
    logins = identifiants(prenoms, domaine)
    mots_de_passe = []
    while len(mots_de_passe) < len(prenoms):
        candidat = tirer_mot_de_passe(mots)
        if candidat not in mots_de_passe:
            mots_de_passe.append(candidat)
    return tuple(
        Compte(prenom, login, rang == 0, mot)
        for rang, (prenom, login, mot) in enumerate(zip(prenoms, logins, mots_de_passe))
    )
