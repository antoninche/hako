# Illustrations

Les dessins du site forment une seule série, en « papier découpé » : des formes plates superposées, coupées à la main (bords légèrement irréguliers) et posées sur une carte de papier. La profondeur vient d’une ombre plate décalée, sans flou, sans transparence et sans dégradé. Chaque dessin est décrit en code, puis optimisé : on ne retouche jamais un SVG à la main.

## Les fichiers

- `src/assets/illustrations/` : les 21 dessins publiés, soit 10 scènes, les 7 icônes des engagements (`icones/`) et les 4 vignettes des tutoriels (`tutoriels/`).
- `design/illustrations/_source/` : le générateur. `dessins.mjs` décrit chaque dessin, avec des coordonnées posées une à une ; `objets.mjs` réunit les objets communs (carte de fond, sol, box, box internet, personnes, meubles, plantes) ; `papier.mjs` donne la palette, la coupe irrégulière et l’ombre ; `kanji.mjs` pose le kanji 箱 du logo sur le dessus de la box, et `mot.mjs` le mot HAKO du logo sur sa face avant.
- `design/illustrations/svgo.config.mjs` : l’optimisation par SVGO.
- `scripts/illustrations/check.mjs` et `scripts/illustrations/render.mjs` : le contrôle et le rendu en PNG.

Dans le générateur, les noms de fonctions et de variables sont en français, comme le vocabulaire des dessins (`boite`, `socle`, `etagere`, `casier`…), alors que le reste du code du site les écrit en anglais.

## Utiliser un dessin

Le composant `Illustration` insère le dessin dans la page, sans requête de plus :

```astro
<Illustration name="probleme" ratio="4/3" alt={problem.illustrationAlt} />
<Illustration name="etape-commande" ratio="1/1" decorative />
```

Il retire le `<title>` et le `<desc>` du fichier : les lecteurs d’écran entendent le texte de remplacement de la page (`alt`), ou rien si le dessin est décoratif. Ces textes sont dans les fichiers de contenu (`src/content/*.ts`), à côté des textes de la page. Ils disent ce que l’on voit, en mots simples, sans nommer la technique du dessin.

Les formats : 4/3 (800 × 600), 16/10 (800 × 500), 16/9 (640 × 360, les vignettes) et 1/1 (600 × 600, 800 × 800 pour la vue éclatée, 48 × 48 pour les icônes). Les identifiants internes sont préfixés par le nom du fichier : deux dessins différents peuvent partager une page, mais un même dessin n’y paraît qu’une fois.

Les scènes se posent sur une section crème ou sable, jamais sur la pierre : leurs ombres lin y feraient des bords clairs. La vue éclatée, sur sa propre carte pierre, va sur toutes les surfaces.

Si un dessin manque, le composant affiche à sa place un cadre vide aux mêmes proportions (classe `illustration--attente`). Les tests échouent si une page construite contient encore un de ces cadres.

## Palette

Les couleurs sont celles de `src/styles/tokens.css`, aux mêmes valeurs ; `check.mjs` refuse toute autre couleur.

| Couleur  | Valeur  | Rôle dans les dessins                                                                                     |
| -------- | ------- | --------------------------------------------------------------------------------------------------------- |
| crème    | #FDF7EF | la lumière : fenêtres, papier des photos, nuages, écrans                                                  |
| perle    | #E3D9C6 | la coque de la box (RAL 1013, blanc perlé), et rien d’autre                                               |
| sable    | #F2E6D6 | carte de fond, murs, pastille des icônes                                                                  |
| lin      | #E6D5BF | sol, ombres, dessus de la box internet, prises, peau claire                                               |
| caramel  | #B9773F | bois clair (tables, étagères), entretoises en laiton, pointillés des trajets                              |
| noyer    | #5F3E27 | bois foncé, socle et pieds de la box, fond des meubles ouverts, coque des ordinateurs, ficelles et câbles |
| chocolat | #412D1E | kanji et mot HAKO de la box, cheveux, traits des icônes, charnières, ombres sur les fonds foncés          |
| terre    | #9A4E2B | un ou deux accents par image : toit, étiquettes de prix, pot, vêtement de l’équipe                        |
| olive    | #5E6B45 | plantes, collines, volets, meuble peint de la boutique, cartes électroniques, pastille cochée             |
| pierre   | #BAB1A7 | à petites doses : bord ombré de la coque, carte de la vue éclatée, écran d’etape-commande, box internet   |

