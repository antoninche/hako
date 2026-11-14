#!/bin/bash
# Étape maison HakOS, lancée par build.sh de pi-gen dans le conteneur, juste après stage2.
# Elle repart du système de stage2 (Raspberry Pi OS Lite), comme les étapes officielles.
set -euo pipefail

case "${HAKOS_PROFIL:-}" in
	dev | prod) ;;
	*)
		echo "Erreur : HAKOS_PROFIL vaut « ${HAKOS_PROFIL:-} » au lieu de dev ou prod. Construire avec scripts/construire.sh." >&2
		exit 1
		;;
esac
if [ ! -d "${HAKOS_RACINE:-}" ]; then
	echo "Erreur : le dépôt HakOS (HAKOS_RACINE « ${HAKOS_RACINE:-} ») n'est pas visible dans le conteneur. Construire avec scripts/construire.sh." >&2
	exit 1
fi
echo "HakOS : profil ${HAKOS_PROFIL}, dépôt ${HAKOS_RACINE}."

if [ ! -d "${ROOTFS_DIR}" ]; then
	copy_previous
fi
