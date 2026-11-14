# HakOS

HakOS est le système de la box HAKO : une image Raspberry Pi OS Lite (Debian 13 trixie, arm64) pour Raspberry Pi 5, qui démarre sur SSD. L'image est construite avec pi-gen, l'outil officiel de Raspberry Pi, à la révision figée dans versions.env. Elle contient trois services, en conteneurs Docker :

- la page d'accueil, http://hako.local (nginx, port 80), avec deux boutons : « Mes photos » et « Mes fichiers » ;
- Immich, pour les photos, sur le port 2283 (nginx devant Immich, qui n'écoute que sur 127.0.0.1:12283) ;
- Nextcloud, pour les fichiers, sur le port 8080.

Rien n'est téléchargé chez le client : les images Docker sont livrées dans l'image système et chargées au premier démarrage. Chaque box tire alors ses propres secrets (mots de passe des bases de données), démarre les services et écrit sa fiche d'installation. Deux box gravées avec la même image ne partagent aucun secret.

Avant sa première installation, la box sert sur http://hako.local la page de la HAKO (assistant de première installation, construite depuis le dépôt hako-site) : la famille donne ses prénoms, reçoit ses mots de passe, fait sa fiche de secours, et la box crée les comptes dans Immich et Nextcloud. D'ici là, les ports 2283 et 8080 restent fermés au réseau : personne ne peut prendre un compte administrateur. Détails : docs/lot5-assistant.md.

Deux profils, construits à partir des mêmes fichiers :

| Profil | Pour | Accès à la box |
| --- | --- | --- |
| dev | l'équipe | SSH par clé seulement (clés de l'équipe), compte hako avec un mot de passe console |
| prod | les clients | aucun : SSH masqué, compte hako verrouillé, aucune clé (promesse « zéro accès ») |

L'image dev ne doit jamais être installée chez un client.

## Prérequis

- Un Mac Apple Silicon : la construction est native (arm64), sans émulation.
- Colima, docker, le greffon docker compose, xz, git et curl.
- Un clone du dépôt dans un chemin sans espace, hors OneDrive ou iCloud, par exemple ~/Code/mabox-os.
- Pour le profil dev, le fichier local/cles-ssh-dev.pub : une clé publique SSH par ligne, une par membre de l'équipe. Le dossier local/ n'est jamais versionné.

```sh
brew install colima docker docker-compose xz
colima start --vm-type vz --arch aarch64 --cpu 6 --memory 8 --disk 60 --mount-type virtiofs
docker compose version
```

Homebrew explique comment déclarer le greffon compose (`cliPluginsExtraDirs` dans ~/.docker/config.json) : `docker compose version` doit répondre. Une VM Colima déjà créée se règle à l'arrêt : `colima stop`, puis `colima start --cpu 6 --memory 8 --disk 60`. Son disque peut grandir, jamais rétrécir (sauf `colima delete --data`, qui efface toutes les images Docker).

scripts/verifier-hote.sh contrôle la machine en lecture seule : architecture, outils, moteur Docker, place libre (20 Gio sur le Mac, 15 Gio dans la VM), périphériques loop et accès réseau. La construction le relance d'elle-même.

## Construire

```sh
ssh-keygen -t ed25519 -f ~/.ssh/mabox-dev       # clé de l'équipe, si elle n'existe pas encore
mkdir -p -m 700 local
cat ~/.ssh/mabox-dev.pub >> local/cles-ssh-dev.pub
make images        # les 7 images Docker figées, en arm64, dans images/ (1,4 Gio)
make build-dev     # image de l'équipe
make build-prod    # image des clients (make build fait la même chose)
```

`make images` (scripts/recuperer-images.sh) récupère chaque image de versions.env pour linux/arm64, par son empreinte quand versions.env en donne une, vérifie l'étiquette et l'architecture, puis l'enregistre avec `docker save` dans images/. Une archive à jour n'est pas refaite.