## Ombres

Une seule ombre par objet, celle de toute sa silhouette, toujours vers le bas à droite : la lumière vient d’en haut à gauche. Elle prend le ton plus sombre du papier sur lequel elle tombe.

- Sur la page, le crème ou le sable : lin.
- Sur le lin : caramel.
- Sur le caramel ou la pierre : noyer.
- Sur l’olive, le terre ou le noyer : chocolat.
- Sur la coque perle, les côtés tournés vers l’ombre sont en pierre (le lin, presque du même ton, s’y perdrait).

Un objet posé sur une étagère ou un meuble projette son ombre sur le mur, et la planche la cache : `sv.marque()` pose un repère avant la planche, puis l’option `sous` glisse l’ombre de l’objet sous ce repère. Un petit objet posé au sol a une ombre plus courte (2 et 3).

Le meuble ouvert à cases (`casier()`, la bibliothèque et l’étagère des offres) renvoie un tel repère avec ses cases. On le voit d’un peu haut : chaque case a un fond noyer et le dessus caramel de sa planche, où l’on pose les objets avec une ombre noyer.

## Mesures

| Format (viewBox)                | Bande fine | Câbles, ficelles, tiges | Décalage de l’ombre |
| ------------------------------- | ---------- | ----------------------- | ------------------- |
| 800 × 600, 800 × 500, 800 × 800 | 6          | 3 à 4                   | 4 et 6              |
| 600 × 600, 640 × 360            | 5          | 3 à 3,5                 | 3 et 5              |
| 48 × 48 (icônes)                | 2,6        | 1,6                     | 1 et 1,5            |

Les bandes ont des bouts ronds. La coupe irrégulière reste sous 1,5 unité, discrète même à 360 px. Chaque scène est posée sur une carte sable aux coins arrondis (rayon 40 à 44, 30 pour les vignettes). Les icônes sont posées sur une pastille sable, sans carte.

La box est dessinée comme le prototype : coque perle aux angles arrondis, socle noyer un peu en retrait sur ses pieds, kanji du logo en chocolat au centre du dessus et mot HAKO du logo en chocolat au centre de la grande face avant. Cette face est celle que l’on voit sur l’image de trois quarts du prototype : la grande face lisse, sans fentes ni ouvertures. Le kanji et le mot sont des tracés du logo officiel (`hako-kanji.svg` et `hako-mot.svg`), jamais du texte. Ses proportions sont réunies dans `BOX` (`_source/objets.mjs`). Aucun téléphone n’est dessiné (il n’y a pas d’accès depuis l’extérieur de la maison pour l’instant) et aucune copie de secours n’est montrée.

La box a un ventilateur : il lui faut de l’air autour. Elle ne remplit jamais la case, la fenêtre ou le meuble qui la porte ; on voit le fond libre au-dessus d’elle et de chaque côté. Dans les offres, sa case du meuble ouvert est large et haute : 49 unités d’air au-dessus de la box, 39 (salon) et 35 (boutique) de chaque côté, soit 16, 13 et 11 px sur un écran de 360 px. Sur une étagère, on laisse aussi un écart franc entre la box et ses voisins (box internet, plante).

Dans les dessins dont elle est le sujet (les deux offres, les vignettes des tutoriels, la page 404 et la vue éclatée), la box doit se lire sur un écran de 360 px : au moins 47 px de large, avec un kanji d’au moins 12 px. Sa coque perle se distingue mal du sable, du lin et du crème. Seule et grande sur sa carte (tutoriels, page 404), elle se lit grâce à son socle, son kanji et son côté ombré ; au milieu d’une scène chargée, comme dans les offres, on la pose devant un fond foncé, le fond noyer des meubles ouverts. Dans les autres scènes où elle paraît (le déménageur et les étapes), elle reste un détail et peut être plus petite.

