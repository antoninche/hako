# Journal des modifications

Les versions de HakOS (MaBox OS jusqu'au Lot 0) suivent les lots du projet.

## [Lot 4] - 2026-11-13

### Ajouté

- scripts/test-sur-boitier.sh, copié dans l'image en /opt/box/test-sur-boitier.sh : test de fumée à lancer en root sur la box après le premier démarrage. Contrôles : .initialized, archives supprimées, .env en 0600, secrets uniques de 48 caractères hexadécimaux sans valeur par défaut, fiche en 0600, images figées chargées en arm64, chaque conteneur en marche et en bonne santé, apprentissage automatique conforme à la mémoire (conteneur, .env et API d'Immich), réponses des ports 80, 2283 et 8080 ; hors essai, nom d'hôte, machine-id, avahi, SSH selon le profil, unattended-upgrades limité à la sécurité, unité hakos-premier-demarrage, Wi-Fi débloqué et Bluetooth. Une ligne « OK » ou « ÉCHEC » par contrôle, un bilan, code 1 en cas d'échec ; variables HAKOS_BOITE, HAKOS_ESSAI et HAKOS_MEMOIRE_KIO comme le premier démarrage. Aucun secret affiché.
- scripts/verifier-image.sh (make verifier-image) : vérification d'une image construite, sans la démarrer, dans la VM Colima : image décompressée dans un dossier temporaire, attachée en lecture seule, partitions montées en lecture seule. 21 contrôles : empreinte, nom d'hôte, identité vierge, profil, /opt/box complet et propriété de root, versions.env, une archive arm64 par image figée, unités activées, paquets Docker, rpi-connect-lite absent, SSH et compte selon le profil, unattended-upgrades, config.txt (kernel8) et cmdline.txt (cgroup), aucun réseau préconfiguré, aucun .env, aucune clé privée hors clés d'hôte SSH, aucune trace de local/. Nettoyage et fstrim même en cas d'échec ; sans argument, l'image la plus récente de deploy/.
- docs/lots-1-a-4.md : contenu de l'image, décisions des lots 1 à 4, procédure de test sur le Pi 5 commande par commande.

### Modifié

- README.md : réécrit pour HakOS (prérequis, construction, vérification, gravure, test sur la box, Wi-Fi sur place, limites connues, organisation).

### Problèmes connus

- Aucune image HakOS n'a encore été construite ni démarrée sur un Pi 5 : la procédure de docs/lots-1-a-4.md reste à dérouler, image dev puis image prod.
- scripts/verifier-image.sh n'a tourné que sur l'image du Lot 0 (mécanique validée : décompression, montage, contrôles, nettoyage).
- Le premier démarrage et scripts/test-sur-boitier.sh ont tourné dans la VM Colima, en essai, avec les vraies images chargées depuis leurs archives : 19 contrôles réussis sans apprentissage automatique, 20 avec (docs/lots-1-a-4.md, « Essai dans la VM Colima »). Rien n'a encore tourné sur une box.
- Le Wi-Fi d'une box prod par le fichier network-config de bootfs n'est pas vérifié.
- Avant l'installation, la page de l'installateur de Nextcloud contient le mot de passe de sa base, prérempli par l'image ; la base n'a aucun port publié.

## [Lot 3] - 2026-11-13

### Ajouté

- rootfs/opt/box/firstboot.sh et rootfs/opt/box/lib/ : premier démarrage en 7 étapes, journal dans journald : machine-id propre à la box et clés d'hôte SSH en dev ; apprentissage automatique d'Immich selon la mémoire (seuil 7 Gio) ; un .env par service (0600, root), où chaque `__SECRET__` devient une valeur différente (`openssl rand -hex 24`), jamais journalisée ; `docker load` des archives puis leur suppression ; `docker compose up -d` de l'accueil, d'Immich puis de Nextcloud et attente de leur santé (900 s au plus, conteneur en cause nommé) ; fiche /root/fiche-installation.txt (0600, sans secret, emplacement réservé à la clé de récupération) ; /opt/box/.initialized seulement si tout a réussi. Relance sûre après un échec ; variables d'essai HAKOS_BOITE, HAKOS_ESSAI, HAKOS_MEMOIRE_KIO et HAKOS_DELAI_SANTE.
- rootfs/opt/box/systemd/hakos-premier-demarrage.service : unité oneshot, ConditionPathExists=!/opt/box/.initialized, après docker.service et network-online.target, 30 min au plus.
- stage-box/03-premier-demarrage : installation et activation de l'unité, contrôle de l'image (aucun .env, aucun .initialized, aucune fiche).

## [Lot 2] - 2026-11-13

### Ajouté