`make build-dev` et `make build-prod` lancent scripts/construire.sh, qui reprend la méthode du Lot 0 : la config complète est écrite dans local/pigen.conf (mode 600), montée en lecture seule dans le conteneur de pi-gen, puis effacée à la fin, même en cas d'échec. Aucun secret n'entre dans l'image Docker de pi-gen. En dev, le mot de passe console du compte hako est lu dans local/mot-de-passe-dev (tiré au hasard s'il manque) ; en prod, il est tiré au hasard et jeté. Les images arrivent dans deploy/, avec SHA256SUMS et un journal :

```text
deploy/image_AAAA-MM-JJ-hakos-dev.img.xz
deploy/image_AAAA-MM-JJ-hakos-prod.img.xz
deploy/SHA256SUMS
deploy/hakos-PROFIL-construction-AAAAMMJJ-HHMMSS.log
```

Après un échec, le conteneur pigen_work reste pour le diagnostic (`docker logs pigen_work`). Le supprimer avant de relancer, puis rendre la place au Mac :

```sh
docker rm -v pigen_work
colima ssh -- sudo fstrim -a
```

`make clean` supprime deploy/ et images/ après confirmation ; il ne touche jamais à local/.

## Vérifier

```sh
make lint
make verifier-image                                            # la plus récente de deploy/
make verifier-image IMAGE=deploy/image_AAAA-MM-JJ-hakos-prod.img.xz
```

`make lint` (scripts/verifier-qualite.sh) passe shellcheck sur tous les scripts, `docker compose config -q` sur chaque fichier compose (avec un .env provisoire et de faux secrets) et cherche les secrets dans les fichiers suivis ou à suivre : fichiers .env, clés privées, mots de passe en clair.

`make verifier-image` (scripts/verifier-image.sh) contrôle une image sans la démarrer. Dans la VM Colima, l'image est décompressée dans un dossier temporaire, attachée en lecture seule et ses partitions sont montées en lecture seule. Le script vérifie notamment le nom d'hôte, /opt/box (scripts, versions.env, une archive par image figée), les services activés, Docker, SSH selon le profil, les mises à jour automatiques, config.txt et cmdline.txt, l'absence de .env, de clé privée et de toute trace de local/. Il affiche une ligne « OK » ou « ÉCHEC » par contrôle, puis un bilan, et défait tout à la fin, même en cas d'échec. Il a fallu une minute pour l'image du Lot 0 (2,9 Gio décompressée) ; une image HakOS est plus grosse.

## Graver un SSD

```sh
diskutil list external physical    # avant, puis après avoir branché le SSD
scripts/flasher-ssd.sh --simulation deploy/image_AAAA-MM-JJ-hakos-prod.img.xz diskN
scripts/flasher-ssd.sh deploy/image_AAAA-MM-JJ-hakos-prod.img.xz diskN
```

Le script efface tout le disque diskN. Il vérifie l'empreinte de l'image et le disque (externe, physique, sans partition Apple, distinct du disque du Mac), demande de retaper diskN, écrit l'image, la relit en entier et éjecte le SSD. Raspberry Pi Imager 2.x convient aussi, en « Utiliser image personnalisée », sans aucune personnalisation. Ne jamais fabriquer une box en clonant un SSD déjà démarré : graver toujours le .img.xz.

## Tester sur la box

Pi 5 éteint : SSD en place, aucune microSD, câble Ethernet vers le réseau du Mac, alimentation officielle 27 W. Au premier démarrage, la box agrandit sa partition, puis le service hakos-premier-demarrage tire les secrets, charge les images Docker, démarre l'accueil, Immich et Nextcloud, attend qu'ils soient en bonne santé, écrit la fiche d'installation et enfin /opt/box/.initialized. Dans la VM Colima, il a pris un peu plus d'une minute (docs/lots-1-a-4.md, « Essai dans la VM Colima ») ; sur le Pi, sa durée reste à mesurer. Il abandonne si les services ne sont pas prêts au bout de 15 min. Ne pas couper le courant pendant ce temps.

Avec l'image dev :