Le mot HAKO est discret, comme la marque d’un appareil : 0,3 fois la largeur de la coque (`BOX.mot`), centré sur la face. On ne le pose (option `mot` de `boite()`) que là où il mesure au moins 14 px de large sur un écran de 360 px ; plus petit, ce ne serait qu’une tache. Il est donc sur les offres, les vignettes des tutoriels, la page 404 et la vue éclatée, et absent du déménageur et des étapes.

La taille à donner dépend de la largeur du dessin dans la page. Sur un écran de 360 px :

| Dessin                        | Largeur dans la page | Box d’au moins | Box dessinée | Mot HAKO dans la page   |
| ----------------------------- | -------------------- | -------------- | ------------ | ----------------------- |
| offres (800 de large)         | 258 px               | 146 unités     | 150          | 14,5 px                 |
| vignettes des tutoriels (640) | 322 px               | 94 unités      | de 150 à 168 | de 22,6 à 25,3 px       |
| page 404 (600)                | 192 px               | 147 unités     | 264          | 25,3 px                 |
| vue éclatée (800)             | 324 px               | 117 unités     | 320          | 38,8 px                 |
| déménageur (800)              | 276 px               | pas de minimum | 110          | absent (11,4 px)        |
| étapes (600)                  | 88 px                | pas de minimum | de 50 à 190  | absent (8,4 px au plus) |

Ces largeurs viennent de la mise en page des sections (mesurées le 13 novembre 2026 sur le site construit) ; si elle change, il faut les mesurer de nouveau. Entre parenthèses, la largeur qu’aurait le mot là où il n’est pas posé.

## Reconstruire et vérifier

Depuis la racine du projet :

```sh
npm run illustrations:build   # génère les dessins, puis les optimise avec SVGO
npm run illustrations:check   # poids, viewBox, titre et description, palette, éléments interdits
npm run illustrations:render  # PNG à 360 et 1280 px et planche-contact
```

`illustrations:build` écrit directement dans `src/assets/illustrations/`. La construction est reproductible : l’irrégularité de coupe vient d’un tirage initialisé par le nom du fichier, donc les mêmes sources donnent les mêmes octets. Après une retouche, `git status` montre exactement les dessins qui ont changé.

`illustrations:check` échoue si un fichier dépasse 20 Ko, n’a pas de `viewBox`, de `<title>` ou de `<desc>`, garde une largeur ou une hauteur fixe, emploie une couleur hors palette, du texte, une image, un style, un script, un filtre, un dégradé ou une transparence, ou un identifiant non préfixé. `illustrations:render` écrit ses images dans `design/illustrations/renders/`, que git ignore. Avant de publier, on y regarde chaque dessin à la largeur où il paraît sur un écran de 360 px (tableau plus haut) ; une liste de largeurs peut suivre le dossier de sortie :

```sh
npm run illustrations:render -- src/assets/illustrations design/illustrations/renders 88,258,322,1280
```

Si le logo change, recopier l’attribut `d` de `src/assets/brand/hako-kanji.svg` dans `KANJI_D` (`_source/kanji.mjs`) et celui de `src/assets/brand/hako-mot.svg` dans `MOT_D` (`_source/mot.mjs`), puis reconstruire la série.

Deux réglages servent rarement. `PAPIER_ESSAIS=<dossier>` écrit les fiches d’essai, dont le nom commence par « _ » (par exemple `PAPIER_ESSAIS=.tmp/essais node design/illustrations/_source/dessins.mjs _essai-personnages`) ; elles ne vont jamais dans le site. `PAPIER_ANCRES=<dossier>` écrit `vue-eclatee.anchors.json`, les points où accrocher des étiquettes à droite de chaque pièce de la vue éclatée, en pourcentage de la largeur et de la hauteur ; le site ne s’en sert pas aujourd’hui.
