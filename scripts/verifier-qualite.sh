#!/usr/bin/env bash
# Contrôles qualité du dépôt HakOS (make lint). Ne construit rien et ne lance aucune pile.
#   1. shellcheck (image Docker koalaman/shellcheck:v0.11.0) sur tous les scripts shell, hors pi-gen/ :
#      fichiers .sh, fichiers à shebang sh ou bash, fichiers marqués « # shellcheck shell= » ;
#   2. « docker compose config -q » sur chaque fichier compose, avec un .env provisoire écrit dans un
#      dossier temporaire, comme au premier démarrage : lignes CLÉ=valeur de versions.env, puis
#      env.modele du service avec un faux secret différent à la place de chaque __SECRET__, puis la
#      ligne de l'apprentissage automatique (les deux cas quand le fichier utilise des profils).
#      Une variable non définie compte comme une erreur ;
#   3. recherche de secrets dans les fichiers suivis par git ou à suivre (non ignorés) : fichiers .env,
#      clés privées, mots de passe en clair (CLÉ=valeur ou clé YAML dont le nom contient PASSWORD,
#      PASS, SECRET ou TOKEN, avec une valeur littérale).
# Une ligne « OK … » ou « ÉCHEC … » par contrôle, puis un bilan. Code de sortie 1 si un contrôle échoue.
# Compatible avec le bash 3.2 de macOS.
set -euo pipefail

RACINE="$(cd -- "$(dirname -- "$0")/.." && pwd)"
SHELLCHECK_IMAGE=koalaman/shellcheck:v0.11.0
# Lignes que le premier démarrage ajoute au .env d'Immich selon la mémoire de la box.
LIGNE_SANS_ML="IMMICH_CONFIG_FILE=/usr/src/app/hakos/immich-sans-ml.json"
LIGNE_ML="COMPOSE_PROFILES=ml"
# Variables de docker compose qui fausseraient l'essai si elles venaient de l'environnement.
unset COMPOSE_PROFILES COMPOSE_FILE COMPOSE_PROJECT_NAME COMPOSE_ENV_FILES

echecs=0
ok() { printf 'OK      %s\n' "$1"; }
echec() {
	printf 'ÉCHEC   %s\n' "$1"
	echecs=$((echecs + 1))
}

command -v git >/dev/null 2>&1 || { echo "Erreur : git introuvable." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Erreur : docker introuvable." >&2; exit 1; }
TEMP="$(mktemp -d "${TMPDIR:-/tmp}/hakos-qualite.XXXXXX")"
trap 'rm -rf "$TEMP"' EXIT

# Fichiers suivis par git ou à suivre, hors pi-gen/.
fichiers=()
while IFS= read -r -d '' f; do
	case "$f" in pi-gen/*) continue ;; esac
	[ -f "$RACINE/$f" ] || continue
	fichiers+=("$f")
done < <(git -C "$RACINE" ls-files -z --cached --others --exclude-standard)
[ ${#fichiers[@]} -gt 0 ] || { echo "Erreur : aucun fichier trouvé par git ls-files dans $RACINE." >&2; exit 1; }

# 1. shellcheck
scripts=()
for f in "${fichiers[@]}"; do
	case "$f" in
		*.sh)
			scripts+=("$f")
			continue
			;;
	esac
	debut="$(head -n 5 "$RACINE/$f" 2>/dev/null || true)"
	if grep -Eq '^#!.*[/ ](ba|da)?sh( |$)' <<<"${debut%%$'\n'*}" ||
		grep -q '^# shellcheck shell=' <<<"$debut"; then
		scripts+=("$f")
	fi
done
if [ ${#scripts[@]} -eq 0 ]; then
	echec "shellcheck : aucun script shell trouvé"
else
	# Dépôt monté en lecture seule, local/ (secrets) masqué par un dossier vide, sans réseau.
	# Format gcc (fichier:ligne:colonne) : le format par défaut recopie la ligne en cause, et
	# l'outil plante alors dans son image Docker sur un accent (« commitBuffer: invalid argument »).
	montages=(--volume "$RACINE:$RACINE:ro")
	if [ -d "$RACINE/local" ]; then
		montages+=(--tmpfs "$RACINE/local")
	fi
	if sortie="$(docker run --rm --network none "${montages[@]}" --workdir "$RACINE" \
		"$SHELLCHECK_IMAGE" -f gcc -x --source-path=SCRIPTDIR -- "${scripts[@]}" 2>&1)"; then
		ok "shellcheck : ${#scripts[@]} scripts sans remarque"
	else
		printf '%s\n' "$sortie"
		if grep -q 'openBinaryFile: does not exist' <<<"$sortie"; then
			echo "Le moteur Docker ne voit pas les fichiers du dépôt : avec Colima, placer le dépôt dans un dossier partagé avec la VM, par exemple ~/Code."
		fi
		echec "shellcheck : remarques ci-dessus (${#scripts[@]} scripts vérifiés)"
	fi
fi

# 2. docker compose config
composes=()
for f in "${fichiers[@]}"; do
	case "${f##*/}" in
		docker-compose.yml | docker-compose.yaml | compose.yml | compose.yaml) composes+=("$f") ;;
	esac
