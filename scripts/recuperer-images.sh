#!/usr/bin/env bash
# Prépare les archives des images Docker livrées dans HakoS, dans le dossier images/.
#
# Pour chaque image de versions.env, sur le Mac (moteur Docker de Colima) :
#   - la récupère pour linux/arm64 si elle manque, par son empreinte quand versions.env en donne une ;
#   - vérifie que son étiquette désigne bien cette empreinte, sinon la pose avec docker tag ;
#   - vérifie que l'image est bien pour linux/arm64 ;
#   - l'enregistre par son étiquette avec docker save dans images/<nom>.tar.
# Les fichiers compose de la box n'utilisent que les étiquettes : docker load ne garde pas les
# empreintes du registre. Une archive à jour n'est pas refaite : images/<nom>.tar.ref note
# l'étiquette, l'empreinte figée et l'identifiant de l'image enregistrée.
#
# Usage :
#   scripts/recuperer-images.sh             prépare les archives (demande le moteur Docker)
#   scripts/recuperer-images.sh --verifier  vérifie seulement, sans Docker, que chaque archive
#                                           existe et correspond à versions.env (lancé par
#                                           l'étape stage-box/02-applications de pi-gen)
set -euo pipefail

RACINE="$(cd -- "$(dirname -- "$0")/.." && pwd)"
DOSSIER="$RACINE/images"
PLATEFORME=linux/arm64

MODE=preparer
case "${1:-}" in
	"") ;;
	--verifier) MODE=verifier ;;
	*)
		echo "Usage : $0 [--verifier]" >&2
		exit 2
		;;
esac

# shellcheck source=../versions.env
. "$RACINE/versions.env"
for cle in IMMICH_VERSION IMMICH_VALKEY_IMAGE IMMICH_VALKEY_DIGEST IMMICH_POSTGRES_IMAGE \
	IMMICH_POSTGRES_DIGEST NEXTCLOUD_IMAGE NEXTCLOUD_POSTGRES_IMAGE NGINX_IMAGE; do
	if [ -z "${!cle:-}" ]; then
		echo "Erreur : $cle absent de versions.env." >&2
		exit 1
	fi
done

# Une ligne par archive : nom lisible, image (avec son étiquette), empreinte figée ou « - ».
ARCHIVES="
immich-server ghcr.io/immich-app/immich-server:$IMMICH_VERSION -
immich-machine-learning ghcr.io/immich-app/immich-machine-learning:$IMMICH_VERSION -
immich-valkey $IMMICH_VALKEY_IMAGE $IMMICH_VALKEY_DIGEST
immich-postgres $IMMICH_POSTGRES_IMAGE $IMMICH_POSTGRES_DIGEST
nextcloud $NEXTCLOUD_IMAGE -
nextcloud-postgres $NEXTCLOUD_POSTGRES_IMAGE -
nginx $NGINX_IMAGE -
"

