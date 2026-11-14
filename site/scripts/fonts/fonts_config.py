"""Réglages de la chaîne des polices (lus par build.py et measure_fallbacks.py).

Tout ce qui décide du résultat est ici : sources épinglées (adresse + empreinte
SHA-256), jeu de caractères, fonctions OpenType gardées, axes variables,
noms de fichiers et polices de secours. Le détail des choix est dans docs/fonts.md.
"""

# ---------------------------------------------------------------------------
# Jeu de caractères : latin de base et français.
# Les mêmes plages servent au découpage des fichiers et au descripteur
# unicode-range de fonts.css.
# ---------------------------------------------------------------------------
UNICODE_RANGES = [
    (0x0020, 0x007E),  # latin de base
    (0x00A0, 0x00FF),  # latin-1 : lettres accentuées, « », espace insécable, ×
    (0x0152, 0x0153),  # Œ œ
    (0x0178, 0x0178),  # Ÿ
    (0x02C6, 0x02C6),  # ˆ
    (0x02DA, 0x02DA),  # ˚
    (0x02DC, 0x02DC),  # ˜
    (0x2009, 0x200A),  # espace fine, espace ultrafine
    (0x2010, 0x2011),  # trait d'union, trait d'union insécable
    (0x2013, 0x2014),  # tirets demi-cadratin et cadratin
    (0x2018, 0x201A),  # ‘ ’ ‚
    (0x201C, 0x201E),  # “ ” „
    (0x2022, 0x2022),  # puce
    (0x2026, 0x2026),  # points de suspension
    (0x202F, 0x202F),  # espace fine insécable (« … », ; : ! ?, 1 000 €)
    (0x2039, 0x203A),  # ‹ ›
    (0x20AC, 0x20AC),  # €
    (0x2122, 0x2122),  # ™
    (0x2190, 0x2193),  # flèches
    (0x2212, 0x2212),  # signe moins
    (0x2248, 0x2248),  # ≈
]

# Fonctions OpenType conservées (les autres sont retirées des fichiers).
LAYOUT_FEATURES = [
    "kern", "liga", "calt", "ccmp", "locl", "mark", "mkmk",
    "tnum", "lnum", "pnum", "case",
]

# Textes de référence pour mesurer la chasse moyenne des polices (réglage des
# polices de secours). Mots tirés du cahier des charges ; jamais affichés.
SAMPLES = {
    # Titres et texte courant : des phrases.
    "texte": (
        "HAKO garde les photos et les fichiers de la famille à la maison. "
        "Nous installons la box chez vous, nous vous formons et nous restons à vos côtés. "
        "Achat unique, sans abonnement : la box, l’installation à domicile, la formation "
        "sur place et le déménageur, qui vous aide à rapatrier vos photos depuis Google Photos "
        "ou iCloud. Chaque box crée ses propres secrets au premier démarrage. Nous n’avons pas "
        "accès à vos données. Aucun port n’est ouvert vers internet. Nous intervenons de "
        "Salon-de-Provence à Toulon, en passant par Aix-en-Provence et Marseille."
    ),
    # Étiquettes, navigation, boutons et prix (D-DIN) : des mots courts et des chiffres.
    "interface": (
        "Offres La box Notre engagement FAQ Contact Commander Menu Tutoriels "
        "Hako Home Hako Pro 600 € 1 000 € 25 €/mois 1 To 2 To 4 To "
        "Mentions légales Confidentialité Conditions générales de vente Aller au contenu"
    ),
}

# ---------------------------------------------------------------------------
# Sources officielles, épinglées : un fichier qui change fait échouer la
# construction (empreinte SHA-256 différente).
# ---------------------------------------------------------------------------
FRAUNCES_COMMIT = "7ccdec31c6028118dce3e47fe864e3744460371d"
ATKINSON_COMMIT = "7925f50f649b3813257faf2f4c0b381011f434f1"

