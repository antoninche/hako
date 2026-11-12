#!/usr/bin/env bash
# Lot 0 : construit l'image Lite de référence avec le build Docker officiel de pi-gen.
# Sur Mac, le moteur Docker est celui de Colima (machine virtuelle Linux ARM 64 bits).
#
# Fichiers locaux (dossier local/, jamais versionné) :
#   local/cles-ssh-dev.pub   clés publiques autorisées, une par ligne (obligatoire)
#   local/mot-de-passe-dev   mot de passe console du compte de test (créé s'il manque)
#   local/pigen.conf         config complète pour pi-gen, créée puis effacée à chaque construction
set -euo pipefail

RACINE="$(cd -- "$(dirname -- "$0")/.." && pwd)"
LOCAL="$RACINE/local"
CLES="$LOCAL/cles-ssh-dev.pub"
MDP="$LOCAL/mot-de-passe-dev"
CONTENEUR=pigen_work

mkdir -p "$RACINE/deploy"
JOURNAL="$RACINE/deploy/lot0-construction-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$JOURNAL") 2>&1
echo "Journal : $JOURNAL"

"$RACINE/scripts/verifier-hote.sh"
"$RACINE/scripts/recuperer-pigen.sh"

umask 077
mkdir -p "$LOCAL"
if [ ! -s "$CLES" ]; then
	echo "Erreur : $CLES manquant (une clé publique SSH par ligne)." >&2
	exit 1
fi
if grep -v -E '^((ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(256|384|521)|sk-ssh-ed25519@openssh\.com|sk-ecdsa-sha2-nistp256@openssh\.com) [A-Za-z0-9+/]+=*( [^'"'"']*)?|#[^'"'"']*)?$' "$CLES" | grep -q .; then
	echo "Erreur : $CLES contient une ligne qui n'est pas une clé publique valide (ou une apostrophe)." >&2
	exit 1
fi
if [ ! -s "$MDP" ]; then
	openssl rand -hex 16 >"$MDP"
	echo "Mot de passe console du compte de test créé dans $MDP"
fi

# build-docker.sh copie tout le dossier pi-gen dans l'image Docker « pi-gen » : la config, qui
# contient le mot de passe et les clés, ne doit donc jamais s'y trouver. Elle reste dans local/ et
# elle est montée en lecture seule dans le conteneur, au même chemin. Ce chemin marche dans les
# deux cas : le sed de macOS ne réécrit pas « -c chemin » en « -c /config », celui de Linux le fait,
# et build-docker.sh monte aussi le fichier sur /config.
case "$RACINE" in
	*[[:space:]]*)
		echo "Erreur : le chemin du dépôt contient une espace ($RACINE). Le déplacer, par exemple dans ~/Code." >&2
		exit 1
		;;
esac
if [ -e "$RACINE/pi-gen/config" ]; then
	echo "Erreur : pi-gen/config existe et serait copié dans l'image Docker pi-gen. Le supprimer puis relancer." >&2
	exit 1
fi
CONFIG="$LOCAL/pigen.conf"
# Le sed de macOS ne reconnaît pas \s : il réécrit le premier « -c » suivi d'au moins un caractère
# qu'il trouve, y compris au milieu d'un nom (« pigen-config » devenait « pigen-c /config »).
case "$CONFIG" in
	*-c*)
		echo "Erreur : le chemin $CONFIG contient « -c », que build-docker.sh réécrirait sous macOS. Placer le dépôt ailleurs." >&2
		exit 1
		;;
esac
nettoyer() { rm -f "$CONFIG"; }
trap nettoyer EXIT
{
	echo "# Généré par scripts/construire-stock.sh : ne pas modifier, ne pas versionner."
	cat "$RACINE/config/stock.conf"
	printf "FIRST_USER_PASS='%s'\n" "$(cat "$MDP")"
	printf "PUBKEY_SSH_FIRST_USER='%s'\n" "$(cat "$CLES")"
} >"$CONFIG"
chmod 600 "$CONFIG"

if docker ps -a --format '{{.Names}}' | grep -qx "$CONTENEUR"; then
	echo "Erreur : le conteneur $CONTENEUR existe déjà. Le supprimer : docker rm -v $CONTENEUR" >&2
	exit 1
fi

cd "$RACINE/pi-gen"
debut=$(date +%s)
if ! PIGEN_DOCKER_OPTS="--volume $CONFIG:$CONFIG:ro" ./build-docker.sh -c "$CONFIG"; then
	echo "Erreur : la construction a échoué. Le conteneur $CONTENEUR est gardé pour le diagnostic (docker logs $CONTENEUR)." >&2
	echo "Le supprimer avant de relancer : docker rm -v $CONTENEUR" >&2
	exit 1
fi
duree=$(($(date +%s) - debut))
if ! docker run --rm pi-gen sh -c 'test ! -e /pi-gen/config'; then
	echo "Erreur : l'image Docker pi-gen contient un fichier config. La supprimer : docker image rm pi-gen" >&2
	exit 1
fi

shopt -s nullglob
produits=(deploy/*)
if [ ${#produits[@]} -eq 0 ]; then
	echo "Erreur : pi-gen n'a rien produit dans deploy/." >&2
	exit 1
fi
mv "${produits[@]}" "$RACINE/deploy/"
cd "$RACINE/deploy"
images=(*.img.xz)
if [ ${#images[@]} -eq 0 ]; then
	echo "Erreur : aucune image .img.xz produite." >&2
	exit 1
fi
shasum -a 256 "${images[@]}" >SHA256SUMS
echo "Construction terminée en $((duree / 60)) min $((duree % 60)) s."
ls -lh "${images[@]}" SHA256SUMS

nettoyer

# Le disque de la VM Colima grossit pendant la construction et ne rend pas seul
# la place libérée au Mac : fstrim la rend (environ 9 Gio par construction).
if command -v colima >/dev/null 2>&1 && colima status >/dev/null 2>&1; then
	colima ssh -- sudo -n fstrim -a >/dev/null && echo "Place rendue au Mac (fstrim dans la VM Colima)."
fi
