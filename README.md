# Site de HAKO

HAKO est une jeune entreprise de Provence. Elle installe chez ses clients, familles et petites entreprises, une petite box qui garde leurs photos et leurs fichiers chez eux, puis les forme et les accompagne. Ce dépôt contient son site web, construit avec Astro en pages statiques. Le site ne dépose aucun cookie et ne charge rien depuis un autre site : polices, logo et icônes sont servis par le site lui-même, et les tests le vérifient à chaque lancement.

Aperçu en ligne : https://antoninche.github.io/hako/. Il est reconstruit et publié à chaque envoi sur la branche `main` (`.github/workflows/apercu.yml`). Comme il est servi dans le sous-dossier `/hako/`, l'étape `scripts/deploy/sous-dossier.mjs` réécrit les adresses du site construit ; avec un nom de domaine propre, on publie `dist/` tel quel.

## Prérequis

- Node.js 22.23.4 ou plus récent, avec npm. Le projet est testé avec Node 26.8.2 (le fichier `.nvmrc` indique la version 26).
- Pour les tests, le navigateur Chromium de Playwright, à installer une fois avec `npx playwright install chromium` (sous Linux, ajouter `--with-deps`).
- Seulement pour régénérer les polices : [uv](https://docs.astral.sh/uv/), qui installe à part Python et les outils de polices.
- Seulement pour régénérer le logo : [potrace](https://potrace.sourceforge.net/) 1.16 (`brew install potrace` sous macOS, `apt install potrace` sous Debian ou Ubuntu).

## Installation

```sh
npm ci
npm run dev
```

`npm ci` installe exactement les versions notées dans `package-lock.json`. Le site s’ouvre ensuite sur http://localhost:4321 et se met à jour à chaque modification. Pour voir le site tel qu’il sera publié : `npm run build`, puis `npm run preview`. Astro 7 n’accepte qu’un serveur de prévisualisation suivi par projet : si `npm run preview` signale qu’un autre tourne déjà, `npx astro preview stop` l’arrête, ou `npx astro preview --ignore-lock` en ouvre un second à côté (c’est ce que font les tests).

## Commandes

| Commande                       | Rôle                                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                  | serveur de développement sur http://localhost:4321, mis à jour à chaque modification                             |
| `npm run build`                | construit le site statique dans `dist/`                                                                          |
| `npm run preview`              | sert `dist/` sur http://localhost:4321, comme en production                                                      |
| `npm run check`                | vérifie les types TypeScript et les composants Astro (`astro check`)                                             |
| `npm run lint`                 | enchaîne `astro check`, ESLint (règles d’accessibilité comprises) et la vérification de mise en forme (Prettier) |
| `npm run format`               | remet en forme tous les fichiers avec Prettier                                                                   |
| `npm run todos`                | écrit la liste des informations manquantes dans `TODO.md`                                                        |
| `npm run contrast`             | recalcule le contraste de chaque couple texte/fond du CSS et échoue sous 4,5:1                                   |
| `npm run check:dist`           | contrôle `dist/` : aucune ressource d’un autre site, aucun script ni style en ligne, ni cookie ni stockage local |
| `npm test`                     | construit le site, le sert sur le port 4321 et lance tous les tests dans Chromium                                |
| `npm run screenshots`          | prend seulement les captures d’écran de chaque page, dans `qa/screenshots/`                                      |
| `npm run fonts:build`          | reconstruit les polices à partir de leurs sources officielles (demande uv)                                       |
| `npm run logo:build`           | revectorise le logo et refait le favicon, les icônes, le manifeste et l’image de partage (demande potrace)       |
| `npm run prototype:images`     | refait les images du prototype de `src/assets/prototype/` à partir des captures de `design/prototype/`           |
| `npm run illustrations:build`  | refait les dessins de `src/assets/illustrations/` à partir de leurs sources (`design/illustrations/`)            |
| `npm run illustrations:check`  | vérifie les couleurs et la structure de chaque dessin                                                            |
| `npm run illustrations:render` | enregistre une image PNG de chaque dessin, pour les regarder (dans `design/illustrations/renders/`)              |

Les tests vérifient que chaque page s’affiche sans erreur, que la page 404 répond, que chaque lien interne mène à une page ou un fichier qui existe, qu’aucune requête ne quitte la machine et qu’aucun cookie n’est déposé (à 390 et 1440 px de large), l’accessibilité avec axe (WCAG 2.2 AA), le lien d’évitement, le menu au clavier, des cibles tactiles de 44 × 44 px dans l’en-tête et le pied de page, le surlignage des informations manquantes, l’affichage avec moins d’animations, et deux constructions à part (dans `.tmp/tests/`) : la démonstration avec `PUBLIC_SHOW_TODOS=false` et l’adresse canonique avec `SITE_URL`. Les captures sont faites à 390 et 1440 px ; `CAPTURE_WIDTHS=360,768,1024 npm run screenshots` en ajoute d’autres. Si un serveur tourne déjà sur le port 4321, Playwright le réutilise sans reconstruire le site : arrêtez-le avant de lancer les tests. Pour construire ailleurs que dans `dist/` : `PW_OUT_DIR=.tmp/dist-essai PW_PORT=4410 npm test`.

## Modifier les textes et les informations

Les informations de l’entreprise sont rassemblées dans `src/data/`, les textes des pages dans `src/content/`, avec le titre et le résumé de chaque page (onglet du navigateur, moteurs de recherche). Les composants ne contiennent que des mots de structure (« Menu », « Plan du site », « Nous suivre », « Crédits »…) ; seule la charte interne `/charte/` garde ses textes d’exemple dans sa page.

- `entreprise.ts` : nom, accroche, promesse, e-mail, téléphone, nom de domaine, réseaux sociaux, zone d’intervention, équipe et phrases du pied de page.
- `tarifs.ts` : tous les prix et les options de stockage (voir [docs/commande.md](docs/commande.md)).
- `faits.ts` : les faits que plusieurs pages reprennent (accès depuis l’extérieur, copie de secours, déménageur, paiement, garantie, frais d’envoi, acompte), écrits une seule fois.
- `navigation.ts` : liens de l’en-tête, du plan du site et des pages légales.
- `credits.ts` : auteurs et licences des polices et des icônes, affichés dans les mentions légales.
- `types.ts` : forme des informations de `entreprise.ts` (à changer seulement pour un nouveau genre d’information).

Les prix, les pourcentages et les nombres s’écrivent avec `src/lib/format.ts` (`formatEur()`, `formatPercent()`…), le seul fichier qui appelle `Intl` : « 1 000 € » s’écrit partout de la même façon, avec des espaces insécables.

Dans `entreprise.ts` et `credits.ts`, on peut écrire des espaces ordinaires : les espaces insécables avant « : » et à l’intérieur des guillemets « » sont posées automatiquement (`src/lib/typography.ts`). Pour l’apostrophe, on écrit ’ ; un texte qui contient l’apostrophe droite (') s’entoure de guillemets doubles ("quelqu'un"), sinon la construction échoue. Les autres règles de typographie et de ton sont dans [docs/brand.md](docs/brand.md).

Une information encore inconnue s’écrit avec l’outil `todo()` de `src/lib/todo.ts`, qui reçoit ce qui manque puis le texte provisoire affiché entre crochets. Quand l’information arrive, on remplace tout l’appel par la valeur :

```ts
phone: todo('Numéro de téléphone de contact', '[numéro de téléphone]'),
// devient
phone: '04 00 00 00 00',
```

Chaque fichier de `src/pages/` est une page, dont l’adresse suit le nom du fichier et finit par « / » (`offres.astro` donne `/offres/`). Une page utilise le gabarit `BaseLayout` ; une page intérieure s’ouvre avec `PageIntro`, qui pose son titre (exemple dans [docs/brand.md](docs/brand.md)). Chaque nouvelle page s’ajoute aussi dans `tests/routes.ts`, pour que les tests et les captures la couvrent.

## Informations manquantes (TODO)

Tant qu’une information manque, le site affiche son texte provisoire surligné en jaune. Elle se déclare de deux façons :

- dans `src/data/`, avec `todo('ce qui manque', '[texte provisoire]')`, puis `<Fact value={company.phone} />` dans la page (avec `link="email"`, `"phone"` ou `"url"`, la valeur devient un lien une fois connue) ;
- directement dans une page, avec `<Todo what="Durée des mises à jour de sécurité">[durée]</Todo>`.

Dans `src/data/`, une valeur `null` suivie d’un commentaire `// TODO: description` compte aussi.

`npm run todos` parcourt `src/` et écrit `TODO.md` : chaque information manquante y figure avec son fichier, son numéro de ligne, ce qui manque et le texte provisoire. Ce qui est en commentaire ou calculé n’est pas compté ; les exemples de la page `/charte/` n’y figurent donc pas. Le fichier ne contient aucune date ; il se met à jour en relançant la commande, jamais à la main. `npm run todos -- --check` vérifie qu’il est à jour sans le réécrire.

Pour une démonstration sans surlignage, copiez `.env.example` en `.env` et mettez `PUBLIC_SHOW_TODOS=false`, puis relancez `npm run dev` ou `npm run build`. Le texte provisoire reste, sans fond jaune ni infobulle, dans un simple `<span>` que les lecteurs d’écran lisent comme du texte ordinaire.

Le même fichier `.env` accepte `SITE_URL`, l’adresse publique du site, à renseigner avant la mise en ligne : chaque page indexable déclare alors son adresse complète (lien canonique). Sans elle, les pages n’en déclarent aucune.

## Polices, logo et icônes

Les trois polices, Fraunces pour les titres, Atkinson Hyperlegible Next pour le texte et D-DIN pour l’interface, sont servies depuis `public/fonts/`, chacune avec sa licence. `npm run fonts:build` les produit à partir des sources officielles de leurs créateurs : voir [docs/fonts.md](docs/fonts.md).

Le logo vient des trois PNG fournis dans `brand/`. `npm run logo:build` les vectorise et en tire les SVG de `src/assets/brand/` et `public/brand/`, le favicon, les icônes d’application, le manifeste et l’image de partage : voir [docs/logo.md](docs/logo.md). Les icônes des réseaux sociaux viennent de Simple Icons et de Bootstrap Icons : voir [docs/icons.md](docs/icons.md). Tous ces fichiers sont produits par les deux commandes : une retouche à la main serait perdue à la construction suivante.

Les images du prototype (l’ouverture de l’accueil et la galerie de la page « La box ») sont des captures du modèle 3D de la box, faites par l’équipe et rangées dans `design/prototype/`. `npm run prototype:images` les nettoie (pointeur de la souris, trace de l’interface), les convertit en sRGB et les cadre ; Astro en tire les versions AVIF et WebP. Leurs textes sont dans `src/content/prototype.ts` ; chaque légende dit que ce sont des images de synthèse.

Les dessins du site sont produits par un générateur versionné dans `design/illustrations/` : voir [docs/illustrations.md](docs/illustrations.md).

Les licences de tous les éléments tiers sont réunies dans [docs/licences.md](docs/licences.md). Sur le site, la rubrique « Crédits » de la page des mentions légales cite les auteurs des polices et des icônes, avec un lien vers chaque licence (`src/data/credits.ts`).

## Charte graphique

La page `/charte/` (http://localhost:4321/charte/ avec `npm run dev`) est une page interne : elle n’est liée nulle part et demande aux moteurs de recherche de ne pas l’indexer. Elle montre les couleurs et leurs contrastes, les surfaces, la typographie, les boutons, le logo et les icônes, avec les valeurs de `src/styles/tokens.css` relues à chaque construction. Les règles d’usage et les composants sont décrits dans [docs/brand.md](docs/brand.md).

## Organisation du dépôt

```text
hako-site/
├── brand/            PNG d’origine du logo
├── design/           captures du prototype (prototype/) et sources des dessins (illustrations/)
├── docs/             charte graphique, polices, logo, icônes, licences
├── public/           fichiers servis tels quels : polices et licences, favicon,
│                     icônes, manifeste, image de partage, logo en fichiers autonomes,
│                     licence de Bootstrap Icons (licences/)
├── qa/logo/          images de contrôle de la vectorisation du logo
├── scripts/          commandes todos, contrast et check:dist, polices (fonts/), logo (logo/)
├── src/
│   ├── assets/       logo SVG et icônes des réseaux sociaux
│   ├── components/   en-tête, pied de page, logo, icônes, informations manquantes…
│   ├── data/         textes et informations de l’entreprise, liens du site
│   ├── layouts/      gabarit commun à toutes les pages
│   ├── lib/          outils todo() et typographie française
│   ├── pages/        une page par fichier
│   └── styles/       jetons de design, polices, styles de base
├── tests/            tests Playwright et jeux d’essai des scripts
├── CHANGELOG.md      journal des modifications
├── TODO.md           informations manquantes (produit par npm run todos)
├── astro.config.mjs
├── eslint.config.js
├── playwright.config.ts
└── package.json
```

Les commandes produisent aussi des dossiers qui ne sont pas versionnés : `dist/` (site construit), `qa/screenshots/` (captures), `test-results/` (résultats des tests), `.cache/` (téléchargements des polices) et `.tmp/` (essais).
