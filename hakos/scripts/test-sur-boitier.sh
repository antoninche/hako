#!/usr/bin/env bash
# Test de fumée de HakOS, sur la box, après le premier démarrage. En root :
#   sudo /opt/box/test-sur-boitier.sh
# Une ligne « OK … » ou « ÉCHEC … » par contrôle, puis un bilan. Code de sortie 1 si un contrôle
# échoue. Le script ne modifie rien et n'affiche jamais la valeur d'un secret. Les contrôles de
# l'assistant de première installation suivent l'état de la box (/var/lib/hakos/installee) :
# avant, ports 2283 et 8080 fermés et page de la HAKO sur le port 80 ; après, l'accueil.
#
# Essai de bout en bout de l'assistant, sur une box NEUVE seulement (il crée des comptes d'essai ;
# regraver la box ensuite) :
#   sudo /opt/box/test-sur-boitier.sh --assistant N [--coupure]
# N = 1 ou 8 personnes ; --coupure tue le service au milieu de la création, puis la reprend.
# Détail : /opt/box/essai-assistant.py. Les contrôles habituels suivent, sur la box installée.
#
# Variables d'essai, les mêmes que pour /opt/box/firstboot.sh :
#   HAKOS_BOITE        dossier de la box (défaut : /opt/box)
#   HAKOS_ESSAI=1      essai hors de la box : saute les contrôles du système (nom d'hôte,
#                      machine-id, avahi, SSH, mises à jour, unité systemd, radios) ; la fiche est
#                      alors cherchée dans $HAKOS_BOITE/fiche-installation.txt. Comme le premier
#                      démarrage, l'essai peut tourner sans root : .env et fiche appartiennent
#                      alors à l'utilisateur qui l'a lancé.
#   HAKOS_MEMOIRE_KIO  mémoire en Kio à la place de MemTotal, comme au premier démarrage
set -euo pipefail

BOITE="${HAKOS_BOITE:-/opt/box}"
ESSAI="${HAKOS_ESSAI:-0}"
ETAT="${HAKOS_ETAT:-/var/lib/hakos}"
PERSONNES=""
COUPURE=""
while [ $# -gt 0 ]; do
	case "$1" in
		--assistant)
			PERSONNES="${2:-}"
			shift 2 || true
			;;
		--coupure)
			COUPURE=--coupure
			shift
			;;
		*)
			echo "Erreur : option inconnue « $1 ». Usage : $0 [--assistant 1|8 [--coupure]]" >&2
			exit 1
			;;
	esac
done
case "$PERSONNES" in
	"" | 1 | 8) ;;
	*)
		echo "Erreur : --assistant attend 1 ou 8 (personnes)." >&2
		exit 1
		;;
esac
SEUIL_ML_KIO=7340032 # 7 Gio : seuil du premier démarrage pour l'apprentissage automatique
CONFIG_SANS_ML=/usr/src/app/hakos/immich-sans-ml.json
SERVICES="home immich nextcloud"

# Sorties des commandes en anglais et expressions régulières sans surprise.
export LC_ALL=C
# Des variables COMPOSE_* héritées du shell fausseraient la lecture des .env par docker compose.
unset COMPOSE_PROFILES COMPOSE_FILE COMPOSE_PROJECT_NAME

if [ "$(id -u)" -eq 0 ]; then
	proprietaire="root root"
elif [ "$ESSAI" = 1 ]; then
	proprietaire="$(id -un) $(id -gn)"
else
	echo "Erreur : à lancer en root : sudo $0" >&2
	exit 1
fi
if [ ! -d "$BOITE" ]; then
	echo "Erreur : dossier $BOITE introuvable (variable HAKOS_BOITE ?)." >&2
	exit 1
fi
if [ -n "${HAKOS_MEMOIRE_KIO:-}" ]; then
	memoire_kio="$HAKOS_MEMOIRE_KIO"
else
	memoire_kio="$(awk '$1 == "MemTotal:" {print $2}' /proc/meminfo)"
fi
if [[ ! "$memoire_kio" =~ ^[0-9]+$ ]]; then
	echo "Erreur : mémoire illisible (« $memoire_kio »)." >&2
	exit 1
fi
if [ "$ESSAI" = 1 ]; then
	fiche="$BOITE/fiche-installation.txt"
else
	fiche=/root/fiche-installation.txt
fi
profil="$(cat "$BOITE/profil" 2>/dev/null || true)"

