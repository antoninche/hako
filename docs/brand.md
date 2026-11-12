# Charte graphique et système de design

Ce document décrit les règles visuelles du site et la manière d’utiliser les composants. La page `/charte/` du site (non indexée, liée nulle part) montre tout cela en vrai : couleurs, surfaces, typographie, boutons, logo et icônes. Ses valeurs sont lues dans `src/styles/tokens.css` à chaque construction, elle ne peut donc pas se décaler du code.

Documents voisins : [polices](fonts.md), [logo et favicon](logo.md), [icônes](icons.md), [licences](licences.md).

## Jetons et rôles

Les valeurs communes (couleurs, polices, échelle typographique, espacements, rayons, ombres, durées) sont des propriétés CSS définies dans `src/styles/tokens.css`, et les composants s’en servent. Quelques réglages propres à un seul composant restent écrits dans son fichier : hauteurs du logo et taille de 17 px des liens du menu dans `Header.astro`, par exemple. Les seuils de largeur des `@media` (48rem, 64rem…) sont aussi écrits en clair, car une requête média ne peut pas lire une propriété CSS ; le seuil de 64rem, lu aussi par le script du menu et par les tests, est défini une fois dans `src/lib/breakpoints.ts`, et les `@media (min-width: 64rem)` doivent rester d’accord avec lui. Si un composant a besoin d’une valeur commune nouvelle, on la signale à la personne qui tient `tokens.css`.

| Jeton        | Valeur  | Usage                                                              |
| ------------ | ------- | ------------------------------------------------------------------ |
| `--creme`    | #FDF7EF | fond principal                                                     |
| `--chocolat` | #412D1E | texte, logo, boutons principaux                                    |
| `--sable`    | #F2E6D6 | fond de section alterné                                            |
| `--lin`      | #E6D5BF | filets, bordures, aplats discrets (jamais du texte sur fond clair) |
| `--noyer`    | #6B4F3A | texte secondaire                                                   |
| `--terre`    | #9A4E2B | liens, accents, survol des boutons                                 |
| `--caramel`  | #B9773F | illustrations et décor (jamais du texte)                           |
| `--olive`    | #5E6B45 | états de réussite                                                  |
| `--todo`     | #FFE066 | surlignage des informations manquantes, rien d’autre               |

Un composant ne colore jamais du texte avec une couleur de la palette. Il passe par les rôles de la surface où il se trouve : `--text`, `--text-muted`, `--link`, `--link-hover`, `--success`, `--line`, `--line-strong`, `--focus` et `--surface`. Seule exception : une règle qui fixe le texte et le fond ensemble, comme les boutons ou le surlignage jaune. `npm run contrast` vérifie chaque rôle sur chaque surface et chaque couple texte/fond déclaré (4,5:1 pour le texte, 3:1 pour les filets forts et l’anneau de focus) ; il échoue si un texte reçoit une couleur de la palette sans fond associé.

## Surfaces

Trois surfaces existent, chacune définit son fond et ses rôles de texte.

- `.surface-creme` : la page par défaut.
- `.surface-sable` : une section sur deux quand une page alterne les fonds.
- `.surface-chocolat` : le pied de page et, avec parcimonie, un moment fort (un appel à commander en fin de page, par exemple).

On choisit la surface d’une section avec le composant `Section` (`<Section surface="sable">`) ou la classe directement. Le bouton principal s’inverse tout seul sur fond chocolat (fond crème, texte chocolat) ; pour que cette inversion reste juste, on ne place pas de bloc crème ou sable à l’intérieur d’une surface chocolat. Le pied de page est en chocolat : il ferme la page nettement et le logo y passe en crème.

Le fond reste uni. Un grain de papier a été envisagé, puis écarté : il assombrit le fond par endroits, donc il réduit un peu le contraste, et le lien terre sur sable n’a déjà que 4,9:1 de marge.

## Typographie

Trois familles, toutes auto-hébergées (voir [fonts.md](fonts.md)).

Fraunces pour les titres, avec l’axe SOFT à 100 (courbes adoucies), WONK à 0 et la taille optique automatique. Le fichier livré fige déjà SOFT et WONK à ces valeurs (voir [fonts.md](fonts.md)) ; le jeton `--font-display-variation` les répète pour le cas où l’on livrerait un jour la police complète. Graisses entre 400 et 600 : 400 pour `h1` et le grand titre d’accueil (`.display`), puis un peu plus de graisse à mesure que le titre rapetisse. Interligne serré (`--leading-tight`) et `text-wrap: balance` pour des lignes de longueur égale.

