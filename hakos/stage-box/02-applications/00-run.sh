#!/usr/bin/env bash
# Étape 02-applications : dépose les applications de la box dans /opt/box.
#   rootfs/opt/box/             → /opt/box/ (dossiers 0755, fichiers 0644, scripts 0755)
#   versions.env                → /opt/box/versions.env
#   scripts/test-sur-boitier.sh → /opt/box/test-sur-boitier.sh (0755)
#   scripts/essai-assistant.py  → /opt/box/essai-assistant.py (0755), pour test-sur-boitier.sh --assistant
#   images/*.tar                → /opt/box/images/, chargées puis effacées au premier démarrage
# Le dépôt est monté en lecture seule depuis le Mac et virtiofs garde l'UID 501 : chaque fichier
# est donc recopié avec « install -o root -g root ».
set -euo pipefail

: "${ROOTFS_DIR:?variable de pi-gen absente}"
: "${HAKOS_RACINE:?variable absente de la config pi-gen (écrite par scripts/construire.sh)}"

SOURCE="$HAKOS_RACINE/rootfs/opt/box"
BOITE="$ROOTFS_DIR/opt/box"
TEST="$HAKOS_RACINE/scripts/test-sur-boitier.sh"
ESSAI_ASSISTANT="$HAKOS_RACINE/scripts/essai-assistant.py"

for chemin in "$SOURCE" "$HAKOS_RACINE/versions.env" "$TEST" "$ESSAI_ASSISTANT" "$HAKOS_RACINE/images"; do
	if [ ! -e "$chemin" ]; then
		echo "Erreur : $chemin introuvable dans le conteneur pi-gen (fichier absent ou montage manquant)." >&2
		exit 1
	fi
done

# Les sept archives doivent exister et correspondre à versions.env, sans archive en trop.
bash "$HAKOS_RACINE/scripts/recuperer-images.sh" --verifier

# Rien d'autre que des dossiers et des fichiers ordinaires, et aucun .env : un fichier .env
# laissé par un essai contiendrait des mots de passe.
intrus="$(find "$SOURCE" \( -name .env -o \( ! -type d ! -type f \) \) -print)"
if [ -n "$intrus" ]; then
	echo "Erreur : rootfs/opt/box contient un fichier .env ou un fichier spécial :" >&2
	echo "$intrus" >&2
	exit 1
fi

install -d -o root -g root -m 0755 "$BOITE" "$BOITE/images"
find "$SOURCE" -mindepth 1 -type d ! -name __pycache__ -print0 | while IFS= read -r -d '' dossier; do
	install -d -o root -g root -m 0755 "$BOITE/${dossier#"$SOURCE"/}"
done
# Les fichiers de macOS (.DS_Store, ._*) et les caches de Python restent sur le Mac.
find "$SOURCE" -type f ! -name .DS_Store ! -name '._*' ! -name '*.pyc' ! -path '*/__pycache__/*' -print0 | while IFS= read -r -d '' fichier; do
	relatif="${fichier#"$SOURCE"/}"
	if [[ "$relatif" == *.sh ]] || [ -x "$fichier" ]; then
		mode=0755
	else
		mode=0644
	fi
	install -o root -g root -m "$mode" "$fichier" "$BOITE/$relatif"
done

install -o root -g root -m 0644 "$HAKOS_RACINE/versions.env" "$BOITE/versions.env"
install -o root -g root -m 0755 "$TEST" "$BOITE/test-sur-boitier.sh"
install -o root -g root -m 0755 "$ESSAI_ASSISTANT" "$BOITE/essai-assistant.py"

for archive in "$HAKOS_RACINE"/images/*.tar; do
	install -o root -g root -m 0644 "$archive" "$BOITE/images/"
done

echo "Applications déposées dans /opt/box :"
find "$BOITE" -mindepth 1 -maxdepth 2 ! -path "$BOITE/images/*" -printf '  /opt/box/%P\n' | sort
echo "Archives des images : $(du -sh "$BOITE/images" | cut -f 1) dans /opt/box/images"
