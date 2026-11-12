#!/bin/sh
# Reconstruit les polices du site : npm run fonts:build
#
# Options (transmises à build.py) :
#   --offline  utilise seulement le cache .cache/fonts/ (pas de réseau)
#   --check    reconstruit en mémoire et compare aux fichiers du dépôt
#
# Outils : uv (https://docs.astral.sh/uv/) installe à la volée Python 3.12 et
# les versions exactes de fontTools et brotli, sans toucher au reste du système.
set -eu

cd "$(dirname "$0")/../.."

if ! command -v uv >/dev/null 2>&1; then
  echo "fonts:build : l'outil uv est introuvable. Installez-le (https://docs.astral.sh/uv/) puis relancez." >&2
  exit 1
fi

uv run --no-project --quiet --python 3.12 \
  --with fonttools==4.68.0 --with brotli==1.2.1 \
  python -I scripts/fonts/build.py "$@"

# Les deux fichiers générés doivent déjà respecter la mise en forme du projet.
generated="src/styles/fonts.css src/components/FontPreloads.astro"
if [ -f .prettierrc.json ]; then
  # shellcheck disable=SC2086
  npx --no -- prettier --check $generated >/dev/null 2>&1 || prettier_ok=no
else
  # shellcheck disable=SC2086
  npx --no -- prettier --check --single-quote --print-width 100 \
    --plugin prettier-plugin-astro $generated >/dev/null 2>&1 || prettier_ok=no
fi
if [ "${prettier_ok:-yes}" = no ]; then
  echo "fonts:build : attention, Prettier reformaterait les fichiers générés ($generated)." >&2
  echo "Adapter le gabarit dans scripts/fonts/build.py." >&2
fi