Atkinson Hyperlegible Next pour le texte courant : 18 px (`--step-0`), interligne 1,6, lignes de 70 caractères au plus (`--measure`, appliqué à tous les paragraphes). `--measure` vaut 31em et non 70ch : l’unité `ch` est la largeur du zéro, bien plus large qu’une lettre moyenne dans cette police, et 70ch donnaient environ 100 caractères par ligne. `.lead` donne un texte d’introduction un cran plus grand, `.small` une mention de 16 px.

D-DIN pour l’interface : navigation, boutons, étiquettes, prix, noms d’offres. Toujours en gras (700), en casse normale, avec un interlettrage de 0,02 em (`--tracking-ui`). La casse normale garde la silhouette des mots et se lit plus vite que les capitales, ce qui compte pour un public peu à l’aise avec l’informatique ; le léger interlettrage aère ce dessin étroit aux petites tailles. Les capitales sont réservées aux surtitres de deux ou trois mots (`.kicker`, interlettrage 0,08 em).

Les prix utilisent `.price` : jamais coupés en fin de ligne. D-DIN n’a pas de chiffres de largeur fixe (voir [fonts.md](fonts.md)) : un montant qui change, comme le total d’une commande, change donc un peu de largeur ; on lui réserve sa place si besoin. On les formate avec `Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })`, qui place une espace insécable fine entre les milliers et une espace insécable avant l’euro (« 1 000 € »).

Typographie française : apostrophe courbe (’), espace insécable avant « : » et à l’intérieur des guillemets « », espace fine insécable avant « ; », « ! » et « ? ». Dans un gabarit Astro on écrit `&nbsp;` et `&#8239;`. Dans un fichier de données, une espace ordinaire suffit : `withFrenchTypography()` (dans `src/lib/typography.ts`) pose ces espaces et l’apostrophe courbe là où les données sont définies. Les noms composés comme Salon-de-Provence ne doivent pas être coupés : `keepHyphenatedWords()` (dans `src/components/typo.ts`) les entoure d’un `<span class="nowrap">`.

Attention aux espaces dans les gabarits : Astro 7 supprime les blancs comme JSX. Un mot suivi d’un retour à la ligne puis d’une balise (`<a>`, `<code>`, `<Todo>`…) perd son espace. On garde le mot et la balise sur la même ligne, ou on ajoute `{' '}`.

## Espace et rythme

L’espace vide fait partie de la mise en page : chaque section garde de larges marges autour de son contenu. Les espacements viennent de l’échelle `--space-3xs` à `--space-3xl` ; l’espace entre deux sections est `--space-section`.

- `.container` et `.container-narrow` centrent le contenu avec les marges latérales `--gutter`.
- `.stack` empile ses enfants avec un écart régulier (variantes `.stack--2xs` à `.stack--2xl`).
- `.cluster` aligne des éléments en ligne, avec retour à la ligne (variantes `.cluster--xs`, `.cluster--l`).
- `Section` règle la surface et l’espace vertical (`space="s" | "m" | "l"`) ; `PageIntro` ouvre une page intérieure avec son `h1` et un filet court.
- Les filets font 1 px : `.rule` (couleur `--line`), `.rule--strong` (`--line-strong`), `.rule--short` sous un titre.

## Composants

`BaseLayout` (`src/layouts/`) est utilisé par toutes les pages. Il reçoit `title` (sans le nom du site, il ajoute « · HAKO » ; sans titre, c’est l’accueil), `description`, `noindex` et `surface`. Il pose la langue, le mode d’affichage des informations manquantes, les favicons, le lien d’évitement « Aller au contenu », l’en-tête, `<main id="contenu">` et le pied de page.

```astro
<BaseLayout title="Nos offres" description="Ce que comprend chaque offre.">
  <PageIntro title="Nos offres">
    <p class="lead">Texte d’introduction.</p>
  </PageIntro>
</BaseLayout>
```

`Header` est collant en haut de l’écran. Sur grand écran (64rem et plus) : logo, menu principal, bouton « Commander ». Sur petit écran : logo, « Commander » toujours visible et bouton « Menu » qui déplie un panneau sous la barre. Ce panneau n’est pas une fenêtre modale : rien n’est bloqué derrière. Échap le ferme et rend le focus au bouton ; un lien, un clic en dehors, le focus qui sort de l’en-tête ou le passage en grand écran le ferment aussi. Sans JavaScript, un lien « Menu » mène au plan du site en bas de page. Si la personne a agrandi la taille du texte dans son navigateur, « Commander » et « Menu » passent sous le logo plutôt que de sortir de l’écran ; le panneau part toujours du bas réel de l’en-tête. Le comportement est dans `src/components/header-menu.ts`, l’animation (glissé et fondu, `--dur-2`) en CSS. Le lien de la page en cours porte `aria-current="page"`.

