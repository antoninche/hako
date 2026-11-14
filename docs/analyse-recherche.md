# Vérification technique du parcours d'installation HAKO (13 novembre 2026)

Méthode : j'ai lu le code source aux tags précis (Immich v3.4.1, Nextcloud stable34 et nextcloud/docker), les documentations officielles (Raspberry Pi, Apple, Android, Chromium, Docker, Microsoft) et les textes de l'ANSSI et de la CNIL. J'ai mesuré les tailles des images arm64 dans les registres (manifestes seulement, rien n'a été téléchargé). Je n'ai écrit aucun fichier. Le cahier des charges lu est celui de la box.

Niveaux de confiance :
- **haute** : code ou documentation officielle lus directement ;
- **moyenne** : source officielle partielle, ou sources secondaires qui concordent ;
- **faible** : forum, ou extrait que je n'ai pas pu lire en entier.

## Points qui changent la conception

1. **Immich laisse deux routes publiques ouvertes tant qu'aucun administrateur n'existe.** Ce sont l'inscription de l'administrateur et le lancement d'une restauration de sauvegarde. Le port 2283 ne doit pas être ouvert sur le réseau local avant la création du compte par l'assistant.
2. **Les comptes Immich créés par l'API doivent changer leur mot de passe à la première connexion web.** C'est la valeur par défaut en base (`shouldChangePassword` vaut true). Pour garder le mot de passe généré, il faut envoyer `"shouldChangePassword": false`.
3. **Immich ne limite pas les tentatives de connexion.** Nextcloud les limite, mais son image apache fait confiance à l'en-tête X-Real-IP venant de toute adresse privée. Un appareil du réseau local peut donc contourner cette protection si le port 8080 est ouvert directement.
4. **Avec une alimentation 3 A, le Pi 5 ne démarre pas sur USB par défaut.** Si le SSD est branché en USB, un chargeur de téléphone empêche la box de démarrer.
5. **Le voyant vert fixe n'indique pas que la box est prête.** Il ne clignote pas non plus avec un SSD sur M.2 HAT+. L'état doit être montré par la page de la box.
6. **Sur Mac (macOS 15 et plus), Chrome, Firefox et Edge demandent une autorisation « Réseau local » avant d'ouvrir hako.local.** Safari n'en demande pas.
7. **Si deux boxes HAKO sont sur le même réseau, la seconde devient hako-2.local.** C'est la règle de RFC 6762.
8. **Le site public ne peut pas détecter la box.** Sa propre politique de sécurité bloque toute requête, et Chrome afficherait une invite inquiétante. Un simple lien reste possible.
9. **Les mots de passe circuleront en HTTP non chiffré sur le réseau local.** Cela va contre la recommandation R11 de l'ANSSI. C'est un risque réel sur un Wi-Fi partagé.

---

## A. Immich

**A1. Version.**
- Fait : la dernière version stable est v3.4.1 (11 novembre 2026), la veille v3.4.0 (10 novembre). Le dernier correctif de la branche précédente est v3.3.6 (4 novembre). Une anomalie ouverte le 12 novembre, non confirmée, signale l'absence des commandes vidéo en 3.4.0 et 3.4.1.
- Sources :
  - https://github.com/immich-app/immich/releases/tag/v3.4.1
  - https://github.com/immich-app/immich/issues/33249
- Confiance : haute pour la version, faible pour l'anomalie.
- Conséquence : figer `IMMICH_VERSION=v3.4.1` dans versions.env et tester la lecture vidéo sur le prototype. v3.3.6 sert de repli.

**A2. Création du premier administrateur.**
- Fait :
  - La route est `POST /api/auth/admin-sign-up` (préfixe global `api`).
  - Le corps JSON est `{"email": "...", "password": "...", "name": "..."}`, les trois champs sont obligatoires.
  - Le compte créé a `isAdmin=true` et le libellé de stockage `admin`. La route ne renvoie pas de jeton de session.
  - Elle est publique, mais refusée (400 « Admin setup is not available ») si `IMMICH_ALLOW_SETUP=false` ou si un administrateur existe déjà.
- Sources :
  - https://github.com/immich-app/immich/blob/v3.4.1/server/src/controllers/auth.controller.ts
  - https://github.com/immich-app/immich/blob/v3.4.1/server/src/dtos/auth.dto.ts
  - https://github.com/immich-app/immich/blob/v3.4.1/server/src/services/auth.service.ts
  - https://github.com/immich-app/immich/blob/v3.4.1/server/src/services/base.service.ts (isSetupAvailable)
  - https://github.com/immich-app/immich/blob/v3.4.1/server/src/app.common.ts
- Confiance : haute.

**A3. Création d'utilisateurs par un administrateur.**
- Fait :
  - La route est `POST /api/admin/users`. Il faut être administrateur et avoir la permission `adminUser.create`.
  - Champs obligatoires : `email`, `password`, `name`. Le mot de passe est exigé sauf si OAuth est actif.
  - Champs facultatifs : `quotaSizeInBytes` (entier ≥ 0 ; null ou absent veut dire illimité), `isAdmin`, `shouldChangePassword`, `notify`, `storageLabel`, `avatarColor`, `pinCode`.
  - Piège : en base, `shouldChangePassword` vaut true par défaut. Sur le web, un compte qui n'est pas administrateur et qui a ce drapeau est envoyé sur la page de changement de mot de passe à sa première connexion.
