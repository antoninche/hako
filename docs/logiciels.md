# Logiciels de la box : licences et sources

La page « La box » du site (`/la-box/`) cite chaque logiciel installé dans la box avec sa licence et l’adresse de son site officiel. Ce fichier garde la trace des vérifications : où chaque information a été lue, et quand. Toutes les vérifications ci-dessous datent du 12 novembre 2026.

Les textes affichés sur le site sont dans `src/content/la-box.ts`. Si un logiciel change de licence ou d’adresse, corrigez les deux fichiers ensemble.

## Licences vérifiées

| Logiciel                    | Rôle dans la box                                | Licence                                                                                                    | Site officiel                            | Où la licence a été lue                                                             |
| --------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| Immich                      | photos et vidéos                                | GNU AGPL v3                                                                                                | https://immich.app/                      | https://github.com/immich-app/immich/blob/main/LICENSE                              |
| Nextcloud Server            | fichiers                                        | GNU AGPL v3 ou toute version ultérieure                                                                    | https://nextcloud.com/fr/                | https://github.com/nextcloud/server (README, COPYING, en-têtes SPDX)                |
| Nextcloud Agenda (Calendar) | agenda partagé (Hako Pro)                       | GNU AGPL v3                                                                                                | https://apps.nextcloud.com/apps/calendar | https://github.com/nextcloud/calendar/blob/main/COPYING                             |
| Nextcloud Contacts          | contacts partagés (Hako Pro)                    | GNU AGPL v3 ou toute version ultérieure                                                                    | https://apps.nextcloud.com/apps/contacts | https://github.com/nextcloud/contacts (appinfo/info.xml, COPYING)                   |
| Docker Engine (projet Moby) | fait tourner chaque logiciel dans son conteneur | Apache 2.0                                                                                                 | https://docs.docker.com/engine/          | https://github.com/moby/moby/blob/master/LICENSE et https://docs.docker.com/engine/ |
| Raspberry Pi OS Lite        | système de base                                 | pas de licence unique : logiciels libres de Debian et de Raspberry Pi, plus quelques micrologiciels fermés | https://www.raspberrypi.com/software/    | notes de version et recette de construction (voir plus bas)                         |
| Debian 13 « trixie »        | socle de Raspberry Pi OS                        | logiciels libres selon les principes du logiciel libre selon Debian                                        | https://www.debian.org/                  | https://www.debian.org/social_contract.fr.html                                      |
| PeerTube (page Tutoriels)   | plateforme vidéo libre                          | GNU AGPL v3                                                                                                | https://joinpeertube.org/fr              | https://github.com/Chocobozzz/PeerTube/blob/develop/LICENSE                         |

## Détail des preuves

Immich : le fichier `LICENSE` de la branche `main` contient le texte « GNU AFFERO GENERAL PUBLIC LICENSE, Version 3, 19 November 2007 », que l’API GitHub identifie comme `AGPL-3.0`. Le fichier `server/package.json` déclare `"license": "GNU Affero General Public License version 3"` et le README affiche le badge « License: AGPLv3 ». Dernière version publiée le jour de la vérification : v3.4.1, le 11 novembre 2026. Le site officiel indiqué par le dépôt est https://immich.app (réponse 200).

Nextcloud Server : le fichier `COPYING` de la branche `master` contient la GNU AGPL v3. Le README précise : « All contributions to this repository from June 16, 2016, and onward are considered to be licensed under the AGPLv3 or any later version. » Les fichiers portent l’en-tête `SPDX-License-Identifier: AGPL-3.0-or-later` (par exemple `lib/base.php`). Le dossier `LICENSES/` réunit aussi les licences des éléments tiers inclus dans le dépôt. Le site https://nextcloud.com/fr/ répond 200.

Applications Agenda et Contacts de Nextcloud (fonctions de Hako Pro) : `nextcloud/calendar` contient la GNU AGPL v3 dans `COPYING` et déclare `<licence>agpl</licence>` dans `appinfo/info.xml` ; `nextcloud/contacts` déclare `<licence>AGPL-3.0-or-later</licence>`.