reussis=0
echecs=0
ok() {
	printf 'OK     %s\n' "$*"
	reussis=$((reussis + 1))
}
echec() {
	printf 'ÉCHEC  %s\n' "$*"
	echecs=$((echecs + 1))
}
# valeur CLÉ FICHIER : valeur de la dernière ligne CLÉ=… du fichier (vide si absente).
valeur() {
	awk -v cle="$1" 'index($0, cle "=") == 1 {v = substr($0, length(cle) + 2)} END {print v}' "$2" 2>/dev/null || true
}
# par_defaut VALEUR : vrai pour une valeur vide ou un mot de passe par défaut connu.
par_defaut() {
	case "$1" in
		"" | __SECRET__ | postgres | password | changeme | admin | root | immich | nextcloud) return 0 ;;
		*) return 1 ;;
	esac
}
projet_de() {
	case "$1" in
		home) echo hakos-accueil ;;
		*) echo "hakos-$1" ;;
	esac
}
# lire_page URL : remplit $corps et $code (code HTTP) ; échoue si rien ne répond.
lire_page() {
	local sortie
	corps=""
	code=""
	sortie="$(curl -sS -L --max-time 20 -w '\n%{http_code}' "$1" 2>/dev/null)" || return 1
	code="${sortie##*$'\n'}"
	corps="${sortie%$'\n'*}"
}

echo "Test de HakOS dans $BOITE : profil ${profil:-inconnu}, mémoire $memoire_kio Kio$([ "$ESSAI" = 1 ] && echo ', essai')."

# --- Essai de bout en bout de l'assistant (option --assistant) ---

if [ -n "$PERSONNES" ]; then
	if [ -e "$ETAT/installee" ]; then
		echec "essai de l'assistant impossible : la box est déjà installée ($ETAT/installee)"
	elif python3 "$BOITE/essai-assistant.py" --personnes "$PERSONNES" $COUPURE; then
		ok "essai de bout en bout de l'assistant : $PERSONNES personne(s)${COUPURE:+, création coupée puis reprise}"
	else
		echec "essai de bout en bout de l'assistant : détail ci-dessus"
	fi
	echo
fi

# --- Fichiers de la box ---

if [ -f "$BOITE/.initialized" ]; then
	ok "premier démarrage terminé ($BOITE/.initialized présent)"
else
	echec "premier démarrage non terminé : $BOITE/.initialized absent (journalctl -u hakos-premier-demarrage)"
fi

