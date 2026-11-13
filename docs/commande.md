# Offres et commande

Ce document explique comment fonctionnent la page Offres (`/offres/`) et le formulaire de commande (`/commander/`), où modifier les prix et les textes, et comment brancher plus tard un vrai service de commande puis un paiement en ligne.

## Ce que fait le formulaire aujourd’hui

Le formulaire est une démonstration. La personne choisit son offre et son stockage, voit son total se mettre à jour, laisse ses coordonnées, relit un récapitulatif, puis envoie. L’envoi passe par `DemoSubmitter`, qui ne transmet rien : aucune requête réseau, aucun cookie, rien d’enregistré dans le navigateur. La page affiche alors « Mode démonstration : aucune donnée n’a été envoyée ». Un test le vérifie (`tests/commande.spec.ts`) en relevant toutes les requêtes faites pendant l’envoi.

Le formulaire tient sur une seule page, en trois étapes, sans fenêtre surgissante. Avec JavaScript, une seule étape s’affiche à la fois. Sans JavaScript, les étapes 1 et 2 restent lisibles l’une sous l’autre, sans leurs boutons, et une note explique comment commander autrement (par e-mail ou par téléphone). L’étape 3 (récapitulatif, consentements et envoi) ne sert à rien sans JavaScript : elle est masquée. Le bouton d’envoi reste aussi désactivé : les données saisies ne partent donc jamais dans l’adresse de la page.

L’adresse `/commander/?offre=home` ou `/commander/?offre=pro` choisit l’offre d’avance. Les boutons de la page Offres utilisent ces adresses.

## Modifier un prix ou une condition

Tous les prix sont dans `src/data/tarifs.ts`, et seulement là. La page Offres et le formulaire lisent ce fichier. Une valeur `null` veut dire « pas encore décidé » : le site affiche à sa place un repère jaune, jamais 0 €. Si un total dépend d’un prix inconnu, il s’affiche sous la forme « 1 000 € + [prix] TTC ».

Pour fixer un prix, remplacez `null` par le nombre en euros et supprimez le commentaire `// TODO:` de la ligne :

```ts
{ id: '2to', label: '2 To', extraEur: null }, // TODO: supplément de l'option 2 To
```

devient

```ts
{ id: '2to', label: '2 To', extraEur: 90 },
```

L’acompte (`depositPercent`) s’écrit en pourcentage : `30` pour 30 %. Le montant de l’acompte est alors calculé sur le paiement unique et arrondi au centime. Les tests de `tests/unit/tarifs.test.ts` vérifient que le fichier reste cohérent (prix positifs, stockage compris à 0 €, acompte entre 1 et 100 %, chaque `null` accompagné de son commentaire `// TODO:` pour `npm run todos`).

Les montants des pages sont calculés au moment de la construction du site, pour chaque combinaison d’offre et de stockage. Après une modification de `tarifs.ts`, il faut donc reconstruire le site.

## Modifier un texte

Les textes de la page Offres sont dans `src/content/offres.ts`, ceux du formulaire (intitulés, aides, messages d’erreur, récapitulatif, confirmation, notice « Vos données ») dans `src/content/commande.ts`. Une information manquante s’écrit `todo('ce qui manque', '[texte provisoire]')`. Une phrase qui contient une information manquante, un lien ou un prix s’écrit comme une liste de morceaux, par exemple `['Nous vous appelons sous ', callbackDelay, '.']`.

Les règles de validation (champs obligatoires, formats, longueurs) sont dans `src/lib/commande/validation.ts`. Elles servent au formulaire et serviront telles quelles au futur service, qui doit refaire les mêmes vérifications de son côté.

## Zone d’intervention

Quand le code postal semble hors de la zone, le formulaire affiche une note avec ce que nous proposons ailleurs (`company.serviceArea.outside` : l’envoi de la box et son installation avec notre guide pas à pas, à venir, et nos tutoriels vidéo) et les frais d’envoi (`shippingCost` dans `src/data/faits.ts`, encore à fixer), sans bloquer la demande. La règle est la constante `SERVICE_AREA_DEPARTMENTS` de `src/lib/commande/service-area.ts` : pour l’instant, tout code postal des Bouches-du-Rhône (13) ou du Var (83). C’est une règle provisoire, plus large que la zone réelle (de Salon-de-Provence à Toulon) : elle peut être remplacée par une liste de codes postaux sans toucher au reste. Elle figure dans `TODO.md` (constante `SERVICE_AREA_RULE_PENDING`, à supprimer une fois la règle confirmée).

