"""Construit les polices du site (lancé par `npm run fonts:build`).

Étapes :
1. reprend chaque source officielle du cache .cache/fonts/ ou la télécharge,
   et vérifie son empreinte SHA-256 (voir fonts_config.py) ;
2. découpe les polices au jeu latin + français, fige ou restreint les axes
   variables, retire le hinting et compresse en WOFF2 ; D-DIN est copié tel
   quel (nom réservé, voir docs/fonts.md) ;
3. écrit public/fonts/<famille>/ (polices et licences telles que publiées),
   src/styles/fonts.css et src/components/FontPreloads.astro ;
4. affiche un bilan : tailles, empreintes, caractères absents des sources.

Options :
    --offline  n'utilise que le cache, sans réseau ;
    --check    reconstruit en mémoire et compare aux fichiers existants, sans
               rien écrire (code de sortie 1 en cas de différence).
"""

import argparse
import io
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from fontTools import subset  # noqa: E402
from fontTools.ttLib import TTFont  # noqa: E402
from fontTools.varLib import instancer  # noqa: E402

import fonts_config as cfg  # noqa: E402
from fontlib import (  # noqa: E402
    Cache,
    average_width,
    codepoints,
    samples_sha256,
    sha256,
    unicode_range_css,
    zip_member,
)

ROOT = HERE.parent.parent
CACHE_DIR = ROOT / ".cache" / "fonts"
PUBLIC_FONTS = Path("public/fonts")
CSS_PATH = Path("src/styles/fonts.css")
PRELOADS_PATH = Path("src/components/FontPreloads.astro")
WANTED = codepoints(cfg.UNICODE_RANGES)


# ---------------------------------------------------------------------------
# Polices
# ---------------------------------------------------------------------------
def load(data: bytes) -> TTFont:
    return TTFont(io.BytesIO(data), recalcTimestamp=False, lazy=False)


def save(font: TTFont, flavor=None) -> bytes:
    font.flavor = flavor
    font.recalcTimestamp = False
    buffer = io.BytesIO()
    font.save(buffer)
    return buffer.getvalue()


def bake_rvrn(font: TTFont) -> int:
    """Applique dans la table cmap les substitutions rvrn devenues permanentes.

    Une fois l'axe WONK figé à 0, Fraunces remplace toujours h, m, n, s… par
    leur forme « sage » (.alt). On pointe directement vers ces formes : le
    rendu ne dépend plus de la prise en charge de rvrn par le navigateur, et
    les formes inutilisées disparaissent du fichier.
    """
    table = font["GSUB"].table
    mapping = {}
    for record in table.FeatureList.FeatureRecord:
        if record.FeatureTag == "rvrn":
            for index in record.Feature.LookupListIndex:
                for sub in table.LookupList.Lookup[index].SubTable:
                    mapping.update(getattr(sub, "mapping", None) or {})
    count = 0
    for cmap in font["cmap"].tables:
        for cp, glyph in list(cmap.cmap.items()):
            if glyph in mapping:
                cmap.cmap[cp] = mapping[glyph]
                count += 1
    if not count:
        raise SystemExit("bake_rvrn : aucune substitution rvrn trouvée (source inattendue).")
    return count


def subset_font(font: TTFont) -> None:
    options = subset.Options()
    options.layout_features = list(cfg.LAYOUT_FEATURES)
    options.name_IDs = ["*"]  # garde copyright, licence, auteurs, noms des axes
    options.name_languages = ["*"]
    options.hinting = False
    options.recalc_timestamp = False
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=WANTED)
    subsetter.subset(font)


def build_face(face: dict, data: bytes) -> dict:
    source = load(data)
    missing = [cp for cp in WANTED if cp not in source.getBestCmap()]
    if face["method"] == "copy":
        # Fichier officiel inchangé : aucune transformation, aucun ré-encodage.
        return {"woff2": data, "font": source, "source": source, "missing": missing}
    font = load(data)
    if face.get("axes"):
        font = instancer.instantiateVariableFont(
            font, face["axes"], updateFontNames=bool(face.get("update_names"))
        )
        # Aller-retour en binaire : la table gvar redevient complète pour le découpage.
        font = load(save(font))
    if face.get("bake_rvrn"):
        bake_rvrn(font)
    subset_font(font)
    ttf = save(font)
    woff2 = save(load(ttf), "woff2")
    return {"woff2": woff2, "font": load(ttf), "source": source, "missing": missing}


