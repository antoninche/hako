# Contrat du modèle 3D

Ce document s’adresse à la personne qui modélise la box dans Blender et l’exporte pour le site. La page d’accueil montre la box qui s’ouvre en vue éclatée pendant le défilement. Tant que `public/models/hako.glb` n’existe pas, le site dessine un modèle provisoire en code. Dès que ce fichier est présent au moment de la construction du site, c’est lui qui s’affiche.

Le contrat ci-dessous garantit que le vrai modèle s’anime exactement comme le provisoire. Les noms d’objets et les limites viennent de `src/scripts/scene-3d/contract.ts` : en cas de doute, c’est ce fichier qui fait foi, et `npm run model:check` le vérifie pour vous.

## Le parcours

1. Préparer la scène dans Blender (unités, noms, transformations, origines, matériaux), comme décrit plus bas.
2. Exporter au format glTF binaire vers `design/3d/hako-source.glb`.
3. Lancer `npm run model:optimize` : le modèle est contrôlé, allégé puis écrit dans `public/models/hako.glb`.
4. Regarder le résultat avec `npm run dev` sur la page d’accueil.
5. Versionner `public/models/hako.glb` (le fichier source, lui, ne l’est pas).

## Les objets attendus

Chaque pièce est un objet Blender qui porte exactement l’un de ces noms, majuscules et tiret bas compris. Un objet peut avoir plusieurs matériaux.

| Nom exact    | Pièce                                                           | Obligatoire |
| ------------ | --------------------------------------------------------------- | ----------- |
| `Case_Base`  | Base du boîtier imprimé en 3D : fond et parois                  | oui         |
| `Case_Lid`   | Couvercle du boîtier, posé au-dessus de la base                 | oui         |
| `Fan`        | Ventilateur : son cadre, sans les pales                         | oui         |
| `Fan_Rotor`  | Moyeu et pales du ventilateur, qui tournent pendant l’ouverture | non         |
| `NVMe_Board` | Carte M.2 qui porte le SSD                                      | oui         |
| `NVMe_SSD`   | Le SSD NVMe                                                     | oui         |
| `RPi5_Board` | Raspberry Pi 5 avec ses composants et ses ports                 | oui         |
| `Logo_Decal` | Marquage 箱 HAKO sur le côté du boîtier                         | non         |

Blender ajoute « .001 » au nom d’une copie (`Fan.001`) : renommez-la ou supprimez-la, le contrôle la signale. Un nom ne peut servir qu’une fois.

Les petits éléments (vis, entretoises, nappe) doivent appartenir à une pièce. Le plus simple est de les joindre à l’objet de la pièce (sélectionner l’élément puis la pièce, Ctrl+J). On peut aussi les ranger sous la pièce (Ctrl+P puis « Object (Keep Transform) ») : ils suivront ses mouvements, avec un avertissement. Un objet hors contrat laissé à la racine de la scène est une erreur, car il resterait immobile pendant l’ouverture.

Une pièce peut être rangée sous une autre, comme dans le modèle provisoire : `Fan_Rotor` sous `Fan`, `NVMe_SSD` sous `NVMe_Board`, `Logo_Decal` sous la pièce qui le porte. Un objet vide (Empty) peut regrouper des pièces, ou toute la box : comme elles, il garde une échelle de 1 et aucune rotation. Un objet hors contrat qui a sa propre géométrie ne doit pas porter de pièces, car cette géométrie resterait immobile pendant que les pièces s’écartent.

Le marquage `Logo_Decal` reprend toujours le logo officiel, jamais un objet texte de Blender tapé avec une police. Le plus simple est un plan (Add > Mesh > Plane) aux proportions du logo, texturé avec `brand/HAKO_Landscape_Transparent.png` : dans son matériau, la sortie Color de l’image va sur Base Color et sa sortie Alpha sur l’entrée Alpha du Principled BSDF. Les bords restent ainsi adoucis (mode « Blend » de glTF) ; un nœud Math réglé sur « Round », intercalé entre ces deux prises Alpha, donne des bords nets (mode « Mask »). Pour un logo en relief, importez plutôt la version vectorielle `public/brand/hako-paysage.svg` (File > Import > Scalable Vector Graphics (.svg)), puis convertissez-la en maillage (Object > Convert > Mesh). Décollez le marquage de la paroi d’environ 0,2 mm : collé contre elle, il scintillerait.

## Préparer la scène

