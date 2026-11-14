# Carte de la zone d’intervention

La carte qui montre où nous intervenons n’est pas dessinée à main levée. Un script la calcule à partir de données géographiques réelles, puis le composant `ZoneMap.astro` la dessine en SVG directement dans la page. Le site ne charge aucune tuile et ne fait aucune requête vers un autre site : tout est dans le HTML et la feuille de style.

Pour l’afficher dans une page :

```astro
---
import ZoneMap from '../components/carte/ZoneMap.astro';
---

<ZoneMap />
```

Le composant n’a pas de paramètre. Il n’en faut qu’un par page, car ses identifiants internes sont fixes.

## Les fichiers

- `src/data/zone.ts` : les quatre villes (nom, code Insee, latitude, longitude, source et date du relevé, place dans la phrase) et les textes de la carte.
- `src/components/carte/ZoneMap.astro` : le dessin, la légende et leur feuille de style.
- `src/components/carte/papier.ts` : les bords coupés à la main, comme ceux des illustrations du site.
- `src/components/carte/carte-data.json` : la géométrie produite par le script (terres, lignes d’eau, projection). Ne pas le modifier à la main.
- `scripts/map/build.mjs` : le script, avec ses réglages dans `scripts/map/config.mjs` et ses outils dans `scripts/map/lib/`.

La phrase sous la carte est `company.serviceArea.sentence` (`src/data/entreprise.ts`), la même que dans le pied de page.

## Position des villes

Chaque ville est placée sur sa mairie. La position vient de l’API Découpage administratif de l’État (geo.api.gouv.fr), qui la tire d’ADMIN EXPRESS, la base des limites administratives de l’IGN. Relevé du 12 novembre 2026, avec l’adresse `https://geo.api.gouv.fr/communes/<code Insee>?fields=nom,centre,mairie`.

Une seconde source indépendante a servi de contrôle : Wikidata, propriété P625 (coordonnées), retrouvée par le code Insee (propriété P374).

| Ville             | Code Insee | Mairie (API, retenue) | Centre (API)     | Écart   | Wikidata                     | Écart |
| ----------------- | ---------- | --------------------- | ---------------- | ------- | ---------------------------- | ----- |
| Salon-de-Provence | 13103      | 43,6407 ; 5,0990      | 43,6430 ; 5,0490 | 4 032 m | Q232567 : 43,64056 ; 5,09722 | 144 m |
| Aix-en-Provence   | 13001      | 43,5298 ; 5,4474      | 43,5360 ; 5,3879 | 4 846 m | Q47465 : 43,52778 ; 5,44556  | 270 m |
| Marseille         | 13055      | 43,2965 ; 5,3698      | 43,2803 ; 5,3806 | 2 002 m | Q23482 : 43,29667 ; 5,37639  | 534 m |
| Toulon            | 83137      | 43,1204 ; 5,9325      | 43,1364 ; 5,9334 | 1 781 m | Q44160 : 43,12500 ; 5,93056  | 535 m |

Latitude puis longitude, en degrés décimaux (WGS 84). Les écarts sont mesurés depuis la position retenue.

L’API donne deux points par commune. Le champ `centre` est un point calculé à l’intérieur du territoire de la commune : pour Salon-de-Provence et Aix-en-Provence, dont le territoire s’étend loin vers l’ouest, il tombe à 4 ou 5 km de la ville, dans la campagne. Le champ `mairie` donne l’emplacement de l’hôtel de ville. C’est lui que la carte utilise. Wikidata le confirme à moins de 550 m près pour les quatre villes, ce qui est invisible à cette échelle (un pixel représente 100 à 400 m selon la taille de la carte).

Pour refaire la comparaison, avec un accès à internet :

```sh
npm run map:build -- --verifier
```

Le script affiche le tableau des écarts et s’arrête en erreur si une ville de `zone.ts` est à plus de 50 m de sa mairie officielle. Corriger une position dans `zone.ts` suffit : la carte place les villes elle-même, sans relancer le script.

## Fond de carte

Les terres et la mer viennent de Natural Earth, au 1:10 000 000, version 5.1.2, téléchargée depuis le dépôt officiel (github.com/nvkelso/natural-earth-vector, commit `f1890d9f152c896d250a77557a5751a93d494776`). Trois fichiers servent, chacun vérifié par son empreinte SHA-256 :