def check_metadata(font: TTFont, label: str) -> None:
    """La licence OFL impose de garder le copyright et la licence dans chaque copie."""
    name = font["name"]
    for name_id in (0, 13):
        if not name.getDebugName(name_id):
            raise SystemExit(f"{label} : entrée name {name_id} absente (copyright ou licence).")


# ---------------------------------------------------------------------------
# Polices de secours (faces « … Fallback »)
# ---------------------------------------------------------------------------
def fallback_rule(rule: dict, built_faces: list, sample: str) -> dict:
    font = load(save(built_faces[rule.get("face", 0)]["font"]))
    if rule["match"] and "fvar" in font:
        font = instancer.instantiateVariableFont(font, rule["match"], updateFontNames=False)
    web_width = average_width(font, cfg.SAMPLES[sample])
    locals_ = [cfg.FALLBACK_METRICS[key] for key in rule["locals"]]
    reference = locals_[0]["avg_width"][sample]
    for other in locals_[1:]:
        if abs(other["avg_width"][sample] - reference) / reference > 0.005:
            raise SystemExit(f"{rule['locals']} : chasses trop différentes pour une seule règle.")
    upm = font["head"].unitsPerEm
    hhea = font["hhea"]
    size_adjust = web_width / reference
    names = []
    for item in locals_:
        for local_name in (item["full_name"], item["postscript"]):
            if local_name not in names:
                names.append(local_name)
    return {
        "weight": rule["weight"],
        "style": rule["style"],
        "locals": names,
        "size_adjust": size_adjust,
        "ascent": hhea.ascent / upm / size_adjust,
        "descent": -hhea.descent / upm / size_adjust,
        "line_gap": hhea.lineGap / upm / size_adjust,
        "web_width": web_width,
        "local_width": reference,
    }


def pct(value: float) -> str:
    text = f"{value * 100:.2f}".rstrip("0").rstrip(".")
    return f"{text}%"


# ---------------------------------------------------------------------------
# Fichiers texte générés
# ---------------------------------------------------------------------------
CSS_HEADER = """/*
 * Polices du site, toutes servies depuis /fonts/ : aucune requête vers un autre site.
 *
 * Fichier généré par `npm run fonts:build` (scripts/fonts/build.py) : ne pas le
 * modifier à la main. Sources, licences et réglages : docs/fonts.md.
 *
 * Chaque famille a sa face « … Fallback » : une police déjà installée (Georgia,
 * Arial…) ajustée aux mesures de la police du site. Pendant le chargement, le
 * texte occupe presque la même place et la page ne bouge pas au remplacement.
 * Pour une même famille, la règle écrite en dernier est essayée en premier.
 */
"""


WIDTH = 100  # largeur de ligne de Prettier dans ce projet


def comma_list(prop: str, values: list[str]) -> list[str]:
    """Déclaration CSS à valeurs séparées par des virgules, mise en page comme Prettier :
    sur une ligne si elle tient, sinon valeurs remplies ligne à ligne sous la propriété."""
    single = f"  {prop}: {', '.join(values)};"
    if len(single) <= WIDTH:
        return [single]
    lines, current = [f"  {prop}:"], ""
    for i, value in enumerate(values):
        piece = value + ("," if i < len(values) - 1 else ";")
        if not current:
            current = "    " + piece
        elif len(current) + 1 + len(piece) <= WIDTH:
            current += " " + piece
        else:
            lines.append(current)
            current = "    " + piece
    lines.append(current)
    return lines


def src_url(url: str) -> list[str]:
    single = f"  src: url('{url}') format('woff2');"
    if len(single) <= WIDTH:
        return [single]
    return [f"  src: url('{url}')", "    format('woff2');"]


def css_comment(text: str) -> list[str]:
    words, lines, current = text.split(), [], "/*"
    for word in words:
        if len(current) + 1 + len(word) > WIDTH - 3:
            lines.append(current)
            current = " *"
        current += " " + word
    lines.append(current + " */")
    return lines


