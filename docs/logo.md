# Logo, favicon et icônes d’application

Le logo HAKO réunit le kanji 箱 (« boîte ») et le mot HAKO. Les fichiers de référence sont les trois PNG fournis dans `brand/`. Tout le reste (SVG, favicon, icônes, image de partage, images de contrôle) en est tiré par `npm run logo:build`, sans retouche à la main. Le mot HAKO n’est jamais retapé dans une police : on utilise toujours ces fichiers.

## Fichiers et usages

| Fichier                             | Contenu                             | Cadre (`viewBox`)           | Usage                                  |
| ----------------------------------- | ----------------------------------- | --------------------------- | -------------------------------------- |
| `src/assets/brand/hako-paysage.svg` | kanji et HAKO côte à côte           | 0 0 2054.78 364.07, serré   | en-tête                                |
| `src/assets/brand/hako-carre.svg`   | kanji au-dessus de HAKO, sans marge | 0 0 1017 914.79, serré      | pied de page, bloc carré               |
| `src/assets/brand/hako-reseaux.svg` | même dessin, avec une large marge   | 0 0 1080 1080, celui du PNG | avatars des réseaux sociaux            |
| `src/assets/brand/hako-kanji.svg`   | 箱 seul                             | 0 0 543.32 573.28, serré    | rappel discret, base du favicon        |
| `src/assets/brand/hako-mot.svg`     | HAKO seul                           | 0 0 1567 323.5, serré       | quand le kanji est déjà visible à côté |

Ces cinq fichiers n’ont qu’un `viewBox` (pas de largeur ni de hauteur), un seul tracé en `fill="currentColor"` et aucun titre : ils prennent la couleur du texte qui les entoure et le composant `Logo` leur donne leur nom accessible. Le cadre de chaque fichier, sauf `reseaux`, est serré autour du dessin, courbes comprises, et son origine ramenée en 0,0 : une hauteur CSS de 36 px donne 36 px de dessin visible. Le décalage de chaque dessin dans son PNG est noté dans le rapport (`offsetInSource`). Le kanji seul vient du PNG carré, où il est le plus grand (573 px de haut contre 363 px dans le PNG en largeur) ; le mot seul vient du PNG en largeur (1 567 px de large contre 1 017 px).

Dans `public/brand/`, les mêmes dessins existent en fichiers autonomes, avec la couleur chocolat écrite dans le fichier et une largeur et une hauteur, pour un document, un dossier de presse ou un partenaire. Ils ont le même cadre serré : la personne qui les utilise ajoute l’espace libre autour (voir plus bas). Ce dossier contient aussi les trois PNG d’origine, copiés octet pour octet (`HAKO_Landscape_Transparent.png`, `HAKO_Square_Transparent.png`, `HAKO_SocialMedia_Transparent.png`), en dernier recours. Leurs bords ont été lissés sur fond blanc puis détourés : sur un fond sombre, un liseré clair apparaît autour des lettres. On ne les utilise donc que sur fond clair, et le SVG reste toujours préférable.

## Règles d’usage

Le logo est toujours d’une seule couleur, sans dégradé, ombre, contour ni effet, et n’est jamais déformé, incliné ou recomposé. On choisit l’une des cinq variantes telles quelles.

| Fond               | Couleur du logo    | Contraste |
| ------------------ | ------------------ | --------- |
| crème `#FDF7EF`    | chocolat `#412D1E` | 12,2:1    |
| sable `#F2E6D6`    | chocolat `#412D1E` | 10,5:1    |
| chocolat `#412D1E` | crème `#FDF7EF`    | 12,2:1    |

Les autres couleurs de la palette (terre, caramel, olive, lin, noyer) ne servent pas pour le logo. Sur une photo, on le pose seulement sur une zone unie et calme.

Tailles minimales à l’écran, mesurées sur des rendus à la taille réelle : 24 px de haut pour le logo en largeur (en dessous, les traits du kanji se mélangent), 48 px pour la version carrée, 20 px pour le kanji seul, 12 px pour HAKO seul. Le favicon fait exception : son dessin est calé sur la grille de 16 pixels (voir plus bas).

L’en-tête du site fait une autre exception, à décider par l’équipe : sur un écran de moins de 360 px de large, le logo en largeur y descend à 21 px. Mesuré à 320 px, avec un logo de 24 px, la barre demanderait 293 px pour 285 px disponibles : « Commander » et « Menu » passeraient sous le logo. Deux autres choix sont possibles : le kanji seul dans l’en-tête sur ces écrans, ou un bouton « Commander » en plus petits caractères.

Autour du logo, on laisse un espace vide au moins égal au quart de sa hauteur. Pour le logo en largeur, cela correspond à peu près à l’épaisseur d’un jambage du H. La version `reseaux` contient déjà cette marge.

## Favicon et icônes d’application

Tous sont dessinés à partir de `hako-kanji.svg` : un kanji chocolat sur fond crème. Sur un onglet sombre comme sur un onglet clair, le fond crème garde le kanji lisible.

