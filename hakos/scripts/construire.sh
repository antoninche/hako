#!/usr/bin/env bash
# Construit l'image HakOS d'un profil avec le build Docker officiel de pi-gen.
# Usage : scripts/construire.sh dev|prod   (ou make build-dev, make build-prod)
#
# Méthode du Lot 0 (scripts/construire-stock.sh) : la config complète est écrite dans
# local/pigen.conf (mode 600), montée en lecture seule dans le conteneur au même chemin, puis
# effacée à la fin, même en cas d'échec. Aucun secret n'entre dans l'image Docker pi-gen.
#
# Profils :
#   dev   clés publiques de local/cles-ssh-dev.pub (une par ligne, obligatoire) et mot de passe
#         console de local/mot-de-passe-dev (tiré au hasard s'il manque) ; jamais affichés.
#   prod  mot de passe tiré au hasard, écrit seulement dans la config provisoire ; aucune clé SSH ;
#         stage-box/00-systeme verrouille ensuite le compte et masque SSH.
#
# Montés en lecture seule, au même chemin, dans le conteneur : stage-box/, rootfs/, images/,
# scripts/ et versions.env. L'image arrive dans deploy/ avec SHA256SUMS et un journal.
# Compatible avec le bash 3.2 de macOS.
set -euo pipefail

usage() {
	echo "Usage : $0 dev|prod" >&2
	exit 2
}
[ $# -eq 1 ] || usage
PROFIL="$1"
case "$PROFIL" in
	dev | prod) ;;
	*) usage ;;
esac

RACINE="$(cd -- "$(dirname -- "$0")/.." && pwd)"
LOCAL="$RACINE/local"
CONFIG="$LOCAL/pigen.conf"
CLES="$LOCAL/cles-ssh-dev.pub"
MDP_DEV="$LOCAL/mot-de-passe-dev"
SKIP_STAGE2="$RACINE/pi-gen/stage2/SKIP_IMAGES"
CONTENEUR=pigen_work

erreur() {
	echo "Erreur : $*" >&2
	exit 1
}

# Le chemin du dépôt passe sans guillemets dans PIGEN_DOCKER_OPTS (build-docker.sh) et dans
# STAGE_LIST (build.sh) : ni espace, ni caractère spécial. Le sed de macOS réécrirait aussi un
# « -c » placé dans le chemin de la config (voir docs/lot0-faisabilite.md).
if LC_ALL=C grep -q '[^A-Za-z0-9._/-]' <<<"$RACINE"; then
	erreur "le chemin du dépôt ($RACINE) contient une espace ou un caractère spécial. Le déplacer, par exemple dans ~/Code."
fi
case "$CONFIG" in
	*-c*) erreur "le chemin $CONFIG contient « -c », que build-docker.sh réécrirait sous macOS. Placer le dépôt ailleurs." ;;
esac

mkdir -p "$RACINE/deploy"
JOURNAL="$RACINE/deploy/hakos-$PROFIL-construction-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$JOURNAL") 2>&1
echo "Journal : $JOURNAL"
echo "Construction de HakOS, profil $PROFIL."

"$RACINE/scripts/verifier-hote.sh"
"$RACINE/scripts/recuperer-pigen.sh"

for fichier in config/commun.conf "config/$PROFIL.conf" versions.env stage-box/EXPORT_IMAGE; do
	[ -f "$RACINE/$fichier" ] || erreur "$fichier manquant."
done
for dossier in stage-box rootfs scripts; do
	[ -d "$RACINE/$dossier" ] || erreur "dossier $dossier/ manquant."