SOURCES = {
    # Fraunces 1.003 : dépôt officiel d'Undercase Type, commit du 21 octobre 2025.
    "fraunces-vf": {
        "url": "https://raw.githubusercontent.com/undercasetype/Fraunces/"
        f"{FRAUNCES_COMMIT}/fonts/variable/Fraunces%5BSOFT,WONK,opsz,wght%5D.ttf",
        "sha256": "0776a870a0856b296e11639505ac0cf9be5e7800bb1849dfa21a1bd182455fc0",
    },
    "fraunces-ofl": {
        "url": "https://raw.githubusercontent.com/undercasetype/Fraunces/"
        f"{FRAUNCES_COMMIT}/OFL.txt",
        "sha256": "bdf4c22802eaf804f998195871c6b8938aac2ac14b2d78a8bd66a6f1eced833b",
    },
    # Atkinson Hyperlegible Next 2.001 : dépôt googlefonts/atkinson-hyperlegible-next,
    # commit du 21 février 2025 (celui que cite Google Fonts).
    "atkinson-vf": {
        "url": "https://raw.githubusercontent.com/googlefonts/atkinson-hyperlegible-next/"
        f"{ATKINSON_COMMIT}/fonts/variable/AtkinsonHyperlegibleNext%5Bwght%5D.ttf",
        "sha256": "5a455d1cfa099b601ab70751bb9673e8fe1854dc4500c80e1a220d0d75e31745",
    },
    "atkinson-italic": {
        "url": "https://raw.githubusercontent.com/googlefonts/atkinson-hyperlegible-next/"
        f"{ATKINSON_COMMIT}/fonts/ttf/AtkinsonHyperlegibleNext-Italic.ttf",
        "sha256": "b7f8f03ceb28ebadb2de2332b2e869a00e8dbfb5c8e00fdbb06385770c8227e7",
    },
    "atkinson-ofl": {
        "url": "https://raw.githubusercontent.com/googlefonts/atkinson-hyperlegible-next/"
        f"{ATKINSON_COMMIT}/OFL.txt",
        "sha256": "aca6a428580965d2297d1b718042dd427c2a9443ece3b0d02d758e161e0c4030",
    },
    # D-DIN 1.00 : archive déposée par le compte « Datto Fonts » sur fontlibrary.org
    # (2 novembre 2017) ; la page de Datto n'existe plus.
    "d-din-zip": {
        "url": "https://fontlibrary.org/assets/downloads/d-din/"
        "39fc8c3de156292478f87c2ff0b96df2/d-din.zip",
        "sha256": "d095789cc511d03e3e78e4e4129a662703b5685720cb11dbebe2d911d0daf674",
    },
}

# Fichiers lus dans une archive (en mémoire), chacun vérifié par son empreinte.
ARCHIVE_MEMBERS = {
    "d-din-bold-woff2": {
        "archive": "d-din-zip",
        "member": "D-DIN-Bold.woff2",
        "sha256": "9007288706aafe9616f96be4e856fe91722056c40ea579bbfcd95993a6e82e34",
    },
    "d-din-ofl": {
        "archive": "d-din-zip",
        "member": "OFL-1.1.txt",
        "sha256": "59e505e11e6da3ac3020eb6b4163f4d0382524183db660bf52a08234c764b2e5",
    },
    "d-din-fontlog": {
        "archive": "d-din-zip",
        "member": "FONTLOG.txt",
        "sha256": "e1e2e114db6aed0269e7f907bc0b2bd0da18c05b6339a8f712d3645d5d7e043f",
    },
}

