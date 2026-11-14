# HakOS, lot 5 : l'assistant de première installation (conception)

14 novembre 2026. Branche `lot-5` (`~/Code/mabox-os-lot5`). Pas de code de production : des essais (`spikes/`) et cette conception, à valider par les fondateurs.

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