- Sources :
  - https://github.com/immich-app/immich/blob/v3.4.1/server/src/controllers/user-admin.controller.ts
  - https://github.com/immich-app/immich/blob/v3.4.1/server/src/dtos/user.dto.ts
  - https://github.com/immich-app/immich/blob/v3.4.1/server/src/services/user-admin.service.ts
  - https://github.com/immich-app/immich/blob/v3.4.1/server/src/schema/tables/user.table.ts
  - https://github.com/immich-app/immich/blob/v3.4.1/web/src/routes/auth/login/+page.svelte
- Confiance : haute pour le web ; comportement de l'application mobile non vérifié.
- Conséquence : envoyer `"shouldChangePassword": false` et `"notify": false` (la box n'a pas de serveur de courriel).

**A4. Adresse e-mail servant d'identifiant.**
- Fait :
  - Depuis la v3.0.0, le serveur valide l'adresse avec zod et une expression Unicode qui n'exige pas d'extension de domaine. `marie@hako.local` est accepté, et même `marie@hako`.
  - L'adresse est mise en minuscules. Une adresse déjà prise renvoie « Email is not available ».
  - L'option `require_tld` n'existe plus. Jusqu'à la v2.5.0, le code utilisait class-validator avec `@IsEmail({ require_tld: false })`.
  - Le formulaire de connexion web utilise un champ HTML `type="email"`. La norme HTML n'y accepte que des caractères ASCII avant le @ ; « héloïse@… » serait refusé par le navigateur.
  - L'application mobile vérifie seulement la présence d'un @ et l'absence d'espace.
- Sources :
  - https://github.com/immich-app/immich/blob/v3.4.1/server/src/validation.ts (testé : marie@hako.local et marie@hako valides)
  - https://github.com/immich-app/immich/blob/v2.5.0/server/src/dtos/user.dto.ts
  - https://html.spec.whatwg.org/multipage/input.html#valid-e-mail-address
  - https://github.com/immich-app/immich/blob/v3.4.1/mobile/lib/widgets/forms/login/login_form.dart
- Confiance : haute.
- Conséquence : identifiant = prénom sans accents, en minuscules, suivi de @hako.local (heloise@hako.local). Ajouter un suffixe en cas de doublon.

**A5. Empêcher un inconnu de créer le compte administrateur.**
- Fait :
  - La configuration d'origine est ouverte si `IMMICH_ALLOW_SETUP` (true par défaut) est vrai et qu'aucun administrateur n'existe. Ce réglage est documenté au plus tard depuis la v2.5.0.
  - Tant que c'est le cas, deux routes publiques sont ouvertes : `/api/auth/admin-sign-up` et `/api/admin/database-backups/start-restore`. La seconde met Immich en maintenance pour restaurer une sauvegarde.
  - Avec `IMMICH_ALLOW_SETUP=false`, les deux sont fermées, y compris pour notre assistant. Aucune commande `immich-admin` ne crée d'administrateur.
  - Docker publie un port sur toutes les interfaces par défaut. Le trafic vers un port publié est détourné avant les chaînes INPUT de l'hôte : un pare-feu de l'hôte ne le protège pas.
- Sources :
  - https://github.com/immich-app/immich/blob/v3.4.1/docs/docs/install/environment-variables.md
  - https://github.com/immich-app/immich/blob/v3.4.1/server/src/repositories/config.repository.ts
  - https://github.com/immich-app/immich/blob/v3.4.1/server/src/controllers/database-backup.controller.ts
  - https://github.com/immich-app/immich/blob/v3.4.1/docs/docs/administration/server-commands.md
  - https://docs.docker.com/engine/network/port-publishing/
  - https://docs.docker.com/engine/network/packet-filtering-firewalls/
- Confiance : haute.
- Conséquence, dans l'ordre :
  1. Ne pas publier 2283, ou le publier sur `127.0.0.1:2283:2283`. L'assistant parle au conteneur par le réseau Docker.
  2. L'assistant crée l'administrateur, c'est-à-dire directement le responsable du foyer, sans compte technique.
  3. Ensuite seulement, on publie le port sur le réseau local.
  4. Par précaution, on passe `IMMICH_ALLOW_SETUP=false`.

**A6. Scripter l'API.**
- Fait :
  - Jeton de session : `POST /api/auth/login {email, password}` renvoie `accessToken`. On l'envoie dans l'en-tête `Authorization: Bearer <jeton>` ou `x-immich-user-token`.
  - Clé d'API : `POST /api/api-keys {"name": "...", "permissions": ["all"]}`, une permission au minimum. La réponse contient `secret`, affiché une seule fois ; on l'envoie dans l'en-tête `x-api-key`.
  - Pour éviter les écrans d'accueil : `POST /api/system-metadata/admin-onboarding {"isOnboarded": true}` et `PUT /api/users/me/onboarding {"isOnboarded": true}`.
  - Déconnexion : `POST /api/auth/logout`.
- Sources :
  - https://github.com/immich-app/immich/blob/v3.4.1/server/src/dtos/api-key.dto.ts
  - https://github.com/immich-app/immich/blob/v3.4.1/server/src/enum.ts
  - https://github.com/immich-app/immich/blob/v3.4.1/server/src/controllers/system-metadata.controller.ts
  - https://github.com/immich-app/immich/blob/v3.4.1/server/src/controllers/user.controller.ts
- Confiance : haute.
- Conséquence : utiliser un jeton de session, puis se déconnecter. Ne garder aucune clé d'API sur la box, pour tenir la promesse « zéro accès ».

**A7. Désactiver l'apprentissage automatique.**
- Fait :
  - En v3.4.1, aucune variable d'environnement ne le désactive (vérifié dans env.dto.ts).
  - Première méthode : un fichier `IMMICH_CONFIG_FILE` contenant seulement `{"machineLearning": {"enabled": false}}`. Un fichier partiel est permis, mais toute la configuration devient alors non modifiable dans l'interface.
  - Seconde méthode : lire `GET /api/system-config`, changer `machineLearning.enabled`, puis renvoyer l'ensemble avec `PUT /api/system-config` (administrateur).
  - D'après la FAQ, désactiver toutes les tâches n'arrête pas le conteneur ; il faut le retirer du compose (notre profil `ml`).
- Sources :
  - https://github.com/immich-app/immich/blob/v3.4.1/docs/docs/install/config-file.md
  - https://github.com/immich-app/immich/blob/v3.4.1/docs/docs/FAQ.mdx
  - https://github.com/immich-app/immich/blob/v3.4.1/server/src/controllers/system-config.controller.ts
- Confiance : haute.
- Conséquence : sur le Pi 4 Go, l'assistant appelle l'API, ce qui garde l'interface modifiable.

**A8. Application mobile Immich.**
- Fait :
  - Une adresse saisie sans schéma reçoit `https://` : le client doit taper `http://hako.local:2283` ou `http://<IP>:2283`.
  - L'application ajoute `/api`, lit `/.well-known/immich`, puis appelle `/api/server/ping`, avec 5 s de délai à chaque étape.
  - Le HTTP est autorisé : Android déclare `cleartextTrafficPermitted="true"`, iOS déclare `NSAllowsArbitraryLoads`.
  - iOS affiche une demande d'autorisation « Réseau local » (`NSLocalNetworkUsageDescription`). Un refus empêche la connexion.
  - Il n'existe ni lien profond ni code QR pour configurer le serveur ; la saisie est manuelle.
  - Sous Android, l'application cible le SDK 36 (Flutter 3.47.2). Android 17 n'exige l'autorisation `ACCESS_LOCAL_NETWORK` (groupe « Appareils à proximité ») que pour les applications qui ciblent le SDK 37. Elle est donc accordée implicitement pour l'instant.
- Sources :
  - https://github.com/immich-app/immich/blob/v3.4.1/mobile/lib/utils/url_helper.dart
  - https://github.com/immich-app/immich/blob/v3.4.1/mobile/lib/services/api.service.dart
  - https://github.com/immich-app/immich/blob/v3.4.1/mobile/android/app/src/main/res/xml/network_security_config.xml
  - https://github.com/immich-app/immich/blob/v3.4.1/mobile/ios/Runner/Info.plist
  - https://github.com/immich-app/immich/blob/v3.4.1/mobile/lib/services/deep_link.service.dart
  - https://github.com/flutter/flutter/blob/3.47.2/packages/flutter_tools/gradle/src/main/kotlin/FlutterExtension.kt
  - https://developer.android.com/privacy-and-security/local-network-permission
- Confiance : haute pour le code, moyenne pour l'évolution sous Android 17.
- Conséquence : le guide montre l'adresse complète avec `http://` en gros caractères. Il prévient de l'invite « Réseau local » sur iPhone et donne le chemin pour la réactiver : Réglages > Confidentialité et sécurité > Réseau local.

**A9. Limitation des tentatives de connexion.**
- Fait : Immich n'a pas de limitation intégrée ; les mainteneurs renvoient vers fail2ban ou OAuth.
- Sources :
  - https://github.com/immich-app/immich/discussions/21165
  - https://github.com/immich-app/immich/discussions/5436
- Confiance : moyenne.
- Conséquence : si l'on vise le cas 2 de la CNIL (voir F), placer Immich derrière nginx avec `limit_req` sur `/api/auth/login`.

**A10. Longueur utile du mot de passe.**
- Fait : Immich chiffre les mots de passe avec bcrypt, qui n'utilise que les 72 premiers octets.
- Sources :
  - https://github.com/immich-app/immich/blob/v3.4.1/server/src/repositories/crypto.repository.ts
  - https://github.com/kelektiv/node.bcrypt.js#security-issues-and-concerns
- Confiance : haute.
- Conséquence : une phrase de passe ASCII de 7 mots de 8 lettres au plus, avec 6 tirets, fait 62 octets au plus. Elle passe.

## B. Nextcloud (image Docker officielle)

**B1. Version.**
- Fait : `latest` = 35.0.2. Les étiquettes `stable` et `production` = 34.0.5. Les branches 33.0.10 et 32.0.15 sont aussi publiées. Toutes existent en arm64v8 (fichier mis à jour le 23 octobre 2026).
- Source : https://github.com/docker-library/official-images/blob/master/library/nextcloud
- Confiance : haute.
- Conséquence : `nextcloud:34.0.5-apache` (canal production) pour une box familiale. Les scripts d'entrée des versions 34 et 35 sont identiques.

**B2. Installation automatique.**
- Fait :
  - L'installation est automatique si toutes les variables `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` et `POSTGRES_HOST` sont définies, avec `NEXTCLOUD_ADMIN_USER` et `NEXTCLOUD_ADMIN_PASSWORD`.
  - Le script d'entrée lance alors `occ maintenance:install --database pgsql …` avant `exec` d'Apache, avec 11 essais espacés de 10 s.
  - Les variantes `_FILE` permettent de lire les secrets dans des fichiers.
  - Sans les deux variables d'administration, le script affiche « Access your instance to finish the web-based installation! ».
  - En version 34, `occ maintenance:install` propose aussi `--disable-admin-user` (installation sans administrateur).
- Sources :
  - https://github.com/nextcloud/docker/blob/master/README.md
  - https://github.com/nextcloud/docker/blob/master/34/apache/entrypoint.sh
  - https://github.com/nextcloud/server/blob/stable34/core/Command/Maintenance/Install.php
- Confiance : haute.

**B3. Risque d'un assistant d'installation ouvert sur le réseau.**
- Fait : la première personne qui ouvre le port 8080 remplit l'assistant d'installation et devient administrateur. La base est déjà renseignée par la configuration automatique.
- Comment l'éviter :
  - Installation automatique : il n'y a aucune fenêtre, puisque Apache ne démarre qu'après l'installation. On utilise un administrateur technique au mot de passe aléatoire. L'assistant crée ensuite le responsable du foyer avec `-g admin`, puis supprime le compte technique (`occ user:delete`).
  - Ou bien : `occ maintenance:install --disable-admin-user`, le port n'étant publié qu'à la fin.
- Sources : celles de B2.
- Confiance : haute.

**B4. Création des comptes.**
- Fait :
  - Syntaxe : `occ user:add [--password-from-env] [--generate-password] [--display-name] [-g|--group …] [--email] uid`. Le mot de passe est lu dans `NC_PASS` ou `OC_PASS`, et un groupe absent est créé.
  - Exemple : `docker exec -u www-data -e OC_PASS <conteneur> php occ user:add --password-from-env --display-name "Héloïse" -g admin heloise`. `-e OC_PASS` sans valeur reprend la variable de l'appelant (comportement standard de la ligne de commande Docker, non testé ici).
  - Le mot de passe passe par le contrôle de l'application password_policy. Par défaut : 10 caractères minimum, mots de passe courants refusés.
  - Une vérification sur HaveIBeenPwned est active par défaut sauf si `has_internet_connection=false`. C'est une requête vers un service extérieur.
- Sources :
  - https://github.com/nextcloud/server/blob/stable34/core/Command/User/Add.php
  - https://github.com/nextcloud/documentation/blob/stable34/admin_manual/occ_users.rst
  - https://github.com/nextcloud/server/blob/stable34/lib/private/User/Database.php
  - https://github.com/nextcloud/password_policy/blob/stable34/lib/PasswordPolicyConfig.php
- Confiance : haute.

**B5. Contraintes sur les identifiants.**
- Fait :
  - Caractères permis : a-z, A-Z, 0-9, espace et `_ . @ - '`.
  - Pas d'espace au début ni à la fin, pas « . » ni « .. », 64 caractères au plus.
  - Quelques noms sont réservés (.htaccess, files_external, __groupfolders, .ncdata, journaux, appdata_*).
  - Le nom affiché est libre. L'aide de la commande `occ` annonce une liste plus restrictive (a-z, A-Z, 0-9, -, _ et @).
- Source : https://github.com/nextcloud/server/blob/stable34/lib/private/User/Manager.php (validateUserId)
- Confiance : haute.
- Conséquence : identifiant = prénom en minuscules ASCII (`heloise`), nom affiché « Héloïse ».

**B6. Domaines de confiance (`trusted_domains`).**
- Fait :
  - `NEXTCLOUD_TRUSTED_DOMAINS` (liste séparée par des espaces) n'est appliquée qu'à l'installation, à partir de l'indice 1.
  - localhost est toujours accepté.
  - Formes acceptées : nom exact, nom:port, adresse IP, joker `*` (qui correspond à `[-.a-zA-Z0-9]*`). L'exemple officiel `ubos-raspberry-pi*.local` couvre aussi `-2`.
  - `overwritehost` fait tout accepter.
  - Après l'installation : `occ config:system:set trusted_domains N --value=…`.
- Sources :
  - https://github.com/nextcloud/server/blob/stable34/config/config.sample.php
  - https://github.com/nextcloud/server/blob/stable34/lib/private/Security/TrustedDomainHelper.php
  - script d'entrée cité en B2
- Confiance : haute.
- Conséquence : déclarer `hako*.local` et l'IP. Si l'IP change (DHCP), choisir entre :
  - une réservation d'adresse dans la box internet ;
  - un joker du type `192.168.*`, plus large ;
  - une mise à jour automatique à chaque changement d'IP (script à écrire).

**B7. Protection contre la force brute.**
- Fait :
  - Elle est intégrée, active par défaut et fonctionne par adresse IP. Le délai monte jusqu'à 25 s, puis Nextcloud renvoie 429 après 10 essais en 30 min. Une connexion réussie efface le compteur.
  - Elle dépend de la bonne adresse IP du client.
  - Or l'image apache contient `RemoteIPHeader X-Real-IP` avec les mandataires internes 10.0.0.0/8, 172.16.0.0/12 et 192.168.0.0/16. Un appareil du réseau local peut donc fournir une fausse IP par requête.
- Sources :
  - https://github.com/nextcloud/documentation/blob/stable34/admin_manual/configuration_server/bruteforce_configuration.rst
  - https://github.com/nextcloud/docker/blob/master/34/apache/Dockerfile
  - https://github.com/nextcloud/docker/blob/master/README.md (APACHE_DISABLE_REWRITE_IP, TRUSTED_PROXIES)
- Confiance : haute pour la configuration ; moyenne pour le contournement (déduit du fonctionnement de mod_remoteip, non testé).
- Conséquence : avec le port 8080 ouvert directement, mettre `APACHE_DISABLE_REWRITE_IP=1`. Derrière le nginx de la box, nginx écrase X-Real-IP et on renseigne `TRUSTED_PROXIES`.

## C. Noms en .local (mDNS)

**C1. iPhone et iPad.**
- Fait :
  - Le système résout les noms .local.
  - La protection « Réseau local » existe depuis iOS et iPadOS 14. Safari, WKWebView et SFSafariViewController en sont exemptés, donc aussi les navigateurs tiers bâtis sur WKWebView.
  - Une application comme Immich doit obtenir l'autorisation, car résoudre un nom .local en fait partie.
- Source : https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy
- Confiance : haute. Le cas des moteurs non WebKit autorisés dans l'UE n'est pas vérifié.

**C2. Mac.**
- Fait :
  - Même protection depuis macOS 15. Safari est exempté.
  - Chrome, Firefox et Edge déclenchent une alerte au premier accès ; un refus bloque hako.local. Le réglage est dans Réglages Système > Confidentialité et sécurité > Réseau local.
  - Les commandes lancées depuis le Terminal sont exemptées.
- Source : TN3179 ci-dessus.
- Confiance : haute.

**C3. Windows 10 et 11.**
- Fait : Microsoft annonce un support natif de mDNS depuis Windows 10 version 1703. En 2022, Microsoft en fait la norme et réduit LLMNR et NetBIOS. Une règle de pare-feu entrante « mDNS (UDP-In) » existe.
- Sources :
  - https://techcommunity.microsoft.com/blog/networkingblog/mdns-in-the-enterprise/3275777
  - https://techcommunity.microsoft.com/blog/networkingblog/aligning-on-mdns-ramping-down-netbios-name-resolution-and-llmnr/3290816
- Confiance : moyenne. Microsoft ne documente pas explicitement la résolution de .local dans les navigateurs, ni l'effet du profil réseau « Public ».
- Conséquence : tester sur Windows 10 et 11 ; prévoir l'adresse IP en repli.

**C4. Android et Chrome.**
- Fait :
  - Depuis novembre 2021 (mise à jour du module DNS Resolver), `getaddrinfo` résout les noms .local par mDNS, sauf en VPN et en données mobiles.
  - Le code est présent dans la branche AOSP android13-release mais absent de android12-release. Un article technique indique que la fonction marche sous Android 12 (par la mise à jour système Google Play) et qu'elle n'a pas été reportée sous Android 10 ni 11.
  - Chrome passe toujours par le résolveur du système pour les noms .local. Il n'y a donc pas de version minimale de Chrome : c'est la version d'Android qui compte.
  - Sous Android 17, une application qui cible le SDK 37 doit obtenir `ACCESS_LOCAL_NETWORK`, et la résolution de .local en fait partie. L'effet sur Chrome n'est pas vérifié.
  - Un forum de 2025 signale des échecs de Chrome sous Android avec certains noms .local longs.
- Sources :
  - https://source.android.com/docs/core/architecture/modular-system/dns-resolver
  - https://android.googlesource.com/platform/packages/modules/DnsResolver/+/refs/heads/android13-release/getaddrinfo.cpp
  - https://www.esper.io/blog/android-dessert-bites-26-mdns-local-47912385
  - https://chromium.googlesource.com/chromium/src/+/main/net/dns/README.md
  - https://developer.android.com/privacy-and-security/local-network-permission
  - https://community.start9.com/t/i-cant-access-services-on-local-addresses-in-chrome-on-android/4019
- Confiance : haute pour Android 13 et plus, moyenne pour Android 12, faible pour le forum.
- Conséquence : le guide indique « Android 12 ou plus récent, en Wi-Fi, sans VPN ».

**C5. Réseaux partagés.**
- Fait : l'isolation des clients (« AP isolation », fréquente sur les réseaux invités, d'hôtel ou publics) empêche d'atteindre un appareil local.
- Source : https://support.google.com/chromecast/answer/3213084
- Confiance : moyenne. Le cas des résidences étudiantes (Wifirst) n'est pas vérifié.
- Conséquence : tester sur un réseau de résidence. Prévoir dans le guide le cas « la box n'est pas joignable sur ce réseau ».