# ---------------------------------------------------------------------------
# Familles et fichiers produits.
#
# method « subset » : police découpée au jeu de caractères ci-dessus, sans
#   hinting, compressée en WOFF2. « axes » fige ou restreint des axes
#   variables (valeur seule = figé ; (min, défaut, max) = restreint).
# method « copy » : fichier WOFF2 officiel servi tel quel, sans aucune
#   modification (obligatoire pour D-DIN, voir docs/fonts.md).
#
# Le nom de fichier final reçoit les 8 premiers caractères de son empreinte :
# un fichier modifié change de nom et ne peut pas rester en cache par erreur.
# ---------------------------------------------------------------------------
FAMILIES = [
    {
        "slug": "fraunces",
        "family": "Fraunces",
        "role": "titres",
        "sample": "texte",
        "credit": "Fraunces 1.003, Undercase Type, SIL OFL 1.1",
        "licenses": [("fraunces-ofl", "OFL.txt")],
        "faces": [
            {
                "source": "fraunces-vf",
                "method": "subset",
                "file_stem": "fraunces-1.003-latin-fr",
                # WONK et SOFT figés aux valeurs du jeton --font-display-variation ;
                # graisse restreinte à 400-700 ; taille optique (opsz) gardée en entier.
                "axes": {"WONK": 0, "SOFT": 100, "wght": (400, 400, 700)},
                # WONK figé à 0 : les formes « sages » de h, m, n… deviennent les
                # formes par défaut (substitution rvrn appliquée dans la table cmap).
                "bake_rvrn": True,
                # Noms internes mis à jour d'après la table STAT de la police :
                # « Fraunces SuperSoft NonWonky » (SOFT 100, WONK 0).
                "update_names": True,
                "style": "normal",
                "weight": "400 700",
                "preload": True,
                "note": "Fichier variable : graisse 400 à 700 et taille optique (opsz) 9 à 144. "
                "SOFT figé à 100 et WONK à 0, les valeurs du jeton --font-display-variation.",
            }
        ],
        "fallback_family": "Fraunces Fallback",
        "fallback_note": "Secours pour Fraunces : Georgia, ou Times New Roman si Georgia manque, "
        "ajustées aux mesures de Fraunces à la taille optique 48 (graisses 400 et 600).",
        # Mesures faites sur Fraunces à la taille optique 48 (titres moyens).
        # Pour un même style, la dernière règle est essayée en premier : la police
        # de secours principale vient donc après la police de remplacement.
        "fallbacks": [
            {"weight": "400 500", "style": "normal", "match": {"wght": 400, "opsz": 48},
             "locals": ["Times New Roman"]},
            {"weight": "400 500", "style": "normal", "match": {"wght": 400, "opsz": 48},
             "locals": ["Georgia"]},
            {"weight": "600 700", "style": "normal", "match": {"wght": 600, "opsz": 48},
             "locals": ["Times New Roman Bold"]},
            {"weight": "600 700", "style": "normal", "match": {"wght": 600, "opsz": 48},
             "locals": ["Georgia Bold"]},
        ],
    },
    {
        "slug": "atkinson-hyperlegible-next",
        "family": "Atkinson Hyperlegible Next",
        "role": "texte courant",
        "sample": "texte",
        "credit": "Atkinson Hyperlegible Next 2.001, Braille Institute, SIL OFL 1.1",
        "licenses": [("atkinson-ofl", "OFL.txt")],
        "faces": [
            {
                "source": "atkinson-vf",
                "method": "subset",
                "file_stem": "atkinson-hyperlegible-next-2.001-latin-fr",
                "axes": {"wght": (400, 400, 700)},
                "style": "normal",
                "weight": "400 700",
                "preload": True,
                "note": "Fichier variable : graisse 400 à 700 (un seul fichier pour le normal "
                "et le gras, plus léger que deux fichiers fixes).",
            },
            {
                "source": "atkinson-italic",
                "method": "subset",
                "file_stem": "atkinson-hyperlegible-next-2.001-italic-latin-fr",
                "style": "italic",
                "weight": "400",
                "note": "Italique 400, chargé seulement si une page en affiche.",
            },
        ],
        "fallback_family": "Atkinson Hyperlegible Next Fallback",
        "fallback_note": "Secours pour Atkinson Hyperlegible Next : Arial, ou Helvetica (mêmes "
        "chasses), ajustées aux mesures d'Atkinson Hyperlegible Next 400, 700 et italique.",
        "fallbacks": [
            {"weight": "400 500", "style": "normal", "match": {"wght": 400},
             "locals": ["Arial", "Helvetica"]},
            {"weight": "600 700", "style": "normal", "match": {"wght": 700},
             "locals": ["Arial Bold", "Helvetica Bold"]},
            {"weight": "400", "style": "italic", "match": {}, "face": 1,
             "locals": ["Arial Italic", "Helvetica Oblique"]},
        ],
    },
    {
        "slug": "d-din",
        "family": "D-DIN",
        "role": "étiquettes, navigation, boutons, prix",
        "sample": "interface",
        "credit": "D-DIN 1.00, Datto, SIL OFL 1.1",
        "licenses": [("d-din-ofl", "OFL-1.1.txt"), ("d-din-fontlog", "FONTLOG.txt")],
        "faces": [
            {
                "source": "d-din-bold-woff2",
                "method": "copy",
                "file_stem": "d-din-1.00-bold",
                "style": "normal",
                "weight": "700",
                # Mêmes mesures verticales sur tous les systèmes : sans cela, Windows
                # peut lire usWinAscent/usWinDescent, différents de hhea dans cette police.
                "normalize_metrics": True,
                "note": "Fichier officiel de Datto servi tel quel, sans découpage : le nom "
                "« D-DIN » est réservé et une version modifiée devrait en changer. Mesures "
                "verticales fixées pour un rendu identique sur tous les systèmes.",
            }
        ],
        "fallback_family": "D-DIN Fallback",
        "fallback_note": "Secours pour D-DIN : Arial Narrow Bold, ou Arial Bold si Arial Narrow "
        "manque, ajustées aux mesures de D-DIN Bold.",
        "fallbacks": [
            {"weight": "700", "style": "normal", "match": {}, "locals": ["Arial Bold"]},
            {"weight": "700", "style": "normal", "match": {}, "locals": ["Arial Narrow Bold"]},
        ],
    },
]

