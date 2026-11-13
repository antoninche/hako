# Journal des modifications

Les modifications notables du site sont notées ici, de la plus récente à la plus ancienne. Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et les numéros de version suivent la [gestion sémantique de version](https://semver.org/lang/fr/).

## [0.3.1] - 2026-11-13

### Modifié

- L’abonnement de Hako Pro se paie chaque mois, par virement (phrase commune `proSubscriptionPayment`, pages Offres et FAQ).
- Conditions générales de vente : la section « Paiement » ne parle plus de solde ; le virement bancaire vaut pour la box et pour l’abonnement.

## [0.3.0] - 2026-11-13

### Ajouté

- Guide d’installation pas à pas (`/installer/`), pour la personne qui installe sa HAKO elle-même : « Avant de commencer », puis huit étapes, du carton aux applications des téléphones. Chaque étape dit quoi faire, pourquoi, comment savoir que c’est bon, et quoi faire quand ça ne marche pas. Consignes selon l’appareil (iPhone ou iPad, Android, ordinateur), chronomètre pendant la préparation, lexique et version imprimable. L’étape en cours est gardée dans l’adresse (`#etape-…`) : rien n’est enregistré dans le navigateur. Textes dans `src/content/installation.ts`, faits dans `src/data/installation.ts`.
- Démonstration de la première installation (`/installer/demonstration/`) : la page que la HAKO affichera chez la personne, à `http://hako.local`, essayée avec une HAKO simulée. On y tape les prénoms de la maison ; la HAKO invente les mots de passe ; on garde la fiche de secours, on la vérifie, puis la HAKO crée les comptes. Bandeau « Démonstration », mots de passe d’exemple et fiche marquée EXEMPLE. Rien n’est envoyé ni gardé, et la page interdit toute connexion par sa propre règle de sécurité. Le composant (`src/components/assistant/`, logique dans `src/lib/assistant/`) servira sur la HAKO.
- « Installer votre HAKO » dans le menu et le plan du site, et des liens vers le guide depuis l’accueil, les tutoriels et la FAQ.
- Étiquette « Bientôt » sur Hako Pro (accueil, Offres, formulaire de commande), avec la phrase « Hako Pro ouvrira après le lancement de Hako Home. » (`proOpening` dans `src/data/faits.ts`, composant `SoonBadge`, partagé avec les tutoriels).
- Huit dessins « papier découpé » pour le guide, avec leur générateur (`design/illustrations/_source/installation.mjs`), et de nouvelles icônes d’interface, réunies dans `src/components/icons.ts`.

### Modifié

- Adresse de la box : `hako.local` partout.
- Installation : dans la zone, l’équipe installe la box. Hors de la zone, l’envoi et l’installation par le client avec le guide ouvriront bientôt (accueil, Offres, FAQ, contact, tutoriels, guide). La box crée les comptes et invente les mots de passe.
- « Sans votre demande, nous n’avons pas accès à vos données », en accord avec la maintenance à distance de Hako Pro (accueil, FAQ, confidentialité, Notre engagement, démonstration).
- Branchement : un câble réseau (Ethernet) relie la box à la box internet, et le Wi-Fi est aussi possible ; le câble réseau n’est pas fourni quand la box est envoyée. Nouvelle limite sur la page de la box : pas sur un réseau partagé avec d’autres logements.
- Menu et titre de la page `/la-box/` : « Votre HAKO ».
- FAQ : les réponses s’impriment ouvertes, sans animation.
- En-tête : le lien de la rubrique est souligné sur les pages rangées dessous ; de 64 à 73rem, les liens se rapprochent et le logo rapetisse un peu, pour que les six liens et « Commander » tiennent sur une ligne, même avec une barre de défilement.
- `BaseLayout` : emplacement `head` pour les balises propres à une page.
- Aperçu en ligne : le script construit de la démonstration est contrôlé à chaque publication, et les informations manquantes s’affichent en texte simple, sans surlignage jaune (`PUBLIC_SHOW_TODOS=false`).
- Hako Home à 750 € TTC.
- Paiement : la box se règle en une seule fois, par virement bancaire, avant l’installation ; l’abonnement de Hako Pro se paie chaque mois. Section « Commande et paiement » dans les conditions générales de vente.
- Copie de secours : prévue pour une prochaine version, sans date annoncée.
- Guide et démonstration, après relecture : voyant et bouton de la box marqués « à confirmer », mot de passe du compte Apple distingué du code de l’iPhone, fiche de secours avec chaque mot de passe sur une ligne, retour du navigateur après « Recommencer », mentions « nouvel onglet » qui ne se coupent plus, espaces insécables.

### Supprimé

- L’acompte (données, calcul, formulaire, textes et tests) et les frais d’envoi hors de la zone.

## [0.2.0] - 2026-11-13

### Ajouté

- Les pages du site : l’accueil (le constat, le déménageur, la box qui s’ouvre au défilement en 3D, les étapes, les offres, les engagements, la carte de la zone et l’équipe), Offres (cartes, tableau comparatif, stockage, « Bon à savoir »), Commander (formulaire en trois étapes, total calculé à partir de `src/data/tarifs.ts`, mode démonstration), La box, Notre engagement, Tutoriels, FAQ, Contact, les mentions légales, les conditions générales de vente et la politique de confidentialité (encore à compléter), et la page 404.
- Les faits repris par plusieurs pages, écrits une seule fois dans `src/data/faits.ts`, et un seul outil de mise en forme des prix et des nombres (`src/lib/format.ts`).
- L’hébergement : en-têtes de sécurité et politique de sécurité du contenu documentés (`docs/hebergement.md`, exemple Apache), serveur local de production (`npm run serve:prod`), mesure Lighthouse (`npm run lighthouse`) et aperçu en ligne sur GitHub Pages, republié à chaque envoi sur `main`.
- Images du prototype (images de synthèse du modèle 3D de l’équipe) : la box vue de trois quarts en ouverture de l’accueil, à la place du kanji seul, et une galerie de quatre vues avec les finitions (blanc perlé RAL 1013, socle brun foncé) sur la page « La box ». Les captures d’origine sont dans `design/prototype/` ; `npm run prototype:images` les nettoie, les cadre et les convertit en sRGB, et Astro en tire des versions AVIF et WebP.
- Dessins « papier découpé » sur toutes les pages (21 fichiers), avec leur générateur dans `design/illustrations/` (`npm run illustrations:build`, `illustrations:check`, `illustrations:render`) et `docs/illustrations.md`.
- Couleur `--perle` (RAL 1013), sans rôle de texte.
- Crédits de three.js et du décodeur meshoptimizer, avec le texte de leur licence servi par le site.
- Maintenance de Hako Pro expliquée (tunnel sécurisé WireGuard, seulement à la demande du client) sur Notre engagement, la page Offres et dans une nouvelle question de la FAQ.
- Balises de partage (Open Graph) sur chaque page, `robots.txt` et plan du site `sitemap.xml` (quand l’adresse publique est connue).

### Modifié

- Scène 3D de l’accueil : modèle refait d’après le prototype, sur fond pierre ; la vue éclatée dessinée remplace l’image provisoire.
- Carte de la zone au style des dessins.
- Le mot HAKO sur la grande face de la box, en plus du kanji du couvercle : dans la scène 3D (images d’attente refaites) et dans les dessins où il reste lisible. Dans les dessins des offres, la box a de l’air autour d’elle, pour son ventilateur.
- Corrections après une répétition complète du site : champs Code postal et Commune alignés dans le formulaire, mêmes mots pour un même fait sur toutes les pages (service après-vente hors garantie, « engagements », rôles de l’équipe, Google Photos), le kanji du logo dans le dernier appel de l’accueil.
- Réponses de l’équipe : engagement de deux ans pour Hako Pro, mises à jour de sécurité pendant cinq ans, renouvelables, pour Hako Home, intervention hors garantie à 100 € TTC pour les deux offres, liens LinkedIn et présentations de l’équipe, pas d’accès depuis l’extérieur de la maison (choix de sécurité), hébergement provisoire chez GitHub Pages dans les mentions légales et la politique de confidentialité.
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