**C6. Collision de noms.**
- Fait : un nom déjà pris est changé automatiquement, en général en ajoutant « 2 ». Avahi produit hako-2.local.
- Source : https://www.rfc-editor.org/rfc/rfc6762#section-9
- Confiance : haute.
- Conséquence : avec deux HAKO sur le même réseau, la carte et l'assistant doivent prévoir un nom unique par box, ou au moins expliquer le -2.

**C7. Que proposer quand .local ne marche pas.**
- Fait : la documentation Raspberry Pi propose l'adresse IP trouvée dans la liste des appareils connectés de la box internet.
- Source : https://www.raspberrypi.com/documentation/computers/remote-access.html
- Confiance : haute.
- Je n'ai trouvé aucune source officielle sur des noms automatiques du type hako.home ou hako.lan chez Orange, Free, SFR ou Bouygues, ni sur les adresses de leurs interfaces : ne pas les promettre.

## D. Lien et détection depuis la page publique en HTTPS

**D1. Un lien vers http://hako.local fonctionne.**
- Fait :
  - Une navigation de premier niveau n'est pas du contenu mixte, et la politique de sécurité ne s'applique pas aux liens.
  - La directive `upgrade-insecure-requests` du site ne fait pas passer en HTTPS les navigations vers un autre site, sauf les envois de formulaire.
  - Chrome 154 (octobre 2026) demande l'accord de l'utilisateur avant d'ouvrir une page en HTTP. Il n'affiche pas cet avertissement pour les noms non uniques (.local), les IP locales et les noms sans point.
  - Chrome, Safari, Firefox et Edge essaient d'abord HTTPS puis reviennent à HTTP.
  - La politique de sécurité du site est décrite dans ~/Code/hako-site/docs/hebergement.md.