def render_css(families: list) -> str:
    unicode_range = comma_list("unicode-range", unicode_range_css(cfg.UNICODE_RANGES))
    out = [CSS_HEADER]
    for fam in families:
        out.append(f"/* ---------- {fam['family']} : {fam['role']} ---------- */\n")
        for face in fam["faces"]:
            out.extend(css_comment(f"{fam['credit']}. {face['note']}"))
            out.append("@font-face {")
            out.append(f"  font-family: '{fam['family']}';")
            out.append(f"  font-style: {face['style']};")
            out.append(f"  font-weight: {face['weight']};")
            out.append("  font-display: swap;")
            out.extend(src_url(face["url"]))
            out.extend(unicode_range)
            if face.get("normalize_metrics"):
                m = face["metrics"]
                out.append(f"  ascent-override: {pct(m['ascent'])};")
                out.append(f"  descent-override: {pct(m['descent'])};")
                out.append(f"  line-gap-override: {pct(m['line_gap'])};")
            out.append("}\n")
        out.extend(css_comment(fam["fallback_note"]))
        for rule in fam["fallback_rules"]:
            out.append("@font-face {")
            out.append(f"  font-family: '{fam['fallback_family']}';")
            out.append(f"  font-style: {rule['style']};")
            out.append(f"  font-weight: {rule['weight']};")
            out.extend(comma_list("src", [f"local('{name}')" for name in rule["locals"]]))
            out.append(f"  size-adjust: {pct(rule['size_adjust'])};")
            out.append(f"  ascent-override: {pct(rule['ascent'])};")
            out.append(f"  descent-override: {pct(rule['descent'])};")
            out.append(f"  line-gap-override: {pct(rule['line_gap'])};")
            out.append("}\n")
    return "\n".join(out).rstrip("\n") + "\n"


def render_preloads(urls: list[str]) -> str:
    lines = [
        "---",
        "// Précharge les polices de la première vue : les titres (Fraunces) et le texte",
        "// courant (Atkinson Hyperlegible Next). Les autres fichiers se chargent quand",
        "// une page en a besoin. Fichier généré par `npm run fonts:build` : ne pas le",
        "// modifier à la main.",
        "---",
        "",
    ]
    for url in urls:
        attributes = ['rel="preload"', f'href="{url}"', 'as="font"', 'type="font/woff2"']
        attributes.append("crossorigin")
        single = f"<link {' '.join(attributes)} />"
        if len(single) <= WIDTH:
            lines.append(single)
        else:  # même mise en page que Prettier : un attribut par ligne
            lines.extend(["<link", *[f"  {a}" for a in attributes], "/>"])
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# Bilan
# ---------------------------------------------------------------------------
def describe_ranges(cps: list[int]) -> str:
    if not cps:
        return "aucun"
    return " ".join(unicode_range_css([(cp, cp) for cp in cps]))


def axes_label(font: TTFont) -> str:
    if "fvar" not in font:
        return "fixe"
    return ", ".join(f"{a.axisTag} {a.minValue:g}-{a.maxValue:g}" for a in font["fvar"].axes)


