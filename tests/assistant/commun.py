"""Outils communs aux tests de l'assistant : chemin du code de la box, liste de mots d'essai."""

import itertools
import sys
from pathlib import Path

ASSISTANT = Path(__file__).resolve().parents[2] / 'rootfs' / 'opt' / 'box' / 'assistant'
sys.path.insert(0, str(ASSISTANT))


def mots_essai():
    """4 096 mots de 4 lettres a-z, distincts (pas la liste de la box)."""
    lettres = 'bcdfghjklmnpqrst'
    return tuple(''.join(m) for m in itertools.islice(itertools.product(lettres, repeat=4), 4096))