`public/favicon.svg` est un carré crème aux coins arrondis (rayon de 18,75 % du côté) avec le kanji à 88 % de la hauteur. À 16 px, un kanji de quinze traits devient vite flou ; le script essaie donc de petites variations de taille et de position, au seizième de pixel, et garde celle qui donne les traits les plus nets à 16 px. Le kanji est ainsi décalé de 0,375 px vers le haut et vers la gauche à cette taille (2 % du côté). Le calage vaut aussi à 32 et 48 px. Les rendus agrandis sont dans `qa/logo/favicon-16-x8.png`, `favicon-32-x8.png` et `favicon-48-x8.png`.

`public/favicon.ico` contient ce même dessin en 16, 32 et 48 px (images PNG dans le fichier ICO), pour les navigateurs qui ne lisent pas le SVG.

`public/apple-touch-icon.png` (180 × 180) a un fond crème plein, sans transparence : iOS arrondit lui-même les coins. Le kanji y occupe 66 % de la hauteur.

`public/icons/icon-192.png` et `icon-512.png` reprennent le dessin du favicon, plus aéré (kanji à 70 % de la hauteur). `icon-maskable-512.png` a un fond plein et le kanji tient entièrement dans le cercle central de 80 % du côté, la zone que les systèmes Android peuvent découper en rond, en goutte ou en carré : la diagonale de son cadre fait 77,6 % du côté. Contrôle visuel : `qa/logo/maskable-zone-securite.png`, avec le cercle tracé en rouge.

`public/manifest.webmanifest` déclare le nom HAKO, la langue française, l’adresse de départ `/`, l’affichage dans le navigateur, le crème comme couleur de fond et de thème, et ces trois icônes.

`public/og/hako-og.png` est l’image de partage (Open Graph), 1 200 × 630 px, moins de 5 ko : le logo `reseaux` centré sur fond crème, haut de 391 px (62 % de l’image), sans autre texte. Le centre reste lisible si un réseau recadre l’image en carré.

Les PNG sont réduits à une palette de 32 à 64 couleurs (deux teintes et leurs bords lissés suffisent), d’où des fichiers de 1 à 5 ko.

## Vectorisation

Les trois PNG sont des images à palette de 106 couleurs, exportées par Paint.NET 5.2 (seule indication de leurs métadonnées). Chaque pixel est soit transparent, soit opaque : la couche alpha ne contient aucun lissage. L’encre est `#412D1E`, couleur d’index 0 de la palette et couleur opaque la plus fréquente (vérifié en lisant la palette des trois fichiers). Les 104 autres couleurs opaques vont du chocolat à `#B2ABA4` : ce sont les pixels de bord, lissés sur fond blanc avant que le fond soit retiré. Les pixels de bord les plus clairs, couverts à moins de 47 % environ, sont devenus transparents.

La vectorisation suit ces étapes.

1. Couverture des pixels. Pour chaque couleur de bord, on retrouve la part du pixel couverte par le dessin. Le modèle « encre mélangée au blanc avec un gamma de 1,37 » est celui qui rend les trois canaux (rouge, vert, bleu) les plus cohérents entre eux : écart quadratique moyen de 0,013 entre les estimations des trois canaux. Ce gamma est recalculé à chaque construction à partir des trois PNG.
2. Séparation du kanji et du mot, à la plus large bande vide entre les deux.
3. Suréchantillonnage ×8 de la couverture (interpolation bilinéaire), seuil à 50 %, puis vectorisation par potrace 1.16, avec une précision de 1/100 de pixel du bitmap suréchantillonné (`-u 100`).
4. Lettres HAKO : potrace avec `alphamax 0`, qui ne produit que des segments droits. Le script garde ensuite les vrais angles (simplification de Douglas-Peucker à 0,8 px), ajuste une droite sur chaque côté en ignorant 2 px près des angles, rend exactement horizontaux ou verticaux les côtés qui le sont à 0,75° près, supprime les arrondis de moins de 3 px que le suréchantillonnage crée dans les angles, et recalcule chaque angle comme l’intersection de ses deux côtés. Dans le logo en largeur, 41 des 47 côtés sont exactement horizontaux ou verticaux ; les deux biseaux du O sont parallèles à 0,01° près.
5. Kanji : potrace avec `alphamax 1` (réglage par défaut des angles) et une tolérance de 0,2 px, puis redessin. Le contour est échantillonné tous les 0,1 px ; un angle vif est un virage d’au moins 38° concentré sur 1,5 px. Entre deux angles, un côté droit devient une droite (redressée à 0,75° près), un côté courbe une suite de courbes de Bézier ajustées par la méthode de P. J. Schneider (« An Algorithm for Automatically Fitting Digitized Curves », Graphics Gems, 1990), avec un écart maximal de 0,3 px. Chaque angle est recalculé comme l’intersection des tangentes de ses deux côtés, déplacé de 1,5 px au plus (0,5 px pour un angle aigu). Pour le kanji du PNG carré : 64 angles, 47 droites et 57 courbes.
6. Optimisation par svgo 4.1.0, coordonnées arrondies au centième de pixel. Chaque logo complet pèse environ 2,4 ko, le mot seul 0,4 ko.