done
# pi-gen saute sans erreur un prerun.sh ou un NN-run.sh non exécutable.
shopt -s nullglob
for script in "$RACINE"/stage-box/prerun.sh "$RACINE"/stage-box/*/[0-9][0-9]-run.sh; do
	[ -x "$script" ] || erreur "${script#"$RACINE"/} manque ou n'est pas exécutable (chmod +x)."
done
shopt -u nullglob

# Archives des images Docker figées dans versions.env : une par image, reconnue à son étiquette
# (RepoTags du manifest.json écrit par docker save), quel que soit le nom du fichier.
# shellcheck source=../versions.env
. "$RACINE/versions.env"
images_figees() {
	printf '%s\n' \
		"ghcr.io/immich-app/immich-server:${IMMICH_VERSION:?absent de versions.env}" \
		"ghcr.io/immich-app/immich-machine-learning:${IMMICH_VERSION}" \
		"${IMMICH_VALKEY_IMAGE:?absent de versions.env}" \
		"${IMMICH_POSTGRES_IMAGE:?absent de versions.env}" \
		"${NEXTCLOUD_IMAGE:?absent de versions.env}" \
		"${NEXTCLOUD_POSTGRES_IMAGE:?absent de versions.env}" \
		"${NGINX_IMAGE:?absent de versions.env}"
}
# docker save écrit les étiquettes sous leur forme courte : « nginx:1.31.8-alpine » pour
# « docker.io/library/nginx:1.31.8-alpine », « valkey/valkey:9 » pour « docker.io/valkey/valkey:9 ».
forme_courte() {
	local ref="${1#docker.io/}"
	printf '%s\n' "${ref#library/}"
}
etiquettes_archive() {
	tar -xOf "$1" manifest.json 2>/dev/null | grep -o '"RepoTags":\[[^]]*\]' |
		grep -o '"[^"]*"' | tr -d '"' | grep -vx 'RepoTags' || true
}
[ -d "$RACINE/images" ] || erreur "le dossier images/ n'existe pas : lancez make images."
attendues="$(images_figees | while IFS= read -r ref; do forme_courte "$ref"; done)"
shopt -s nullglob
archives=("$RACINE"/images/*.tar)
shopt -u nullglob
[ ${#archives[@]} -gt 0 ] || erreur "images/ ne contient aucune archive .tar : lancez make images."
inventaire=""
for archive in "${archives[@]}"; do
	nom="${archive#"$RACINE"/}"
	etiquettes="$(etiquettes_archive "$archive")"
	[ -n "$etiquettes" ] || erreur "$nom n'est pas une archive docker save étiquetée : lancez make images."
	if ! grep -qxF -f <(printf '%s\n' "$attendues") <<<"$etiquettes"; then
		erreur "$nom ne contient aucune image figée dans versions.env (ancienne version ?) : la supprimer, puis lancez make images."
	fi
	inventaire="$inventaire$etiquettes"$'\n'
done
while IFS= read -r ref; do
	nombre="$(grep -cxF -- "$ref" <<<"$inventaire" || true)"
	case "$nombre" in
		1) ;;
		0) erreur "aucune archive de images/ ne contient $ref : lancez make images." ;;
		*) erreur "$ref se trouve dans $nombre archives de images/ : n'en garder qu'une (make images)." ;;
	esac
done <<<"$attendues"
echo "Images Docker : ${#archives[@]} archives, une par image figée dans versions.env."

# Secrets du compte hako, jamais affichés.
umask 077
mkdir -p "$LOCAL"
cles=""
if [ "$PROFIL" = dev ]; then
	[ -s "$CLES" ] || erreur "$CLES manquant (une clé publique SSH par ligne)."
	if grep -v -E '^((ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(256|384|521)|sk-ssh-ed25519@openssh\.com|sk-ecdsa-sha2-nistp256@openssh\.com) [A-Za-z0-9+/]+=*( [^'"'"']*)?|#[^'"'"']*)?$' "$CLES" | grep -q .; then
		erreur "$CLES contient une ligne qui n'est pas une clé publique valide (ou une apostrophe)."
	fi
	if [ ! -s "$MDP_DEV" ]; then
		openssl rand -hex 16 >"$MDP_DEV"
		echo "Mot de passe console du compte de test créé dans $MDP_DEV"
	fi
	mot_de_passe="$(cat "$MDP_DEV")"
	cles="$(cat "$CLES")"
else
	mot_de_passe="$(openssl rand -hex 24)"
fi
# pi-gen recopie le mot de passe dans un document « heredoc » non protégé : rien d'autre que
# lettres, chiffres, point, tiret ou souligné, sur une seule ligne.
case "$mot_de_passe" in
	"" | *[!A-Za-z0-9._-]*) erreur "le mot de passe du compte doit être une seule ligne de lettres, chiffres, points, tirets ou soulignés." ;;
esac

# build-docker.sh copie tout le dossier pi-gen dans l'image Docker « pi-gen » : la config, qui
# contient le mot de passe et les clés, ne doit jamais s'y trouver.
if [ -e "$RACINE/pi-gen/config" ]; then
	erreur "pi-gen/config existe et serait copié dans l'image Docker pi-gen. Le supprimer puis relancer."
fi
if grep -qx "$CONTENEUR" <<<"$(docker ps -a --format '{{.Names}}')"; then
	erreur "le conteneur $CONTENEUR existe déjà. Le supprimer : docker rm -v $CONTENEUR"
fi

nettoyer() {
	rm -f "$CONFIG" "$SKIP_STAGE2"
}
trap nettoyer EXIT
trap 'exit 1' HUP INT TERM
{
	echo "# Généré par scripts/construire.sh ($PROFIL) : ne pas modifier, ne pas versionner, effacé en fin de construction."
	cat "$RACINE/config/commun.conf" "$RACINE/config/$PROFIL.conf"
	printf "FIRST_USER_PASS='%s'\n" "$mot_de_passe"
	if [ -n "$cles" ]; then
		printf "PUBKEY_SSH_FIRST_USER='%s'\n" "$cles"
	fi
	printf 'STAGE_LIST="stage0 stage1 stage2 %s/stage-box"\n' "$RACINE"
	printf "export HAKOS_RACINE='%s'\n" "$RACINE"
	printf "export HAKOS_PROFIL='%s'\n" "$PROFIL"
} >"$CONFIG"
chmod 600 "$CONFIG"
unset cles

# Seule l'étape maison exporte une image ; SKIP_IMAGES est retiré à la fin (nettoyer), pour que
# scripts/construire-stock.sh exporte toujours l'image Lite de référence.
: >"$SKIP_STAGE2"

volumes="--volume $CONFIG:$CONFIG:ro"
for chemin in stage-box rootfs images scripts versions.env; do
	volumes="$volumes --volume $RACINE/$chemin:$RACINE/$chemin:ro"
done

cd "$RACINE/pi-gen"
debut=$(date +%s)
if ! PIGEN_DOCKER_OPTS="$volumes" ./build-docker.sh -c "$CONFIG"; then
	echo "Erreur : la construction a échoué. Le conteneur $CONTENEUR est gardé pour le diagnostic (docker logs $CONTENEUR)." >&2
	echo "Le supprimer avant de relancer : docker rm -v $CONTENEUR, puis rendre la place au Mac : colima ssh -- sudo fstrim -a" >&2
	exit 1
fi
duree=$(($(date +%s) - debut))
if ! docker run --rm pi-gen sh -c 'test ! -e /pi-gen/config'; then
	erreur "l'image Docker pi-gen contient un fichier config. La supprimer : docker image rm pi-gen"
fi

shopt -s nullglob
produits=(deploy/*)
images=(deploy/image_*-hakos-"$PROFIL".img.xz)
shopt -u nullglob
[ ${#produits[@]} -gt 0 ] || erreur "pi-gen n'a rien produit dans pi-gen/deploy/."
[ ${#images[@]} -eq 1 ] || erreur "pi-gen/deploy/ devrait contenir une image image_<date>-hakos-$PROFIL.img.xz (trouvé : ${#images[@]})."
image="${images[0]##*/}"
for produit in "${produits[@]}"; do
	case "${produit##*/}" in
		build.log | build-docker.log) mv "$produit" "$RACINE/deploy/hakos-$PROFIL-${produit##*/}" ;;
		*) mv "$produit" "$RACINE/deploy/" ;;
	esac