`Footer` réunit le logo, la zone d’intervention, l’e-mail, le plan du site (`id="plan-du-site"`), les réseaux sociaux, les pages légales et les deux phrases sur le site lui-même, écrites en couleur pleine. Toute sa navigation (plan du site, réseaux, pages légales) est en D-DIN gras. Ses textes viennent des fichiers de données. Les auteurs des polices et des icônes sont cités dans la rubrique « Crédits » de la page des mentions légales (`src/data/credits.ts`).

`Logo` affiche une des cinq variantes (`paysage`, `carre`, `reseaux`, `kanji`, `mot`) en SVG dans la page, à la couleur du texte. Sa taille se règle en CSS par la hauteur. Le cadre des fichiers est serré autour du dessin (sauf `reseaux`, qui garde sa marge) : 36 px de haut donnent 36 px de logo visible. Il est annoncé « HAKO » par les lecteurs d’écran, ou ignoré avec `decorative` quand le nom est déjà écrit à côté. Le logo n’est jamais retapé dans une police (voir [logo.md](logo.md)).

`Icon` affiche une icône d’interface (`menu`, `close`, `mail`, `map-pin`, `arrow-right`, `external`, trait de 1,5 sur une grille de 24) ou de réseau social (`linkedin`, `youtube`, `facebook`, `instagram`, `peertube`). Elle est décorative par défaut ; si elle est seule, on lui donne un `label`. Les icônes de réseaux sont décrites dans [icons.md](icons.md).

Boutons : `.btn` avec `.btn--primary` (fond chocolat, texte crème ; au survol et au focus, fond terre) ou `.btn--secondary` (contour fin aux couleurs de la surface). `.btn--compact` sert dans l’en-tête. Cibles de 44 × 44 px au moins (`--target-min`) pour tous les boutons et liens d’interface, « FAQ » compris : les liens courts reçoivent une largeur minimale.

Liens : dans le texte, toujours soulignés, couleur `--link` ; le soulignement s’épaissit au survol. Dans la navigation, le soulignement n’apparaît qu’au survol et pour la page en cours.

Focus : anneau de 2 px couleur `--focus`, décalé de 3 px, visible au clavier (`:focus-visible`). On ne le retire jamais. L’en-tête collant ne cache pas l’élément qui a le focus grâce à `scroll-padding-top`.

Mouvement : uniquement avec les durées `--dur-1` (survol), `--dur-2` (menu) et `--dur-3` (apparitions lentes), et la courbe `--ease-out`. Ces durées tombent à zéro quand la personne a demandé moins d’animations dans son système. Pas de lecture automatique, pas de fenêtre surgissante.

## Informations manquantes

Ce qui n’est pas encore connu ne s’invente pas : on l’écrit comme information manquante. Le site l’affiche surlignée en jaune avec un texte provisoire entre crochets, et `npm run todos` en dresse la liste dans `TODO.md`.

- Dans `src/data/` : `todo('ce qui manque', '[texte provisoire]')` (voir `src/lib/todo.ts`), puis `<Fact value={…} />` pour l’afficher. `Fact` affiche la valeur si elle est connue (avec `link="email"`, `"phone"` ou `"url"`, elle devient un lien), sinon le texte provisoire surligné.
- Dans une page : `<Todo what="Durée des mises à jour de sécurité">[durée]</Todo>`.
- `PUBLIC_SHOW_TODOS=false` (fichier `.env`) garde le texte provisoire sans surlignage, par exemple pour une démonstration. Il est alors écrit dans un simple `<span>` : un `<mark>` ferait annoncer « surligné » par les lecteurs d’écran.

Les exemples de la page `/charte/` sont écrits sous forme de variables : `npm run todos` ne les compte pas, ce ne sont pas de vraies informations manquantes.

## Ton des textes

On écrit en français, en vouvoyant, avec des phrases courtes et des mots simples. Un mot technique est expliqué la première fois qu’il apparaît. Pas de superlatifs, pas d’urgence artificielle, jamais les mots « belle » ou « beau ». On écrit des faits précis, par exemple « aucun port n’est ouvert vers internet », et on n’affirme rien qui ne figure pas dans les informations validées par l’équipe : ni avis, ni chiffres, ni logos de partenaires, ni certification.

## Touche japonaise

Elle reste discrète. On garde le kanji 箱 dans le logo et le favicon, de l’espace autour des éléments, des filets fins, et une seule phrase qui explique le nom (« Hako » veut dire « boîte » en japonais), placée là où l’on présente l’entreprise.

On évite les cerisiers en fleur, les torii, les geishas, le soleil rouge, les pinceaux et les polices qui imitent la calligraphie, les mots japonais semés dans le texte et le kanji utilisé comme motif décoratif en dehors du logo. Quand le kanji apparaît dans du texte, il est balisé `<span lang="ja">箱</span>` pour que les lecteurs d’écran le prononcent correctement.