```sh
ssh-keygen -R hako.local
ssh -i ~/.ssh/mabox-dev -o IdentitiesOnly=yes hako@hako.local
sudo journalctl -b -u hakos-premier-demarrage -o cat -n all -f   # suivi, Ctrl-C pour quitter
sudo /opt/box/test-sur-boitier.sh                                # une ligne OK ou ÉCHEC par contrôle
sudo cat /root/fiche-installation.txt                            # fiche d'installation, sans secret
```

sudo demande le mot de passe console, celui de local/mot-de-passe-dev. Le test finit par « Bilan : … aucun échec. » et rend le code 0 ; au moindre échec, il rend le code 1.

Avec l'image prod, personne ne peut se connecter : le test se fait depuis le Mac, par le réseau.

```sh
curl -s http://hako.local/ | grep -c 'Mes photos'                    # 1
curl -s http://hako.local:2283/api/server/ping; echo                 # {"res":"pong"}
curl -sL -o /dev/null -w '%{http_code}\n' http://hako.local:8080/    # 200
nc -z -G 5 hako.local 22; echo "code=$?"                             # code=1 : port 22 fermé
```

La procédure complète, commande par commande avec les sorties attendues, est dans docs/lots-1-a-4.md.

Assistant de première installation, sur une box neuve de test seulement (il crée des comptes d'essai ; regraver ensuite) :

```sh
sudo /opt/box/test-sur-boitier.sh --assistant 8 --coupure   # 8 personnes, création coupée puis reprise
```

Sans box, dans la VM Colima (premier démarrage réel par systemd, images déjà dans Docker) :

```sh
colima ssh -- sudo ~/Code/mabox-os/scripts/essai-vm.sh installer
colima ssh -- sudo env HAKOS_ESSAI=1 HAKOS_MEMOIRE_KIO=4000000 /opt/box/test-sur-boitier.sh --assistant 1
colima ssh -- sudo ~/Code/mabox-os/scripts/essai-vm.sh defaire
```

Dans un vrai navigateur (Chromium de Playwright, pris dans ~/Code/hako-site), après « installer » : `node scripts/essai-page.mjs`.

## Rejoindre un Wi-Fi sur place

L'Ethernet reste la connexion conseillée. L'image ne connaît aucun réseau Wi-Fi ; la radio est réglée pour la France (WPA_COUNTRY=FR).

Avec l'image dev, en SSH, pendant que la box est encore branchée en Ethernet :

```sh
LC_ALL=C nmcli radio wifi                        # enabled ; sinon : sudo nmcli radio wifi on
sudo nmcli --ask device wifi connect "Nom du réseau"
hostname -I                                      # une adresse de plus : celle du Wi-Fi
```

nmcli demande le mot de passe du Wi-Fi sans l'afficher. Débrancher ensuite l'Ethernet : hako.local répond par le Wi-Fi.

Avec l'image prod, sans SSH, le Wi-Fi se donne avant le premier démarrage, dans le fichier network-config de la partition bootfs : cloud-init le lit à ce premier démarrage seulement. Après la gravure, rebrancher le SSD au Mac ; le volume « bootfs » apparaît. Ouvrir /Volumes/bootfs/network-config dans un éditeur de texte brut, garder les lignes de commentaire et ajouter à la fin, en indentant avec des espaces, jamais des tabulations :

```yaml
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: true
      optional: true
  wifis:
    wlan0:
      dhcp4: true
      optional: true
      regulatory-domain: FR
      access-points:
        "Nom du réseau":
          password: "<mot de passe du Wi-Fi>"
```

C'est le format netplan v2 de l'exemple commenté que Raspberry Pi met dans ce même fichier. Ne toucher à aucun autre fichier de bootfs, puis éjecter le SSD. Ce chemin n'est pas encore vérifié sur une box : l'essayer d'abord avec une image dev. Le mot de passe du Wi-Fi reste lisible en clair sur bootfs.

## Limites connues

- Première installation : la première personne qui ouvre http://hako.local commence l'installation (décision du 13/11 : ni code ni carte). Un autre appareil voit « installation en cours » ; il prend la main avec le mot de passe de la personne responsable, ou recommence 2 minutes après la fermeture de la page qui avait la main.
- Liste de mots des mots de passe : la relecture par deux personnes reste à faire (docs/liste-de-mots.md).
- Adresses en http, sans chiffrement : à la maison, mots de passe, photos et fichiers circulent en clair sur le réseau local.
- Pas de sauvegarde : une panne du SSD perd photos et fichiers. La fiche d'installation garde la place de la future clé de récupération.
- Mises à jour automatiques limitées aux correctifs de sécurité de Debian (unattended-upgrades). Les paquets Raspberry Pi (noyau, firmware) et ceux de Docker ne changent qu'avec une nouvelle image HakOS.
- Pas de mise à jour des images Docker : Immich, Nextcloud, Postgres, Valkey et nginx restent aux versions de versions.env. Une box prod n'a aujourd'hui aucun moyen de recevoir une nouvelle version, et regraver le SSD efface les données.
- Sous 7 Gio de mémoire (Pi 5 de 4 Go), l'apprentissage automatique d'Immich est coupé par un fichier de configuration (IMMICH_CONFIG_FILE) : d'après la documentation d'Immich, les réglages ne sont alors plus modifiables dans l'interface web.
- Nextcloud n'accepte que hako.local (et localhost) : ouvert par l'adresse IP de la box, il refuse la page (« domaine non approuvé »).
- Deux box sur le même réseau : la seconde répond à hako-2.local (avahi), alors que sa fiche d'installation indique hako.local.
- En prod, la fiche /root/fiche-installation.txt n'est lisible par personne : la box n'a ni SSH ni compte ouvert.
- cloud-init est gardé : qui a le SSD en main peut, par les fichiers de bootfs, faire lancer des commandes en root au démarrage. Il pourrait aussi lire les données, le disque n'étant pas chiffré.

## Organisation

```text
Makefile             make images, build-dev, build-prod, lint, verifier-image, clean
versions.env         toutes les versions figées : pi-gen, Immich, Nextcloud, Postgres, Valkey, nginx
config/              configuration pi-gen : commun.conf, dev.conf, prod.conf (stock.conf : Lot 0)
stage-box/           étape pi-gen maison : système, Docker, applications, premier démarrage, nettoyage
rootfs/opt/box/      contenu de /opt/box : fichiers compose, modèles d'environnement (env.modele),
                     page d'accueil et page de la HAKO (home/assistant), configuration nginx
                     (home/nginx), firstboot.sh et sa bibliothèque, assistant/ (API locale en
                     Python, liste de mots), parefeu/ (nftables), unités systemd
scripts/             construction, images Docker, qualité, vérification de l'image, test sur la box,
                     gravure ; scripts du Lot 0
tests/assistant/     tests unitaires de l'assistant (make lint)
docs/                notes de lot
images/              archives des images Docker (ignorées par git)
local/               clés publiques et mot de passe de test (ignorés par git)
pi-gen/, deploy/     copie de pi-gen et images produites (ignorées par git)
```

Sur la box : /opt/box/{home,immich,nextcloud,images,lib,assistant,parefeu}/, /opt/box/firstboot.sh, /opt/box/versions.env, /opt/box/profil, /opt/box/test-sur-boitier.sh, /opt/box/essai-assistant.py, les unités hakos-parefeu et hakos-premier-demarrage (/etc/systemd/system) et hakos-assistant (/usr/lib/systemd/system), l'utilisateur hakos-assistant et l'état de l'installation dans /var/lib/hakos. Les données restent dans le dossier de chaque service : immich/library et immich/postgres, nextcloud/html et nextcloud/db.

## Documentation

- docs/lot5-assistant.md : assistant de première installation (lot 5) : conception, réalisation, essais.
- docs/liste-de-mots.md : provenance et filtrage de la liste de mots des mots de passe.
- docs/lots-1-a-4.md : décisions des lots 1 à 4 et procédure de test sur le Pi 5.
- docs/lot0-faisabilite.md : construction sur Mac, pièges, gravure, conditions côté Pi (Lot 0).
- CHANGELOG.md : historique par lot.