- Sources :
  - https://www.w3.org/TR/upgrade-insecure-requests/
  - https://chromium.googlesource.com/chromium/src/+/main/docs/security/ask-before-http/ask-before-http-adoption-guide.md
- Confiance : haute pour Chrome, moyenne pour les autres.
- Conséquence :
  - Utiliser un lien `<a href>`, jamais un formulaire (`form-action 'self'` le bloquerait de toute façon).
  - La box n'envoie jamais d'en-tête HSTS. Son port 443 reste fermé avec un refus net, ou bien sert un TLS correct (non vérifié : délai si les paquets sont ignorés).

**D2. Détecter la box depuis le site est impossible ou déconseillé.**
- Fait, trois obstacles :
  1. La politique du site (`connect-src`, `img-src` et `default-src` à `'self'`) bloque fetch, image et cadre vers hako.local avant toute requête.
  2. Le contenu mixte : un fetch d'une page HTTPS vers une adresse HTTP est bloqué. Chrome fait passer les images en HTTPS depuis la version 86, donc vers https://hako.local, qui échoue.
  3. Depuis Chrome 142, Local Network Access s'applique : fetch, sous-ressources et cadres vers .local depuis un site public déclenchent l'invite « Look for and connect to any device on your local network ». La page doit être en HTTPS. Si l'utilisateur accepte, les noms .local et les IP privées sont exemptés de la règle de contenu mixte. Les navigations de premier niveau ne sont pas visées.
