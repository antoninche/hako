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
- `src/components/carte/ZoneMap.astro` : le dessin, la légende et les trois styles.
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

L’étang de Berre y figure comme une étendue de mer, reliée par le canal de Caronte. À cette échelle, la côte est simplifiée au kilomètre près : les îles du Frioul et de Riou n’y sont pas, et la mairie de Toulon, au bord du port, tombe juste du côté de l’eau. Le point reste posé sur la côte, à sa vraie place.

Le cadre va de 4,88° à 6,32° de longitude est et de 42,95° à 43,735° de latitude nord. Au nord, il s’arrête juste avant le lac de Sainte-Croix.

## Projection et tracé

La projection est équirectangulaire, corrigée par le cosinus de la latitude du milieu du cadre (φ0 = 43,34°) :

```text
x = (λ − 4,88) × cos φ0 × s
y = (43,735 − φ) × s
s = 1000 / ((6,32 − 4,88) × cos φ0) ≈ 954,8 unités par degré de latitude
```

λ est la longitude, φ la latitude. Le dessin fait 1000 × 750 unités ; une unité vaut environ 117 m sur le terrain. Les distances sont justes à la latitude φ0, et l’écart reste sous 0,7 % partout ailleurs sur la carte. L’échelle graphique de 20 km mesure 171,3 unités (calcul sur l’ellipsoïde WGS 84).

Le script suit ces étapes : il garde les contours proches du cadre, les projette, les découpe au rectangle (algorithme de Sutherland-Hodgman) avec une marge hors cadre, adoucit la côte (deux passes de Chaikin), puis la simplifie (Douglas-Peucker, écart toléré 0,45 unité). Les lignes d’eau sont les courbes situées à 1,2, 2,8 et 4,9 km de la côte : le script trace les terres sur une grille, calcule pour chaque point de mer sa distance à la terre la plus proche, puis relève les courbes de niveau de cette distance. Les coordonnées sont arrondies au dixième d’unité et écrites en relatif.

Le fichier produit pèse 8,3 Ko (3,5 Ko compressé). Le résultat est identique d’une exécution à l’autre.

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

## Changer le style

Trois styles reprennent les trois pistes des illustrations. On en choisit un avec la constante `PRESET`, en haut de `ZoneMap.astro` :

```ts
const PRESET: 'a' | 'b' | 'c' = 'a';
```

Le style `a`, « trait d’encre fin », est tout au trait : côte en chocolat, lignes d’eau fines en noyer, zone en aplat sable bordé de tirets caramel. Le style `b`, « aplats chauds », pose la mer en aplat lin avec des lignes d’eau claires, les terres en crème cernées de noyer, la zone en sable bordée de caramel. Le style `c`, « papier découpé », superpose des feuilles : mer en lin, bande côtière en sable, terres en crème avec une ombre caramel décalée, zone en sable avec son ombre.

Le style `a` reste en place jusqu’au choix du jury des illustrations. Les trois styles ne diffèrent que par la feuille de style du composant (des variables `--carte-…`, uniquement des jetons de la palette) : le dessin est le même. Une fois le style choisi, on peut supprimer les règles des deux autres.

Dans le même fichier, `ZONE_RADIUS_KM` règle la largeur de la zone autour des villes (8 km) et `LABEL_PLACE` le côté où s’écrit chaque nom.

## Lisibilité et accessibilité

Les noms des villes sont du vrai texte, en D-DIN gras, avec un liseré couleur crème qui les détache du dessin (contraste du texte : 12,2:1 ; nom de la mer et échelle : 7:1). Leur taille reste à l’écran entre 15 et 18 px environ, quelle que soit la largeur de la carte : la feuille de style ajuste la variable `--k` par paliers, selon la largeur du cadre (requêtes de conteneur). Sur une carte étroite, la ligne d’eau la plus proche de la côte disparaît pour garder le dessin aéré.

Pour les lecteurs d’écran, la carte est une image dont le nom est « Carte de notre zone d’intervention. » suivi de la phrase de la légende. Sous la carte, la liste des quatre villes, la note sur les contours indicatifs et les sources restent lisibles par tous.

Les trois styles ont été relus aux largeurs d’écran 360, 390, 768, 1024 et 1440 px, sur les surfaces crème, sable et chocolat, sans requête externe ni erreur dans la console. L’outil axe (règles WCAG 2.2 AA) n’y relève aucune violation à 390 et 1440 px.

## Sources et licences

Natural Earth est dans le domaine public : aucune mention n’est exigée, la carte la cite quand même.

Les positions des villes viennent d’ADMIN EXPRESS (IGN), diffusé par l’API Découpage administratif (geo.api.gouv.fr, Direction interministérielle du numérique) sous Licence Ouverte / Open Licence 2.0 d’Etalab. Cette licence demande de citer la source et sa date. La ligne affichée sous la carte le fait : « Sources : Natural Earth ; IGN, ADMIN EXPRESS, via geo.api.gouv.fr (Licence Ouverte 2.0, novembre 2026). » Son texte est dans `zoneMapText.credit`.

Wikidata (licence CC0) n’a servi qu’au contrôle des positions ; rien n’en est repris sur le site.
