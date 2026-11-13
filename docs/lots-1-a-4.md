# Lots 1 à 4 : HakoS

MaBox OS devient HakoS, le système de la box HAKO. Les lots 1 à 4 ajoutent à l'image Lite du Lot 0 une étape pi-gen maison, stage-box, qui livre une box complète : Docker, Immich, Nextcloud, une page d'accueil et un premier démarrage qui rend chaque box unique. Cette note donne le contenu de l'image, les décisions prises et la procédure de test sur le Pi 5. Elle décrit l'état au 13 novembre 2026.

Au moment de l'écrire, aucune image HakoS n'a encore été construite ni démarrée : tout ce qui touche à la box est à vérifier avec la procédure plus bas. La liste est à la fin, dans « Reste à vérifier ». Le premier démarrage, lui, a déjà tourné pour de vrai dans la VM Colima, avec les vraies images Docker (« Essai dans la VM Colima »).

## Contenu de l'image

La construction (scripts/construire.sh) enchaîne stage0, stage1 et stage2 de pi-gen, comme au Lot 0, puis stage-box. stage2 n'exporte plus d'image (SKIP_IMAGES) : seule stage-box en exporte une, nommée image_AAAA-MM-JJ-hakos-dev.img.xz ou image_AAAA-MM-JJ-hakos-prod.img.xz.

| Étape | Rôle |
| --- | --- |
| prerun.sh | repart du système de stage2 ; refuse de tourner sans HAKOS_PROFIL (dev ou prod) ni dépôt visible |
| 00-systeme | fichier /opt/box/profil, réglages SSH, mises à jour de sécurité, noyau du Pi 5, cgroup memory, avahi activé, rpi-connect-lite retiré ; en prod, SSH masqué et compte verrouillé |
| 01-docker | Docker Engine et le greffon compose, depuis le dépôt apt officiel de Docker pour Debian ; rotation des journaux des conteneurs ; dockerd n'est jamais lancé dans le chroot |
| 02-applications | rootfs/opt/box vers /opt/box, versions.env, test-sur-boitier.sh, et les 7 archives d'images Docker, contrôlées par `recuperer-images.sh --verifier` |
| 03-premier-demarrage | unité hakos-premier-demarrage installée dans /etc/systemd/system et activée ; vérifie que firstboot.sh, sa bibliothèque, les fichiers compose et les archives sont en place ; refuse une image qui contiendrait un .env, /opt/box/.initialized ou une fiche d'installation |
| 99-nettoyage | caches apt vidés avant l'export |

Tous les fichiers venus du Mac sont copiés avec `install -o root -g root` : vus à travers virtiofs, ils gardent l'UID du Mac (501).

## Décisions

### Nom, compte et adresse

Le système s'appelle HakoS (IMG_NAME=hakos, PI_GEN_RELEASE="HakoS"). Toutes les box s'appellent hako et répondent à http://hako.local, l'adresse du guide d'installation du site. Le compte s'appelle hako (FIRST_USER_NAME), et il n'est jamais renommé au premier démarrage (DISABLE_FIRST_BOOT_USER_RENAME=1).

Deux box sur le même réseau : avahi donne à la seconde le nom hako-2.local. Les boutons de la page d'accueil passent par /photos et /fichiers, qui renvoient vers le nom ou l'adresse IP que le navigateur a utilisé : ils marchent aussi avec hako-2.local ou une adresse IP. La fiche d'installation, elle, indique toujours hako.local.

### Noyau à pages de 4 Kio sur le Pi 5

Le Pi 5 démarre par défaut sur kernel_2712.img, un noyau à pages mémoire de 16 Kio. Une partie des logiciels livrés en images Docker (jemalloc, Postgres, Immich) est prévue pour des pages de 4 Kio. Par prudence, la section [pi5] de config.txt reçoit `kernel=kernel8.img` : c'est le noyau des Pi 4 (variante rpi-v8, pages de 4 Kio), présent sur bootfs, qui démarre aussi sur Pi 5. La ligne ne vaut que pour un Pi 5. Avec `auto_initramfs=1`, le firmware charge alors initramfs8, que pi-gen crée à l'export comme initramfs_2712 : l'agrandissement de la partition au premier démarrage, fait dans l'initramfs, est gardé. Nous renonçons au noyau taillé pour le Pi 5.

