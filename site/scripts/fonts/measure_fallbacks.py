"""Mesure les polices installées qui servent de secours (Georgia, Arial…).

Les valeurs sont recopiées dans fonts_config.py (FALLBACK_METRICS) : la
construction n'a ainsi jamais besoin de ces polices et donne le même résultat
sur toutes les machines. À relancer sur un Mac seulement si SAMPLES change :

    uv run --no-project --python 3.12 --with fonttools==4.68.0 \\
      python -I scripts/fonts/measure_fallbacks.py [--check]
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fontTools.ttLib import TTFont  # noqa: E402

import fonts_config as cfg  # noqa: E402
from fontlib import average_width, samples_sha256  # noqa: E402

SUPPLEMENTAL = "/System/Library/Fonts/Supplemental"
FILES = {
    "Georgia": (f"{SUPPLEMENTAL}/Georgia.ttf", None),
    "Georgia Bold": (f"{SUPPLEMENTAL}/Georgia Bold.ttf", None),
    "Times New Roman": (f"{SUPPLEMENTAL}/Times New Roman.ttf", None),
    "Times New Roman Bold": (f"{SUPPLEMENTAL}/Times New Roman Bold.ttf", None),
    "Arial": (f"{SUPPLEMENTAL}/Arial.ttf", None),
    "Arial Bold": (f"{SUPPLEMENTAL}/Arial Bold.ttf", None),
    "Arial Italic": (f"{SUPPLEMENTAL}/Arial Italic.ttf", None),
    "Arial Narrow Bold": (f"{SUPPLEMENTAL}/Arial Narrow Bold.ttf", None),
    "Helvetica": ("/System/Library/Fonts/Helvetica.ttc", 0),
    "Helvetica Bold": ("/System/Library/Fonts/Helvetica.ttc", 1),
    "Helvetica Oblique": ("/System/Library/Fonts/Helvetica.ttc", 2),
}


def measure() -> dict:
    result = {}
    for key, (path, index) in FILES.items():
        font = TTFont(path, fontNumber=index if index is not None else -1, lazy=True)
        name = font["name"]
        result[key] = {
            "full_name": name.getDebugName(4),
            "postscript": name.getDebugName(6),
            "version": name.getDebugName(5),
            "file": path if index is None else f"{path} (n° {index})",
            "avg_width": {
                key: round(average_width(font, text), 6)
                for key, text in sorted(cfg.SAMPLES.items())
            },
        }
    return result


def main() -> int:
    measured = measure()
    sample_hash = samples_sha256(cfg.SAMPLES)
    if "--check" in sys.argv:
        ok = sample_hash == cfg.FALLBACK_SAMPLES_SHA256 and measured == cfg.FALLBACK_METRICS
        if ok:
            print("Mesures identiques à fonts_config.py.")
        else:
            print("Mesures différentes : mettre à jour fonts_config.py.")
        return 0 if ok else 1
    print(f'FALLBACK_SAMPLES_SHA256 = "{sample_hash}"')
    print("FALLBACK_METRICS = {")
    for key, values in measured.items():
        print(f'    "{key}": {{')
        for field, value in values.items():
            if isinstance(value, dict):
                print(f'        "{field}": {{')
                for sub, number in value.items():
                    print(f'            "{sub}": {number},')
                print("        },")
            else:
                print(f'        "{field}": "{value}",')
        print("    },")
    print("}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
