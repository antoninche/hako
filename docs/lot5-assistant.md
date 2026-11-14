# HakOS, lot 5 : l'assistant de première installation

14 novembre 2026. Conception et essais (phase 1, parties « Résultats des essais » à 7), validés par les fondateurs (décisions 1 à 10), puis réalisation (partie 8, en tête).

## 8. Réalisation (phase 2)

### Ce qui tourne sur la box

| Pièce | Où | Rôle |
|---|---|---|
| `hakos-parefeu.service` | `/etc/systemd/system`, requis par `docker.service` | `lib/phase.sh appliquer` avant Docker : charge `parefeu/hakos.nft`, choisit la page du port 80 |
| `hakos-premier-demarrage.service` | idem | 8 étapes ; Nextcloud s'installe seul (administrateur technique), qui est supprimé à l'étape 6 |
| `hakos-assistant.service` | `/usr/lib/systemd/system` (pour pouvoir le masquer) | API locale (`assistant/*.py`, Python, bibliothèque standard), socket `/run/hakos-assistant/api.sock` |
| nginx de l'accueil | conteneur, réseau de la box (`network_mode: host`), IPv4 | port 80 : `assistant.conf` puis `accueil.conf` (choix dans `/var/lib/hakos/accueil/phase.conf`) ; port 2283 : Immich (`photos.conf`) |
| État | `/var/lib/hakos/installee` | fait foi pour le pare-feu, la page du port 80 et le service ; aucun secret |

- **Phases et session** (`installation.py`) : comme la partie 2, tout en mémoire. Verrou (décision 9) : toute requête qui porte le jeton est un signe de vie, la page en donne un toutes les 30 s ; après 2 min sans signe de vie, un autre appareil peut recommencer. Un `check` réussi donne la session ; 10 essais faux, puis 423 jusqu'au redémarrage ou à un nouveau `register`.
- **Comptes** (`comptes.py`) : Immich par son API (127.0.0.1:12283), Nextcloud par `occ` (mot de passe dans l'environnement de `docker exec`). Chaque étape se rejoue : comptes en trop supprimés (adresse Immich libérée d'abord), comptes existants mis à jour, création des autres. Identifiants et prénoms identiques à `household.ts` (`tests/assistant/cas-household.json`, tiré du code du site).
- **Reprise après une coupure (écart à la partie 1)** : pas de clé d'API d'Immich sur le disque. Si Immich a déjà son administrateur, l'assistant calcule l'empreinte bcrypt du nouveau mot de passe de la responsable dans le conteneur d'Immich (module `bcrypt` d'Immich, mot de passe dans l'environnement) et la pose dans sa base par `psql` (entrée standard). Aucun secret n'est jamais écrit, et aucune fenêtre où une coupure bloquerait la box (entre l'inscription et l'enregistrement d'une clé). `immich-admin reset-admin-password` a été essayé : il attend un terminal et ne finit pas. Lié à Immich v3.4.1 (table `user`, colonnes `password`, `isAdmin`, `deletedAt`) : à revoir si l'assistant doit tourner avec une autre version.
- **Fin** : marqueur `installee`, `phase.conf` vers l'accueil, nginx rechargé (`docker kill --signal HUP`), ports ouverts (`nft flush set`), mots de passe oubliés ; 10 s plus tard le service s'arrête, `phase.sh fin` (root, `ExecStopPost=+`) refait tout depuis le marqueur et masque le service. Ensuite, nginx répond lui-même `{"phase":"installed","busy":false}` à `GET /api/installation/status` et `409 wrong_phase` aux autres routes.
- **Pare-feu (décisions 1 et 7)** : table `inet hakos` seule (Docker intact). Rien n'entre en IPv6 sauf ICMPv6, DHCPv6 et mDNS ; TCP entrant depuis les IPv4 privées seulement ; 2283 et 8080 fermés avant l'installation ; 12283 toujours fermé au réseau. Redémarrer `hakos-parefeu` redémarre Docker (`Requires`).
- **Frein d'Immich (décision 1)** : `limit_req` de nginx, 10 par minute et par adresse (10 d'un coup, puis un toutes les 6 s, 429 au-delà) sur `/api/auth/login`, `change-password`, `session/unlock` et `pin-code`.
- **Liste de mots (décision 2)** : liste française de diceware utilisée par Tails (CC0), réduite à 4 096 mots ; provenance et filtres dans `docs/liste-de-mots.md`. Relecture par deux personnes : à faire.
- **Page de la HAKO (décisions 8 et 10)** : `rootfs/opt/box/home/assistant/`, construite depuis hako-site au commit `HAKO_SITE_COMMIT` de `versions.env`, `SITE_URL=https://hako-box.github.io`. Pour la remonter : reconstruire dans un clone à un autre commit (`npm ci && SITE_URL=… npm run build:box`), recopier `dist-box/`, changer `HAKO_SITE_COMMIT`.
- **Hors lot** : décision 4 (bouton de la box), sous-lot 5.5 (Wi-Fi), « Gérer ma HAKO » (lot 6).

