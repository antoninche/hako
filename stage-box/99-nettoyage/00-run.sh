#!/bin/bash
# HakoS, étape 99-nettoyage : vide les caches apt juste avant l'export (environ 280 Mio au Lot 0).
# La taille de la partition rootfs est calculée sur ce système : l'image est d'autant plus petite.
# À savoir : l'export de pi-gen (export-image/02-set-sources) relance ensuite apt-get update dans
# l'image ; les listes de paquets y reviennent donc, comme sur toute box qui se met à jour.
set -euo pipefail

find "${ROOTFS_DIR}/var/lib/apt/lists" -type f -delete
rm -f "${ROOTFS_DIR}"/var/cache/apt/*.bin
