# Licences des éléments tiers

Ce document recense ce que le site emprunte à d’autres : les fichiers envoyés aux visiteurs (polices, icônes), les outils qui fabriquent ces fichiers et les dépendances npm. Le détail des sources, des versions et des empreintes est dans [fonts.md](fonts.md), [icons.md](icons.md) et [logo.md](logo.md).

Vérifications faites le 12 novembre 2026. Ce relevé n’a pas été relu par un juriste.

Le code du site lui-même (gabarits, styles, scripts) n’a pas encore de licence déclarée : le dépôt ne contient pas de fichier `LICENSE`. Le choix revient à l’équipe.

## Fichiers envoyés aux visiteurs

| Élément                             | Fichiers                                   | Auteur                                                             | Licence                                      | Modifications                                                            | Ce que demande la licence                                                                                            |
| ----------------------------------- | ------------------------------------------ | ------------------------------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Fraunces 1.003                      | `public/fonts/fraunces/`                   | The Fraunces Project Authors (Undercase Type)                      | SIL OFL 1.1, sans nom réservé                | découpage latin et français, axes SOFT (100) et WONK (0) figés           | livrer la licence avec la police (`OFL.txt`, servi à côté) ; ne pas vendre la police seule                           |
| Atkinson Hyperlegible Next 2.001    | `public/fonts/atkinson-hyperlegible-next/` | The Atkinson Hyperlegible Next Project Authors (Braille Institute) | SIL OFL 1.1, sans nom réservé (copie GitHub) | découpage latin et français, instructions d’affichage (hinting) retirées | les mêmes (`OFL.txt`)                                                                                                |
| D-DIN 1.00 gras                     | `public/fonts/d-din/`                      | Datto Inc.                                                         | SIL OFL 1.1, nom réservé « D-DIN »           | aucune : fichier WOFF2 officiel servi tel quel                           | les mêmes (`OFL-1.1.txt`, `FONTLOG.txt`) ; une version modifiée devrait changer de nom                               |
| Icônes YouTube, Facebook, Instagram | `src/assets/icons/social/`                 | logos des marques, tracés repris de Simple Icons 16.37.0           | aucune déclarée (pas forcément CC0)          | format et couleur                                                        | aucune mention ; respecter les règles des marques (voir [icons.md](icons.md))                                        |
| Icône PeerTube                      | `src/assets/icons/social/peertube.svg`     | Framasoft, tracé repris par Simple Icons                           | CC BY-SA 4.0                                 | format et couleur                                                        | citer l’auteur, la licence et les modifications : fait dans les crédits du site ; le fichier reste sous CC BY-SA 4.0 |
| Icône LinkedIn                      | `src/assets/icons/social/linkedin.svg`     | The Bootstrap Authors (Bootstrap Icons 1.13.2)                     | MIT                                          | agrandie 1,5 fois, format et couleur                                     | conserver la mention de copyright et le texte de la licence : servi par le site, cité dans les crédits               |

Les auteurs, les licences et les modifications des polices, des icônes et des bibliothèques de code sont cités sur le site lui-même, dans la rubrique « Crédits » de la page des mentions légales (`/mentions-legales/`, textes dans `src/data/credits.ts`), liée depuis le pied de page de chaque page. Les textes des licences y sont liés : ceux des polices, servis à côté des fichiers de police, celui de Bootstrap Icons, servi à l’adresse `/licences/bootstrap-icons-LICENSE.txt` (copie octet pour octet du fichier `LICENSE` du dépôt à l’étiquette v1.13.2), et ceux de three.js et de meshoptimizer (voir plus bas).