### Essais du 14 novembre (VM Colima, Ubuntu 24.04 arm64, 4 Go simulés)

`scripts/essai-vm.sh installer` puis le vrai premier démarrage par systemd, sur une box neuve à chaque fois (images déjà dans Docker).

| Essai | Résultat |
|---|---|
| Premier démarrage | 65 à 71 s (sans chargement des archives) |
| `test-sur-boitier.sh --assistant 1` | 42 contrôles de l'essai + 30 de la box, 0 échec ; comptes créés en 1,2 s |
| `--assistant 8` | 56 + 30, 0 échec ; comptes créés en 5,3 s |
| `--assistant 8 --coupure` (service tué au milieu des fichiers, nouveaux mots de passe, reprise) | 61 + 30, 0 échec ; 9,9 s en tout, reprise en 4,2 s ; anciens mots de passe refusés, aucun compte en trop |
| Reprise avec d'autres prénoms (responsable changée, une personne retirée, une ajoutée) | 15 contrôles, 0 échec (essai ponctuel, non scripté) |
| Navigateur (`scripts/essai-page.mjs`, Chromium) : page fermée, « Recommencer » refusé puis accepté après 2 min, fiche qui donne la main, signe de vie, création, accueil | 17 contrôles, 0 échec ; création en 2,3 s ; ni violation de CSP ni requête ailleurs |
| Redémarrage simulé de la box installée (pare-feu rechargé, nginx relancé) | 29 contrôles, 0 échec |

Chaque essai vérifie aussi : voisin simulé (IPv4 privée, IPv4 publique, IPv6), inscription d'un administrateur Immich impossible depuis le réseau avant la fin, journal sans prénom, identifiant, mot de passe ni jeton, aucun mot de passe sur le disque, frein d'Immich (10 × 401 puis 429). Reste : le Pi 5 (P3), Safari et Firefox, l'image prod gravée.

## Résultats des essais

VM Colima (Ubuntu 24.04 arm64, Docker 29.5.2), images figées, services de HakOS v1 lancés par `spikes/preparer.sh`. Les trois essais sont passés deux fois, la seconde sur un environnement neuf.

| Essai | Ce qui est prouvé | Bilan |
|---|---|---|
| a. Immich v3.4.1 | La responsable s'inscrit en administratrice par l'API (`helene@hako.local`), une deuxième personne est créée, les deux se connectent. Ensuite, l'inscription d'un administrateur et la restauration publique sont refusées (400). | 14/14 |
| b. Nextcloud 34.0.5 | Installé seul au premier lancement avec un administrateur technique, sans installateur web. `occ user:add --password-from-env` crée les mêmes identifiants qu'Immich, le mot de passe passant par l'environnement de `docker exec`. Compte technique supprimé : toujours installé. | 14/14 |
| c. nftables | Un voisin simulé (IPv4 et IPv6) atteint le port 80, plus 2283 ni 8080 ; la box garde 127.0.0.1 ; la règle survit au redémarrage de Docker ; une commande ouvre les ports. | 23/23 |

Constats :
1. L'inscription crée la responsable avec `shouldChangePassword=true` : sans correction, Immich exigerait un nouveau mot de passe et la fiche serait fausse.
2. Immich ne freine rien : 5 mauvais mots de passe refusés en 43 ms chacun (VM du Mac), sans blocage.
3. **HakOS v1 publie aussi 2283 et 8080 en IPv6.** Sans pare-feu IPv6 sur la box internet, Immich et Nextcloud sont joignables depuis internet. À corriger dès le sous-lot 5.1.

## 1. Le service de l'API locale

