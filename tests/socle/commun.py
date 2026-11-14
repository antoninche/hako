"""Outils communs aux tests du socle : chemins du code de la box (noms des applications, état)."""

import sys
from pathlib import Path

BOITE = Path(__file__).resolve().parents[2] / 'rootfs' / 'opt' / 'box'
for dossier in ('noms', 'etat'):
    sys.path.insert(0, str(BOITE / dossier))
