# Contribuer à HAKO

Merci de vouloir améliorer HAKO ! Ce dépôt réunit le site ([site/](../site/)) et HakOS, le système de la box ([hakos/](../hakos/)). Ce guide explique comment préparer chacun, le tester et proposer un changement.

- Une faille de sécurité ne se signale jamais dans une issue publique : voir [SECURITY.md](../SECURITY.md).
- Chacun suit le [code de conduite](../CODE_OF_CONDUCT.md).
- Le site, la documentation, les messages de commit et les issues s'écrivent en français.

## Signaler un problème ou proposer une idée

Ouvrez une [issue](https://github.com/antoninche/hako/issues/new/choose) et choisissez le formulaire : « Signaler un problème » (en précisant la partie : site, HakOS ou box) ou « Proposer une idée ». Cherchez d'abord si une issue existe déjà. N'y mettez jamais de mot de passe, de fiche d'installation ni de photo d'une famille.

## Préparer le site

Il faut Node.js 22.23.4 ou plus récent avec npm (le projet est testé avec Node 26, voir [site/.nvmrc](../site/.nvmrc)).

```sh
cd site
npm ci                               # les versions exactes de package-lock.json
npx playwright install chromium      # une fois, pour les tests (sous Linux : --with-deps)
npm run dev                          # http://localhost:4321
```

Le détail (commandes, textes, informations manquantes, polices, logo, dessins) est dans [site/docs/developpement.md](../site/docs/developpement.md).

## Préparer HakOS

Les contrôles demandent git, docker et python3 ; la construction de l'image demande un Mac Apple Silicon avec Colima, docker, le greffon docker compose, xz, curl et environ 20 Gio libres, dans un chemin sans espace, hors OneDrive ou iCloud.

```sh
brew install colima docker docker-compose xz
colima start --vm-type vz --arch aarch64 --cpu 6 --memory 8 --disk 60 --mount-type virtiofs
make -C hakos lint
colima stop
```

Construire l'image, la vérifier, l'essayer dans une machine virtuelle : [hakos/README.md](../hakos/README.md) et [hakos/docs/manuel.md](../hakos/docs/manuel.md). Le dossier `hakos/local/` (clés et mots de passe de l'équipe) n'est jamais versionné.

## Tester

Avant de proposer un changement, lancez les contrôles de la partie touchée.

| Partie   | Commande (depuis la racine du dépôt)                                      | Ce qu'elle vérifie                                                                                   |
| -------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| site     | `cd site && npm run lint`                                                 | `astro check`, ESLint (accessibilité comprise), Prettier, modèle 3D                                  |
| site     | `cd site && npm run test:unit`                                            | tests unitaires (`node --test`)                                                                      |
| site     | `cd site && npx playwright test`                                          | chaque page dans Chromium à 390 et 1440 px : liens, accessibilité (axe), CSP, aucune requête externe |
| site     | `cd site && npm run build && npm run check:dist`                          | le site construit : aucune ressource d'un autre site, aucun script ni style en ligne                 |
| box      | `cd site && SITE_URL=https://antoninche.github.io/hako npm run build:box` | la page de la HAKO, construite à part                                                                |
| HakOS    | `make -C hakos lint`                                                      | shellcheck, fichiers compose, recherche de secrets, tests unitaires de l'API locale et du socle      |
| licences | `reuse lint`                                                              | chaque fichier a une licence et un titulaire du droit d'auteur ([REUSE.toml](../REUSE.toml))         |

Pour un changement visible sur le site, joignez des captures avant et après.

## Proposer un changement

1. Créez une branche depuis `main`.
2. Faites vos changements, avec leurs tests et leur documentation ; notez-les dans le CHANGELOG de la partie touchée ([site/CHANGELOG.md](../site/CHANGELOG.md) ou [hakos/CHANGELOG.md](../hakos/CHANGELOG.md)), section « Non publié ».
3. Signez chaque commit (clé SSH ou GPG déclarée sur votre compte GitHub, qui affiche alors « Verified ») :

   ```sh
   git config commit.gpgsign true
   git config tag.gpgsign true
   ```

4. Écrivez les messages de commit en français : une première ligne courte qui commence par la partie touchée (« Site : … », « HakOS : … », « Dépôt : … »), puis le pourquoi.
5. Ouvrez une demande de fusion (pull request) et remplissez son modèle. Les workflows du dépôt doivent passer au vert.

## Licences

En contribuant, vous acceptez que votre contribution soit distribuée sous la licence du dossier touché :

| Dossier                                              | Licence                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------- |
| [site/](../site/)                                    | MIT ([site/LICENSE](../site/LICENSE))                               |
| [hakos/](../hakos/)                                  | GNU GPL version 3 ou ultérieure ([hakos/LICENSE](../hakos/LICENSE)) |
| polices (`site/public/fonts/`, …)                    | SIL Open Font License 1.1, celle de leurs auteurs                   |
| nom, logo, kanji 箱, photos, dessins, textes du site | réservés, voir [NOTICE](../NOTICE)                                  |

Le détail, fichier par fichier, est dans [REUSE.toml](../REUSE.toml), et les textes des licences dans [LICENSES/](../LICENSES/). Un nouveau fichier doit y être couvert : `reuse lint` le vérifie. Si vous ajoutez un élément tiers (police, icône, bibliothèque), indiquez son auteur et sa licence dans [site/docs/licences.md](../site/docs/licences.md).