- Firefox déploierait une restriction semblable à partir de la version 151.
- Sources :
  - https://developer.chrome.com/blog/local-network-access
  - https://github.com/WICG/local-network-access/blob/main/explainer.md
  - pour Firefox : https://support.mozilla.org/kb/control-personal-device-local-network-permissions-firefox (non lue en entier)
- Confiance : haute pour Chrome, faible pour Firefox.
- Conclusion pour le guide :
  - Un bouton-lien « Ouvrir ma box », l'adresse écrite en grand et un code QR.
  - Aucune détection depuis le site public.
  - La progression et l'état sont affichés par la page de la box elle-même : même origine, donc ni invite ni blocage.

## E. Raspberry Pi 5

**E1. Voyant d'état.**
- Fait :
  - Rouge à la mise sous tension, vert pendant le démarrage du firmware, vert fixe en marche, rouge après l'arrêt (veille).
  - Il ne clignote que pour l'activité de la carte microSD, pas avec un SSD sur M.2 HAT+.
  - Codes d'erreur par clignotements : 4 longs puis 6 ou 7 courts signalent une panne d'alimentation (type A ou B) ; 0 long et 10 courts signalent l'état HALT.
  - Le comportement du voyant se règle avec `dtparam=act_led_trigger` (par exemple `heartbeat`).