Docker Engine : le moteur Docker est développé dans le dépôt `moby/moby`, dont le fichier `LICENSE` est la licence Apache 2.0 (identifiée `Apache-2.0` par GitHub) ; l’outil en ligne de commande `docker/cli` est aussi sous Apache 2.0. La documentation officielle (https://docs.docker.com/engine/, section « Licensing ») indique « Apache License, Version 2.0 » et précise qu’un abonnement payant ne concerne que Docker Engine obtenu avec Docker Desktop dans les grandes entreprises. La box n’utilise pas Docker Desktop.

Raspberry Pi OS Lite : les notes de version officielles (https://downloads.raspberrypi.com/raspios_lite_arm64/release_notes.txt) indiquent pour la version du 1er octobre 2025 « Based on Debian Trixie release » ; la dernière image publiée au moment de la vérification date du 6 octobre 2026 et reste sur cette base. La documentation officielle, dont le texte source est public (https://github.com/raspberrypi/documentation, fichier `documentation/asciidoc/computers/os/rpi-os-introduction.adoc`), confirme : « The latest version of Raspberry Pi OS is based on Debian Trixie ». Le site raspberrypi.com refuse les requêtes automatiques (réponse 403 et page de vérification anti-robots, y compris pour un navigateur sans interface) : les adresses https://www.raspberrypi.com/software/ et https://www.raspberrypi.com/documentation/computers/os.html ont été relevées dans cette documentation officielle.

Debian 13 « trixie » : la page https://www.debian.org/releases/trixie/ indique que la version 13.0 a été publiée le 9 août 2025, avec un suivi complet jusqu’au 9 août 2028 puis un suivi à long terme jusqu’au 30 juin 2030. Le contrat social de Debian (https://www.debian.org/social_contract.fr.html) dit : « Debian demeurera totalement libre » ; les paquets non libres sont rangés à part et « ne font pas partie du système Debian ».

PeerTube : le fichier `LICENSE` de la branche `develop` est la GNU AGPL v3. Le site officiel le présente comme « un outil de partage de vidéos en ligne conçu par Framasoft, une association française à but non lucratif ».

## Ce qui n’est pas libre

Le programme de démarrage de la Raspberry Pi 5 est enregistré dans une petite puce mémoire de la carte (l’EEPROM). Il est publié dans https://github.com/raspberrypi/rpi-eeprom sous forme de fichiers binaires seulement. Le fichier `LICENSE` de ce dépôt place le dossier `firmware-2712/*` (les images de la Raspberry Pi 5) sous une licence « custom » : « All rights reserved. Redistribution and use in binary form, without modification, are permitted… This software may only be used for the purposes of developing for, running or using a Raspberry Pi device. » Le code source de ce programme n’est pas publié. Seuls les scripts d’outillage du dépôt sont sous licence BSD.

Raspberry Pi OS Lite contient aussi des micrologiciels fermés. La recette officielle de construction de l’image 64 bits (https://github.com/RPi-Distro/pi-gen, branche `arm64`, dernier commit consulté du 6 novembre 2026) active les sections Debian `non-free` et `non-free-firmware` (`stage0/00-configure-apt/files/debian.sources`) et installe, dans l’étape qui produit l’image Lite (`stage2/02-net-tweaks/00-packages`), le paquet `firmware-brcm80211`. Ce paquet est rangé dans `trixie/non-free-firmware` (archive Debian, fichier `dists/trixie/non-free-firmware/binary-arm64/Packages.xz`, version 20250410-2) et se décrit comme « Binary firmware for Broadcom/Cypress 802.11 wireless cards » : c’est le micrologiciel de la puce Wi-Fi.

La carte Raspberry Pi 5 n’est pas du matériel libre. Sa documentation officielle (fichier `documentation/asciidoc/computers/sbcs/sbc-models.adoc` du dépôt de documentation) ne publie pour elle qu’un plan mécanique, c’est-à-dire ses dimensions (https://pip.raspberrypi.com/documents/RP-008347-DS), alors qu’elle donne des schémas électriques pour la Raspberry Pi 4B. La même page indique que sa puce principale est une Broadcom BCM2712. L’adresse supposée d’un schéma de la Raspberry Pi 5 (https://datasheets.raspberrypi.com/rpi5/raspberry-pi-5-reduced-schematics.pdf) répond 404.

## Ce qui reste à préciser

Le logiciel qui affiche la page d’accueil de la box (http://hako.local) et sa licence ne sont pas encore fixés. La recette qui fabrique le système de la box est notre propre travail, mais son dépôt n’est pas encore publié. Ces deux informations manquantes sont signalées en jaune sur la page « La box » (et, pour la page d’accueil, sur la page « Notre engagement ») et recensées dans TODO.md. Tant qu’elles manquent, le site ne dit pas que tous les logiciels de la box sont libres : il nomme ceux qui le sont (Immich, Nextcloud, Docker et Raspberry Pi OS).

## Refaire les vérifications

Les commandes suivantes, avec l’outil `gh` connecté à GitHub, redonnent les licences déclarées des dépôts :

```sh
for depot in immich-app/immich nextcloud/server nextcloud/calendar nextcloud/contacts \
  moby/moby docker/cli raspberrypi/rpi-eeprom RPi-Distro/pi-gen Chocobozzz/PeerTube; do
  gh api "repos/$depot/license" --jq '"\(.path) \(.license.spdx_id)"' | sed "s|^|$depot |"
done
gh api repos/raspberrypi/rpi-eeprom/contents/LICENSE --jq .content | base64 -d
curl -s https://downloads.raspberrypi.com/raspios_lite_arm64/release_notes.txt | head -40
```

L’API GitHub renvoie `NOASSERTION` pour `raspberrypi/rpi-eeprom` : c’est normal, son fichier `LICENSE` mélange une licence BSD pour les scripts et la licence propre à Raspberry Pi pour les binaires.