Deux précautions viennent de l’analyse des PNG. Le détourage a fait disparaître les pixels de bord couverts à moins de 47 % : le long d’un bord en biais, le contour mesuré recule donc par endroits, en dent de scie, de 0,47 px au plus, et n’avance jamais. Tous les ajustements (droites et courbes) se font « d’un seul côté » : les points en retrait vers l’intérieur ne comptent presque pas. Ensuite, le PNG en largeur montre le A environ 0,3 px plus haut que H, K et O (sa dernière rangée de pixels, en bas, est partielle alors que celle des autres lettres est pleine) : ce petit décalage a été gardé tel quel.

Le kanji garde tous les détails visibles dans le PNG, y compris les petits crochets arrondis en haut du radical du bambou et du trait vertical.

## Comparaison avec les PNG

Chaque SVG livré est replacé dans le repère de son PNG (décalage `offsetInSource`), rendu par resvg à la taille exacte du PNG, puis comparé à la couche alpha du PNG, au seuil de 50 %. resvg ne calcule la couverture verticale qu’au quart de pixel près ; le rendu est donc fait à 4 fois la taille, puis ramené à la taille du PNG par moyenne. Une deuxième mesure, au quart de pixel, compare un rendu ×4 à la couverture du PNG suréchantillonnée de la même façon.

| Fichier            | IoU (alpha 50 %) | Pixels en désaccord | Écart moyen | 99 % des écarts sous | Écart maximal |
| ------------------ | ---------------- | ------------------- | ----------- | -------------------- | ------------- |
| `hako-paysage.svg` | 0,99949          | 0,05 % de l’encre   | 0,05 px     | 0,35 px              | 0,90 px       |
| `hako-carre.svg`   | 0,99917          | 0,08 %              | 0,05 px     | 0,35 px              | 0,90 px       |
| `hako-reseaux.svg` | 0,99843          | 0,16 %              | 0,06 px     | 0,50 px              | 1,00 px       |
| `hako-kanji.svg`   | 0,99876          | 0,12 %              | 0,07 px     | 0,35 px              | 0,90 px       |
| `hako-mot.svg`     | 0,99982          | 0,02 %              | 0,03 px     | 0,25 px              | 0,90 px       |

L’IoU (intersection sur union) vaut 1 quand les deux masques sont identiques. Les écarts sont mesurés en pixels du PNG d’origine, entre les bords des deux masques. Les pixels en désaccord sont tous des pixels de bord, à moitié couverts : pour la plupart, la couverture du PNG ou celle du SVG y est entre 47 et 60 %, et un dixième de pixel suffit à les faire passer d’un côté ou de l’autre du seuil. Ce sont des différences de lissage.

Les plus grands écarts (0,7 à 1 px) sont tous à des angles, là où les pixels ne disent pas si l’angle est vif ou légèrement arrondi : le creux intérieur du K à sa jonction avec le jambage (le PNG y montre un pan coupé de 1,3 px, rendu vif dans le SVG), le coin haut gauche des traits du bambou, la pointe du petit crochet du trait vertical dans la version `reseaux`. Les positions exactes sont dans `qa/logo/report.json` (`largestDeviations`).

Images de contrôle dans `qa/logo/` :

- `diff-paysage.png`, `diff-carre.png`, `diff-reseaux.png` : toute l’image, en rouge les pixels présents seulement dans le PNG, en bleu ceux présents seulement dans le SVG, en beige les pixels communs ;
- `zoom-<version>-<détail>.png` : agrandissements ×4 de coins, de jonctions et de courbes, sur le PNG d’origine en pixels nets, avec les mêmes couleurs et le contour du SVG en vert.

## Régénérer

```sh
npm run logo:build
```

Il faut potrace sur la machine : `brew install potrace` sous macOS, `apt install potrace` sous Debian ou Ubuntu (version utilisée : 1.16). Les autres outils (resvg-js, sharp, svgo) sont déjà dans les dépendances du projet. La construction prend une dizaine de secondes, ne télécharge rien et donne exactement les mêmes fichiers d’une fois sur l’autre.

Elle réécrit tous les fichiers cités ici, les cinq icônes des réseaux sociaux (voir [icons.md](icons.md)), les images de contrôle et le rapport `qa/logo/report.json` (versions des outils, réglages, mesures, taille et empreinte SHA-256 de chaque fichier). Une retouche à la main de ces fichiers serait donc perdue : on change plutôt les réglages dans `scripts/logo/config.mjs`.

Le code est dans `scripts/logo/` : `build.mjs` enchaîne les étapes, `lib/raster.mjs` lit les PNG et prépare les bitmaps, `lib/potrace.mjs` appelle potrace, `lib/geometry.mjs` redresse les lettres, `lib/fit.mjs` redessine le kanji, `lib/compare.mjs` mesure les écarts et dessine les images de contrôle, `lib/icons.mjs` fabrique le favicon et les icônes, `social.mjs` contient les icônes des réseaux sociaux.

Si un nouveau PNG du logo arrive, on le dépose dans `brand/` sous le même nom, on relance la commande, puis on regarde le rapport et les images de contrôle avant de valider.
