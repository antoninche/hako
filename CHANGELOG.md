# Journal des modifications

Les modifications notables du site sont notées ici, de la plus récente à la plus ancienne. Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et les numéros de version suivent la [gestion sémantique de version](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté

- Images du prototype (images de synthèse du modèle 3D de l’équipe) : la box vue de trois quarts en ouverture de l’accueil, à la place du kanji seul, et une galerie de quatre vues avec les finitions (blanc perlé RAL 1013, socle brun foncé) sur la page « La box ». Les captures d’origine sont dans `design/prototype/` ; `npm run prototype:images` les nettoie, les cadre et les convertit en sRGB, et Astro en tire des versions AVIF et WebP.
- Dessins « papier découpé » sur toutes les pages (21 fichiers), avec leur générateur dans `design/illustrations/` (`npm run illustrations:build`, `illustrations:check`, `illustrations:render`) et `docs/illustrations.md`.
- Couleur `--perle` (RAL 1013), sans rôle de texte.
- Crédits de three.js et du décodeur meshoptimizer, avec le texte de leur licence servi par le site.
- Balises de partage (Open Graph) sur chaque page, `robots.txt` et plan du site `sitemap.xml` (quand l’adresse publique est connue).

### Modifié

- Scène 3D de l’accueil : modèle refait d’après le prototype, sur fond pierre ; la vue éclatée dessinée remplace l’image provisoire.
- Carte de la zone au style des dessins.
- Réponses de l’équipe : engagement de deux ans pour Hako Pro, mises à jour de sécurité pendant cinq ans, renouvelables, pour Hako Home, intervention hors garantie à 100 € pour les deux offres, liens LinkedIn et présentations de l’équipe, pas d’accès depuis l’extérieur de la maison (choix de sécurité), hébergement provisoire chez GitHub Pages dans les mentions légales et la politique de confidentialité.
- Textes relus sur toutes les pages : le prix et la zone dès le premier écran de l’accueil et des offres, « hors garantie » à côté du service après-vente payant, le conseil de garder une autre copie de ses photos tant que la copie de secours n’existe pas, des formules creuses retirées.
- Finitions : un seul repère jaune pour les réseaux sociaux tant que leurs adresses manquent, tutoriels sans lignes vides avant la mise en ligne des vidéos, formulaire de commande lisible sans JavaScript, confirmation de démonstration avec un symbole d’information, tuiles de stockage qui ne ressemblent plus à des boutons, alignements sur l’accueil, Notre engagement et la page 404.
- Page « La box » : le kanji est décrit sur le couvercle et le mot HAKO sur un côté, et le ventilateur avec le conseil de laisser de l’air autour de la box.

## [0.1.0] - 2026-11-12

### Ajouté

- Socle du site : Astro 7 en sortie statique, TypeScript strict, CSS sans framework, versions des dépendances figées dans `package-lock.json`.
- Jetons de design dans `src/styles/tokens.css` : palette, trois surfaces (crème, sable, chocolat) avec leurs rôles de texte, échelle typographique, espacements, ombres, durées d’animation réduites à zéro quand l’utilisateur demande moins d’animations.
- Polices auto-hébergées, découpées pour le français quand leur licence le permet : Fraunces pour les titres, Atkinson Hyperlegible Next pour le texte, D-DIN pour l’interface, avec leurs licences, des polices de secours ajustées et la commande `npm run fonts:build`.
- Logo vectorisé à partir des PNG d’origine (cinq variantes), favicon, icônes d’application, manifeste et image de partage, produits par `npm run logo:build`.
- Icônes des réseaux sociaux (LinkedIn, YouTube, Facebook, Instagram, PeerTube) et icônes d’interface.
- Gabarit commun à toutes les pages : lien d’évitement, en-tête collant avec bouton « Commander » toujours visible et menu dépliant sur petit écran, pied de page avec plan du site, réseaux sociaux, pages légales et zone d’intervention.
- Pages provisoires pour chaque adresse du site, page 404 et charte graphique interne `/charte/`.
- Textes du site rassemblés dans `src/data/` (entreprise, pages, navigation, crédits), avec la typographie française (espaces insécables, apostrophe courbe) posée automatiquement.
- Rubrique « Crédits » dans les mentions légales : auteurs, licences et modifications des polices et des icônes ; texte de la licence MIT de Bootstrap Icons servi par le site.
- Informations manquantes surlignées en jaune (`todo()`, `<Todo>`, `<Fact>`), liste produite par `npm run todos` dans `TODO.md`, réglage `PUBLIC_SHOW_TODOS` pour les masquer.
- Contrôles : `npm run contrast` (contrastes WCAG), `npm run check:dist` (aucune ressource externe, sortie compatible avec une politique de sécurité stricte), `npm run lint` (astro check, ESLint avec règles d’accessibilité, Prettier).
- Tests Playwright : pages sans erreur, page 404, liens internes, aucune requête hors de la machine ni cookie, accessibilité avec axe, clavier et menu, cibles tactiles de 44 × 44 px, mouvement réduit, constructions de démonstration et avec adresse publique, captures d’écran.
- Documentation : `README.md`, `docs/brand.md`, `docs/fonts.md`, `docs/logo.md`, `docs/icons.md`, `docs/licences.md`.