Dans Scene Properties > Units : Unit System « Metric », Unit Scale « 1.000 ». Le champ Length peut afficher des millimètres, ce n’est qu’un affichage : une unité de Blender vaut toujours un mètre. La box est modélisée à sa taille réelle. Le contrôle refuse un modèle dont la plus grande dimension n’est pas comprise entre 3 cm et 50 cm : c’est presque toujours un modèle importé en millimètres depuis un logiciel de CAO.

La box est debout, couvercle en haut, comme posée sur une table. Blender travaille avec Z vers le haut ; l’export convertit vers la convention glTF, Y vers le haut, tant que l’option « +Y Up » reste cochée. La position dans la scène importe peu : le site recentre la box et la pose sur le sol. Placez-la quand même au centre, sur le sol, pour vous y retrouver.

Sélectionnez tout (A), puis Ctrl+A > All Transforms. Chaque objet a alors une échelle de 1 et aucune rotation. Une échelle différente de 1 est une erreur ; une rotation non appliquée est signalée par un avertissement.

## Origines et axe du rotor

Pour chaque objet : Object > Set Origin > Origin to Geometry, puis dans le panneau de l’opération (en bas à gauche, ou F9), choisissez Center « Bounds Center » (« Bounding Box Center » dans le manuel). Une origine éloignée du centre de la pièce donne un avertissement.

Le rotor fait exception : il tourne autour de son origine, qui doit donc être exactement sur l’axe, au centre du moyeu. En mode Édition, sélectionnez les sommets du moyeu, puis Maj+S > Cursor to Selected. En mode Objet, Object > Set Origin > Origin to 3D Cursor. Une origine nettement décalée de l’axe est une erreur : le rotor tournerait de travers.

Le rotor tourne autour de l’axe choisi par `rotor.axis` dans `src/data/model.config.json`, y par défaut. Les axes du site sont ceux de glTF : x correspond au X de Blender, y au Z de Blender (la verticale) et z au -Y de Blender (vers l’avant). Un ventilateur posé à plat, qui souffle vers le haut, tourne donc autour de y ; monté sur une paroi avant ou arrière, autour de z.

## Matériaux, textures et poids

Chaque matériau repose sur un nœud Principled BSDF branché sur la sortie du matériau. L’export lit Base Color, Metallic, Roughness, Normal (avec un nœud Normal Map), Emission et Alpha, en valeur fixe ou avec une texture image. Les textures procédurales (Noise, Voronoi, Wave, Brick…) et les mélanges de nœuds ne sont pas exportés : la pièce apparaîtrait unie. Pour les garder, « cuisez »-les dans une image (moteur Cycles, Render Properties > Bake) et branchez cette image à la place.

Les images de couleur sont en espace « sRGB » ; les autres (rugosité, métal, normales) en « Non-Color ». Évitez la transmission (verre) : l’affichage serait lent sur téléphone, le contrôle le signale.

Les textures font au plus 2048 px de côté, en PNG ou JPEG. Au-delà, `npm run model:optimize` les réduit, mais mieux vaut fournir directement la bonne taille : 1024 px suffisent souvent pour une pièce de quelques centimètres. Le format .glb intègre les images au fichier.

Le modèle compte au plus 100 000 triangles au total, sinon le contrôle échoue. Les pièces les plus lourdes sont souvent les ports et les composants du Raspberry Pi : un modificateur Decimate (Add Modifier > Generate > Decimate) ou la suppression des détails cachés à l’intérieur suffisent en général. Après optimisation, le fichier vise 2 Mo au plus ; au-delà, un avertissement s’affiche.

Le site a ses propres lumières et sa propre caméra, et anime la box lui-même : lampes, caméras, animations, armatures et clés de forme sont inutiles. L’optimisation retire lampes et caméras ; le reste est signalé.

## Exporter depuis Blender