Sur la box, `getconf PAGESIZE` doit répondre 4096 et `uname -r` doit finir par `-rpi-v8`.

### cgroup memory

cmdline.txt reçoit `cgroup_enable=memory cgroup_memory=1`, sur sa ligne unique. Docker s'appuie sur ce contrôleur pour compter et limiter la mémoire des conteneurs. Au Lot 0, nous avions relevé que Raspberry Pi OS Lite trixie (Pi 4, noyau 6.12) ne l'active pas sans ces paramètres (issue pi-gen #917) ; sur Pi 5 avec le noyau 6.18, ce n'était pas vérifié. Le mot « resize » reste sur la ligne : sans lui, ni agrandissement ni nouvel ID disque au premier démarrage.

### cloud-init gardé

Le Lot 0 proposait de retirer cloud-init. Nous le gardons tel quel, pour deux raisons. Sans lui, rien ne prouve que l'Ethernet monte encore en DHCP : nous gardons le réglage du réseau tel que Raspberry Pi le livre. Et son fichier network-config, sur bootfs, est le seul moyen de donner un Wi-Fi à une box prod, qui n'a pas de SSH (README, « Rejoindre un Wi-Fi sur place »).

Ce choix a un prix, connu depuis le Lot 0. bootfs est une partition FAT que n'importe quel ordinateur peut modifier : qui a le SSD en main peut, par user-data, meta-data et network-config, ajouter un compte ou une clé, ou lancer des commandes en root. Il pourrait aussi lire directement les données, le disque n'étant pas chiffré. Les deux anomalies relevées au Lot 0 restent : meta-data écrit `instance_id` au lieu de `instance-id`, et le module netplan_nm_patch manque, d'où « degraded done » (code 2) pour `cloud-init status`. Aucune ligne active n'est ajoutée à user-data ni à network-config : `make verifier-image` le contrôle.

### rpi-connect-lite retiré

rpi-connect-lite est l'accès à distance de Raspberry Pi (Raspberry Pi Connect). Il contredit la promesse « zéro accès » : 00-systeme le purge, et ses dépendances devenues inutiles partent à l'export de pi-gen (`apt-get dist-upgrade --auto-remove --purge`).

### SSH et compte

Nos réglages SSH sont dans /etc/ssh/sshd_config.d/10-hakos.conf, lu avant sshd_config, où la première valeur lue l'emporte : PasswordAuthentication no, KbdInteractiveAuthentication no, PermitRootLogin no, X11Forwarding no.

- dev : SSH activé, clés publiques de local/cles-ssh-dev.pub, connexion par clé seulement. Le compte hako a le mot de passe console de local/mot-de-passe-dev, que sudo demande.
- prod : aucune clé ; le mot de passe que pi-gen exige est tiré au hasard puis jeté ; le compte hako est verrouillé (`usermod -L`). ssh.service, ssh.socket et sshswitch.service sont masqués : un fichier « ssh » déposé sur bootfs ne rallume pas SSH.

Les clés d'hôte SSH ne sont pas dans l'image : regenerate_ssh_host_keys.service (Raspberry Pi) les crée au premier démarrage, et firstboot.sh les crée en dev si elles manquent encore.

### Mises à jour

unattended-upgrades est installé et activé (debconf enable_auto_updates, d'où /etc/apt/apt.conf.d/20auto-upgrades). Le fichier 52hakos-securite vide la liste d'origines de Debian (`#clear`), qui accepte aussi les mises à jour de la version stable, et n'autorise que l'origine Debian-Security. Les dépôts Raspberry Pi (noyau, firmware) et Docker ne sont pas mis à jour seuls ; les images Docker des applications non plus. Ils changent avec une nouvelle image HakoS, donc avec une nouvelle gravure, qui efface les données. rpi-eeprom-update reste actif, comme au Lot 0 : au démarrage, il peut réécrire un bootloader plus ancien que celui que livre l'image.

### Apprentissage automatique d'Immich

Une seule image sert aux deux modèles de box. Le premier démarrage lit MemTotal (ou HAKOS_MEMOIRE_KIO en essai) :

- 7 Gio ou plus (7340032 kio, Pi 5 de 8 Go) : il ajoute `COMPOSE_PROFILES=ml` au .env d'Immich, et le service immich-machine-learning, rangé sous le profil compose « ml », démarre ;
- moins (Pi 5 de 4 Go) : il ajoute `IMMICH_CONFIG_FILE=/usr/src/app/hakos/immich-sans-ml.json`. Ce fichier, monté en lecture seule depuis immich/config, vaut `{"machineLearning":{"enabled":false}}` : le serveur n'appelle pas un conteneur absent. C'est le mécanisme documenté par Immich v3.4.1 (docs/docs/install/config-file.md). La même page prévient que, avec IMMICH_CONFIG_FILE, les réglages ne se modifient plus dans l'interface web.

L'archive de l'image d'apprentissage automatique est livrée et chargée dans les deux cas. Sur la box, l'API publique `/api/server/features` d'Immich dit l'état réel : `"smartSearch":true` avec l'apprentissage automatique, `false` sans. Le test sur la box le contrôle.

### Ports

| Port | Service |
| --- | --- |
| 80 | page d'accueil (nginx) ; /photos et /fichiers renvoient vers les deux applications |
| 2283 | Immich |
| 8080 | Nextcloud (port 80 du conteneur) |
| 22 | SSH, profil dev seulement |

Tout passe en http, sur le réseau de la maison, sans chiffrement.

### Images Docker : étiquettes, empreintes et pull_policy

versions.env fige toutes les versions, sans « latest » ni « release » : Immich v3.4.1, Nextcloud 34.0.5-apache, Postgres 17.12-alpine pour Nextcloud, nginx 1.31.8-alpine, et pour Immich la Valkey et la Postgres de son docker-compose.yml officiel, avec leurs empreintes (digests).

Les fichiers compose désignent les images par leur seule étiquette, jamais par une empreinte : `docker load` ne garde pas l'empreinte du registre, et compose voudrait alors télécharger l'image. L'empreinte est donc vérifiée en amont, sur le Mac : scripts/recuperer-images.sh tire chaque image par son empreinte quand versions.env en donne une, vérifie que l'étiquette désigne bien cette empreinte (sinon la pose avec `docker tag`), vérifie l'architecture linux/arm64, puis l'enregistre par son étiquette avec `docker save` dans images/. construire.sh exige une archive par image figée, reconnue à son étiquette, et 02-applications refait le contrôle dans le conteneur. `make verifier-image` relit les étiquettes et l'architecture de chaque archive de l'image construite.

Chaque service porte `pull_policy: never` : compose ne télécharge jamais rien chez le client. Une image absente fait échouer `docker compose up` au lieu de partir sur Internet, et le premier démarrage le dit avant même de lancer compose.

### Secrets et premier démarrage

Chaque dossier de service (home, immich, nextcloud) contient un modèle, env.modele, sans aucun secret : chaque secret y est écrit `__SECRET__`. Au premier démarrage, firstboot.sh écrit le .env de chaque service (mode 0600, root) : les lignes de versions.env, puis env.modele où chaque `__SECRET__` devient une valeur différente (`openssl rand -hex 24`, 48 caractères hexadécimaux), puis, pour Immich, la ligne de l'apprentissage automatique. Aucun secret n'est écrit dans le journal. Il y en a deux aujourd'hui : DB_PASSWORD (Immich) et POSTGRES_PASSWORD (Nextcloud).

Le premier démarrage suit ensuite le cahier des charges : machine-id propre à la box, chargement des 7 archives puis leur suppression, `docker compose up -d` pour l'accueil, Immich puis Nextcloud, attente de chaque conteneur (« healthy » s'il a un healthcheck, « running » sinon) dans un délai total de 900 s (HAKOS_DELAI_SANTE), fiche /root/fiche-installation.txt (0600, sans secret), puis /opt/box/.initialized. Au délai dépassé, il nomme le conteneur en cause, rend un code non nul et ne crée pas .initialized. L'unité systemd (Type=oneshot, ConditionPathExists=!/opt/box/.initialized, TimeoutStartSec=30min) ne tourne donc qu'une fois. Après une correction, `systemctl start hakos-premier-demarrage` relance le premier démarrage en gardant les .env déjà écrits.

Pour essayer hors box : HAKOS_BOITE (dossier, défaut /opt/box), HAKOS_ESSAI=1 (rien dans /etc ; fiche dans $HAKOS_BOITE), HAKOS_MEMOIRE_KIO et HAKOS_DELAI_SANTE. test-sur-boitier.sh reconnaît les trois premières.

### Contrôles

- `make lint` : shellcheck, `docker compose config -q` de chaque fichier compose (avec et sans le profil ml), secrets dans les fichiers suivis ou à suivre.
- `make verifier-image` : l'image construite, sans la démarrer, dans la VM Colima (21 contrôles).
- `sudo /opt/box/test-sur-boitier.sh` : la box après son premier démarrage (27 contrôles sur une box de 4 Go, 28 sur une box de 8 Go). Il ne modifie rien et n'affiche jamais un secret.

## Essai dans la VM Colima

Le 13 novembre, sans construction pi-gen, le premier démarrage a tourné dans la VM Colima (Ubuntu 24.04 arm64, Docker 29.5.2, Docker Compose 5.1.4, 8 Gio de mémoire), avec les vrais fichiers du dépôt et les vraies images :

1. Les 7 images figées ont été retirées de Docker (`docker image rm`), pour que leur chargement depuis les archives soit réellement éprouvé.
2. L'étape stage-box/02-applications a tourné dans la VM, avec un ROOTFS_DIR provisoire. Le /opt/box obtenu a été placé dans /opt/hakos-essai, avec « dev » dans profil.
3. Premier démarrage, cas d'un Pi 5 de 4 Go :

   ```sh
   sudo env HAKOS_BOITE=/opt/hakos-essai HAKOS_ESSAI=1 HAKOS_MEMOIRE_KIO=4000000 /opt/hakos-essai/firstboot.sh
   ```

Résultats :

- Premier démarrage réussi en 1 min 9 s, chargement des 7 archives compris. Accueil prêt en 5 s, Immich en 32 s, Nextcloud en 6 s.
- Pages et services :
  - accueil : code 200 avec « Mes photos » ;
  - /photos et /fichiers : code 302 vers les ports 2283 et 8080, sur le nom demandé par le navigateur (essayé aussi avec hako.local) ;
  - Immich : `{"res":"pong"}` et `"smartSearch":false` ;
  - Nextcloud : l'installateur, avec la base déjà réglée (status.php : `"installed":false`).
- Apprentissage automatique : aucun conteneur, et `IMMICH_CONFIG_FILE` est posé dans immich/.env.
- Fichiers de la box :
  - trois .env en 600, propriété de root ;
  - deux secrets de 48 caractères hexadécimaux, différents ;
  - archives supprimées ;
  - fiche en 600 et .initialized présent.
- `test-sur-boitier.sh`, lancé avec les mêmes variables, répond « Bilan : 19 contrôles réussis, aucun échec. ». Les 8 contrôles du système sont sautés en essai.
- Relancé, firstboot.sh refuse avec le code 1 : « Erreur : la box est déjà initialisée (/opt/hakos-essai/.initialized existe) : le premier démarrage ne se relance pas. »
- Mémoire occupée après le démarrage : environ 1,7 Gio en tout, dont immich_server 860 Mio, la Postgres d'Immich 520 Mio et Nextcloud 210 Mio.
- Cas d'un Pi 5 de 8 Go (HAKOS_MEMOIRE_KIO=8000000), images déjà chargées : premier démarrage réussi en 48 s, immich_machine_learning en bonne santé, `"smartSearch":true`, puis « Bilan : 20 contrôles réussis, aucun échec. ».

Constat : avant l'installation, la page de l'installateur de Nextcloud contient le mot de passe de sa base. L'image préremplit le formulaire à partir des variables POSTGRES_* (autoconfig.php). Cette base n'a aucun port publié : elle n'est joignable que depuis le réseau Docker du projet.

Tout a été défait ensuite : `docker compose down -v` des trois projets, puis suppression de /opt/hakos-essai.

Cet essai ne prouve rien sur l'unité systemd, le machine-id, les clés SSH ni les durées sur le Pi (processeur, SSD, noyau à pages de 4 Kio). La procédure suivante reste à dérouler.

## Procédure de test sur le Pi 5

Elle reprend les conditions du Lot 0 (« Conditions côté Pi » et « Pièges pendant le test » de docs/lot0-faisabilite.md) : Pi 5 prototype de l'équipe, SSD dans le M.2 HAT+ ou en USB 3, aucune microSD, alimentation officielle 27 W, câble Ethernet vers le réseau du Mac, Terminal.app. Les étapes 1 à 9 se font avec l'image dev, l'étape 10 avec l'image prod. Le compte rendu garde les sorties, sans aucun mot de passe.

Étape 1, sur le Mac : construire et vérifier l'image dev.

```sh
cd ~/Code/mabox-os
make images && make build-dev && make lint && make verifier-image
cd deploy && shasum -a 256 -c SHA256SUMS; cd ..
```

Sortie attendue : « Construction terminée en … », « Bilan : tous les contrôles sont passés. » pour make lint, « Bilan : 21 contrôles réussis, aucun échec. » pour make verifier-image, et une ligne « … : OK » par image de deploy/.

Étape 2 : graver le SSD.

```sh
diskutil list external physical    # SSD débranché, puis branché : le nouveau diskN est le SSD
scripts/flasher-ssd.sh deploy/image_AAAA-MM-JJ-hakos-dev.img.xz diskN
```

Sortie attendue : une ligne qui commence par « Relecture conforme », puis « Terminé ».

Étape 3 : premier démarrage. Brancher l'alimentation, puis lancer sur le Mac, toutes les 30 s :

```sh
ping -c 3 hako.local
```

Sortie attendue au bout de quelques minutes : `3 packets transmitted, 3 packets received, 0.0% packet loss`. Le premier démarrage continue ensuite en arrière-plan : ne pas couper le courant.

Étape 4 : connexion et suivi du premier démarrage.

```sh
ssh-keygen -R hako.local; ssh -i ~/.ssh/mabox-dev -o IdentitiesOnly=yes hako@hako.local
sudo journalctl -b -u hakos-premier-demarrage -o cat -n all -f
```

ssh annonce une clé inconnue : noter l'empreinte et répondre yes. L'invite `hako@hako:~ $` s'affiche sans mot de passe ; sudo demande ensuite le mot de passe console (local/mot-de-passe-dev). Le journal montre « HakoS : premier démarrage (dossier /opt/box, profil dev). », les étapes « Étape 1/7 » à « Étape 7/7 », puis « Premier démarrage réussi en … : /opt/box/.initialized créé. ». Noter la durée, puis Ctrl-C. En cas d'échec, le journal finit par « Erreur : premier démarrage interrompu à l'étape … » et nomme le conteneur en cause ; `sudo docker logs NOM` en donne la raison.

Étape 5 : test de fumée.

```sh
sudo /opt/box/test-sur-boitier.sh; echo "code=$?"
```

Sortie attendue sur un Pi 5 de 4 Go (l'ordre des conteneurs d'un même projet peut varier) :

```text
Test de HakoS dans /opt/box : profil dev, mémoire NNNNNNN Kio.
OK     premier démarrage terminé (/opt/box/.initialized présent)
OK     archives d'images supprimées (/opt/box/images)
OK     /opt/box/home/.env en 0600, propriété de root
OK     /opt/box/immich/.env en 0600, propriété de root
OK     /opt/box/nextcloud/.env en 0600, propriété de root
OK     2 secrets tirés au premier démarrage, tous différents, aucune valeur par défaut
OK     fiche d'installation /root/fiche-installation.txt présente, en 0600
OK     moteur Docker actif
OK     7 images figées chargées dans Docker, en arm64
OK     hakos-accueil/nginx : en marche, en bonne santé
OK     hakos-immich/database : en marche, en bonne santé
OK     hakos-immich/redis : en marche, en bonne santé
OK     hakos-immich/immich-server : en marche, en bonne santé
OK     hakos-nextcloud/db : en marche, en bonne santé
OK     hakos-nextcloud/nextcloud : en marche, en bonne santé
OK     apprentissage automatique coupé (NNNNNNN Kio < 7 Gio) : pas de conteneur, IMMICH_CONFIG_FILE posé, recherche intelligente coupée
OK     page d'accueil http://localhost/ : répond, contient « Mes photos »
OK     Immich http://localhost:2283/api/server/ping : pong
OK     Nextcloud http://localhost:8080/ : répond (code 200), contient « Nextcloud »
OK     nom d'hôte hako
OK     machine-id propre à cette box
OK     avahi actif (adresse hako.local)
OK     SSH actif, port 22 ouvert (profil dev)
OK     unattended-upgrades configuré : mises à jour de sécurité Debian seulement
OK     unité hakos-premier-demarrage.service activée et réussie
OK     Wi-Fi disponible (radio débloquée)
OK     Bluetooth actif

Bilan : 27 contrôles réussis, aucun échec.
code=0
```

Sur un Pi 5 de 8 Go, la ligne de l'apprentissage automatique devient « apprentissage automatique actif … », une ligne « hakos-immich/immich-machine-learning : en marche, en bonne santé » s'ajoute, et le bilan compte 28 contrôles. Un conteneur encore « starting » juste après le démarrage : attendre une minute et relancer.

Étape 6 : noyau, mémoire, cgroup et identité.

```sh
export LC_ALL=C; uname -r; getconf PAGESIZE; grep -o 'cgroup_[a-z]*=[a-z0-9]*' /boot/firmware/cmdline.txt; cat /sys/fs/cgroup/cgroup.controllers; sudo docker info 2>&1 | grep -c 'No memory limit support'; cat /etc/machine-id
```

Sortie attendue : une version qui finit par `-rpi-v8`, `4096`, `cgroup_enable=memory`, `cgroup_memory=1`, une liste de contrôleurs qui contient `memory`, `0`, puis 32 caractères hexadécimaux à noter (machine-id).

Étape 7 : fiche d'installation.

```sh
sudo cat /root/fiche-installation.txt
```

Sortie attendue : nom de la box hako, un identifiant d'installation (UUID), la date, le profil dev, la mémoire, l'état de l'apprentissage automatique, Immich v3.4.1, Nextcloud 34.0.5-apache, les trois adresses en hako.local, et l'emplacement réservé à la clé de récupération. Aucun mot de passe.

Étape 8, dans le navigateur du Mac : les trois services.

- http://hako.local : la page « Votre HAKO » avec « Mes photos » et « Mes fichiers ».
- « Mes photos » ouvre http://hako.local:2283/ : Immich propose de créer le compte administrateur. Le créer.
- « Mes fichiers » ouvre http://hako.local:8080/ : l'installateur de Nextcloud. D'après le fichier compose, il ne demande que le compte administrateur, la base étant déjà réglée par les variables POSTGRES_* : à vérifier. Créer le compte, puis se reconnecter.
- Sur un Pi 5 de 4 Go, dans les réglages d'administration d'Immich : l'apprentissage automatique est désactivé, et les réglages ne sont pas modifiables.

Étape 9 : redémarrage, puis Wi-Fi.

```sh
sudo reboot
```

Une à deux minutes plus tard, depuis le Mac :

```sh
ssh -i ~/.ssh/mabox-dev -o IdentitiesOnly=yes hako@hako.local 'systemctl show -p ConditionResult --value hakos-premier-demarrage; cat /etc/machine-id'
ssh -t -i ~/.ssh/mabox-dev -o IdentitiesOnly=yes hako@hako.local 'sudo /opt/box/test-sur-boitier.sh | tail -n 1'
```

Sortie attendue : connexion sans avertissement de clé d'hôte, `no` (le premier démarrage ne tourne plus), le même machine-id qu'à l'étape 6, puis « Bilan : 27 contrôles réussis, aucun échec. » (28 sur un Pi 5 de 8 Go). Pour le Wi-Fi, suivre « Rejoindre un Wi-Fi sur place » du README, puis débrancher l'Ethernet : `ping -c 3 hako.local` répond toujours et http://hako.local s'ouvre.

Étape 10 : image prod. Construire (`make build-prod`, `make verifier-image`), graver et démarrer comme aux étapes 1 à 3, puis laisser au premier démarrage la durée notée à l'étape 4. Depuis le Mac :

```sh
curl -s http://hako.local/ | grep -c 'Mes photos'
curl -s http://hako.local:2283/api/server/ping; echo
curl -sL -o /dev/null -w '%{http_code}\n' http://hako.local:8080/
nc -z -G 5 hako.local 22; echo "code=$?"
ssh -o BatchMode=yes -o ConnectTimeout=5 hako@hako.local true; echo "code=$?"
```

Sortie attendue : `1`, `{"res":"pong"}`, `200`, `code=1` (port 22 fermé), puis « Connection refused » et `code=255`. Immich et Nextcloud proposent de créer leurs comptes administrateurs, comme à l'étape 8.

Étape 11, facultative : deux box, aucun secret commun. Graver la même image dev sur un second SSD et dérouler les étapes 3 à 5. Sur chaque box :

```sh
cat /etc/machine-id; sudo sha256sum /opt/box/immich/.env /opt/box/nextcloud/.env; sudo grep -i identifiant /root/fiche-installation.txt
```

Sortie attendue : machine-id, empreintes des deux .env et identifiant d'installation tous différents d'une box à l'autre. Sur deux box de même mémoire, les .env ne diffèrent que par leurs secrets : des empreintes différentes prouvent des secrets différents, sans les afficher. Ne jamais brancher deux SSD fraîchement gravés en même temps (même PARTUUID, voir le Lot 0).

## Reste à vérifier

- Aucune image HakoS n'est encore construite : `make build-dev`, `make build-prod` et `make verifier-image` restent à dérouler, ainsi que la place disque qu'ils demandent.
- Sur la box : démarrage du Pi 5 sur kernel8.img avec initramfs8 et agrandissement de la partition, cgroup memory, durée du premier démarrage, apprentissage automatique actif ou coupé selon la mémoire, installateur de Nextcloud, persistance après redémarrage.
- Le Wi-Fi débloqué grâce à WPA_COUNTRY=FR, et la connexion Wi-Fi d'une box prod par network-config.
- Les points restés ouverts au Lot 0 : test de démarrage sur SSD, version du bootloader et BOOT_ORDER, gravure d'un vrai SSD par scripts/flasher-ssd.sh.