done

cd "$RACINE/deploy"
shopt -s nullglob
toutes=(*.img.xz)
textes=(*.log *.info *.json *.txt)
shopt -u nullglob
shasum -a 256 "${toutes[@]}" >SHA256SUMS
# Le mot de passe du compte ne doit apparaître dans aucun journal ni fichier texte produit.
if [ ${#textes[@]} -gt 0 ] && grep -qF -f <(printf '%s\n' "$mot_de_passe") "${textes[@]}"; then
	erreur "le mot de passe du compte apparaît dans un fichier texte de deploy/ : ne pas diffuser ce dossier, trouver la fuite."
fi
unset mot_de_passe
echo "Construction terminée en $((duree / 60)) min $((duree % 60)) s."
ls -lh "$image" SHA256SUMS
if [ "$PROFIL" = dev ]; then
	echo "Image de l'équipe, avec SSH : ne jamais l'installer chez un client."
fi

nettoyer

# Le disque de la VM Colima grossit pendant la construction et ne rend pas seul
# la place libérée au Mac : fstrim la rend.
if command -v colima >/dev/null 2>&1 && colima status >/dev/null 2>&1; then
	if colima ssh -- sudo -n fstrim -a >/dev/null; then
		echo "Place rendue au Mac (fstrim dans la VM Colima)."
	else
		echo "Attention : fstrim a échoué dans la VM Colima. Le lancer à la main : colima ssh -- sudo fstrim -a" >&2
	fi
fi