# Contrôle la forme d'une image et de son empreinte avant tout usage.
verifier_forme() {
	local image="$1" empreinte="$2" etiquette="${1##*:}"
	if [ "$etiquette" = "$image" ] || [ -z "$etiquette" ] || [[ "$etiquette" == */* ]]; then
		echo "Erreur : $image n'a pas d'étiquette (attendu dépôt:étiquette)." >&2
		exit 1
	fi
	case "$etiquette" in
		latest | release)
			echo "Erreur : $image utilise l'étiquette « $etiquette », interdite : figer une version." >&2
			exit 1
			;;
	esac
	if [ "$empreinte" != "-" ] && [[ ! "$empreinte" =~ ^sha256:[0-9a-f]{64}$ ]]; then
		echo "Erreur : empreinte invalide pour $image : $empreinte" >&2
		exit 1
	fi
}

# Taille lisible d'un nombre d'octets.
taille() {
	awk -v o="$1" 'BEGIN { if (o >= 1073741824) printf "%.2f Gio", o / 1073741824; else printf "%.0f Mio", o / 1048576 }'
}

# --- Mode --verifier : sans Docker, avant la copie dans l'image système ---
if [ "$MODE" = verifier ]; then
	erreurs=0
	attendues=" "
	while read -r nom image empreinte <&3; do
		[ -n "$nom" ] || continue
		verifier_forme "$image" "$empreinte"
		attendues="$attendues$nom.tar "
		archive="$DOSSIER/$nom.tar"
		if [ ! -s "$archive" ]; then
			echo "Erreur : archive manquante : images/$nom.tar ($image)." >&2
			erreurs=$((erreurs + 1))
			continue
		fi
		# La note doit commencer par « image empreinte » : l'archive suit alors versions.env.
		note=""
		[ -f "$archive.ref" ] && note="$(cat "$archive.ref")"
		case "$note" in
			"$image $empreinte "*) ;;
			*)
				echo "Erreur : images/$nom.tar ne correspond pas à versions.env (attendu : $image $empreinte)." >&2
				erreurs=$((erreurs + 1))
				;;
		esac
	done 3<<<"$ARCHIVES"
	shopt -s nullglob
	for archive in "$DOSSIER"/*.tar; do
		case "$attendues" in
			*" ${archive##*/} "*) ;;
			*)
				echo "Erreur : archive inattendue : images/${archive##*/}. La retirer du dossier images/." >&2
				erreurs=$((erreurs + 1))
				;;
		esac
	done
	if [ "$erreurs" -gt 0 ]; then
		echo "Préparer les archives sur le Mac, moteur Docker démarré : scripts/recuperer-images.sh" >&2
		exit 1
	fi
	echo "Archives des images conformes à versions.env."
	exit 0
fi

# --- Mode normal : préparation des archives avec le moteur Docker ---
if ! api="$(docker version --format '{{.Server.APIVersion}}' 2>/dev/null)" || [ -z "$api" ]; then
	echo "Erreur : le moteur Docker ne répond pas. Sur Mac, démarrer Colima (voir README.md)." >&2
	exit 1
fi
# docker save --platform demande l'API 1.48 (Docker 28), docker image inspect --platform l'API 1.49.
api_majeure="${api%%.*}"
api_mineure="${api#*.}"
api_mineure="${api_mineure%%.*}"
save_plateforme=0
inspect_plateforme=0
if [ "$api_majeure" -gt 1 ] || [ "$api_mineure" -ge 48 ]; then
	save_plateforme=1
fi
if [ "$api_majeure" -gt 1 ] || [ "$api_mineure" -ge 49 ]; then
	inspect_plateforme=1
fi
if [ "$save_plateforme" -eq 0 ]; then
	echo "Attention : moteur Docker à l'API $api, docker save enregistrera l'image sans filtre de plateforme."
fi

# Identifiant ou plateforme d'une image locale (vide si l'image manque).
inspecter() {
	local format="$1" reference="$2"
	if [ "$inspect_plateforme" -eq 1 ]; then
		docker image inspect --platform "$PLATEFORME" --format "$format" "$reference" 2>/dev/null || true
	else
		docker image inspect --format "$format" "$reference" 2>/dev/null || true
	fi
}

mkdir -p "$DOSSIER"
nettoyer() { rm -f "$DOSSIER"/*.tar.partiel; }
trap nettoyer EXIT

total=0
while read -r nom image empreinte <&3; do
	[ -n "$nom" ] || continue
	verifier_forme "$image" "$empreinte"
	archive="$DOSSIER/$nom.tar"

	# 1. Image présente localement pour linux/arm64, sinon récupérée.
	if [ "$empreinte" = "-" ]; then
		source="$image"
	else
		source="${image%:*}@$empreinte"
	fi
	if [ "$(inspecter '{{.Os}}/{{.Architecture}}' "$source")" != "$PLATEFORME" ]; then
		echo "Téléchargement de $source ($PLATEFORME)..."
		docker pull --quiet --platform "$PLATEFORME" "$source" >/dev/null
	fi

	# 2. L'étiquette doit désigner l'empreinte figée.
	if [ "$empreinte" != "-" ]; then
		id_fige="$(inspecter '{{.Id}}' "$source")"
		if [ -z "$id_fige" ]; then
			echo "Erreur : $source introuvable après le téléchargement." >&2
			exit 1
		fi
		if [ "$(inspecter '{{.Id}}' "$image")" != "$id_fige" ]; then
			echo "Étiquette $image posée sur $empreinte."
			docker tag "$source" "$image"
			if [ "$(inspecter '{{.Id}}' "$image")" != "$id_fige" ]; then
				echo "Erreur : l'étiquette $image ne désigne toujours pas $empreinte." >&2
				exit 1
			fi
		fi
	fi

	# 3. Architecture.
	plateforme="$(inspecter '{{.Os}}/{{.Architecture}}' "$image")"
	if [ "$plateforme" != "$PLATEFORME" ]; then
		echo "Erreur : $image est pour « $plateforme », attendu $PLATEFORME." >&2
		exit 1
	fi

	# 4. Archive, refaite seulement si l'image enregistrée a changé.
	id="$(inspecter '{{.Id}}' "$image")"
	note="$image $empreinte $id"
	if [ -s "$archive" ] && [ -f "$archive.ref" ] && [ "$(cat "$archive.ref")" = "$note" ]; then
		etat="à jour"
	else
		echo "Enregistrement de $image dans images/$nom.tar..."
		rm -f "$archive.ref" "$archive.partiel"
		if [ "$save_plateforme" -eq 1 ]; then
			docker save --platform "$PLATEFORME" -o "$archive.partiel" "$image"
		else
			docker save -o "$archive.partiel" "$image"
		fi
		mv -f "$archive.partiel" "$archive"
		printf '%s\n' "$note" >"$archive.ref"
		etat="enregistrée"
	fi
	octets="$(wc -c <"$archive" | tr -d '[:space:]')"
	total=$((total + octets))
	printf '  %-30s %10s  %s\n' "$nom.tar" "$(taille "$octets")" "$etat"
done 3<<<"$ARCHIVES"

printf '  %-30s %10s\n' "Total" "$(taille "$total")"
echo "Archives prêtes dans $DOSSIER"