- Sources :
  - https://github.com/raspberrypi/documentation/blob/master/documentation/asciidoc/computers/configuration/led_blink_warnings.adoc
  - https://github.com/raspberrypi/firmware/blob/master/boot/overlays/README
- Confiance : haute.
- Conséquence : « vert fixe » ne veut pas dire « prête ». Si l'on veut un signal lumineux, piloter le voyant (à tester sur le prototype). Le boîtier imprimé doit laisser voir le voyant.

**E2. Bouton d'alimentation.**
- Fait :
  - Box éteinte mais alimentée : un appui la redémarre.
  - Sous Raspberry Pi OS Lite : un appui lance l'arrêt propre (`HandlePowerKey=poweroff` par défaut dans logind). Un appui maintenu force l'arrêt.
  - Le bouton est le périphérique d'entrée `pwr_button` (gpio-keys, KEY_POWER), surveillé par systemd-logind. Avec `HandlePowerKey=ignore`, un service peut lire ses appuis.
- Sources :
  - https://github.com/raspberrypi/documentation/blob/master/documentation/asciidoc/computers/raspberry-pi/power-button.adoc
  - https://bugs.launchpad.net/bugs/2057822
  - https://www.freedesktop.org/software/systemd/man/latest/logind.conf.html
- Confiance : haute pour la documentation, moyenne pour le détournement.
- Conséquence : le bouton peut servir de confirmation, mais je le déconseille pour le grand public. Un appui long coupe net, et si notre service est arrêté, un appui éteint la box. Le code de la carte reste préférable.