- **Langage** : Python 3.13, déjà dans l'image, bibliothèque standard seulement. Rien n'est téléchargé chez le client ; la liste de mots est un fichier de l'image.
- **Unité** `hakos-assistant.service` : utilisateur `hakos-assistant`, groupe `docker` pour `occ` (ce qui vaut root), capacité `CAP_NET_ADMIN` pour ouvrir les ports. Durcissement : `NoNewPrivileges`, `ProtectSystem=strict`, deux dossiers en écriture, `PrivateTmp`, `IPAddressAllow=localhost` seulement, `SystemCallFilter=@system-service`, `MemorySwapMax=0`, `LimitCORE=0`. Il protège des accidents, pas d'un attaquant. Le service est masqué après l'installation.
- **Exposition** : un socket Unix, derrière le nginx de l'accueil, qui sert aussi la page.
- **Mots de passe** : tirés par `secrets` à `register`, gardés dans la mémoire du processus seulement : ni disque, ni journal, ni ligne de commande. Oubliés dès les comptes créés ; restent les empreintes d'Immich (bcrypt) et de Nextcloud (Argon2id).
- **Accès techniques** : Nextcloud perd son compte technique dès le premier démarrage (`occ` suffit ensuite). Immich : une clé d'API limitée, en fichier 600 le temps de la création, pour reprendre après une coupure, puis révoquée.

## 2. L'API HTTP, calquée sur BoxAccess

Base `http://hako.local/api/installation/`, JSON de 16 Kio au plus, clés de `box-access.ts`.

| BoxAccess | Route | Succès |
|---|---|---|
| `status()` | `GET /status` | 200 `{phase, progress?, busy}` |
| `register(firstNames)` | `POST /register` | 201 `{accounts, token}` |
| `checkSheet(typed)` | `POST /check` | 200 `{result}`, plus `token` pour un appareil sans session |
| `createAccounts(onProgress)` | `POST /accounts`, puis `GET /status` chaque seconde | 202 `{progress}` |

