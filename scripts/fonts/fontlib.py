"""Outils communs à la chaîne des polices : empreintes, téléchargements, mesures."""

import collections
import hashlib
import io
import json
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

USER_AGENT = "hako-site-fonts-build/1.0"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class Cache:
    """Cache local des fichiers sources, vérifiés par SHA-256 à chaque lecture."""

    def __init__(self, folder: Path, offline: bool = False):
        self.folder = folder
        self.offline = offline

    def get(self, key: str, url: str, expected: str) -> bytes:
        path = self.folder / f"{key}-{expected[:16]}"
        if path.exists():
            data = path.read_bytes()
            if sha256(data) == expected:
                return data
            path.unlink()  # fichier abîmé : on le retélécharge
        if self.offline:
            raise SystemExit(f"Hors ligne : {key} absent du cache ({self.folder}).")
        data = download(url)
        got = sha256(data)
        if got != expected:
            raise SystemExit(
                f"Empreinte inattendue pour {key}\n  adresse : {url}\n"
                f"  attendue : {expected}\n  obtenue  : {got}\n"
                "Le fichier publié a changé : vérifier la source avant de mettre à jour "
                "l'empreinte."
            )
        self.folder.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return data


def download(url: str, attempts: int = 3) -> bytes:
    last = None
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(request, timeout=60) as response:
                return response.read()
        except (urllib.error.URLError, TimeoutError) as error:
            last = error
            time.sleep(2 * (attempt + 1))
    raise SystemExit(f"Téléchargement impossible : {url} ({last})")


def zip_member(archive: bytes, name: str, expected: str) -> bytes:
    """Lit un fichier précis d'une archive, en mémoire (rien n'est extrait sur le disque)."""
    with zipfile.ZipFile(io.BytesIO(archive)) as zf:
        data = zf.read(name)
    got = sha256(data)
    if got != expected:
        raise SystemExit(f"Empreinte inattendue pour {name} : {got} (attendue {expected})")
    return data


def samples_sha256(samples: dict) -> str:
    """Empreinte des textes de référence : signale des mesures de secours périmées."""
    return sha256(json.dumps(samples, ensure_ascii=False, sort_keys=True).encode("utf-8"))


def codepoints(ranges) -> list[int]:
    return sorted({cp for start, end in ranges for cp in range(start, end + 1)})


def unicode_range_css(ranges) -> list[str]:
    """Plages au format CSS, fusionnées et triées (ex. « U+0020-007E »)."""
    merged = []
    for cp in codepoints(ranges):
        if merged and cp == merged[-1][1] + 1:
            merged[-1][1] = cp
        else:
            merged.append([cp, cp])
    return [f"U+{a:04X}" if a == b else f"U+{a:04X}-{b:04X}" for a, b in merged]


def average_width(font, sample: str) -> float:
    """Chasse moyenne (en em) des caractères d'un texte, pondérée par leur fréquence."""
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    upm = font["head"].unitsPerEm
    counts = collections.Counter(sample)
    missing = sorted(ch for ch in counts if ord(ch) not in cmap)
    if missing:
        raise SystemExit(f"Caractères absents de la police pour la mesure : {missing}")
    total = sum(hmtx[cmap[ord(ch)]][0] * n for ch, n in counts.items())
    return total / sum(counts.values()) / upm