**E3. Alimentation.**
- Fait :
  - L'alimentation recommandée est la 27 W USB-C.
  - Avec une alimentation incapable de fournir 5 A, l'USB est limité à 600 mA au lieu de 1,6 A. Le démarrage USB est alors désactivé par défaut (`usb_max_current_enable=1` le réactive).
  - Une tension inférieure à 4,63 V (±5 %) est consignée dans le journal du noyau. `vcgencmd get_throttled` l'indique : bit 0 pour une sous-tension en cours, bit 16 si elle a eu lieu depuis le démarrage.
  - Éteint, le Pi consomme de 1 à 1,4 W ; avec `POWER_OFF_ON_HALT=1`, environ 0,01 W.
- Sources :
  - https://github.com/raspberrypi/documentation/blob/master/documentation/asciidoc/computers/raspberry-pi/power-supplies.adoc
  - https://github.com/raspberrypi/documentation/blob/master/documentation/asciidoc/computers/raspberry-pi/bootflow-eeprom.adoc
  - https://github.com/raspberrypi/documentation/blob/master/documentation/asciidoc/computers/os/graphics-utilities.adoc
- Confiance : haute.
- Conséquence : le guide exige l'alimentation fournie. La page de la box peut afficher « alimentation insuffisante » à partir de `get_throttled`.

**E4. Durée du premier démarrage.**
- Fait :
  - Je n'ai trouvé aucune mesure publiée de `docker load` sur un Pi 5 avec SSD.
  - Tailles compressées arm64 relevées dans les registres :

| Image | Taille compressée |
|---|---|
| immich-server v3.4.1 | 381 Mo |
| immich-machine-learning v3.4.1 | 238 Mo |
| postgres d'Immich (vectorchord) | 198 Mo |
| valkey 9 | 46 Mo |
| nextcloud 34.0.5-apache | 504 Mo |
| postgres 17-alpine (exemple, version pas encore figée) | 115 Mo |
| nginx 1-alpine | 26 Mo |
| **Total** | **environ 1,51 Go** |

  - La taille décompressée n'a pas été mesurée.
  - Docker 29 utilise par défaut le stockage d'images containerd sur une nouvelle installation.
- Source : https://www.docker.com/blog/docker-engine-version-29/
- Confiance : haute pour les tailles ; durée non vérifiée.
- Conséquence :
  - Chronométrer chaque `docker load` sur le prototype 4 Go au Lot 3.
  - Charger et démarrer nginx en premier pour afficher une page de progression.
  - Ne publier aucune durée dans le guide avant la mesure.

## F. Mots de passe faciles à recopier

**F1. Listes de mots françaises sous licence libre.**

| Liste | Licence | Mots | Caractéristiques |
|---|---|---|---|
| Tails (contributeur « Tango », 2024) | CC0 | 7 776 et 8 192 | ASCII sans accents, 4 à 8 lettres, mots rares et grossiers retirés à la main ; la version 7 776 est reprise comme `wordlist_fr` par le logiciel diceware |
| diceware-fr-alt (Arthur Pons) | MIT | 7 776 | ASCII ; 316 mots hors de la plage 4 à 9 lettres annoncée par le README |
| BIP-39 français | MIT | 2 048 | 11 bits par mot ; mots reconnaissables par leurs 4 premières lettres ; 366 mots accentués, qui restent tous distincts une fois les accents retirés |
| diceware-fr (C.-M. Duquesne) | CC-BY-3.0 | 7 776 | ancienne liste avec chiffres, symboles et mots rares, d'après Arthur Pons |

- « Diceware » est une marque d'Arnold G. Reinhold : éviter le terme dans les textes de marque.
- Sources :
  - https://github.com/chmduquesne/diceware-fr/tree/master/tails
  - https://gitlab.tails.boum.org/tails/tails/-/issues/20014
  - https://github.com/ulif/diceware
  - https://github.com/ArthurPons/diceware-fr-alt
  - https://github.com/bitcoin/bips/blob/master/bip-0039/bip-0039-wordlists.md
  - https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki
  - https://github.com/chmduquesne/diceware-fr
- Confiance : haute.
- Conséquence : la liste Tails de 8 192 mots donne exactement 13 bits par mot. Ses exemples contiennent des mots délicats (« croyante », « nubienne ») : la relire, et si l'on en retire, garder une puissance de 2 (4 096 mots = 12 bits).

