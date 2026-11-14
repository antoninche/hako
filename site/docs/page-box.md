# Page de la HAKO : première installation

La page que la HAKO sert elle-même, chez la personne, à `http://hako.local`, pour sa première installation. C’est la page de la démonstration du site (`/installer/demonstration/`), sans ses mentions de démonstration, avec l’accès réel à la HAKO. Décisions : lot 5 de HakOS, validé le 14 novembre 2026.

## Construction

```sh
SITE_URL=https://antoninche.github.io/hako npm run build:box
```

- `SITE_URL` (obligatoire, en `https`) : l’adresse du site public, avec son sous-dossier s’il en a un. Pour la HAKO : `https://antoninche.github.io/hako` (décision du 14 novembre 2026 : le site reste chez antoninche). Les liens de la page (guide, questions fréquentes, contact) la portent et s’ouvrent dans un nouvel onglet.
- Sortie : `dist-box/`, jamais versionnée. Une seule page (`index.html`), ses scripts et sa feuille de style dans `_astro/`, les polices et leurs licences, les icônes de l’onglet et la licence des icônes. Rien d’autre de `public/`.
- Source : `box/pages/index.astro`, avec les composants du site. Configuration : `astro.box.config.mjs` ; script : `scripts/box/build.mjs`, qui contrôle le résultat (une page, en français, non indexée, rien de la démonstration, aucune ressource d’ailleurs ni code en ligne).
- Les informations encore manquantes gardent leur texte provisoire, sans surlignage.
- L’accès réel (`src/lib/assistant/box-http.ts`) n’entre jamais dans le site public : `tests/unit/assistant-script.test.ts` échoue si son adresse ou son en-tête de session apparaît dans `dist/`.

HakOS (dossier `hakos/` du dépôt) construit cette page à partir d’un commit figé du dépôt (`HAKO_SITE_COMMIT` de `hakos/versions.env`), et copie `site/dist-box/` dans son image.

## En-têtes à envoyer

Ceux de `BOX_PAGE_HEADERS` (`src/lib/assistant/box-access.ts`), pour la page, ses fichiers et l’API : CSP stricte (`default-src 'self'`, `connect-src 'self'`, `form-action 'none'`, `frame-ancestors 'none'`, sans `upgrade-insecure-requests`), `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy` et `Cross-Origin-Resource-Policy` en `same-origin`. `tests/box.spec.ts` fait tout le parcours sous ces en-têtes.

## L’API locale

Base `/api/installation/`, à la même adresse que la page. JSON (`Content-Type: application/json`), 16 Kio au plus dans les deux sens. Les clés sont celles de `box-access.ts`.

| Route           | Corps envoyé            | Succès                                      |
| --------------- | ----------------------- | ------------------------------------------- |
| `GET status`    |                         | 200 `{"phase", "busy", "progress"?}`        |
| `POST register` | `{"firstNames": [...]}` | 201 `{"accounts": [...], "token"}`          |
| `POST check`    | `{"typed"}`             | 200 `{"result": "ok" \| "wrong", "token"?}` |
| `POST accounts` | `{}`                    | 202 `{"progress"}`                          |

- `phase` : `preparing`, `ready`, `registered`, `creating` ou `installed`. `busy` (booléen, toujours présent) : vrai en `registered` ou `creating` quand l’appareil qui demande n’a pas le jeton de la session en cours. `progress` (en `creating`) : `{"photos", "files", "finish"}`, chacun `waiting`, `running` ou `done`.
- Session : `register` renvoie un jeton (256 bits, 43 à 128 caractères `A-Z a-z 0-9 _ -`), que la page renvoie dans l’en-tête `X-Hako-Session`. Elle ne le garde qu’en mémoire : la page rechargée n’a plus la main.
- Signe de vie : tant qu’elle a un jeton, la page redemande `status` toutes les 30 secondes (`BOX_HTTP_TIMINGS.heartbeat`). Pour la HAKO, toute requête qui porte le jeton de la session en cours est un signe de vie. Après 2 minutes sans signe de vie (page fermée, appareil éteint ou en veille), un autre appareil peut recommencer (`register`) ; tant que personne ne l’a fait, le jeton reste valable.
- `accounts` : un compte par prénom, dans l’ordre, `{"firstName", "login", "owner", "password"}`. Le prénom est celui reçu ; l’identifiant celui que calcule `household.ts` (`assignLogins`) ; seule la première personne est `owner` ; le mot de passe a quatre mots en minuscules et un nombre de 10 à 99, avec des tirets. Sinon la page refuse la réponse.
- `check` sans session, réussi : la réponse porte un nouveau jeton, et cet appareil prend la main (la fiche sert de preuve).
- Après `accounts`, la page demande `status` chaque seconde jusqu’à `installed`. Une fois la HAKO installée, `GET status` doit encore répondre 200 `{"phase": "installed", "busy": false}`, même si le service de l’API est arrêté : la page de tous les jours en dépend.

Erreurs : `{"error": code}`.

| Réponse                                                  | Ce qu’en fait la page                                                                                |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 400 `invalid_names`                                      | réponse inattendue                                                                                   |
| 401 `no_session`                                         | redemande l’état, et montre l’écran qui va avec                                                      |
| 409 `busy`                                               | « Une installation est déjà en cours » ; après « Recommencer l’installation », le refus est expliqué |
| 409 `wrong_phase`                                        | redemande l’état                                                                                     |
| 423 `too_many_wrong` (sur `check`, après 10 essais faux) | « Trop d’essais faux » : débrancher, rebrancher, recommencer                                         |
| 503 `preparing`                                          | redemande l’état (pour `status` : phase `preparing`)                                                 |
| pas de réponse en 10 s, 502, 504                         | « Votre HAKO ne répond plus » ; pendant la création, 10 réponses manquées de suite arrêtent le suivi |

## Cas difficiles (décisions du lot 5)

| Cas                                                               | Ce que montre la page                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deuxième appareil, ou page rouverte avant la création des comptes | « Une installation est déjà en cours ». Le mot de passe de la personne responsable, recopié de la fiche, donne la main, puis « Créer les comptes ». Sinon, « Recommencer l’installation » : de nouveaux mots de passe pour tout le monde, refusés tant qu’un autre appareil a la main (jusqu’à 2 minutes sans signe de vie de sa page, ou HAKO redémarrée). Jamais de réaffichage. |
| Page fermée pendant la création                                   | La création continue ; la page rouverte la suit jusqu’à « C’est prêt ».                                                                                                                                                                                                                                                                                                            |
| Coupure de courant pendant la création                            | La HAKO redémarre en `ready`. « Réessayer » : la page redemande des comptes pour les mêmes prénoms, montre les nouveaux mots de passe, la fiche est à refaire et à vérifier. La HAKO met à jour les comptes déjà créés.                                                                                                                                                            |
| Création arrêtée, HAKO toujours allumée                           | « Réessayer » redemande l’état : la création reprend (`registered`), se suit (`creating`) ou finit (`installed`).                                                                                                                                                                                                                                                                  |

La démonstration simule chacun de ces cas (« Voir un autre écran »), avec la HAKO simulée de `src/lib/assistant/demo-box.ts`.