done
if [ ${#composes[@]} -eq 0 ]; then
	echec "compose : aucun fichier docker-compose.yml dans le dépôt"
fi
numero=0
for f in ${composes[@]+"${composes[@]}"}; do
	numero=$((numero + 1))
	dossier="$(dirname "$RACINE/$f")"
	essai="$TEMP/compose-$numero"
	mkdir -p "$essai"
	cp "$RACINE/$f" "$essai/"
	{
		grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$RACINE/versions.env" || true
		if [ -f "$dossier/env.modele" ]; then
			awk '{ while (sub(/__SECRET__/, "fauxsecret" (++n) "x")) {} print }' "$dossier/env.modele"
		fi
	} >"$essai/env.commun"
	if grep -q '^[[:space:]]*profiles:' "$RACINE/$f"; then
		variantes="sans-ml ml"
	else
		variantes="seule"
	fi
	for variante in $variantes; do
		cp "$essai/env.commun" "$essai/.env"
		case "$variante" in
			sans-ml) echo "$LIGNE_SANS_ML" >>"$essai/.env" ;;
			ml) echo "$LIGNE_ML" >>"$essai/.env" ;;
		esac
		libelle="compose $f"
		[ "$variante" = seule ] || libelle="$libelle ($variante)"
		if sortie="$(docker compose --project-directory "$essai" -f "$essai/${f##*/}" config -q 2>&1)" &&
			! grep -q 'is not set' <<<"$sortie"; then
			ok "$libelle"
		else
			printf '%s\n' "$sortie"
			echec "$libelle : erreur ci-dessus"
		fi
	done
done

# 3. Secrets
envs=()
for f in "${fichiers[@]}"; do
	case "$f" in
		versions.env) ;;
		.env | */.env | *.env) envs+=("$f") ;;
	esac
done
if [ ${#envs[@]} -eq 0 ]; then
	ok "secrets : aucun fichier .env suivi ou à suivre"
else
	echec "secrets : fichier(s) .env à retirer du dépôt : ${envs[*]}"
fi

# Le motif est écrit « PRIVATE[ ]KEY » pour ne pas se reconnaître lui-même.
cles="$(cd "$RACINE" && grep -l -I -E 'PRIVATE[ ]KEY' -- "${fichiers[@]}" || true)"
if [ -z "$cles" ]; then
	ok "secrets : aucune clé privée"
else
	echec "secrets : clé privée dans : $(printf '%s' "$cles" | tr '\n' ' ')"
fi

# Valeur littérale : commence par une lettre ou un chiffre (ni $, ni %, ni __SECRET__), 4 caractères au moins.
q="'"
valeur="[\"$q]?[A-Za-z0-9][A-Za-z0-9._~+/=!@#,;-]{3,}"
motif_env="(^|[^A-Za-z0-9_])[A-Za-z0-9_]*(PASSWORD|PASSWD|PASS|SECRET|TOKEN)[A-Za-z0-9_]*=$valeur"
motif_yaml="^[[:space:]]*(-[[:space:]]+)?[A-Za-z0-9_]*(PASSWORD|PASSWD|SECRET|TOKEN|[Pp]assword|[Pp]asswd)[A-Za-z0-9_]*:[[:space:]]+$valeur"
lignes="$(cd "$RACINE" && grep -H -n -I -E -e "$motif_env" -e "$motif_yaml" -- "${fichiers[@]}" | cut -d: -f1,2 || true)"
if [ -z "$lignes" ]; then
	ok "secrets : aucun mot de passe en clair"
else
	echec "secrets : mot de passe en clair possible (contenu non affiché) : $(printf '%s' "$lignes" | tr '\n' ' ')"
fi

if [ "$echecs" -eq 0 ]; then
	echo "Bilan : tous les contrôles sont passés."
else
	echo "Bilan : $echecs contrôle(s) en échec."
	exit 1
fi
