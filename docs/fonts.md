# Polices du site

Le site utilise trois familles de polices, toutes servies depuis notre propre serveur (`public/fonts/`) : aucune requête ne part vers un autre site. Les fichiers sont produits par `npm run fonts:build` à partir des sources officielles des créateurs, téléchargées à des versions épinglées et vérifiées par empreinte SHA-256.

La commande écrit aussi deux fichiers du code, à ne pas modifier à la main : `src/styles/fonts.css` (toutes les règles `@font-face`) et `src/components/FontPreloads.astro` (préchargement des deux polices de la première vue). Les réglages sont dans `scripts/fonts/fonts_config.py`.

Sources et licences vérifiées le 12 novembre 2026.

## Les trois familles

| Rôle                                  | Famille (nom CSS)            | Version et source        | Fichier servi                                                                                                       | Taille        |
| ------------------------------------- | ---------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------- |
| Titres                                | `Fraunces`                   | 1.003, Undercase Type    | `fraunces/fraunces-1.003-latin-fr-a093887f.woff2`, variable : taille optique (opsz) 9 à 144, graisse 400 à 700      | 57 788 octets |
| Texte courant                         | `Atkinson Hyperlegible Next` | 2.001, Braille Institute | `atkinson-hyperlegible-next/atkinson-hyperlegible-next-2.001-latin-fr-9c6e8230.woff2`, variable : graisse 400 à 700 | 19 064 octets |
| Texte courant, italique               | `Atkinson Hyperlegible Next` | 2.001, Braille Institute | `atkinson-hyperlegible-next/atkinson-hyperlegible-next-2.001-italic-latin-fr-f8355c87.woff2`, italique 400          | 12 748 octets |
| Étiquettes, navigation, boutons, prix | `D-DIN`                      | 1.00, Datto              | `d-din/d-din-1.00-bold-90072887.woff2`, gras (700), fichier officiel inchangé                                       | 22 052 octets |

Total : 111 652 octets (109 Kio). Le navigateur ne télécharge un fichier que si la page en a besoin : l'italique, par exemple, ne se charge que sur une page qui en affiche. Sur les pages testées (accueil, offres, charte, à 390 et 1440 px de large), trois fichiers sont chargés, chacun une seule fois, sans autre requête que vers le site lui-même.

Chaque dossier de famille contient sa licence telle que publiée : `fraunces/OFL.txt`, `atkinson-hyperlegible-next/OFL.txt`, `d-din/OFL-1.1.txt` et `d-din/FONTLOG.txt`.

## Sources et empreintes

Fraunces vient du dépôt officiel d'Undercase Type, au commit `7ccdec31c6028118dce3e47fe864e3744460371d` (fusion du 21 octobre 2025) :