- **Phases** : `preparing`, `ready`, `registered` (mots de passe remis, comptes pas créés), `creating` (avec l'avancement), `installed`.
- **Erreurs** `{"error": code}` : 400 `invalid_names`, 401 `no_session`, 409 `busy` ou `wrong_phase`, 423 `too_many_wrong` (10 essais faux), 503 `preparing`. La page en tire `unreachable`, `interrupted` ou `unexpected`.
- **Une installation à la fois** : `register` ouvre une session (jeton de 256 bits en en-tête, la box n'en garde que l'empreinte). Un autre appareil reçoit `busy`. Le verrou tombe après 30 min sans activité ou au redémarrage. Un `checkSheet` réussi donne la session : la fiche sert de preuve.
- **Création en tâche de fond** : elle continue si la page se ferme et se rejoue sans doublon.
- **Sécurité** : Host et Origin limités aux noms et à l'IPv4 de la box ; ni cookie ni CORS ; en-têtes du contrat (CSP, `no-store`, `no-referrer`) ; journal sans prénom, identifiant, mot de passe ni jeton.

## 3. La page de la box

- **Dans hako-site** : une entrée à part, `npm run build:box`, qui produit une seule page avec `<Assistant mode="box">` et l'accès réel. Un test vérifie que cet accès n'entre pas dans le site public.
- **Dans mabox-os** : `versions.env` fige `HAKO_SITE_COMMIT`. `make assistant` construit ce commit sur le Mac, dans un conteneur node figé, et range l'archive et sa somme SHA-256 dans `images/`. L'image la copie dans `/opt/box/assistant/page/`, et `verifier-image` contrôle la somme.

## 4. Mots de passe

- **Format** : 4 mots en minuscules et un nombre de 10 à 99, avec des tirets, comme la démo ; « exemple » est exclu.
- **Liste** : la liste française de Tails (CC0, 8 192 mots de 4 à 8 lettres), réduite à 4 096 mots : on retire les mots rares, tristes, choquants, homophones ou difficiles à épeler. Deux personnes la relisent. Licence à confirmer à l'extraction ; repli : Lexique 3.83 (CC BY-SA 4.0).
- **Entropie** : 4 × 12 + log2(90) ≈ 54,5 bits. La CNIL (cas 2) accepte 50 bits avec un frein aux essais. Nextcloud en a un, Immich non (constat 2) : il lui faut le frein de la partie 5.

## 5. Pare-feu, tests, estimation

- **Pare-feu** : `hakos-parefeu.service`, avant Docker, charge la table de l'essai c sans toucher aux règles de Docker. Ports fermés tant que l'état n'est pas « installée » ; état illisible : fermé. En plus : TCP entrant seulement depuis des IPv4 privées, rien en IPv6 (constat 3).
- **Frein devant Immich** : Immich publié sur 127.0.0.1 seulement, sur un autre port (12283). Le nginx de l'accueil sert le port 2283 et limite les connexions (10 par minute et par adresse).
- **Tests** : unitaires (identifiants identiques à `household.ts`, format, phases, verrou). Dans la VM : parcours complet, coupure pendant la création, voisin simulé. Page : Chrome, Safari et Firefox. Puis le vrai Pi.
- **Estimation** : 5.1 socle de sécurité, 2 j ; 5.2 service et API, 3 j ; 5.3 page de la box, 2 j ; 5.4 fin d'installation, contrôles, documentation, 1 j ; 5.5 Wi-Fi, 1,5 j plus l'essai sur le Pi. Plus tard, « Gérer ma HAKO », 2 j.

## 6. Wi-Fi depuis l'assistant

- **Faisable** avec NetworkManager, déjà dans l'image. Le câble reste branché pendant l'installation ; l'étape Wi-Fi est facultative.
- **Comment** : la box liste les réseaux. La personne choisit le sien et tape la clé. La box écrit le profil (fichier 600), s'y connecte et vérifie l'adresse et la passerelle. Alors seulement, la page dit de débrancher le câble.
- **Risques** : clé fausse ; réseau WPA3 seul (à vérifier sur le Pi 5) ; portail captif ; Wi-Fi invité qui isole les appareils ; signal faible. La clé reste sur la box. Un échec ne bloque rien, le câble marche. Non testable dans la VM ; un écran de plus dans le site.

## 7. Cas difficiles

Critères : personne d'autre sur le réseau ne prend la main, l'équipe n'a jamais accès, la famille s'en sort seule.

| Cas | Options | Recommandation |
|---|---|---|
| Quelqu'un d'autre commence avant la famille | A. Premier arrivé (décision du 13/11 : ni code ni carte) ; la famille voit « en cours ailleurs » et débranche la box. B. Commencer exige un appui sur le bouton de la box. C. Code sur une étiquette. | A ; B si le boîtier laisse le bouton accessible |
| Page rouverte avant la création des comptes | A. Retaper le mot de passe de la responsable, puis créer. B. Recommencer : nouveaux mots de passe, ancienne fiche annulée. C. Réafficher les mots de passe (interdit). | A, sinon B |
| Deuxième appareil pendant l'installation | A. Refus « en cours ailleurs » ; il continue s'il tape le mot de passe de la responsable. B. Le dernier arrivé prend la main. C. Suivi en lecture seule. | A |
| Fiche perdue | A. La responsable change le mot de passe dans les deux applications. B. Page « Gérer ma HAKO » : nouveau mot de passe posé dans les deux, carte imprimée. C. Rien. | A, puis B |
| Responsable qui a oublié son mot de passe | A. Deux responsables. B. Box en main : le bouton ouvre 10 min une page de nouveau mot de passe. C. Box envoyée à l'équipe. | B, plus A |
| Ajouter une personne plus tard | A. À la main dans les deux applications. B. « Gérer ma HAKO ». C. Rouvrir l'assistant. | B ; A d'ici là |
| Coupure de courant pendant la création | A. Nouveaux mots de passe pour tous, comptes déjà créés mis à jour, nouvelle fiche. B. Mots de passe chiffrés sur le disque, rouverts par celui de la responsable. C. Regravure. | A |
| Page fermée pendant la création | A. La création continue ; la page rouverte voit la fin. B. Création reprise par un nouvel appel. | A |

## Décisions demandées aux fondateurs

1. Frein devant Immich au lot 5 ? Sans lui, 4 mots ne suffisent pas.
2. Liste de Tails réduite à 4 096 mots ?
3. Premier arrivé, ou bouton de la box pour commencer ? Le boîtier laisse-t-il le bouton accessible ?
4. Nouveau mot de passe de la responsable par le bouton, box en main ?
5. Wi-Fi dans l'assistant au lot 5, ou plus tard ?
6. « Gérer ma HAKO » : dans quel lot ?
7. Corriger l'exposition IPv6 avant toute box chez un client ?