- versions.env : Immich v3.4.1, avec la Valkey et la Postgres de son docker-compose.yml officiel et leurs empreintes ; Nextcloud 34.0.5-apache ; Postgres 17.12-alpine ; nginx 1.31.8-alpine.
- scripts/recuperer-images.sh (make images) : les 7 images en linux/arm64, tirées par empreinte quand versions.env en donne une, étiquette vérifiée ou posée, architecture vérifiée, `docker save` par étiquette dans images/ (1,4 Gio) ; mode `--verifier` sans Docker, lancé pendant la construction.
- stage-box/01-docker : Docker Engine, containerd et le greffon compose depuis le dépôt apt officiel de Docker pour Debian (clé vérifiée), journaux des conteneurs limités, services activés sans jamais lancer dockerd dans le chroot.
- stage-box/02-applications : rootfs/opt/box, versions.env, test-sur-boitier.sh et les archives d'images déposés dans /opt/box avec `install -o root -g root`.
- rootfs/opt/box/home : page d'accueil « Votre HAKO » (nginx, port 80), statique, sans ressource externe, boutons « Mes photos » et « Mes fichiers » vers les ports 2283 et 8080.
- rootfs/opt/box/immich : docker-compose.yml d'après le fichier officiel de la v3.4.1, immich-machine-learning sous le profil compose « ml », config/immich-sans-ml.json pour couper l'apprentissage automatique.
- rootfs/opt/box/nextcloud : Nextcloud et sa base Postgres, port 8080, sans compte administrateur créé d'avance.
- Un env.modele par service, sans secret (`__SECRET__` à la place). Dans les fichiers compose : étiquettes seulement, `pull_policy: never`, `restart: unless-stopped`, healthchecks, données dans des chemins relatifs au dossier du service.

## [Lot 1] - 2026-11-13

### Ajouté

- config/commun.conf, config/dev.conf, config/prod.conf : configuration pi-gen de HakOS (IMG_NAME=hakos), nom d'hôte hako, compte hako jamais renommé, fr_FR.UTF-8, clavier fr, fuseau Europe/Paris, WPA_COUNTRY=FR, cloud-init gardé ; dev avec SSH par clé seulement, prod sans SSH.
- stage-box : étape pi-gen maison. prerun.sh ; EXPORT_IMAGE (image_AAAA-MM-JJ-hakos-dev.img.xz ou -prod) ; 00-systeme : /opt/box/profil, /etc/ssh/sshd_config.d/10-hakos.conf, unattended-upgrades limité à l'origine Debian-Security (52hakos-securite), noyau kernel8.img à pages de 4 Kio sur Pi 5, `cgroup_enable=memory cgroup_memory=1` dans cmdline.txt, avahi activé, rpi-connect-lite purgé ; en prod, ssh.service, ssh.socket et sshswitch.service masqués et compte hako verrouillé ; 99-nettoyage : caches apt vidés avant l'export.
- scripts/construire.sh (make build-dev, make build-prod) : construction par le build Docker de pi-gen avec la méthode du Lot 0 (config dans local/pigen.conf, montée en lecture seule puis effacée), montages en lecture seule de stage-box/, rootfs/, images/, scripts/ et versions.env, une archive par image figée exigée, mot de passe prod tiré au hasard et jeté, SHA256SUMS et journal dans deploy/.
- scripts/verifier-qualite.sh (make lint) : shellcheck sur tous les scripts, `docker compose config -q` sur chaque fichier compose avec un .env provisoire, recherche de secrets dans les fichiers suivis ou à suivre.
- Makefile : images, build-dev, build-prod, build, lint, verifier-image, clean.

### Modifié

- .gitignore : images/ (archives des images Docker) tenu hors du dépôt.

## [Lot 0] - 2026-11-12

### Ajouté

- versions.env : pi-gen figé sur la branche arm64, révision c0d2c9f2cffc08bc56850b0a3eb23178f4226e8a.
- config/stock.conf : configuration de l'image Lite de référence, sans étape maison (nom d'hôte mabox-test, compte mabox, SSH par clé seulement, fr_FR.UTF-8, clavier fr, fuseau Europe/Paris).
- scripts/verifier-hote.sh : vérification en lecture seule de la machine de construction (architecture, place libre sur le Mac et dans la VM Colima, outils, moteur Docker, périphériques loop, conteneur pigen_work restant, accès réseau).
- scripts/recuperer-pigen.sh : récupération de pi-gen à la révision figée, sans toucher à une copie modifiée à la main.
- scripts/construire-stock.sh : construction par le build Docker officiel de pi-gen ; config et secrets gardés dans local/ et montés en lecture seule, sans jamais entrer dans l'image Docker pi-gen ; SHA256SUMS et journal dans deploy/ ; fstrim dans la VM Colima.
- scripts/flasher-ssd.sh : gravure d'un SSD depuis le Mac : contrôle de l'empreinte et du disque (externe, physique, sans partition Apple, distinct du disque du Mac), confirmation au clavier, table de partitions écrite en dernier, relecture de toute l'image, éjection, mode `--simulation`.
- .gitignore : pi-gen/, deploy/, images, archives et secrets (local/, clés) tenus hors du dépôt.
- README.md et docs/lot0-faisabilite.md : mode d'emploi, résultats du Lot 0, procédure de test sur le Pi, décisions pour le Lot 1.
- Image de test, hors dépôt : image_2026-11-12-mabox-stock-lite.img.xz (610611600 octets, SHA-256 358896aba1230b16fdbf448e08142d32b98e94ca229ff3e63f61058cb399f60c), construite en 5 min 33 s sur un Mac Apple Silicon avec Colima.

### Problèmes connus

- Le démarrage de l'image sur le Pi 5 n'est pas encore testé.
- scripts/flasher-ssd.sh n'a pas encore gravé de vrai SSD (testé en simulation et vers un fichier).