| Fichier                        | SHA-256                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| `ne_10m_land.geojson`          | `1ac90796408bc6ad6911d69448485d3c4dbf2190370080368a09976e1c9f7416` |
| `ne_10m_minor_islands.geojson` | `8c933ca7a4760256bdc46408355706e39764b0fa01c160c28888b90b4faec29f` |
| `ne_10m_lakes_europe.geojson`  | `b4dd9e7a5edd0d07b54768b5404d1ebe77f80b9d579c85fff65f90cf50369769` |

L’étang de Berre y figure comme une étendue de mer, reliée par le canal de Caronte. À cette échelle, la côte est simplifiée au kilomètre près : les îles du Frioul et de Riou n’y sont pas, et la mairie de Toulon, au bord du port, tombe juste du côté de l’eau. La pointe de son repère reste posée sur la côte, à sa vraie place.

Le cadre va de 4,88° à 6,32° de longitude est et de 42,95° à 43,735° de latitude nord. Au nord, il s’arrête juste avant le lac de Sainte-Croix.

## Projection et tracé

La projection est équirectangulaire, corrigée par le cosinus de la latitude du milieu du cadre (φ0 = 43,34°) :

```text
x = (λ − 4,88) × cos φ0 × s
y = (43,735 − φ) × s
s = 1000 / ((6,32 − 4,88) × cos φ0) ≈ 954,8 unités par degré de latitude
```

λ est la longitude, φ la latitude. Le dessin fait 1000 × 750 unités ; une unité vaut environ 117 m sur le terrain. Les distances sont justes à la latitude φ0, et l’écart reste sous 0,7 % partout ailleurs sur la carte. L’échelle graphique de 20 km mesure 171,3 unités (calcul sur l’ellipsoïde WGS 84).

Le script suit ces étapes : il garde les contours proches du cadre, les projette, les découpe au rectangle (algorithme de Sutherland-Hodgman) avec une marge hors cadre, adoucit la côte (deux passes de Chaikin), puis la simplifie (Douglas-Peucker, écart toléré 0,45 unité). Les lignes d’eau sont les courbes situées à 1,2, 2,8 et 4,9 km de la côte : le script trace les terres sur une grille, calcule pour chaque point de mer sa distance à la terre la plus proche, puis relève les courbes de niveau de cette distance. Elles restent dans `carte-data.json`, mais la carte ne les dessine pas : le papier découpé n’a pas de trait. Les coordonnées sont arrondies au dixième d’unité et écrites en relatif.

Le fichier produit pèse 8,3 Ko (3,5 Ko compressé). Le résultat est identique d’une exécution à l’autre. Dans la page, la carte et sa légende pèsent 10,6 Ko de HTML (3,2 Ko compressé).

## Régénérer la carte

Le script doit être déclaré dans `package.json` :

```json
"map:build": "node scripts/map/build.mjs"
```

Puis :

```sh
npm run map:build
```

Au premier lancement, le script télécharge les fichiers Natural Earth (environ 12 Mo) dans `.tmp/carte/sources/`, ignoré par git ; ensuite il les relit depuis ce dossier. Si un fichier téléchargé n’a pas l’empreinte attendue, le script s’arrête sans rien écrire : vérifiez le fichier avant de mettre à jour l’empreinte dans `scripts/map/config.mjs`.

Il faut relancer le script après un changement du cadre, des sources ou des réglages de tracé (`scripts/map/config.mjs`), puis versionner le nouveau `carte-data.json`. Le script lit `src/data/zone.ts` directement avec Node (version 22.18 ou plus récente) : ce fichier ne doit rien importer.

## Le style « papier découpé »

La carte suit les illustrations du site, en « papier découpé » (voir [illustrations.md](illustrations.md)) : des feuilles plates sans contour, coupées à la main et posées les unes sur les autres. La profondeur vient d’une seule ombre plate, décalée vers le bas à droite, du ton plus sombre que le papier sur lequel elle tombe : lin sur du crème ou du sable, caramel sur du lin.

| Élément                                   | Papier                                                                  | Ombre                                  |
| ----------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------- |
| Feuille de la carte, qui porte les terres | sable, comme la carte de chaque scène                                   | lin, sur la page                       |
| Mer                                       | lin, comme le sol des scènes                                            | aucune, comme le sol                   |
| Zone d’intervention                       | crème, la lumière                                                       | lin sur les terres, caramel sur la mer |
| Villes                                    | goutte terre percée d’un œillet, celle de l’icône « humain proche »     | lin                                    |
| Noms des villes                           | chocolat, avec un liseré crème                                          | aucune                                 |
| Nom de la mer, échelle                    | noyer ; l’échelle est un petit lien aux bouts ronds, comme les ficelles | aucune                                 |