- police variable : `https://raw.githubusercontent.com/undercasetype/Fraunces/7ccdec31c6028118dce3e47fe864e3744460371d/fonts/variable/Fraunces%5BSOFT,WONK,opsz,wght%5D.ttf`, SHA-256 `0776a870a0856b296e11639505ac0cf9be5e7800bb1849dfa21a1bd182455fc0`
- licence : `…/7ccdec31c6028118dce3e47fe864e3744460371d/OFL.txt`, SHA-256 `bdf4c22802eaf804f998195871c6b8938aac2ac14b2d78a8bd66a6f1eced833b`
- mention de copyright de la licence : « Copyright 2018 The Fraunces Project Authors (https://github.com/undercasetype/Fraunces) » ; dans la police : « Copyright 2020 The Fraunces Project Authors (github.com/undercasetype/Fraunces) »

Atkinson Hyperlegible Next vient du dépôt `googlefonts/atkinson-hyperlegible-next` (le dépôt de fabrication, archivé, celui que cite Google Fonts), au commit `7925f50f649b3813257faf2f4c0b381011f434f1` (21 février 2025) :

- police variable : `https://raw.githubusercontent.com/googlefonts/atkinson-hyperlegible-next/7925f50f649b3813257faf2f4c0b381011f434f1/fonts/variable/AtkinsonHyperlegibleNext%5Bwght%5D.ttf`, SHA-256 `5a455d1cfa099b601ab70751bb9673e8fe1854dc4500c80e1a220d0d75e31745`
- italique : `…/fonts/ttf/AtkinsonHyperlegibleNext-Italic.ttf`, SHA-256 `b7f8f03ceb28ebadb2de2332b2e869a00e8dbfb5c8e00fdbb06385770c8227e7`
- licence : `…/OFL.txt`, SHA-256 `aca6a428580965d2297d1b718042dd427c2a9443ece3b0d02d758e161e0c4030` (identique à la copie de Google Fonts)
- mention de copyright : « Copyright 2020-2024 The Atkinson Hyperlegible Next Project Authors (https://github.com/googlefonts/atkinson-hyperlegible-next) »

D-DIN vient de l'archive déposée par le compte « Datto Fonts » sur fontlibrary.org le 2 novembre 2017. La page de Datto (`https://www.datto.com/fonts/d-din`) ne répond plus : 404 dans les archives de la Wayback Machine depuis avril 2024, 403 lors de notre essai. Les quatre fichiers utilisés sont identiques octet pour octet à ceux du dépôt `github.com/amcchord/datto-d-din` (commit `e199c8441e758d6e492cd01ef52c3c67ba4bae26`), ce qui recoupe les empreintes.

- archive : `https://fontlibrary.org/assets/downloads/d-din/39fc8c3de156292478f87c2ff0b96df2/d-din.zip`, SHA-256 `d095789cc511d03e3e78e4e4129a662703b5685720cb11dbebe2d911d0daf674`
- `D-DIN-Bold.woff2` (servi tel quel) : SHA-256 `9007288706aafe9616f96be4e856fe91722056c40ea579bbfcd95993a6e82e34`
- `OFL-1.1.txt` : SHA-256 `59e505e11e6da3ac3020eb6b4163f4d0382524183db660bf52a08234c764b2e5`
- `FONTLOG.txt` : SHA-256 `e1e2e114db6aed0269e7f907bc0b2bd0da18c05b6339a8f712d3645d5d7e043f`
- mention de la licence : « Copyright (C) 2017 Datto Inc. https://www.datto.com/fonts/d-din, with Reserved Font Names "D-DIN". » (et de même pour « D-DIN Condensed » et « D-DIN Expanded »)

## Licences et noms réservés

Les trois polices sont sous SIL Open Font License 1.1 (OFL). Cette licence permet de modifier et de redistribuer une police. L'auteur peut toutefois déclarer des « noms réservés » (Reserved Font Names) juste après la mention de copyright : une version modifiée ne peut alors pas porter ce nom.

La FAQ officielle de l'OFL (version 1.1-update8, novembre 2026, https://openfontlicense.org/ofl-faq/) range le découpage et la conversion parmi les modifications :

> 2.2 […] A change in font format normally is considered modification, and Reserved Font Names (RFNs) cannot be used. Because of the design of the WOFF and WOFF2 formats, however, it is possible to create a WOFF/WOFF2 version that is not considered modification, and so would not require a name change.

> 2.2.1 You are allowed to create, use and distribute a WOFF version of an OFL font without changing the font name, but only if the original font data remains unchanged except for WOFF compression, and WOFF-specific metadata is either omitted altogether or present and includes, unaltered, the contents of all equivalent metadata in the original font.

> 2.6 Is subsetting a webfont considered modification? Yes. Removing any parts of the font when delivering a webfont to a browser, including unused glyphs and smart font code, is considered modification. This is permitted by the OFL but would not normally allow the use of RFNs.

Le document « Webfonts and Reserved Font Names » (https://openfontlicense.org/webfonts-and-reserved-font-names/, mis à jour le 9 novembre 2026) le confirme pour les sous-ensembles préparés à l'avance, comme les nôtres :

> Because these subsets do not deliver complete functionality, and complete character set support in particular, it is not possible to preserve FE, and so pre-subsetting needs to be considered a Modified Version for which RFN restrictions apply.

et cite, parmi les solutions possibles : « Host the Original Version without any changes at all. »

Conclusion, famille par famille :

- Fraunces : la licence ne déclare aucun nom réservé. Notre fichier découpé garde le nom Fraunces. Ses noms internes ont été mis à jour par fontTools d'après la table STAT de la police (« Fraunces SuperSoft NonWonky ») ; le copyright et la licence restent dans le fichier.
- Atkinson Hyperlegible Next : la licence du dépôt GitHub ne déclare aucun nom réservé ; notre fichier découpé garde donc le nom. Attention : la version téléchargeable sur brailleinstitute.org/freefont (derrière un formulaire qui demande une adresse e-mail, que nous n'avons pas rempli) est accompagnée d'une autre licence. Ce PDF, lié depuis la page sous le nom « End-User License Agreement » (SHA-256 `79f97a4ed4905c414e3e5f3ce7b569ed17ec03c3b73540829cae57e7060dadcf`), déclare : « Copyright 2020, Braille Institute of America, Inc. (https://www.brailleinstitute.org/), with Reserved Font Names: “ATKINSON” and “HYPERLEGIBLE”. » Nous n'utilisons pas cette distribution ; un sous-ensemble fait à partir d'elle devrait changer de nom.
- D-DIN : le nom « D-DIN » est réservé. Un fichier découpé ou converti par nos soins devrait changer de nom. Nous servons donc le fichier WOFF2 publié par Datto, sans aucune modification : il est identique octet pour octet à celui de l'archive officielle, et ses glyphes sont identiques à ceux du fichier TTF de la même archive (comparaison glyphe par glyphe avec fontTools). Les réglages `ascent-override`, `descent-override` et `line-gap-override` de `fonts.css` sont des instructions CSS : le fichier lui-même n'est pas touché.

Aucun changement de nom n'est donc nécessaire : les familles CSS s'appellent exactement `Fraunces`, `Atkinson Hyperlegible Next` et `D-DIN`.

Deux points restent à connaître. La page du Braille Institute écrit « Atkinson Hyperlegible® » : c'est une marque. La FAQ de l'OFL (entrée 3.7) précise : « Trademarks work alongside the OFL and are not subject to the terms of the licensing agreement. The OFL does not grant any rights under trademark law. » Nous n'utilisons ce nom que pour désigner la police (nom de famille CSS, crédits) ; ce point relève du droit des marques et n'a pas été vérifié par un juriste. Ensuite, la licence d'origine de l'Atkinson Hyperlegible de 2020 (version 1.02, lue dans la police de l'archive du Braille Institute du 14 mai 2020, conservée par la Wayback Machine) interdisait toute modification : « Braille Institute of America, Inc. provides Atkinson Hyperlegible for use, without derivatives or alteration […] ». Cette version ne pouvait donc pas être découpée. Atkinson Hyperlegible Next, sous OFL, n'a pas cette limite.

## Choix et réglages

Fraunces existe en deux versions officielles. La 1.000 (octobre 2020) est la dernière version étiquetée du dépôt et, d'après le dépôt `google/fonts`, celle que sert encore Google Fonts ; la copie `googlefonts/fraunces` n'a pas bougé depuis 2021. La 1.003 a été fusionnée dans le dépôt d'Undercase Type le 21 octobre 2025 (demande de fusion n° 275) : même licence, avec des corrections (fonction `locl`, accents pour la fonction `case`, codes Unicode manquants, tracé du g alternatif). Nous prenons la 1.003, épinglée par son commit et son empreinte puisqu'elle n'a pas d'étiquette de version.

Fraunces a quatre axes variables. Garder les quatre coûte cher ; voici les tailles mesurées (sous-ensemble latin + français, WOFF2) :

| Réglage                                                         | Taille         |
| --------------------------------------------------------------- | -------------- |
| Quatre axes, WONK figé à 0                                      | 127 456 octets |
| WONK 0, graisse 400 à 700, SOFT et opsz gardés                  | 109 812 octets |
| WONK 0, opsz figé à 36, graisse 400 à 700, SOFT gardé           | 59 724 octets  |
| WONK 0, SOFT figé à 100, graisse 400 à 700, opsz gardé (retenu) | 57 788 octets  |

Nous figeons SOFT à 100 et WONK à 0, les valeurs du jeton `--font-display-variation`, et gardons la taille optique entière : le navigateur choisit lui-même le dessin adapté à chaque taille de titre (`font-optical-sizing: auto`), ce qui change nettement la chasse et le contraste entre un titre de 24 px et un titre de 76 px. Avec WONK figé à 0, les formes « sages » de h, m, n, s, & et ñ deviennent les formes par défaut directement dans la table des caractères : le rendu ne dépend plus de la fonction `rvrn` du navigateur. Le réglage `font-variation-settings: 'SOFT' 100, 'WONK' 0` reste sans effet sur notre fichier (ces axes n'y existent plus) et sans danger. Si l'équipe veut un jour faire varier SOFT, il suffit de retirer `"SOFT": 100` dans `fonts_config.py` (environ 52 Ko de plus).

Pour Atkinson Hyperlegible Next, un fichier variable limité à 400-700 (19 064 octets) pèse moins que deux fichiers fixes normal et gras (10 688 + 11 156 octets) et donne aussi les graisses intermédiaires. L'italique est un fichier fixe 400 de 12 748 octets ; un texte en gras italique serait épaissi par le navigateur.

Pour D-DIN, nous avons comparé avec DINish (https://github.com/playbeing/dinish, version 4.007, OFL sans nom réservé), dérivé de D-DIN. DINish a des chiffres tabulaires, le signe moins U+2212 et d'autres graisses ; son gras découpé pèserait environ 8,6 Ko. Nous gardons D-DIN, demandé par le cahier des charges, servi tel quel pour respecter son nom réservé. Ses limites : pas de chiffres tabulaires (un prix qui change de valeur change légèrement de largeur), pas de signe moins, fichier non découpé et avec hinting (22 Ko). Le passage à DINish demanderait de changer le nom de famille CSS dans `tokens.css`.

Le découpage garde ces caractères : U+0020-007E, U+00A0-00FF (dont U+00D7 ×), U+0152-0153, U+0178, U+02C6, U+02DA, U+02DC, U+2009-200A, U+2010-2011, U+2013-2014, U+2018-201A, U+201C-201E, U+2022, U+2026, U+202F, U+2039-203A, U+20AC, U+2122, U+2190-2193, U+2212, U+2248. Les mêmes plages forment le descripteur `unicode-range`. Fonctions OpenType gardées quand la police les a : kern, liga, calt, ccmp, locl, mark, mkmk, tnum, lnum, pnum, case. Après découpage, Fraunces garde case, liga, locl et kern ; Atkinson garde case, locl, pnum, tnum et kern. Le hinting (instructions d'affichage pour les petits écrans) est retiré : les navigateurs actuels s'en passent et il pesait plus d'un tiers des fichiers d'Atkinson. Seul D-DIN, non modifiable, garde le sien.

## Caractères absents et repli

Certains caractères demandés n'existent dans aucune version officielle de ces polices (le bilan de `npm run fonts:build` les liste) :

| Police                                                | Caractères absents                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------- |
| Fraunces 1.003                                        | U+2009, U+200A, U+2011, U+202F, U+2190-2193                         |
| Atkinson Hyperlegible Next 2.001 (normal et italique) | U+00AD, U+00B5, U+200A, U+2010, U+2011, U+202F, U+2190-2193         |
| D-DIN 1.00                                            | U+2009, U+200A, U+2010, U+2011, U+202F, U+2190-2193, U+2212, U+2248 |

Comportement vérifié dans Chromium 158 (Playwright 1.65, sous macOS) avec l'outil des développeurs qui liste les polices réellement utilisées pour chaque élément :

- Les espaces absentes (fine U+2009, ultrafine U+200A, fine insécable U+202F) sont fabriquées à partir de l'espace de la police elle-même, sans autre police : U+202F mesure la moitié de l'espace normale (0,107 em en Fraunces, 0,140 em en Atkinson, 0,115 em en D-DIN), U+200A 1/16 d'em, U+2009 1/5 d'em (Atkinson a sa propre espace fine, 0,140 em). Les guillemets « », les prix comme 1 000 € et la ponctuation double s'affichent donc entièrement dans la police du site.
- Les traits d'union restent dans la police du site : en Fraunces, U+2011 (trait d'union insécable) prend le dessin de U+2010 ; en Atkinson et en D-DIN, qui n'ont ni U+2010 ni U+2011, Chromium dessine les deux avec le trait d'union ordinaire de la police.
- Les autres caractères absents (flèches, µ en Atkinson, signe moins et ≈ en D-DIN) viennent de la police suivante de la pile : Times New Roman pour les flèches en Fraunces (Georgia n'en a pas), Arial pour Atkinson, Arial Narrow Bold pour D-DIN. Pour des flèches, mieux vaut une icône SVG.
- Le trait d'union conditionnel U+00AD est invisible ; le navigateur ne dessine un trait qu'en cas de coupure en fin de ligne (non testé).

Firefox et Safari n'ont pas été testés : seul Chromium est installé pour les tests de ce dépôt.

## Polices de secours (faces « … Fallback »)

Pendant le chargement (`font-display: swap`), le texte s'affiche dans une police déjà installée. Pour que la page ne bouge pas au remplacement, `fonts.css` déclare des faces `Fraunces Fallback`, `Atkinson Hyperlegible Next Fallback` et `D-DIN Fallback` : des polices locales mises à la chasse moyenne (`size-adjust`) et aux hauteurs (`ascent-override`, `descent-override`, `line-gap-override`) de la police du site.

La chasse moyenne est calculée avec fontTools sur un texte de référence pondéré par la fréquence des caractères (phrases du cahier des charges pour les titres et le texte, libellés d'interface et prix pour D-DIN). Les mesures des polices locales sont relevées une fois par `scripts/fonts/measure_fallbacks.py` sur les fichiers de macOS 27.3 (Georgia 5.00x-4, Times New Roman 5.01.4x, Arial 5.01.2x, Arial Italic 5.00.2x, Arial Narrow 2.38.1x, Helvetica 22.0d2e1) et recopiées dans `fonts_config.py` ; les versions Windows n'ont pas été mesurées. Fraunces est mesurée à la taille optique 48 (titres moyens), en graisse 400 et 600.

| Face                                         | Police locale                            | size-adjust         |
| -------------------------------------------- | ---------------------------------------- | ------------------- |
| Fraunces Fallback 400-500                    | Georgia, sinon Times New Roman           | 102,17 % (111,53 %) |
| Fraunces Fallback 600-700                    | Georgia Bold, sinon Times New Roman Bold | 90,59 % (108,89 %)  |
| Atkinson Hyperlegible Next Fallback 400-500  | Arial ou Helvetica                       | 98,73 %             |
| Atkinson Hyperlegible Next Fallback 600-700  | Arial Bold ou Helvetica Bold             | 98,87 %             |
| Atkinson Hyperlegible Next Fallback italique | Arial Italic ou Helvetica Oblique        | 98,74 %             |
| D-DIN Fallback                               | Arial Narrow Bold, sinon Arial Bold      | 107,21 % (87,92 %)  |

Arial et Helvetica ont les mêmes chasses sur le texte de référence, d'où une seule règle. Pour Georgia et Times New Roman, comme pour Arial Narrow et Arial, chaque police a sa propre règle : la règle écrite en dernier est essayée en premier, et si sa police manque, le navigateur prend la précédente avec ses propres mesures (vérifié dans Chromium en rendant Georgia et Arial Narrow introuvables).

Mesures dans Chromium, police de secours comparée à la police du site sur une ligne : même hauteur de ligne dans tous les cas ; largeur à 0,2 % près pour un paragraphe d'Atkinson, à 1,8 % près pour ses autres lignes, à 0,6 % près pour Fraunces à 44 px. Les écarts grandissent sur les textes très courts ou riches en chiffres : +5,4 % pour Fraunces à 76 px (taille optique éloignée de 48), +7 à +9 % pour une ligne D-DIN pleine de prix et de points médians, 0,1 % pour « Commander ». La prise en charge de `ascent-override` et de ses voisins par Safari n'a pas été vérifiée ; s'ils y sont ignorés, seule la largeur est ajustée.

## SOFT et WONK : vérification

Comparaison pixel par pixel dans Chromium, à 76, 32 et 24 px, entre la Fraunces officielle complète et notre fichier :

| Comparaison                                           | Pixels de texte nettement différents |
| ----------------------------------------------------- | ------------------------------------ |
| Officielle SOFT 0 contre officielle SOFT 100 (76 px)  | 71,6 %                               |
| Officielle SOFT 100 contre la nôtre (76 / 32 / 24 px) | 0,08 % / 0,02 % / 0,04 %             |
| La nôtre contre la nôtre avec `'SOFT' 0` demandé      | 0 %                                  |
| Officielle WONK 1 contre officielle WONK 0            | 62,9 %                               |
| Officielle WONK 0 contre la nôtre                     | 0,17 %                               |

L'axe SOFT change bien le dessin, et notre fichier reproduit le dessin SOFT 100 (les rares écarts viennent de l'arrondi des points lors du figeage de l'axe). Il ne réagit plus à SOFT, puisque l'axe est figé.

## Reconstruire

```sh
npm run fonts:build            # télécharge (ou reprend du cache), construit, écrit les fichiers
npm run fonts:build -- --check # reconstruit en mémoire et compare, sans rien écrire
npm run fonts:build -- --offline
```

Il faut l'outil `uv` (https://docs.astral.sh/uv/) : il installe à part Python 3.12, fontTools 4.68.0 et brotli 1.2.1, aux versions exactes. Les téléchargements sont gardés dans `.cache/fonts/` (non versionné) et revérifiés par empreinte à chaque lecture. Une source dont l'empreinte change fait échouer la construction.

La construction est reproductible : après suppression du cache et des fichiers produits, une reconstruction complète a redonné exactement les mêmes empreintes pour les dix fichiers (polices, licences, `fonts.css`, `FontPreloads.astro`), et `--check` le confirme à chaque lancement. Le nom de chaque police contient les huit premiers caractères de son empreinte : un fichier modifié change de nom et ne peut pas rester en cache par erreur. Les fichiers de `public/fonts/` qui ne sont plus produits sont supprimés.

## Ajouter une graisse ou changer une police

Toutes les modifications se font dans `scripts/fonts/fonts_config.py`, puis `npm run fonts:build`, puis vérification des tailles dans le bilan.

- Élargir les graisses de Fraunces ou d'Atkinson : modifier le triplet `"wght": (400, 400, 700)` (minimum, défaut, maximum) et la valeur `"weight"` de la face. Garder le défaut à une extrémité : un défaut au milieu double presque la taille du fichier.
- Ajouter une face d'une police déjà présente (par exemple le gras italique d'Atkinson) : ajouter sa source dans `SOURCES` avec son adresse épinglée sur le même commit et son empreinte (`shasum -a 256 fichier`), puis une entrée dans `faces` (style, graisse, nom de fichier) et une règle de secours dans `fallbacks`.
- Ajouter une graisse de D-DIN : lire le fichier dans l'archive via `ARCHIVE_MEMBERS` (nom et empreinte du fichier WOFF2 officiel) et ajouter une face `"method": "copy"`. Ne jamais découper ni convertir D-DIN sous ce nom.
- Changer de version : remplacer le commit et les empreintes, relire la licence de la nouvelle version (copyright, noms réservés), reconstruire, puis refaire la vérification du rendu.
- Changer le texte de référence `SAMPLES` : relancer `scripts/fonts/measure_fallbacks.py` sur un Mac et recopier ses valeurs ; la construction refuse de tourner avec des mesures périmées.

Si un nom de famille CSS change, il faut aussi mettre à jour les piles de polices de `src/styles/tokens.css`.
