#!/usr/bin/env bash
# Récupère pi-gen dans ./pi-gen à la révision figée dans versions.env.
# Peut être relancé sans risque : il ne fait que vérifier si tout est déjà en place.
set -euo pipefail

RACINE="$(cd -- "$(dirname -- "$0")/.." && pwd)"
# shellcheck source=../versions.env
. "$RACINE/versions.env"
: "${PIGEN_DEPOT:?absent de versions.env}" "${PIGEN_BRANCHE:?absent de versions.env}" "${PIGEN_COMMIT:?absent de versions.env}"

DEST="$RACINE/pi-gen"

if [ ! -d "$DEST/.git" ]; then
	echo "Téléchargement de pi-gen ($PIGEN_BRANCHE)..."
	git clone --quiet --branch "$PIGEN_BRANCHE" --single-branch "$PIGEN_DEPOT" "$DEST"
fi

if ! git -C "$DEST" cat-file -e "${PIGEN_COMMIT}^{commit}" 2>/dev/null; then
	git -C "$DEST" fetch --quiet origin "$PIGEN_BRANCHE"
fi

# On ne touche jamais à une copie de pi-gen modifiée à la main.
if [ -n "$(git -C "$DEST" status --porcelain --untracked-files=no)" ]; then
	echo "Erreur : $DEST contient des fichiers suivis modifiés. Rien n'a été changé." >&2
	exit 1
fi

git -C "$DEST" -c advice.detachedHead=false checkout --quiet "$PIGEN_COMMIT"

if [ "$(git -C "$DEST" rev-parse HEAD)" != "$PIGEN_COMMIT" ]; then
	echo "Erreur : pi-gen n'est pas à la révision attendue $PIGEN_COMMIT." >&2
	exit 1
fi
echo "pi-gen prêt à la révision $PIGEN_COMMIT (branche $PIGEN_BRANCHE)."