Les mesures sont celles des illustrations, multipliées par 1,25, car la carte fait 1000 unités de large et les scènes 800 : coins de 55, ombre de la feuille décalée de 5 et 7,5, coupe irrégulière de 1,5 au plus. La zone est posée à plat sur les terres : son ombre, plus courte (2,5 et 3,75), suit la règle des objets posés au sol. Ces mesures suivent la taille de la carte, comme dans les illustrations. Les repères et les noms, eux, gardent la même taille à l’écran (voir plus bas) ; l’ombre d’un repère est décalée de 1 et 1,5 px, comme celle des icônes de 48 px.

Le contour de la feuille et celui de la zone sont coupés aux ciseaux par `papier.ts` : chaque côté long est redécoupé en segments presque droits, légèrement désaxés. Le tirage est initialisé par un nom fixe, donc deux constructions du site donnent exactement le même dessin.

Sur une section sable, la feuille se fond dans le fond et seule son ombre reste, comme pour les scènes. Sur une section chocolat, la feuille n’a pas d’ombre, puisque rien n’est plus sombre que le fond, et les gouttes de la légende prennent un liseré crème.

Les réglages sont en haut de `ZoneMap.astro` : `PAPER` (feuille, ombres, coupe), `ZONE_RADIUS_KM` (largeur de la zone autour des villes, 8 km) et `LABEL_PLACE` (côté où s’écrit chaque nom). Les couleurs sont les variables `--carte-…` de la feuille de style, uniquement des jetons de la palette.

## Lisibilité et accessibilité

Les noms des villes sont du vrai texte, en D-DIN gras, chocolat avec un liseré crème qui les détache du dessin : contraste de 12,2:1, et 10,5:1 sur la feuille sable. Le nom de la mer, en noyer sur la mer lin, atteint 6,6:1 ; l’échelle, en noyer avec son liseré crème, 8,9:1 (7,7:1 sur la feuille sable). Les gouttes terre ressortent à 5,6:1 sur la zone crème.

Les noms gardent à l’écran une taille de 15 à 18 px environ, quelle que soit la largeur de la carte : la feuille de style ajuste la variable `--k` par paliers, selon la largeur du cadre (requêtes de conteneur). Les repères suivent la même règle.

Pour les lecteurs d’écran, la carte est une image dont le nom est « Carte de notre zone d’intervention. » suivi de la phrase de la légende. Sous la carte, la liste des quatre villes, la note sur les contours indicatifs et les sources restent lisibles par tous. Les pastilles de la légende (une goutte pour chaque ville, un morceau de la carte pour la zone) sont décoratives et cachées aux lecteurs d’écran. Ce sont des formes sans texte : leur règle CSS déclare `color: transparent`, pour que `npm run contrast` ne les prenne pas pour du texte.

Contrôles du 12 et du 13 novembre 2026, avec les polices du site : la carte a été relue aux largeurs d’écran 320, 360, 390, 768, 1024 et 1440 px, sur les surfaces crème, sable et chocolat, puis à sa place, sur la surface crème de l’accueil (section « proximité ») et de la page de contact. Aucun nom ne chevauche un autre nom, un repère, l’échelle ou le bord de la carte. Aucune requête externe, aucune erreur dans la console. L’outil axe (règles WCAG 2.2 AA) ne relève aucune violation à 390 et 1440 px. Il ne sait pas mesurer le contraste d’un texte dans un SVG : ces valeurs ont été calculées à part (ci-dessus).

## Sources et licences

Natural Earth est dans le domaine public : aucune mention n’est exigée, la carte la cite quand même.

Les positions des villes viennent d’ADMIN EXPRESS (IGN), diffusé par l’API Découpage administratif (geo.api.gouv.fr, Direction interministérielle du numérique) sous Licence Ouverte / Open Licence 2.0 d’Etalab. Cette licence demande de citer la source et sa date. La ligne affichée sous la carte le fait : « Sources : Natural Earth ; IGN, ADMIN EXPRESS, via geo.api.gouv.fr (Licence Ouverte 2.0, novembre 2026). » Son texte est dans `zoneMapText.credit`.

Wikidata (licence CC0) n’a servi qu’au contrôle des positions ; rien n’en est repris sur le site.
