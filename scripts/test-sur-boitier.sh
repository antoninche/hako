#!/usr/bin/env bash
# Test de fumée de HakoS, sur la box, après le premier démarrage. En root :
#   sudo /opt/box/test-sur-boitier.sh
# Une ligne « OK … » ou « ÉCHEC … » par contrôle, puis un bilan. Code de sortie 1 si un contrôle
# échoue. Le script ne modifie rien et n'affiche jamais la valeur d'un secret.
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

echo "Test de HakoS dans $BOITE : profil ${profil:-inconnu}, mémoire $memoire_kio Kio$([ "$ESSAI" = 1 ] && echo ', essai')."

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

if lire_page http://localhost/ && [ "$code" = 200 ] && [[ "$corps" == *"Mes photos"* ]]; then
	ok "page d'accueil http://localhost/ : répond, contient « Mes photos »"
else
	echec "page d'accueil http://localhost/ : code « ${code:-aucune réponse} », « Mes photos » introuvable"
fi
if lire_page http://localhost:2283/api/server/ping && [ "$code" = 200 ] && [[ "$corps" == *pong* ]]; then
	ok "Immich http://localhost:2283/api/server/ping : pong"
else
	echec "Immich http://localhost:2283/api/server/ping : code « ${code:-aucune réponse} », pas de pong"
fi
# Avant l'installation, Nextcloud affiche son assistant (200) ; après, la page de connexion. Un 400
# (« domaine non approuvé ») prouve aussi que Nextcloud répond.
if lire_page http://localhost:8080/ && [[ "$code" =~ ^[234][0-9][0-9]$ ]] && [[ "$corps" == *Nextcloud* ]]; then
	ok "Nextcloud http://localhost:8080/ : répond (code $code), contient « Nextcloud »"
else
	echec "Nextcloud http://localhost:8080/ : code « ${code:-aucune réponse} », « Nextcloud » introuvable"
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
