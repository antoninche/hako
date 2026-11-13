# shellcheck shell=bash
# shellcheck disable=SC2034  # les variables HAKOS_* servent aux scripts qui chargent ce fichier
#
# HakoS : réglages et fonctions communes aux scripts de la box (premier démarrage, contrôles).
# À charger avec « . /opt/box/lib/commun.sh » : ce fichier ne lance rien par lui-même.
#
# Variables d'essai, toutes facultatives :
#   HAKOS_BOITE        dossier de la box (défaut /opt/box)
#   HAKOS_ESSAI=1      essai hors box : ni machine-id, ni clés SSH, rien dans /etc ;
#                      la fiche d'installation va dans $HAKOS_BOITE au lieu de /root
#   HAKOS_MEMOIRE_KIO  mémoire à prendre en compte, en kio, à la place de MemTotal
#   HAKOS_DELAI_SANTE  délai d'attente des services, en secondes (défaut 900)

HAKOS_BOITE=${HAKOS_BOITE:-/opt/box}
HAKOS_ESSAI=${HAKOS_ESSAI:-0}
HAKOS_DELAI_SANTE=${HAKOS_DELAI_SANTE:-900}
HAKOS_MEMOIRE_KIO=${HAKOS_MEMOIRE_KIO:-}

# Dossiers des projets docker compose, dans l'ordre de démarrage.
HAKOS_SERVICES=(home immich nextcloud)

# Apprentissage automatique d'Immich : actif à partir de 7 Gio de MemTotal (7 × 1024 × 1024 kio).
HAKOS_SEUIL_ML_KIO=7340032
HAKOS_LIGNE_ML="COMPOSE_PROFILES=ml"
HAKOS_LIGNE_SANS_ML="IMMICH_CONFIG_FILE=/usr/src/app/hakos/immich-sans-ml.json"

journal() {
	printf '%s\n' "$*"
}

echec() {
	printf 'Erreur : %s\n' "$*" >&2
	exit 1
}

# libelle SERVICE : nom affiché d'un dossier de service.
libelle() {
	case $1 in
		home) printf 'accueil\n' ;;
		immich) printf 'Immich\n' ;;
		nextcloud) printf 'Nextcloud\n' ;;
		*) printf '%s\n' "$1" ;;
	esac
}

# lire_valeur FICHIER CLÉ : valeur de la dernière ligne « CLÉ=valeur » du fichier, sans les
# guillemets qui l'entourent. Code 1 si la clé est absente.
lire_valeur() {
	local ligne valeur
	ligne=$(grep -E "^$2=" "$1") || return 1
	ligne=${ligne##*$'\n'}
	valeur=${ligne#*=}
	case $valeur in
		\"*\" | \'*\') valeur=${valeur:1:${#valeur}-2} ;;
	esac
	printf '%s\n' "$valeur"
}

# memoire_kio : mémoire totale en kio, HAKOS_MEMOIRE_KIO pour un essai, sinon MemTotal.
memoire_kio() {
	local kio=$HAKOS_MEMOIRE_KIO
	if [ -z "$kio" ]; then
		kio=$(awk '$1 == "MemTotal:" { print $2; exit }' /proc/meminfo 2>/dev/null) || kio=""
	fi
	if [[ ! $kio =~ ^[0-9]+$ ]]; then
		printf 'Erreur : mémoire illisible (MemTotal dans /proc/meminfo, ou HAKOS_MEMOIRE_KIO).\n' >&2
		return 1
	fi
	printf '%s\n' "$kio"
}

# ml_possible KIO : vrai si cette mémoire permet l'apprentissage automatique d'Immich.
ml_possible() {
	[ "$1" -ge "$HAKOS_SEUIL_ML_KIO" ]
}

# en_gio KIO : la mémoire en Gio, à un chiffre après la virgule (« 3,9 Gio »).
en_gio() {
	local dixiemes=$((($1 * 10 + 524288) / 1048576))
	printf '%d,%d Gio\n' $((dixiemes / 10)) $((dixiemes % 10))
}

# etat_conteneur ID : « nom|état|santé » ; la santé est vide si le conteneur n'a pas de healthcheck.
etat_conteneur() {
	local etat
	etat=$(docker inspect --format '{{.Name}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$1" </dev/null) || return 1
	printf '%s\n' "${etat#/}"
}

# conteneur_pret ÉTAT : vrai si le conteneur (état donné par etat_conteneur) est « healthy »,
# ou « running » quand il n'a pas de healthcheck.
conteneur_pret() {
	local etat sante
	IFS="|" read -r _ etat sante <<<"$1"
	if [ -n "$sante" ]; then
		[ "$sante" = healthy ]
	else
		[ "$etat" = running ]
	fi
}