# ---------------------------------------------------------------------------
# Polices installées servant de secours, mesurées avec measure_fallbacks.py
# sur les fichiers de macOS 27.3 (les versions Windows n'ont pas été mesurées).
# avg_width : chasse moyenne de chaque texte de SAMPLES, en em.
# ---------------------------------------------------------------------------
FALLBACK_SAMPLES_SHA256 = "2c6c9ec0f1bd45030825ecff0c0f01bb0a08ae95162a55a9696e164b3a52a4eb"
FALLBACK_METRICS = {
    "Georgia": {
        "full_name": "Georgia",
        "postscript": "Georgia",
        "version": "Version 5.00x-4",
        "file": "/System/Library/Fonts/Supplemental/Georgia.ttf",
        "avg_width": {
            "interface": 0.470081,
            "texte": 0.441775,
        },
    },
    "Georgia Bold": {
        "full_name": "Georgia Bold",
        "postscript": "Georgia-Bold",
        "version": "Version 5.00x-4",
        "file": "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
        "avg_width": {
            "interface": 0.541697,
            "texte": 0.514509,
        },
    },
    "Times New Roman": {
        "full_name": "Times New Roman",
        "postscript": "TimesNewRomanPSMT",
        "version": "Version 5.01.4x",
        "file": "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
        "avg_width": {
            "interface": 0.431345,
            "texte": 0.404691,
        },
    },
    "Times New Roman Bold": {
        "full_name": "Times New Roman Bold",
        "postscript": "TimesNewRomanPS-BoldMT",
        "version": "Version 5.01.4x",
        "file": "/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf",
        "avg_width": {
            "interface": 0.454168,
            "texte": 0.428023,
        },
    },
    "Arial": {
        "full_name": "Arial",
        "postscript": "ArialMT",
        "version": "Version 5.01.2x",
        "file": "/System/Library/Fonts/Supplemental/Arial.ttf",
        "avg_width": {
            "interface": 0.472344,
            "texte": 0.450247,
        },
    },
    "Arial Bold": {
        "full_name": "Arial Bold",
        "postscript": "Arial-BoldMT",
        "version": "Version 5.01.2x",
        "file": "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "avg_width": {
            "interface": 0.50011,
            "texte": 0.483762,
        },
    },
    "Arial Italic": {
        "full_name": "Arial Italic",
        "postscript": "Arial-ItalicMT",
        "version": "Version 5.00.2x",
        "file": "/System/Library/Fonts/Supplemental/Arial Italic.ttf",
        "avg_width": {
            "interface": 0.472344,
            "texte": 0.450247,
        },
    },
    "Arial Narrow Bold": {
        "full_name": "Arial Narrow Bold",
        "postscript": "ArialNarrow-Bold",
        "version": "Version 2.38.1x",
        "file": "/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf",
        "avg_width": {
            "interface": 0.410132,
            "texte": 0.396738,
        },
    },
    "Helvetica": {
        "full_name": "Helvetica",
        "postscript": "Helvetica",
        "version": "22.0d2e1",
        "file": "/System/Library/Fonts/Helvetica.ttc (n° 0)",
        "avg_width": {
            "interface": 0.475095,
            "texte": 0.450247,
        },
    },
    "Helvetica Bold": {
        "full_name": "Helvetica Bold",
        "postscript": "Helvetica-Bold",
        "version": "22.0d2e1",
        "file": "/System/Library/Fonts/Helvetica.ttc (n° 1)",
        "avg_width": {
            "interface": 0.502861,
            "texte": 0.483762,
        },
    },
    "Helvetica Oblique": {
        "full_name": "Helvetica Oblique",
        "postscript": "Helvetica-Oblique",
        "version": "22.0d2e1",
        "file": "/System/Library/Fonts/Helvetica.ttc (n° 2)",
        "avg_width": {
            "interface": 0.475095,
            "texte": 0.450247,
        },
    },
}