Les intitulés sont ceux de l’interface en anglais, la langue par défaut de Blender. Ils ont été vérifiés le 12 novembre 2026 dans les manuels de Blender 4.2, 4.5, 5.0 et 5.1 (page « glTF 2.0 » de docs.blender.org, par exemple https://docs.blender.org/manual/en/4.5/addons/import_export/scene_gltf2.html).

1. Sélectionnez les objets à exporter (ou masquez tout le reste).
2. File > Export > glTF 2.0 (.glb/.gltf).
3. Format : « glTF Binary (.glb) ».
4. Include : cochez « Selected Objects » (ou « Visible Objects »). Dans Data, décochez « Custom Properties », « Cameras » et « Punctual Lights ».
5. Transform : « +Y Up » coché.
6. Data > Mesh : « Apply Modifiers » coché, « UVs » et « Normals » cochés, « Tangents », « Loose Edges » et « Loose Points » décochés.
7. Data > Material : Materials « Export », Images « Automatic ».
8. Data > Compression : décoché. Le site ne lit pas la compression Draco ; `npm run model:optimize` compresse lui-même le modèle.
9. Animation : décoché.
10. Enregistrez sous `design/3d/hako-source.glb`, dans le dossier du site.

Cochez « Remember Export Settings » pour que ces réglages restent dans le fichier .blend.

Le fichier source n’est pas versionné : il est lourd et se régénère depuis Blender. La ligne `design/3d/*.glb` du fichier `.gitignore` l’écarte de Git.

## Optimiser et vérifier

```sh
npm run model:optimize
npm run model:check
```

`npm run model:optimize` lit `design/3d/hako-source.glb` et écrit `public/models/hako.glb`. Il contrôle d’abord le fichier source et s’arrête s’il trouve une erreur, sans toucher au fichier du site. Il retire ensuite lampes et caméras, fusionne les doublons, supprime ce qui ne sert pas, soude les sommets identiques, réduit les textures à 2048 px et garde pour chacune la version la plus légère sans différence visible (WebP, PNG à palette ou l’image d’origine ; les cartes de normales et de rugosité restent exactes au pixel près). Il quantifie enfin la géométrie (coordonnées stockées en nombres entiers, extension KHR_mesh_quantization) et la réordonne pour que le serveur la compresse mieux, contrôle le résultat et affiche le poids avant et après. Les objets nommés gardent exactement leur position, leur rotation et leur échelle. Le fichier obtenu se lit sans décodeur : il respecte la politique de sécurité des contenus prévue pour le site (CSP `default-src 'self'`).

Pour d’autres chemins : `npm run model:optimize -- chemin/source.glb chemin/sortie.glb`.

L’option `--meshopt` (`npm run model:optimize -- --meshopt`) compresse en plus la géométrie avec meshopt (extension EXT_meshopt_compression). Le fichier est plus léger, mais le navigateur doit exécuter un décodeur WebAssembly, que la CSP prévue bloque : le site afficherait alors le modèle provisoire. Ne l’utilisez que si la CSP du site ajoute `'wasm-unsafe-eval'` à `script-src` : `docs/hebergement.md` (partie « La scène 3D ») indique les quatre endroits à modifier. `npm run model:check` le rappelle par un avertissement.

`npm run model:check` contrôle `public/models/hako.glb`, ou le fichier donné (`npm run model:check -- chemin/modele.glb`). L’option `--source` applique les règles du fichier brut exporté de Blender, avant optimisation. Sans modèle dans `public/models/`, la commande indique que le site utilise le modèle dessiné en code et vérifie seulement les noms de `src/data/model.config.json`. Chaque ligne commence par ERREUR (le modèle n’est pas utilisable), ATTENTION (utilisable, à corriger si possible) ou INFO, suivie de la correction à faire dans Blender. La commande échoue (code de sortie 1) s’il reste une erreur.

## Comment le site l’utilise

À la construction, `src/components/home/BoxScene.astro` regarde si `public/models/hako.glb` existe. Si oui, la page le charge quand la section 3D approche de l’écran, avec le chargeur GLTFLoader de three.js. Sinon, elle dessine le modèle provisoire. Si le fichier ne se charge pas, ou s’il lui manque une pièce obligatoire, le site revient au modèle provisoire et l’indique dans la console du navigateur. Après avoir ajouté ou retiré le fichier, reconstruisez le site (`npm run build`) ; avec `npm run dev`, rechargez la page.

## Régler l’animation

L’ouverture se règle dans `src/data/model.config.json`, sans toucher au code. Le fichier est vérifié à la construction par `src/scripts/scene-3d/config.ts` : une valeur hors limites fait échouer `npm run build` avec un message qui nomme la clé fautive. `npm run model:check` vérifie en plus que les noms de pièces existent dans le contrat et que le rotor et le marquage suivent bien leur pièce.

Le mouvement de chaque pièce pendant l’ouverture se règle dans `parts` :

```json
"parts": {
  "Case_Lid": { "offset": [0, 0.104, 0], "delay": 0, "duration": 0.6, "ease": "inOutCubic" }
}
```

`offset` est le déplacement en mètres, dans le repère du modèle (y vers le haut). `delay` et `duration` sont des fractions de l’ouverture, de 0 à 1, avec `delay + duration` au plus égal à 1. `ease` est la courbe du mouvement, parmi `linear`, `inQuad`, `outQuad`, `inOutQuad`, `inCubic`, `outCubic`, `inOutCubic`, `inSine`, `outSine`, `inOutSine`, `outQuart` et `inOutQuart`.

Une pièce sans réglage ne bouge pas d’elle-même : elle suit la pièce sous laquelle elle est rangée. Le déplacement d’une pièce rangée sous une autre se compte toujours depuis sa position de repos, dans le repère du modèle : le site retire de lui-même le mouvement de la pièce qui la porte. Pour qu’elle reste solidaire, donnez-lui le même réglage, comme `Fan_Rotor` et `Fan`.

Les étiquettes se règlent avec `order`, la liste des pièces étiquetées de haut en bas, et `labels`, qui donne pour chacune un titre (`title`) et une phrase courte facultative (`detail`). Chaque pièce de `order` doit avoir son entrée dans `labels`.

Le rotor se règle avec `rotor` : `axis` vaut x, y ou z dans le repère du rotor (voir « Origines et axe du rotor »), et `turnsPerSecond` donne la vitesse en tours par seconde, de 0 à 5. Le rotor se met à tourner à mesure que le ventilateur s’écarte.

Le déroulé suit le défilement dans `timeline`. Chaque piste est une liste de clés `{ "at": …, "value": …, "ease": … }`, où `at` va de 0 (début de la section) à 1 (fin) : `rotationY` fait tourner la box (en radians), `explode` règle l’ouverture (0 fermée, 1 vue éclatée), `labels` l’opacité des étiquettes et `elevation` la hauteur du regard (en radians au-dessus de l’horizon).

Les autres clés (`labelStagger`, `smoothing`, `camera`, `portraitSpread`, et `procedural`, qui ne sert qu’au modèle provisoire) sont décrites avec leurs limites dans `src/scripts/scene-3d/config.ts`.

## En cas de problème

« Le modèle mesure 100 m » ou une taille 1 000 fois trop grande : le modèle vient d’un fichier en millimètres. Réduisez-le à 0,001 (touche S, puis 0.001), puis Ctrl+A > Scale.

La box apparaît couchée ou à l’envers : l’option « +Y Up » était décochée à l’export, ou une rotation n’a pas été appliquée.

Des faces noires ou transparentes : une échelle négative (effet miroir) ou des normales retournées. Appliquez l’échelle, puis en mode Édition, Mesh > Normals > Recalculate Outside (Maj+N).

Une pièce s’affiche unie, sans sa texture : le matériau utilise des nœuds non exportés, ou l’image n’est pas branchée sur le Principled BSDF. Cuisez la texture dans une image.

Le rotor tourne de travers : son origine n’est pas sur l’axe (voir « Origines et axe du rotor »). Il tourne sur la tranche : changez `rotor.axis`.

Le marquage ou le rotor se détache pendant l’ouverture : rangez-le sous sa pièce dans Blender (Ctrl+P), ou donnez-lui le même réglage que sa pièce dans `parts`.

Des pièces se chevauchent pendant l’ouverture : augmentez l’écart entre leurs `offset`, en gardant l’ordre de haut en bas.

Le contrôle parle de KHR_draco_mesh_compression : décochez Data > Compression à l’export.

Le fichier est trop lourd : réduisez les textures à 1024 px, simplifiez les pièces les plus détaillées et supprimez ce qui ne se voit pas.

Le site affiche toujours le modèle provisoire : le fichier n’était pas là au moment de la construction (reconstruisez), une pièce obligatoire manque (la console du navigateur le dit et `npm run model:check` le détaille), ou le fichier a été produit avec `--meshopt` alors que la CSP du site n’autorise pas WebAssembly (voir « Optimiser et vérifier »).

## Pour les développeurs

Les noms, les limites et la fonction `compareNodeNames` sont dans `src/scripts/scene-3d/contract.ts`. Les scripts sont dans `scripts/model/`. Deux modèles d’essai servent aux tests : `tests/fixtures/hako-test.glb` respecte le contrat, `tests/fixtures/hako-test-mauvais.glb` accumule les erreurs d’export courantes. `npm run model:test-glb` les régénère et `npm run test:unit` lance les tests (`node --test tests/unit/`).
