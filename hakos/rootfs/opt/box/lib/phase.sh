#!/bin/bash
# HakOS : applique l'état de la première installation, en root.
#   phase.sh appliquer   pare-feu (parefeu/hakos.nft) et page du port 80 (phase.conf) ;
#                        lancé au démarrage par hakos-parefeu.service, avant Docker, et par le
#                        premier démarrage avant les services
#   phase.sh fin         à l'arrêt de hakos-assistant (ExecStopPost) : si la HAKO est installée,
#                        applique, recharge le nginx de l'accueil et masque le service
#   phase.sh recharger   applique, puis recharge le nginx de l'accueil s'il tourne (premier
#                        démarrage qui refuse le matériel)
#
# L'état fait foi : $HAKOS_ETAT/installee (défaut /var/lib/hakos), écrit par l'assistant une fois
# les comptes créés. Absent, vide ou illisible : HAKO pas installée, ports 2283 et 8080 fermés,
# le port 80 sert la page de la HAKO. Présent : ports ouverts, le port 80 sert l'accueil.
# $HAKOS_ETAT/arret, posé par le premier démarrage quand il refuse le matériel (pages mémoire
# différentes de 4 Kio), passe avant tout : ports fermés, le port 80 sert la page d'arrêt.
# Variables d'essai : HAKOS_BOITE (défaut /opt/box), HAKOS_ETAT, HAKOS_ESSAI=1 (pas de masquage).
set -euo pipefail
umask 022

BOITE=${HAKOS_BOITE:-/opt/box}
ETAT=${HAKOS_ETAT:-/var/lib/hakos}
ESSAI=${HAKOS_ESSAI:-0}
UTILISATEUR=hakos-assistant
SERVICE=hakos-assistant.service

journal() { printf '%s\n' "$*"; }
echec() {
	printf 'Erreur : %s\n' "$*" >&2
	exit 1
}

# arretee : vrai si le premier démarrage a refusé le matériel ($HAKOS_ETAT/arret).
arretee() {
	[ -e "$ETAT/arret" ]
}

installee() {
	local ligne=""
	[ -f "$ETAT/installee" ] && [ -r "$ETAT/installee" ] || return 1
	IFS= read -r ligne <"$ETAT/installee" || true
	[[ $ligne == "HakOS installée le "* ]]
}

# ecrire_phase PAGE : phase.conf inclut accueil.conf, assistant.conf ou arret.conf ; rend 0 s'il a changé.
ecrire_phase() {
	local voulu="include /etc/nginx/hakos/$1.conf;" fichier="$ETAT/accueil/phase.conf" provisoire
	if [ -f "$fichier" ] && [ "$(cat "$fichier")" = "$voulu" ]; then
		return 1
	fi
	provisoire=$(mktemp "$ETAT/accueil/.phase.XXXXXX")
	printf '%s\n' "$voulu" >"$provisoire"
	chmod 644 "$provisoire"
	mv -f "$provisoire" "$fichier"
}

appliquer() {
	local page
	command -v nft >/dev/null || echec "nft introuvable (paquet nftables)."
	[ -r "$BOITE/parefeu/hakos.nft" ] || echec "règles introuvables : $BOITE/parefeu/hakos.nft"
	install -d -m 755 "$ETAT" "$ETAT/accueil"
	if id -u "$UTILISATEUR" >/dev/null 2>&1; then
		chown "$UTILISATEUR:$UTILISATEUR" "$ETAT" "$ETAT/accueil"
	fi
	nft -f "$BOITE/parefeu/hakos.nft" || echec "nft a refusé $BOITE/parefeu/hakos.nft."
	if arretee; then
		page=arret
		journal "Premier démarrage arrêté ($ETAT/arret) : pare-feu chargé, ports 2283 et 8080 fermés, page d'arrêt sur le port 80."
	elif installee; then
		nft flush set inet hakos ports_fermes
		page=accueil
		journal "HAKO installée : pare-feu chargé, ports 2283 et 8080 ouverts au réseau de la maison."
	else
		page=assistant
		journal "HAKO pas encore installée : pare-feu chargé, ports 2283 et 8080 fermés, port 80 pour l'assistant."
	fi
	if ecrire_phase "$page"; then
		journal "Port 80 : $page.conf."
		return 0
	fi
	return 1
}

recharger_nginx() {
	local id
	id=$(docker ps -q --filter label=com.docker.compose.project=hakos-accueil \
		--filter label=com.docker.compose.service=nginx 2>/dev/null </dev/null) || id=""
	if [ -n "$id" ]; then
		docker kill --signal HUP "$id" >/dev/null </dev/null && journal "nginx de l'accueil rechargé."
	fi
}

fin() {
	installee || {
		journal "Assistant arrêté, HAKO pas encore installée : il redémarrera."
		return 0
	}
	appliquer || true
	recharger_nginx || journal "attention : nginx de l'accueil pas rechargé."
	if [ "$ESSAI" = 1 ]; then
		journal "Essai : $SERVICE n'est pas masqué."
	elif systemctl mask "$SERVICE" >/dev/null 2>&1; then
		journal "$SERVICE masqué : la première installation est faite."
	else
		journal "attention : $SERVICE n'a pas pu être masqué (il ne redémarre pas : $ETAT/installee existe)."
	fi
}

[ "$(id -u)" -eq 0 ] || echec "à lancer en root."
case ${1:-} in
	appliquer) appliquer || true ;;
	fin) fin ;;
	recharger)
		appliquer || true
		recharger_nginx || journal "attention : nginx de l'accueil pas rechargé."
		;;
	*) echec "usage : $0 appliquer|fin|recharger" ;;
esac