**F2. Entropie, avec un tirage uniforme par un générateur cryptographique.**

| Nombre de mots | Liste de 8 192 (13 bits/mot) | Liste de 7 776 (12,9 bits/mot) | Liste de 2 048 (11 bits/mot) |
|---|---|---|---|
| 4 | 52 bits | 51,7 bits | 44 bits |
| 5 | 65 bits | 64,6 bits | 55 bits |
| 6 | 78 bits | 77,5 bits | 66 bits |
| 7 | 91 bits | 90,5 bits | 77 bits |
| 8 | 104 bits | 103,4 bits | 88 bits |

**F3. ANSSI**, guide ANSSI-PG-078 du 8 octobre 2021.
- Fait :
  - L'entropie ne vaut que si chaque mot est tiré uniformément au hasard.
  - Une phrase de passe consiste à tirer au hasard des mots d'un corpus, par exemple le dictionnaire français.
  - Tableau 3, pour un jeu de 90 caractères : 9 à 11 caractères ≈ 65 bits (sensibilité faible à moyenne), 12 à 14 ≈ 85 bits (moyenne à forte), 15 et plus ≥ 100 bits (forte à très forte).
  - Recommandations utiles ici : R10 limiter dans le temps le nombre de tentatives ; R11 s'authentifier par un canal sécurisé ; R22 pas de longueur maximale ; R30 prévoir une méthode de recouvrement ; R33 (utilisateur) un mot de passe différent par service.
- Source : https://messervices.cyber.gouv.fr/documents-guides/anssi-guide-authentification_multifacteur_et_mots_de_passe.pdf
- Confiance : haute.

**F4. CNIL**, délibération 2022-100 du 21 juillet 2022.
- Fait :
  - Cas 1, mot de passe seul : au moins 80 bits. Exemple donné : une phrase de passe d'au moins 7 mots.
  - Cas 2, avec restriction d'accès : au moins 50 bits. Mécanismes cités : temporisation qui croît après les échecs (plus d'une minute après 5 échecs, au plus 25 essais par 24 h), nombre d'essais limité (par exemple 10 par heure), captcha, blocage du compte.
  - Cas 3, avec un matériel détenu : au moins 13 bits.
- Sources :
  - https://www.cnil.fr/sites/cnil/files/atoms/files/deliberation-2022-100-du-21-juillet-2022_recommandation-aux-mots-de-passe.pdf
  - https://www.cnil.fr/fr/mots-de-passe-une-nouvelle-recommandation-pour-maitriser-sa-securite
- Confiance : haute ; le nombre de mots de l'exemple du cas 2 n'est pas lisible dans mon extraction.

**Conséquences pour la conception.**
- Sans limitation des tentatives (Immich aujourd'hui), il faut 7 mots de la liste de 8 192 (91 bits, environ 40 à 62 caractères).
- Avec une limitation dans nginx devant Immich et Nextcloud, 4 mots (52 bits) satisfont le cas 2, et 5 mots (65 bits) donnent de la marge.
- Le même mot de passe pour les photos et les fichiers va contre la recommandation R33 de l'ANSSI : à assumer explicitement, puisque les deux services sont sur la même box.
- Les mots de passe affichés et saisis en HTTP vont contre R11 : sur un Wi-Fi partagé, ils sont lisibles.
- La fiche de secours répond à R30.

---

## Non vérifié

1. La durée de `docker load` et du premier démarrage sur un Pi 5 avec SSD, et la taille décompressée des images. Il faut les mesurer sur le prototype.
2. Les noms automatiques (hako.home, hako.lan) et les adresses d'administration des box Orange, Free, SFR et Bouygues : aucune page officielle lue.
3. Windows : la fiabilité de la résolution de .local dans les navigateurs et l'effet du profil réseau « Public » sur la règle mDNS.
4. Chrome sous Android 17 : s'il demande l'autorisation `ACCESS_LOCAL_NETWORK` pour ouvrir hako.local. Les échecs signalés sur certains noms .local relèvent d'un forum.
5. Firefox : la version exacte des restrictions réseau local (151 selon un extrait), et son comportement HTTPS-First avec les noms .local.
6. Les navigateurs iOS à moteur non WebKit autorisés dans l'UE, face à la protection « Réseau local ».
7. L'isolation des clients sur les réseaux de résidence (Wifirst) : à tester sur place.
8. Le bouton du Pi 5 : la durée de l'appui long et l'impossibilité de désactiver l'arrêt forcé par logiciel.
9. Les noms des voyants dans /sys/class/leds sur le Pi 5, et le pilotage du voyant pendant l'installation.
10. Immich mobile : s'il impose aussi le changement de mot de passe quand `shouldChangePassword` vaut true (vérifié sur le web seulement).
11. Le contournement de la protection force brute de Nextcloud par un faux X-Real-IP : déduit de la configuration, pas testé.
12. Le délai de repli de Chrome quand le port 443 ignore les paquets au lieu de les refuser.
13. Le nombre de mots de l'exemple « phrase de passe » du cas 2 de la CNIL.
14. Le transfert d'un secret avec `docker exec -e OC_PASS` sans valeur.
15. L'anomalie Immich #33249 (commandes vidéo absentes en 3.4.x), qui n'est pas confirmée.