shopt -s nullglob
archives=("$BOITE"/images/*.tar)
shopt -u nullglob
if [ "${#archives[@]}" -eq 0 ]; then
	ok "archives d'images supprimées ($BOITE/images)"
else
	echec "${#archives[@]} archive(s) .tar encore dans $BOITE/images"
fi

for service in $SERVICES; do
	env="$BOITE/$service/.env"
	if [ ! -f "$env" ]; then
		echec "$env absent"
		continue
	fi
	droits="$(stat -c '%a %U %G' "$env")"
	if [ "$droits" = "600 $proprietaire" ]; then
		ok "$env en 0600, propriété de ${proprietaire% *}"
	else
		echec "$env : droits « $droits », attendu « 600 $proprietaire »"
	fi
done

# Secrets : chaque clé marquée __SECRET__ dans env.modele doit avoir dans .env une valeur tirée
# au premier démarrage (openssl rand -hex 24 : 48 caractères hexadécimaux), différente de toutes
# les autres. Toute clé de .env qui ressemble à un mot de passe doit être l'une d'elles.
declare -A deja_vu=()
secrets=0
erreurs_secrets=0
for service in $SERVICES; do
	modele="$BOITE/$service/env.modele"
	env="$BOITE/$service/.env"
	if [ ! -f "$modele" ] || [ ! -f "$env" ]; then
		echec "secrets de $service : env.modele ou .env absent"
		erreurs_secrets=$((erreurs_secrets + 1))
		continue
	fi
	cles="$(sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=__SECRET__[[:space:]]*$/\1/p' "$modele")"
	for cle in $cles; do
		v="$(valeur "$cle" "$env")"
		secrets=$((secrets + 1))
		if par_defaut "$v"; then
			echec "secret $service/$cle : valeur par défaut ou vide"
			erreurs_secrets=$((erreurs_secrets + 1))
		elif [[ ! "$v" =~ ^[0-9a-f]{48}$ ]]; then
			echec "secret $service/$cle : pas une valeur tirée au hasard de 48 caractères hexadécimaux"
			erreurs_secrets=$((erreurs_secrets + 1))
		elif [ -n "${deja_vu[$v]:-}" ]; then
			echec "secret $service/$cle : même valeur que ${deja_vu[$v]}"
			erreurs_secrets=$((erreurs_secrets + 1))
		else
			deja_vu[$v]="$service/$cle"
		fi
	done
	if grep -q '__SECRET__' "$env"; then
		echec "$env contient encore __SECRET__"
		erreurs_secrets=$((erreurs_secrets + 1))
	fi
	liste=" $(tr '\n' ' ' <<<"$cles") "
	for cle in $(sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' "$env" | grep -E 'PASSWORD|SECRET|TOKEN' | sort -u || true); do
		case "$liste" in
			*" $cle "*) ;;
			*)
				if par_defaut "$(valeur "$cle" "$env")"; then
					echec "$service/.env : $cle garde une valeur par défaut ou vide"
				else
					echec "$service/.env : $cle ressemble à un mot de passe mais n'est pas un secret tiré au premier démarrage"
				fi
				erreurs_secrets=$((erreurs_secrets + 1))
				;;
		esac
	done
done
if [ "$secrets" -eq 0 ]; then
	echec "aucun secret trouvé : aucune clé __SECRET__ dans les env.modele"
elif [ "$erreurs_secrets" -eq 0 ]; then
	ok "$secrets secrets tirés au premier démarrage, tous différents, aucune valeur par défaut"
fi

if [ -s "$fiche" ] && [ "$(stat -c '%a %U %G' "$fiche")" = "600 $proprietaire" ]; then
	ok "fiche d'installation $fiche présente, en 0600"
elif [ -e "$fiche" ]; then
	echec "fiche d'installation $fiche : droits « $(stat -c '%a %U %G' "$fiche") » ou fichier vide, attendu « 600 $proprietaire »"
else
	echec "fiche d'installation $fiche absente"
fi

# --- Services ---

if docker info >/dev/null 2>&1; then
	ok "moteur Docker actif"
else
	echec "moteur Docker injoignable (systemctl status docker)"
fi

# Images figées dans versions.env : toutes chargées, en arm64, y compris celle de
# l'apprentissage automatique quand elle ne sert pas.
versions="$BOITE/versions.env"
if [ -f "$versions" ]; then
	immich="$(valeur IMMICH_VERSION "$versions")"
	manquantes=""
	total=0
	for image in "ghcr.io/immich-app/immich-server:$immich" "ghcr.io/immich-app/immich-machine-learning:$immich" \
		"$(valeur IMMICH_VALKEY_IMAGE "$versions")" "$(valeur IMMICH_POSTGRES_IMAGE "$versions")" \
		"$(valeur NEXTCLOUD_IMAGE "$versions")" "$(valeur NEXTCLOUD_POSTGRES_IMAGE "$versions")" \
		"$(valeur NGINX_IMAGE "$versions")"; do
		total=$((total + 1))
		arch="$(docker image inspect --format '{{.Architecture}}' "$image" 2>/dev/null || true)"
		[ "$arch" = arm64 ] || manquantes="$manquantes ${image:-(vide)}"
	done
	if [ -z "$manquantes" ]; then
		ok "$total images figées chargées dans Docker, en arm64"
	else
		echec "images absentes ou pas en arm64 :$manquantes"
	fi
else
	echec "$versions absent"
fi

# Chaque service attendu (profils compris, lus dans le .env du projet) a un conteneur en marche,
# en bonne santé s'il a un healthcheck.
for service in $SERVICES; do
	compose="$BOITE/$service/docker-compose.yml"
	projet="$(projet_de "$service")"
	if ! attendus="$(docker compose -f "$compose" config --services 2>/dev/null)" || [ -z "$attendus" ]; then
		echec "$projet : $compose illisible par docker compose"
		continue
	fi
	for nom in $attendus; do
		ids="$(docker compose -f "$compose" ps -a -q "$nom" 2>/dev/null || true)"
		id="${ids%%$'\n'*}"
		if [ -z "$id" ]; then
			echec "$projet/$nom : aucun conteneur"
			continue
		fi
		etat="$(docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}sans-healthcheck{{end}}' "$id" 2>/dev/null || true)"
		case "$etat" in
			"running healthy") ok "$projet/$nom : en marche, en bonne santé" ;;
			"running sans-healthcheck") ok "$projet/$nom : en marche (l'image n'a pas de healthcheck)" ;;
			*) echec "$projet/$nom : état « $etat »" ;;
		esac
	done
done

# Apprentissage automatique d'Immich : choisi au premier démarrage selon la mémoire.
env_immich="$BOITE/immich/.env"
ml="$(docker ps -a -q --filter label=com.docker.compose.project=hakos-immich --filter label=com.docker.compose.service=immich-machine-learning 2>/dev/null || true)"
profils="$(valeur COMPOSE_PROFILES "$env_immich")"
config_immich="$(valeur IMMICH_CONFIG_FILE "$env_immich")"
recherche="?"
if lire_page http://localhost:2283/api/server/features && [ "$code" = 200 ]; then
	recherche="${corps#*\"smartSearch\":}"
	recherche="${recherche%%[,\}]*}"
fi
if [ "$memoire_kio" -ge "$SEUIL_ML_KIO" ]; then
	etat_ml="$(docker inspect --format '{{.State.Status}}' "${ml%%$'\n'*}" 2>/dev/null || true)"
	if [ "$profils" = ml ] && [ -z "$config_immich" ] && [ "$etat_ml" = running ] && [ "$recherche" = true ]; then
		ok "apprentissage automatique actif ($memoire_kio Kio ≥ 7 Gio) : profil ml, conteneur en marche, recherche intelligente active"
	else
		echec "apprentissage automatique attendu ($memoire_kio Kio ≥ 7 Gio) : COMPOSE_PROFILES « $profils », IMMICH_CONFIG_FILE « $config_immich », conteneur « ${etat_ml:-absent} », smartSearch « $recherche »"
	fi
else
	if [ "$profils" != ml ] && [ -z "$ml" ] && [ "$config_immich" = "$CONFIG_SANS_ML" ] &&
		[ -f "$BOITE/immich/config/immich-sans-ml.json" ] && [ "$recherche" = false ]; then
		ok "apprentissage automatique coupé ($memoire_kio Kio < 7 Gio) : pas de conteneur, IMMICH_CONFIG_FILE posé, recherche intelligente coupée"
	else
		echec "apprentissage automatique à couper ($memoire_kio Kio < 7 Gio) : COMPOSE_PROFILES « $profils », conteneur $([ -n "$ml" ] && echo présent || echo absent), IMMICH_CONFIG_FILE « $config_immich », smartSearch « $recherche »"
	fi
fi

if [ -e "$ETAT/installee" ]; then
	if lire_page http://localhost/ && [ "$code" = 200 ] && [[ "$corps" == *"Mes photos"* ]]; then
		ok "page d'accueil http://localhost/ : répond, contient « Mes photos »"
	else
		echec "page d'accueil http://localhost/ : code « ${code:-aucune réponse} », « Mes photos » introuvable"
	fi
elif lire_page http://127.0.0.1/ && [ "$code" = 200 ] && [[ "$corps" == *noindex* ]] && [[ "$corps" == *_astro/* ]]; then
	ok "page de la HAKO (première installation) sur http://127.0.0.1/ : répond"
else
	echec "page de la HAKO sur http://127.0.0.1/ : code « ${code:-aucune réponse} » ou page inattendue"
fi
if lire_page http://localhost:2283/api/server/ping && [ "$code" = 200 ] && [[ "$corps" == *pong* ]]; then
	ok "Immich http://localhost:2283/api/server/ping : pong"
else
	echec "Immich http://localhost:2283/api/server/ping : code « ${code:-aucune réponse} », pas de pong"
fi
# Nextcloud s'installe seul au premier démarrage : page de connexion. Un 400 (« domaine non
# approuvé ») prouve aussi que Nextcloud répond.
if lire_page http://localhost:8080/ && [[ "$code" =~ ^[234][0-9][0-9]$ ]] && [[ "$corps" == *Nextcloud* ]]; then
	ok "Nextcloud http://localhost:8080/ : répond (code $code), contient « Nextcloud »"
else
	echec "Nextcloud http://localhost:8080/ : code « ${code:-aucune réponse} », « Nextcloud » introuvable"
fi

# --- Assistant de première installation : pare-feu, page du port 80, API, service ---

if [ -e "$ETAT/installee" ]; then
	installee=1
	echo "Box installée ($ETAT/installee) : comptes créés par l'assistant."
else
	installee=0
	echo "Box pas encore installée : l'assistant attend la famille."
fi

if ! nft list table inet hakos >/dev/null 2>&1; then
	echec "pare-feu : table inet hakos absente (systemctl status hakos-parefeu)"
else
	fermes="$(nft list set inet hakos ports_fermes 2>/dev/null | tr -d '\n\t ' || true)"
	if [ "$installee" = 1 ] && [[ "$fermes" != *elements* ]]; then
		ok "pare-feu chargé : ports 2283 et 8080 ouverts au réseau de la maison (box installée)"
	elif [ "$installee" = 0 ] && [[ "$fermes" == *"2283,8080"* ]]; then
		ok "pare-feu chargé : ports 2283 et 8080 fermés au réseau tant que la box n'est pas installée"
	else
		echec "pare-feu : ensemble ports_fermes « $fermes » pour une box $([ "$installee" = 1 ] && echo installée || echo 'pas installée')"
	fi
	if nft list chain inet hakos entree 2>/dev/null | grep -q 'meta nfproto ipv6 drop'; then
		ok "pare-feu : rien n'entre en IPv6, TCP entrant depuis les IPv4 privées seulement"
	else
		echec "pare-feu : règle IPv6 absente de la chaîne entree"
	fi
fi
if [ "$(systemctl is-enabled hakos-parefeu.service 2>/dev/null || true)" = enabled ] &&
	[ "$(systemctl is-active hakos-parefeu.service 2>/dev/null || true)" = active ]; then
	ok "unité hakos-parefeu activée et active"
else
	echec "unité hakos-parefeu : $(systemctl is-enabled hakos-parefeu.service 2>/dev/null || true), $(systemctl is-active hakos-parefeu.service 2>/dev/null || true)"
fi

ecoutes="$(ss -Hltn 2>/dev/null | awk '{print $4}' || true)"
if grep -qx '127.0.0.1:12283' <<<"$ecoutes" && ! grep -Eq '^(0\.0\.0\.0|\[::\]|\*):12283$' <<<"$ecoutes" &&
	! grep -Eq '^(\[::\]|\*):(80|2283)$' <<<"$ecoutes"; then
	ok "Immich publié sur 127.0.0.1:12283 seulement ; 80 et 2283 servis par nginx, en IPv4"
else
	echec "écoutes inattendues : $(grep -E ':(80|2283|12283)$' <<<"$ecoutes" | tr '\n' ' ')"
fi

statut="$(curl -sS --max-time 10 -H 'Host: hako.local' http://127.0.0.1/api/installation/status 2>/dev/null || true)"
entetes="$(curl -sS --max-time 10 -o /dev/null -D - -H 'Host: hako.local' http://127.0.0.1/api/installation/status 2>/dev/null | tr -d '\r' || true)"
if [ "$installee" = 1 ]; then
	attendu_statut='{"phase":"installed","busy":false}'
	if [ "$statut" = "$attendu_statut" ]; then
		ok "API : $statut (réponse fixe de nginx)"
	else
		echec "API : « $statut », attendu $attendu_statut"
	fi
elif [[ "$statut" =~ ^\{\"phase\":\"(preparing|ready|registered|creating)\" ]]; then
	ok "API de l'assistant : phase ${BASH_REMATCH[1]}"
else
	echec "API de l'assistant : « ${statut:-aucune réponse} »"
fi
if grep -qi "^content-security-policy: default-src 'self'.*connect-src 'self'.*form-action 'none'" <<<"$entetes" &&
	grep -qi '^cache-control: no-store' <<<"$entetes" && grep -qi '^referrer-policy: no-referrer' <<<"$entetes"; then
	ok "API : en-têtes de la page de la HAKO (CSP, no-store, no-referrer)"
else
	echec "API : en-têtes de la page de la HAKO absents"
fi
etranger="$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' -H 'Host: exemple.fr' http://127.0.0.1/api/installation/status 2>/dev/null || true)"
if [ "$installee" = 1 ] || [ "$etranger" = 403 ]; then
	ok "API : refuse un autre nom que celui de la box$([ "$installee" = 1 ] && echo ' (sans objet : service arrêté)')"
else
	echec "API : Host « exemple.fr » accepté (code $etranger)"
fi

assistant_actif="$(systemctl is-active hakos-assistant.service 2>/dev/null || true)"
assistant_unite="$(systemctl is-enabled hakos-assistant.service 2>/dev/null || true)"
if [ "$installee" = 1 ] && [ "$assistant_actif" != active ] && [ "$assistant_unite" = masked ]; then
	ok "assistant arrêté et masqué (box installée)"
elif [ "$installee" = 0 ] && [ "$assistant_actif" = active ] && [ "$assistant_unite" = enabled ]; then
	ok "assistant actif (hakos-assistant), en attente de la famille"
else
	echec "assistant : $assistant_actif, $assistant_unite, pour une box $([ "$installee" = 1 ] && echo installée || echo 'pas installée')"
fi
if id -nG hakos-assistant 2>/dev/null | tr ' ' '\n' | grep -qx docker && [ "$(stat -c '%U %a' "$ETAT" 2>/dev/null)" = "hakos-assistant 755" ]; then
	ok "utilisateur hakos-assistant (groupe docker), $ETAT à lui"
else
	echec "utilisateur hakos-assistant ou dossier $ETAT absents ou mal réglés"
fi
if grep -q '^NEXTCLOUD_ADMIN_' "$BOITE/nextcloud/.env" 2>/dev/null; then
	echec "Nextcloud : lignes NEXTCLOUD_ADMIN_* encore dans $BOITE/nextcloud/.env"
else
	ok "Nextcloud : plus de compte technique dans .env"
fi

# --- Garde-fous du Pi 5, noms des applications, page d'état ---

pages="$(getconf PAGESIZE 2>/dev/null || true)"
if [ "$pages" = 4096 ] && [ ! -e "$ETAT/arret" ]; then
	ok "pages mémoire de 4 Kio (noyau kernel8.img), premier démarrage pas arrêté"
else
	echec "pages mémoire de « $pages » octets, ou premier démarrage arrêté ($ETAT/arret : $(cat "$ETAT/arret" 2>/dev/null || echo absent))"
fi

if [ "$(systemctl is-enabled hakos-noms.service 2>/dev/null || true)" = enabled ] &&
	[ "$(systemctl is-active hakos-noms.service 2>/dev/null || true)" = active ]; then
	ok "unité hakos-noms activée et active"
else
	echec "unité hakos-noms : $(systemctl is-enabled hakos-noms.service 2>/dev/null || true), $(systemctl is-active hakos-noms.service 2>/dev/null || true)"
fi
# Nom pris par avahi (hako, hako-2…) et adresse IPv4 de la box (route par défaut).
nom_avahi="$(busctl --system call org.freedesktop.Avahi / org.freedesktop.Avahi.Server GetHostName 2>/dev/null | sed -n 's/^s "\(.*\)"$/\1/p' || true)"
adresse="$(ip -4 route get 192.0.2.1 2>/dev/null | sed -n 's/.* src \([0-9.]*\).*/\1/p' | head -n 1 || true)"
if [ -z "$nom_avahi" ] || [ -z "$adresse" ]; then
	echec "noms des applications : nom avahi « $nom_avahi » ou adresse IPv4 « $adresse » illisible (avahi-daemon actif ?)"
else
	resolus=""
	for application in photos fichiers; do
		resolus="$resolus $(timeout 10 avahi-resolve-host-name -4 "$nom_avahi-$application.local" 2>/dev/null | awk '{print $2}' || true)"
	done
	if [ "$resolus" = " $adresse $adresse" ]; then
		ok "avahi : $nom_avahi-photos.local et $nom_avahi-fichiers.local → $adresse"
	else
		echec "avahi : $nom_avahi-photos.local et $nom_avahi-fichiers.local résolus en «$resolus », attendu $adresse"
	fi
fi

photos_nom="$(curl -sS --max-time 10 -H 'Host: hako-photos.local' http://127.0.0.1/api/server/ping 2>/dev/null || true)"
fichiers_nom="$(curl -sS --max-time 20 -H 'Host: hako-fichiers.local' http://127.0.0.1/status.php 2>/dev/null || true)"
renvoi="$(curl -sS --max-time 10 -o /dev/null -w '%{redirect_url}' -H 'Host: hako-2.local' http://127.0.0.1/fichiers 2>/dev/null || true)"
if [ "$installee" = 1 ]; then
	if [[ "$photos_nom" == *pong* ]] && [[ "$fichiers_nom" == *'"installed":true'* ]] && [ "$renvoi" = http://hako-2-fichiers.local/ ]; then
		ok "port 80 : hako-photos.local → Immich, hako-fichiers.local → Nextcloud, /fichiers de hako-2.local → hako-2-fichiers.local"
	else
		echec "port 80 par les noms : Immich « ${photos_nom:0:40} », Nextcloud « ${fichiers_nom:0:60} », renvoi « $renvoi »"
	fi
	domaines="$(docker exec -u www-data "$(docker ps -q --filter label=com.docker.compose.project=hakos-nextcloud --filter label=com.docker.compose.service=nextcloud)" php occ --no-interaction config:system:get trusted_domains 2>/dev/null | tr '\n' ' ' || true)"
	manque=""
	for domaine in hako.local hako-2.local hako-fichiers.local hako-2-fichiers.local "$adresse"; do
		[[ " $domaines " == *" $domaine "* ]] || manque="$manque ${domaine:-(adresse illisible)}"
	done
	par_ip="$(curl -sS --max-time 20 -o /dev/null -w '%{http_code}' "http://$adresse:8080/login" 2>/dev/null || true)"
	if [ -z "$manque" ] && [ "$par_ip" = 200 ]; then
		ok "Nextcloud : domaines de confiance hako.local, hako-2.local, hako-fichiers.local, hako-2-fichiers.local et $adresse (http://$adresse:8080 répond)"
	else
		echec "Nextcloud : domaines de confiance, manque :${manque:- rien} ; http://$adresse:8080/login : code « $par_ip »"
	fi
elif [[ "$photos_nom" != *pong* ]] && [[ "$fichiers_nom" != *installed* ]]; then
	ok "port 80 : hako-photos.local et hako-fichiers.local ne mènent pas aux applications avant l'installation"
else
	echec "port 80 : une application répond par son nom avant l'installation"
fi

json="/run/hakos-etat/etat.json"
# Une mesure fraîche plutôt que celle de la dernière minute (applications peut-être en démarrage).
systemctl start hakos-etat.service >/dev/null 2>&1 || true
if [ "$(systemctl is-enabled hakos-etat.timer 2>/dev/null || true)" = enabled ] &&
	[ "$(systemctl is-active hakos-etat.timer 2>/dev/null || true)" = active ] &&
	python3 -I - "$json" "$ESSAI" <<'FIN'
import json, sys, time
etat = json.load(open(sys.argv[1], encoding='utf-8'))
attendues = {'version', 'verifie', 'disque', 'photos', 'allumee_depuis', 'temperature', 'ralentissement',
             'applications', 'sauvegarde'}
assert set(etat) == attendues, sorted(set(etat) ^ attendues)
assert abs(time.time() - etat['verifie']) < 180, 'mesure trop ancienne'
assert etat['disque']['total'] > etat['disque']['utilise'] > 0
assert isinstance(etat['photos'], int) and isinstance(etat['allumee_depuis'], int)
assert etat['applications'] == {'photos': 'ok', 'fichiers': 'ok'}, etat['applications']
if sys.argv[2] != '1':
    assert isinstance(etat['temperature'], float) and isinstance(etat['ralentissement'], dict), 'vcgencmd'
FIN
then
	ok "page d'état : hakos-etat.timer actif, $json à jour et complet ($(python3 -I -c 'import json,sys;e=json.load(open(sys.argv[1]));print(e["photos"],"photo(s),",e["temperature"],"°C")' "$json" 2>/dev/null || true))"
else
	echec "page d'état : hakos-etat.timer inactif, ou $json absent, ancien ou incomplet (journalctl -u hakos-etat)"
fi
# Comparaison dans bash : aucun secret ne passe en argument d'une commande.
fuites=0
contenu_json="$(cat "$json" 2>/dev/null || true)"
for secret in "${!deja_vu[@]}"; do
	if [[ "$contenu_json" == *"$secret"* ]]; then
		fuites=$((fuites + 1))
	fi
done
etat_http="$(curl -sS --max-time 10 -D - -o /dev/null -H 'Host: hako.local' http://127.0.0.1/api/etat 2>/dev/null | tr -d '\r' || true)"
if [ "$fuites" -eq 0 ] && [ "${#deja_vu[@]}" -gt 0 ] && [ "$(stat -c '%a %U' "$json" 2>/dev/null)" = "644 root" ] &&
	{ [ "$installee" = 0 ] || { grep -q '^HTTP/1.1 200' <<<"$etat_http" && grep -qi '^cache-control: no-store' <<<"$etat_http"; }; }; then
	ok "page d'état : aucun des ${#deja_vu[@]} secrets de la box dans $json$([ "$installee" = 1 ] && echo ', servi sur http://hako.local/api/etat')"
else
	echec "page d'état : $fuites secret(s) dans $json, droits « $(stat -c '%a %U' "$json" 2>/dev/null) », ou /api/etat pas servi"
fi

# --- Système (pas en essai) ---

if [ "$ESSAI" = 1 ]; then
	echo "Essai (HAKOS_ESSAI=1) : contrôles du système sautés."
else
	nom="$(uname -n)"
	if [ "$nom" = hako ]; then
		ok "nom d'hôte hako"
	else
		echec "nom d'hôte « $nom », attendu hako"
	fi

	if [[ "$(cat /etc/machine-id 2>/dev/null)" =~ ^[0-9a-f]{32}$ ]]; then
		ok "machine-id propre à cette box"
	else
		echec "machine-id absent ou non initialisé"
	fi

	if [ "$(systemctl is-active avahi-daemon.service 2>/dev/null || true)" = active ]; then
		ok "avahi actif (adresse hako.local)"
	else
		echec "avahi-daemon inactif : hako.local ne répondra pas"
	fi

	ecoute22="$(ss -Hltn 'sport = :22' 2>/dev/null || true)"
	case "$profil" in
		dev)
			if [ "$(systemctl is-active ssh.service 2>/dev/null || true)" = active ] && [ -n "$ecoute22" ]; then
				ok "SSH actif, port 22 ouvert (profil dev)"
			else
				echec "SSH attendu actif en profil dev (ssh.service : $(systemctl is-active ssh.service 2>/dev/null || true), port 22 : $([ -n "$ecoute22" ] && echo ouvert || echo fermé))"
			fi
			;;
		prod)
			masques=""
			for unite in ssh.service ssh.socket sshswitch.service; do
				masques="$masques $(systemctl is-enabled "$unite" 2>/dev/null || true)"
			done
			if [ "$masques" = " masked masked masked" ] && [ -z "$ecoute22" ]; then
				ok "SSH masqué, port 22 fermé (profil prod)"
			else
				echec "SSH doit être masqué en profil prod (ssh.service, ssh.socket, sshswitch.service :$masques ; port 22 : $([ -n "$ecoute22" ] && echo ouvert || echo fermé))"
			fi
			;;
		*)
			echec "profil illisible dans $BOITE/profil : « $profil »"
			;;
	esac

	paquet="$(dpkg-query -W -f='${db:Status-Status}' unattended-upgrades 2>/dev/null || true)"
	reglages="$(apt-config dump 2>/dev/null || true)"
	origines="$(sed -n 's/^Unattended-Upgrade::Origins-Pattern:: "\(.*\)";$/\1/p' <<<"$reglages")"
	minuterie="$(systemctl is-enabled apt-daily-upgrade.timer 2>/dev/null || true)"
	if [ "$paquet" = installed ] && grep -qx 'APT::Periodic::Unattended-Upgrade "1";' <<<"$reglages" &&
		[ -n "$origines" ] && ! grep -qvi security <<<"$origines" && [ "$minuterie" = enabled ]; then
		ok "unattended-upgrades configuré : mises à jour de sécurité Debian seulement"
	else
		echec "unattended-upgrades : paquet « $paquet », minuterie « $minuterie », origines : $(tr '\n' ' ' <<<"$origines")"
	fi

	unite=hakos-premier-demarrage.service
	resultat="$(systemctl show -p Result --value "$unite" 2>/dev/null || true)"
	actif="$(systemctl show -p ActiveState --value "$unite" 2>/dev/null || true)"
	condition="$(systemctl show -p ConditionResult --value "$unite" 2>/dev/null || true)"
	active="$(systemctl is-enabled "$unite" 2>/dev/null || true)"
	# Au premier démarrage, l'unité reste « active » (RemainAfterExit) ; aux suivants, sa condition
	# (.initialized absent) n'est plus remplie et elle ne tourne plus.
	if [ "$active" = enabled ] && [ "$resultat" = success ] && { [ "$actif" = active ] || [ "$condition" = no ]; }; then
		ok "unité $unite activée et réussie"
	else
		echec "unité $unite : activation « $active », état « $actif », résultat « $resultat »"
	fi

	wifi=""
	for radio in /sys/class/rfkill/rfkill*; do
		[ "$(cat "$radio/type" 2>/dev/null)" = wlan ] || continue
		wifi="$wifi $(cat "$radio/soft" "$radio/hard" 2>/dev/null | tr -d '\n' || true)"
	done
	if [ -n "$wifi" ] && [[ ! "$wifi" =~ 1 ]]; then
		ok "Wi-Fi disponible (radio débloquée)"
	else
		echec "Wi-Fi bloqué ou absent (rfkill :${wifi:- aucune radio wlan})"
	fi
	# EEPROM du Pi 5 : le démarrage sur SSD NVMe demande une version du 6/12/2023 ou plus récente.
	eeprom="$(vcgencmd bootloader_version 2>/dev/null || true)"
	date_eeprom="$(sed -n 's/^timestamp \([0-9]*\)$/\1/p' <<<"$eeprom")"
	if [[ "$date_eeprom" =~ ^[0-9]+$ ]] && [ "$date_eeprom" -ge 1701820800 ]; then
		ok "EEPROM du $(date -u -d "@$date_eeprom" '+%d/%m/%Y'), assez récent pour démarrer sur NVMe"
	else
		echec "EEPROM : version illisible ou antérieure au 6/12/2023 (« ${eeprom%%$'\n'*} »)"
	fi
	if [ "$(systemctl is-active bluetooth.service 2>/dev/null || true)" = active ]; then
		ok "Bluetooth actif"
	else
		echec "Bluetooth inactif"
	fi
fi

echo
if [ "$echecs" -eq 0 ]; then
	echo "Bilan : $reussis contrôles réussis, aucun échec."
else
	echo "Bilan : $echecs échec(s) sur $((reussis + echecs)) contrôles."
	exit 1
fi