Les licences des polices ont été relues dans les fichiers livrés : la première ligne de `fraunces/OFL.txt` et de `atkinson-hyperlegible-next/OFL.txt` ne déclare aucun nom réservé, celle de `d-din/OFL-1.1.txt` déclare « D-DIN » (ainsi que « D-DIN Condensed » et « D-DIN Expanded »). Les fichiers de licence sont servis avec les polices : sur le site construit, `/fonts/fraunces/OFL.txt`, `/fonts/atkinson-hyperlegible-next/OFL.txt` et `/fonts/d-din/OFL-1.1.txt` répondent bien (vérifié le 12 novembre 2026). Les raisons du découpage, ou de son absence pour D-DIN, sont dans [fonts.md](fonts.md), avec les passages de la FAQ officielle de l’OFL (version 1.1-update8, https://openfontlicense.org/ofl-faq/, entrée 2.6 relue le 12 novembre 2026 : découper une police est une modification).

Pour les icônes, ont été revérifiés le 12 novembre 2026 : la licence CC0 1.0 de Simple Icons à l’étiquette 16.37.0 (publiée le 8 novembre 2026), la licence propre `CC-BY-SA-4.0` de PeerTube dans `data/simple-icons.json` à la même étiquette, l’absence de licence propre pour YouTube, Facebook et Instagram (ce qui, d’après le fichier `DISCLAIMER.md` du projet, ne veut pas dire qu’elles sont sous CC0 : ce sont les logos des marques), et la licence MIT de Bootstrap Icons à l’étiquette v1.13.2 (publiée le 8 octobre 2026), dont le tracé LinkedIn d’origine, multiplié par 1,5, redonne exactement le nôtre (comparaison point par point, en coordonnées absolues). `npm run logo:build` compare aussi le rendu de chaque icône livrée à celui de son tracé d’origine (rubrique `social` de `qa/logo/report.json`). Les liens sont dans [icons.md](icons.md).

Ces licences portent sur le droit d’auteur. Les marques (LinkedIn, YouTube, Facebook, Instagram, PeerTube, et « Atkinson Hyperlegible ») restent à leurs propriétaires. Nos icônes monochromes s’écartent des règles de couleur publiées par LinkedIn et par Facebook : la décision à prendre avant la mise en ligne est décrite dans [icons.md](icons.md).

Le reste appartient à HAKO ou a été dessiné pour le site :

- le logo, dans toutes ses versions (SVG, favicon, icônes d’application, image de partage), tiré des PNG de `brand/` (voir [logo.md](logo.md)) ;
- les icônes d’interface (menu, fermer, e-mail, téléphone, repère, flèche, lien externe, box, vidéo, horloge), dessinées dans `src/components/Icon.astro` ;
- les scripts écrits pour le site : menu de l’en-tête (`src/components/header-menu.ts`), questions de la FAQ, formulaire de commande et scène 3D de l’accueil (`src/scripts/scene-3d/`).

Une bibliothèque tierce est envoyée aux visiteurs, seulement quand la scène 3D de l’accueil approche de l’écran : three.js 0.187.0 et quelques modules de son dossier `examples/` (licence MIT, « Copyright © 2010-2026 three.js authors »), dont le décodeur de meshoptimizer (licence MIT, « Copyright (C) 2016-2026, by Arseny Kapoulkine »), chargé seulement pour un modèle compressé. La licence MIT demande de joindre sa notice à chaque copie. Les fichiers construits ne la gardent pas : le site sert donc les deux textes, `/licences/three-LICENSE.txt` (copie octet pour octet de `node_modules/three/LICENSE`, version 0.187.0) et `/licences/meshoptimizer-LICENSE.txt` (copie de `node_modules/meshoptimizer/LICENSE.md`, version 1.3.0, même texte MIT que l’en-tête du décodeur), et les cite dans ses crédits. À chaque mise à jour de three.js, recopiez son fichier `LICENSE`.

Le kanji 箱 apparaît dans le logo, en tracés, et comme texte dans quelques phrases (accueil, La box, Notre engagement) : il s’affiche alors avec une police japonaise déjà installée sur l’appareil du visiteur (règle `[lang='ja']` de `src/styles/global.css`) ; aucun fichier de police japonaise n’est envoyé.

## Outils qui fabriquent les fichiers

Ces outils tournent sur la machine de l’équipe ; aucun n’est envoyé aux visiteurs.

| Outil                                 | Version              | Licence                                                | Usage                                                         |
| ------------------------------------- | -------------------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| potrace                               | 1.16                 | GNU GPL version 2 ou ultérieure                        | vectorisation du logo (`npm run logo:build`)                  |
| fontTools                             | 4.68.0               | MIT                                                    | découpage des polices (`npm run fonts:build`)                 |
| brotli (module Python)                | 1.2.1                | MIT                                                    | compression des fichiers WOFF2                                |
| Python                                | 3.12                 | PSF License version 2                                  | exécution des scripts de polices                              |
| uv                                    | 0.12.17 sur ce poste | MIT ou Apache 2.0, au choix                            | installation à part de Python, fontTools et brotli            |
| svgo                                  | 4.1.0                | MIT                                                    | optimisation des SVG                                          |
| sharp, avec libvips                   | 0.35.5               | Apache 2.0 ; libvips sous LGPL version 3 ou ultérieure | lecture et écriture des PNG                                   |
| @resvg/resvg-js                       | 2.6.2                | MPL 2.0                                                | rendu des SVG, pour la comparaison avec les PNG et les icônes |
| Playwright et son navigateur Chromium | 1.65.0               | Apache 2.0 ; Chromium sous licence BSD à trois clauses | tests et captures d’écran                                     |
| axe-core et @axe-core/playwright      | 4.14.0               | MPL 2.0                                                | audit d’accessibilité dans les tests                          |

Sources des licences, relues le 12 novembre 2026 : `potrace --license` (potrace 1.16), les fiches PyPI de fontTools 4.68.0, de brotli 1.2.1 et de uv (https://pypi.org/project/fonttools/, https://pypi.org/project/brotli/, https://pypi.org/project/uv/), https://docs.python.org/3.12/license.html pour Python, https://chromium.googlesource.com/chromium/src/+/main/LICENSE pour Chromium, et le champ `license` du `package.json` des paquets npm installés.

Les fichiers produits par ces outils ne sont pas couverts par la licence des outils. La FAQ de la GPL le dit pour potrace (https://www.gnu.org/licenses/gpl-faq.html#GPLOutput, lue le 12 novembre 2026) : « when a program translates its input into some other form, the copyright status of the output inherits that of the input it was generated from ». Les SVG du logo restent donc à HAKO, comme les PNG dont ils sont tirés. Ils ne contiennent d’ailleurs que des tracés : les métadonnées que potrace ajoute à ses SVG sont écartées par le script (vérifié : aucun fichier SVG ne contient de métadonnées de potrace). De même, les polices découpées par fontTools restent sous la licence de la police d’origine, l’OFL.

## Dépendances npm

Elles servent à construire, vérifier et tester le site. `astro` est la seule dépendance de production ; le site construit n’en contient aucun code.

| Paquet                   | Version | Licence    |
| ------------------------ | ------- | ---------- |
| astro                    | 7.4.11  | MIT        |
| @astrojs/check           | 0.9.12  | MIT        |
| @axe-core/playwright     | 4.14.0  | MPL-2.0    |
| @eslint/js               | 10.0.1  | MIT        |
| @playwright/test         | 1.65.0  | Apache-2.0 |
| @resvg/resvg-js          | 2.6.2   | MPL-2.0    |
| eslint                   | 10.14.0 | MIT        |
| eslint-config-prettier   | 10.1.8  | MIT        |
| eslint-plugin-astro      | 3.2.1   | MIT        |
| eslint-plugin-jsx-a11y-x | 0.2.0   | MIT        |
| globals                  | 17.14.0 | MIT        |
| postcss                  | 8.5.32  | MIT        |
| prettier                 | 3.10.1  | MIT        |
| prettier-plugin-astro    | 1.1.2   | MIT        |
| sharp                    | 0.35.5  | Apache-2.0 |
| svgo                     | 4.1.0   | MIT        |
| typescript               | 6.0.3   | Apache-2.0 |
| typescript-eslint        | 8.72.2  | MIT        |

Avec leurs dépendances indirectes, npm a installé 381 paquets sur le poste de vérification (macOS, processeur Apple) ; `package-lock.json` en liste 469, les autres étant des fichiers binaires pour d’autres systèmes. Licences relevées dans le champ `license` du `package.json` de chaque paquet installé : 307 MIT, 21 Apache-2.0, 18 ISC, 15 BSD-2-Clause, 6 MPL-2.0, 5 BSD-3-Clause, 4 BlueOak-1.0.0, 3 CC0-1.0, 1 LGPL-3.0-or-later et 1 0BSD. Aucun paquet n’est sans licence déclarée.

Les licences MPL 2.0 (axe-core, @axe-core/playwright, @resvg/resvg-js, lightningcss que Vite utilise pour le CSS) et LGPL (libvips, livré dans `@img/sharp-libvips-*`) imposent des conditions à qui redistribue ces logiciels. Le projet ne les redistribue pas : npm les télécharge depuis son registre sur chaque poste.

Pour refaire le relevé après une mise à jour des dépendances, on relit le champ `license` de chaque `node_modules/*/package.json` et on reporte ici les changements.
