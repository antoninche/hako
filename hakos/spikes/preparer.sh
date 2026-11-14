#!/usr/bin/env bash
# HakOS, lot 5, essais : prépare dans la VM Colima une copie des trois services de la box
# (accueil, Immich, Nextcloud) avec les images figées, sans rien modifier dans le dépôt.
#
# À lancer en root dans la VM Colima :
#   colima ssh -- sudo ~/Code/mabox-os-lot5/spikes/preparer.sh demarrer
#   colima ssh -- sudo ~/Code/mabox-os-lot5/spikes/preparer.sh nettoyer
#
# demarrer : copie rootfs/opt/box/{home,immich,nextcloud} et versions.env dans $ESSAI, écrit les
#            .env comme le premier démarrage (secrets tirés au hasard, mode 600), puis
#            « docker compose up -d --wait » de chaque service. Immich tourne sans apprentissage
#            automatique (cas d'un Pi 5 de 4 Go). Nextcloud reçoit en plus un administrateur
#            technique, pour qu'il s'installe seul au premier lancement (essai b).
# nettoyer : « docker compose down -v » de chaque service, puis suppression de $ESSAI.
#
# Aucun secret n'est affiché.
set -euo pipefail

DEPOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
ESSAI=/opt/hakos-lot5-essai
SERVICES=(home immich nextcloud)

echec() {
	echo "Erreur : $*" >&2
	exit 1
}

# creer_env SERVICE [LIGNE…] : même méthode que creer_env de lib/premier-demarrage.sh :
# versions.env, puis env.modele où chaque __SECRET__ devient une valeur aléatoire, puis les LIGNEs.
creer_env() {
	local service=$1
	shift
	local ligne contenu
	contenu=$(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$ESSAI/versions.env")$'\n'
	while IFS= read -r ligne || [ -n "$ligne" ]; do
		case $ligne in
			'' | '#'*) continue ;;
		esac
		while [[ $ligne == *__SECRET__* ]]; do
			ligne=${ligne/__SECRET__/$(openssl rand -hex 24)}
		done
		contenu+="$ligne"$'\n'
	done <"$ESSAI/$service/env.modele"
	for ligne in "$@"; do
		contenu+="$ligne"$'\n'
	done
	(
		umask 077
		printf '%s' "$contenu" >"$ESSAI/$service/.env"
	)
}

demarrer() {
	local service debut
	[ ! -e "$ESSAI" ] || echec "$ESSAI existe déjà : lancer d'abord « $0 nettoyer »."
	install -d -m 755 "$ESSAI"
	cp "$DEPOT/versions.env" "$ESSAI/"
	for service in "${SERVICES[@]}"; do
		cp -R "$DEPOT/rootfs/opt/box/$service" "$ESSAI/"
	done
	creer_env home
	creer_env immich "IMMICH_CONFIG_FILE=/usr/src/app/hakos/immich-sans-ml.json"
	# Lot 5 : avec ces deux variables, l'image installe Nextcloud avant de démarrer Apache.
	# L'essai b crée ensuite les personnes, supprime ce compte et retire ces lignes.
	creer_env nextcloud "NEXTCLOUD_ADMIN_USER=hakos-installation" \
		"NEXTCLOUD_ADMIN_PASSWORD=$(openssl rand -hex 24)"
	for service in "${SERVICES[@]}"; do
		debut=$SECONDS
		(cd "$ESSAI/$service" && docker compose up -d --wait --wait-timeout 900 >/dev/null 2>&1) ||
			echec "docker compose up a échoué pour $service."
		echo "$service : prêt en $((SECONDS - debut)) s"
	done
}

nettoyer() {
	local service
	for service in nextcloud immich home; do
		if [ -f "$ESSAI/$service/docker-compose.yml" ]; then
			(cd "$ESSAI/$service" && docker compose down -v --remove-orphans >/dev/null 2>&1) || true
		fi
	done
	rm -rf -- "$ESSAI"
	echo "Essai défait : services arrêtés, $ESSAI supprimé."
}

[ "$(id -u)" -eq 0 ] || echec "à lancer en root, dans la VM Colima."
command -v docker >/dev/null || echec "docker introuvable."
case ${1:-} in
	demarrer) demarrer ;;
	nettoyer) nettoyer ;;
	*) echec "usage : $0 demarrer|nettoyer" ;;
esac
