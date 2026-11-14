#!/usr/bin/env python3
"""HakOS : état de la box pour la page d'accueil (service hakos-etat, lancé chaque minute par
hakos-etat.timer).

Écrit /run/hakos-etat/etat.json (0644), que le nginx de l'accueil sert à http://hako.local/api/etat.
Aucun secret ni rien sur les personnes : ni mot de passe, ni prénom, ni identifiant, ni nom de
fichier. Seulement des mesures :
  version          version de HakOS (HAKOS_VERSION de versions.env)
  verifie          date de la mesure (secondes depuis 1970)
  disque           octets utilisés et total, sur le disque de la box
  photos           nombre de photos et de vidéos dans Immich (sa base, par docker exec)
  allumee_depuis   secondes depuis le démarrage
  temperature      °C, par vcgencmd measure_temp
  ralentissement   par vcgencmd get_throttled : ralentie par la chaleur, alimentation trop faible,
                   maintenant et depuis le démarrage
  applications     photos et fichiers : ok, demarrage ou panne (santé des conteneurs)
  sauvegarde       null : pas encore de copie de secours
Une mesure impossible vaut null (la page affiche un tiret) : pas de vcgencmd hors d'un Raspberry
Pi, Immich pas encore prêt…

Bibliothèque standard de Python seulement. Variables d'essai : HAKOS_BOITE (/opt/box),
HAKOS_SORTIE (/run/hakos-etat/etat.json), HAKOS_VCGENCMD (vcgencmd).
"""

import json
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

# Photos et vidéos visibles dans Immich v3.4.1 : ni dans la corbeille, ni cachées (la vidéo d'une
# photo animée est une ressource cachée). Le dossier verrouillé compte : seul le nombre est donné.
REQUETE_PHOTOS = ('SELECT count(*) FROM asset WHERE "deletedAt" IS NULL '
                  "AND visibility <> 'hidden'")
CONTENEUR_BASE_IMMICH = 'immich_postgres'
APPLICATIONS = {
    'photos': ('hakos-immich', 'immich-server'),
    'fichiers': ('hakos-nextcloud', 'nextcloud'),
}
# Bits de vcgencmd get_throttled (documentation de Raspberry Pi).
SOUS_TENSION, SOUS_TENSION_DEPUIS = 0x1, 0x10000
RALENTIE, RALENTIE_DEPUIS = 0x2 | 0x4 | 0x8, 0x20000 | 0x40000 | 0x80000


def lancer(*commande, delai=20):
    try:
        resultat = subprocess.run(commande, capture_output=True, text=True, timeout=delai,
                                  stdin=subprocess.DEVNULL, check=False)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return resultat.stdout if resultat.returncode == 0 else None


def lire_valeur(chemin, cle):
    try:
        for ligne in reversed(Path(chemin).read_text(encoding='utf-8').splitlines()):
            if ligne.startswith(f'{cle}='):
                return ligne.split('=', 1)[1].strip().strip('"\'') or None
    except OSError:
        pass
    return None


def disque(chemin):
    try:
        mesure = os.statvfs(chemin)
    except OSError:
        return None
    total = mesure.f_blocks * mesure.f_frsize
    utilise = (mesure.f_blocks - mesure.f_bfree) * mesure.f_frsize
    return {'utilise': utilise, 'total': total} if total else None


def allumee_depuis():
    try:
        return int(float(Path('/proc/uptime').read_text().split()[0]))
    except (OSError, ValueError, IndexError):
        return None


def lire_temperature(sortie):
    """« temp=52.1'C » → 52.1."""
    trouve = re.search(r"temp=(-?[0-9]+(?:\.[0-9]+)?)'C", sortie or '')
    return float(trouve.group(1)) if trouve else None


def lire_ralentissement(sortie):
    """« throttled=0x50005 » → les quatre indicateurs de la page."""
    trouve = re.search(r'throttled=(0x[0-9a-fA-F]+)', sortie or '')
    if not trouve:
        return None
    valeur = int(trouve.group(1), 16)
    return {
        'chaleur': bool(valeur & RALENTIE),
        'chaleur_depuis_demarrage': bool(valeur & (RALENTIE | RALENTIE_DEPUIS)),
        'alimentation': bool(valeur & SOUS_TENSION),
        'alimentation_depuis_demarrage': bool(valeur & (SOUS_TENSION | SOUS_TENSION_DEPUIS)),
    }


def lire_nombre(sortie):
    texte = (sortie or '').strip()
    return int(texte) if texte.isdigit() else None


def photos():
    # Le mot de passe de la base n'est jamais lu : psql se connecte dans le conteneur, par le
    # socket local, avec l'utilisateur et la base de son environnement.
    sortie = lancer('docker', 'exec', CONTENEUR_BASE_IMMICH, 'sh', '-c',
                    'exec psql -X -q -t -A -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$1"', 'sh', REQUETE_PHOTOS)
    return lire_nombre(sortie)


def lire_sante(sortie):
    """« running|healthy » → ok ; « running|starting » → demarrage ; le reste → panne."""
    etat, _, sante = (sortie or '').strip().partition('|')
    if etat == 'running' and sante in ('healthy', ''):
        return 'ok'
    if etat in ('running', 'restarting', 'created') and sante in ('starting', ''):
        return 'demarrage'
    return 'panne'


def applications():
    if lancer('docker', 'info', '--format', '{{.ServerVersion}}', delai=10) is None:
        return {nom: None for nom in APPLICATIONS}
    resultat = {}
    for nom, (projet, service) in APPLICATIONS.items():
        ident = (lancer('docker', 'ps', '-a', '-q', '--filter', f'label=com.docker.compose.project={projet}',
                        '--filter', f'label=com.docker.compose.service={service}') or '').split()
        if not ident:
            resultat[nom] = 'panne'
            continue
        sortie = lancer('docker', 'inspect', '--format',
                        '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}', ident[0])
        resultat[nom] = lire_sante(sortie)
    return resultat


def mesurer(boite):
    vcgencmd = os.environ.get('HAKOS_VCGENCMD', 'vcgencmd')
    return {
        'version': lire_valeur(boite / 'versions.env', 'HAKOS_VERSION'),
        'verifie': int(time.time()),
        'disque': disque(str(boite)),
        'photos': photos(),
        'allumee_depuis': allumee_depuis(),
        'temperature': lire_temperature(lancer(vcgencmd, 'measure_temp', delai=5)),
        'ralentissement': lire_ralentissement(lancer(vcgencmd, 'get_throttled', delai=5)),
        'applications': applications(),
        'sauvegarde': None,
    }


def ecrire(sortie, donnees):
    """Écriture dans un fichier provisoire du même dossier, puis renommage : jamais de JSON coupé."""
    dossier = sortie.parent
    descripteur, provisoire = tempfile.mkstemp(prefix='.etat.', dir=dossier)
    try:
        with os.fdopen(descripteur, 'w', encoding='utf-8') as fichier:
            json.dump(donnees, fichier, ensure_ascii=False, separators=(',', ':'))
        os.chmod(provisoire, 0o644)
        os.replace(provisoire, sortie)
    except BaseException:
        Path(provisoire).unlink(missing_ok=True)
        raise


def main():
    boite = Path(os.environ.get('HAKOS_BOITE', '/opt/box'))
    sortie = Path(os.environ.get('HAKOS_SORTIE', '/run/hakos-etat/etat.json'))
    ecrire(sortie, mesurer(boite))
    return 0


if __name__ == '__main__':
    sys.exit(main())