def main() -> int:
    parser = argparse.ArgumentParser(description="Construit les polices du site.")
    parser.add_argument("--offline", action="store_true", help="n'utiliser que le cache")
    parser.add_argument("--check", action="store_true", help="comparer sans rien écrire")
    args = parser.parse_args()

    if samples_sha256(cfg.SAMPLES) != cfg.FALLBACK_SAMPLES_SHA256:
        raise SystemExit(
            "Les textes de référence (SAMPLES) ont changé : relancer "
            "scripts/fonts/measure_fallbacks.py sur un Mac et recopier ses valeurs "
            "dans fonts_config.py."
        )
    cache = Cache(CACHE_DIR, offline=args.offline)
    blobs = {key: cache.get(key, s["url"], s["sha256"]) for key, s in cfg.SOURCES.items()}
    for key, m in cfg.ARCHIVE_MEMBERS.items():
        blobs[key] = zip_member(blobs[m["archive"]], m["member"], m["sha256"])

    outputs: dict[Path, bytes] = {}
    families, preloads, report, missing_report = [], [], [], []
    for fam in cfg.FAMILIES:
        folder = PUBLIC_FONTS / fam["slug"]
        for key, filename in fam["licenses"]:
            outputs[folder / filename] = blobs[key]
        built_faces, faces = [], []
        for face in fam["faces"]:
            built = build_face(face, blobs[face["source"]])
            check_metadata(built["font"], face["file_stem"])
            filename = f"{face['file_stem']}-{sha256(built['woff2'])[:8]}.woff2"
            url = f"/{(folder / filename).relative_to('public').as_posix()}"
            outputs[folder / filename] = built["woff2"]
            entry = dict(face, url=url)
            if face.get("normalize_metrics"):
                font, upm = built["font"], built["font"]["head"].unitsPerEm
                entry["metrics"] = {
                    "ascent": font["hhea"].ascent / upm,
                    "descent": -font["hhea"].descent / upm,
                    "line_gap": font["hhea"].lineGap / upm,
                }
            faces.append(entry)
            built_faces.append(built)
            if face.get("preload"):
                preloads.append(url)
            report.append((
                str(folder / filename),
                len(built["woff2"]),
                sha256(built["woff2"]),
                len(built["font"].getGlyphOrder()),
                axes_label(built["font"]),
            ))
            source_name = built["source"]["name"]
            family = source_name.getDebugName(16) or source_name.getDebugName(1)
            version = source_name.getDebugName(5).split(";")[0]
            label = f"{family} {face['style']} ({version})"
            missing_report.append((label, describe_ranges(built["missing"])))
        rules = [fallback_rule(rule, built_faces, fam["sample"]) for rule in fam["fallbacks"]]
        families.append(dict(fam, faces=faces, fallback_rules=rules))

    outputs[CSS_PATH] = render_css(families).encode("utf-8")
    outputs[PRELOADS_PATH] = render_preloads(preloads).encode("utf-8")

    # Tout public/fonts/ appartient à cette chaîne ; seuls les fichiers cachés
    # (.DS_Store…) sont laissés de côté.
    existing = {
        p.relative_to(ROOT)
        for p in (ROOT / PUBLIC_FONTS).rglob("*")
        if p.is_file() and not p.name.startswith(".")
    }
    stale = sorted(existing - set(outputs))

    if args.check:
        changed = [
            p for p, data in outputs.items()
            if not (ROOT / p).exists() or (ROOT / p).read_bytes() != data
        ]
        for p in changed:
            print(f"différent ou absent : {p}")
        for p in stale:
            print(f"en trop : {p}")
        if changed or stale:
            print("Les fichiers ne correspondent pas à la construction.")
            return 1
        print(f"Les {len(outputs)} fichiers générés sont identiques à la construction.")
        return 0

    for p in stale:
        (ROOT / p).unlink()
    for p, data in outputs.items():
        target = ROOT / p
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists() or target.read_bytes() != data:
            target.write_bytes(data)
    for folder in sorted((ROOT / PUBLIC_FONTS).rglob("*"), reverse=True):
        if folder.is_dir() and not any(folder.iterdir()):
            folder.rmdir()  # dossier d'une famille retirée de fonts_config.py

    print("Polices écrites :")
    total = 0
    for path, size, digest, glyphs, axes in report:
        total += size
        print(f"  {path}\n    {size} octets, {glyphs} glyphes, axes : {axes}\n    sha256 {digest}")
    print(f"  Total : {total} octets ({total / 1024:.1f} Kio)")
    print("Caractères demandés absents des polices sources :")
    for label, text in missing_report:
        print(f"  {label} : {text}")
    print("Polices de secours :")
    for fam in families:
        for rule in fam["fallback_rules"]:
            print(
                f"  {fam['fallback_family']} {rule['weight']} {rule['style']} "
                f"({rule['locals'][0]}) : size-adjust {pct(rule['size_adjust'])}, "
                f"ascent {pct(rule['ascent'])}, descent {pct(rule['descent'])}, "
                f"line-gap {pct(rule['line_gap'])}"
            )
    print(f"Fichiers générés : {CSS_PATH}, {PRELOADS_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