## Brancher un vrai service de commande

Le formulaire ne connaît que l’interface `OrderSubmitter`, définie dans `src/lib/commande/submitter.ts` :

```ts
export interface OrderSubmitter {
  readonly mode: 'demo' | 'live';
  submit(order: OrderRequest): Promise<SubmitResult>;
}
```

`OrderRequest` (dans `src/lib/commande/types.ts`) contient l’offre, le stockage, les coordonnées, l’entreprise pour Hako Pro, les créneaux préférés, l’indication « hors zone » et les montants affichés. Une implémentation réelle enverrait cette demande en JSON, avec `fetch` et la méthode POST, à une adresse de notre propre domaine (par exemple `/api/commande`), puis renverrait `{ status: 'received', reference }`. En cas d’échec, elle rejette la promesse : le formulaire affiche alors un message et garde la saisie.

Pour l’activer, il suffit de remplacer `new DemoSubmitter()` dans le bloc `<script>` de `src/components/commande/OrderForm.astro`. Il faudra aussi, dans `src/content/commande.ts`, retirer la note « Formulaire de démonstration » et écrire le texte de confirmation d’une demande reçue (le formulaire indique le résultat dans l’attribut `data-status` de la confirmation ; avec `received`, la confirmation montre une coche à la place du symbole « info » de la démonstration). Avec une politique de sécurité du contenu stricte, l’envoi vers notre propre domaine reste autorisé par `connect-src 'self'`.

Côté serveur, quelques règles. Le service recalcule toujours les montants à partir de ses propres tarifs ; ceux que le navigateur transmet servent seulement à repérer un écart avec ce qui a été affiché. Il refait toutes les vérifications de `validation.ts`. Il ne garde que les champs utiles à la commande, pendant la durée annoncée dans la notice « Vos données » (encore à fixer), et n’écrit pas les coordonnées en clair dans ses journaux. Les échanges passent uniquement en HTTPS.

## Paiement en ligne, plus tard

Le paiement en ligne n’existe pas encore : la page annonce un appel de confirmation, puis un acompte dont le pourcentage reste à fixer. Le jour où un prestataire de paiement est choisi, la solution la plus simple pour rester fidèle à nos engagements est une page de paiement hébergée par le prestataire, vers laquelle on redirige la personne après la confirmation de la commande, ou un lien de paiement envoyé par e-mail. Le montant à payer est alors calculé par notre serveur.

## Ce qu’il ne faut pas faire

Aucun script, cadre (`iframe`) ou feuille de style d’un autre site sur nos pages : ni module de paiement intégré, ni outil de mesure d’audience, ni messagerie instantanée, ni service de formulaires en ligne. Cela casserait la promesse « zéro traceur », la politique de sécurité du contenu et les tests qui vérifient qu’aucune requête ne quitte le site. Pas de cookie ni de stockage dans le navigateur pour retenir la saisie. Pas d’envoi par la méthode GET, qui mettrait les coordonnées dans l’adresse de la page et dans les journaux du serveur. Pas d’adresse Gmail pour recevoir les commandes.

## Données personnelles

La notice « Vos données », sous le formulaire, dit à quoi servent les informations, combien de temps elles sont gardées (encore à fixer) et comment les consulter, les corriger ou les faire supprimer (adresse e-mail encore à fixer). Quand un vrai service sera branché, il faudra la relire avec la politique de confidentialité (`/confidentialite/`) et les conditions générales de vente (`/cgv/`), qui sont pour l’instant des pages à rédiger.

## Tests

Les tests unitaires (`tests/unit/*.test.ts`) se lancent avec `node --test tests/unit/` : calcul des montants avec des prix connus ou inconnus, part mensuelle de Hako Pro, acompte, validation des champs, règle du code postal et envoi de démonstration sans réseau ni stockage. Les tests de bout en bout (`tests/commande.spec.ts`) passent par Playwright : total de Hako Pro avec 2 To calculé d’après `tarifs.ts`, erreurs accessibles, envoi de démonstration sans aucune requête, choix d’avance par `?offre=pro`, page sans JavaScript, et contrôle axe sur les deux pages.
