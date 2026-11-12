# MaBox OS

Ce dépôt construit le système de la box MaBox : une image Debian 13 (Raspberry Pi OS Lite) pour Raspberry Pi 5, qui démarre sur SSD. L'image est produite par pi-gen, l'outil officiel de Raspberry Pi, à la révision figée dans versions.env. Au Lot 0, il n'y a pas encore d'étape maison : l'image sert à valider la chaîne de construction et le démarrage sur SSD.

L'image de ce lot est une image de test, avec le compte et la clé SSH de l'équipe : elle ne doit jamais être installée chez un client.

## Prérequis

- Un Mac Apple Silicon ou une machine Linux arm64 : la construction est native, sans émulation.
- Sur Mac, Colima ; sous Linux, un moteur Docker. Docker Desktop n'a pas été testé.
- 20 Gio libres sur le disque, et 15 Gio dans la VM Colima.
- git, docker, xz et curl.
- Un clone du dépôt dans un chemin sans espace, hors OneDrive ou iCloud.

Sur Mac, la configuration testée :

```sh
brew install colima docker xz
colima start --vm-type vz --arch aarch64 --cpu 4 --memory 6 --disk 30 --mount-type virtiofs
```

## Construire l'image

```sh
scripts/verifier-hote.sh
```

Ce script vérifie en lecture seule la machine, les outils, le moteur Docker, la place disque et l'accès réseau. Il sort avec le code 1 si un point bloque.

La construction demande le fichier local/cles-ssh-dev.pub : une clé publique SSH par ligne, une par membre de l'équipe. Le dossier local/ n'est jamais versionné.

```sh
ssh-keygen -t ed25519 -f ~/.ssh/mabox-dev          # si la clé n'existe pas encore
mkdir -p -m 700 local
cat ~/.ssh/mabox-dev.pub >> local/cles-ssh-dev.pub
scripts/construire-stock.sh
```

construire-stock.sh relance verifier-hote.sh, récupère pi-gen à la révision figée et crée au besoin local/mot-de-passe-dev, le mot de passe console du compte de test, tiré au hasard. Il écrit la config complète dans local/pigen.conf, la monte en lecture seule dans le conteneur et lance le build Docker officiel de pi-gen : aucun secret n'entre dans l'image Docker pi-gen. L'image arrive dans deploy/ avec SHA256SUMS et un journal. À la fin, même en cas d'échec, le script efface local/pigen.conf ; après une construction réussie, il rend la place au Mac (fstrim dans la VM Colima). Durée mesurée sur un Mac Apple Silicon : 5 à 6 min.

## Graver un SSD

```sh
diskutil list external physical    # avant, puis après avoir branché le SSD
scripts/flasher-ssd.sh --simulation deploy/image_2026-11-12-mabox-stock-lite.img.xz diskN
scripts/flasher-ssd.sh deploy/image_2026-11-12-mabox-stock-lite.img.xz diskN
```

Le script efface tout le disque diskN. Il vérifie l'empreinte de l'image et le disque (externe, physique, sans partition Apple, distinct du disque du Mac), demande de retaper diskN, écrit l'image, la relit en entier et éjecte le SSD. Raspberry Pi Imager 2.x convient aussi, en « Utiliser image personnalisée », sans aucune personnalisation.

## Organisation

```text
config/stock.conf   configuration pi-gen du Lot 0, sans secret
scripts/            vérification de la machine, récupération de pi-gen, construction, gravure
versions.env        révision figée de pi-gen
docs/               notes de lot
local/              clés publiques et mot de passe de test (ignorés par git)
pi-gen/, deploy/    copie de pi-gen et images produites (ignorées par git)
```

## Documentation

- docs/lot0-faisabilite.md : résultats du Lot 0, pièges, procédure de test sur le Pi, décisions pour le Lot 1.
- CHANGELOG.md : historique par lot.
