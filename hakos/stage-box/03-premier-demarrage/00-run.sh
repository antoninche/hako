#!/bin/bash
# stage-box, étape 03 : premier démarrage et assistant de première installation de HakOS.
# L'étape 02 a déjà copié rootfs/opt/box dans l'image (firstboot.sh, lib/, systemd/, assistant/…).
# Celle-ci crée l'utilisateur système hakos-assistant (groupe docker), installe et active les
# unités hakos-parefeu, hakos-premier-demarrage, hakos-assistant, hakos-noms (noms des
# applications) et hakos-etat.timer (page d'état), et les dossiers de l'assistant et de la page
# d'état (tmpfiles.d), puis vérifie que l'image contient ce dont le premier démarrage a
# besoin, et aucun secret ni marqueur d'une box déjà initialisée ou installée.
# Le dépôt vient du Mac par virtiofs et garde l'UID 501 : copie avec install -o root -g root.
set -euo pipefail

erreur() {
	echo "Erreur (stage-box/03-premier-demarrage) : $*" >&2
	exit 1
}

[ -n "${ROOTFS_DIR:-}" ] || erreur "ROOTFS_DIR n'est pas défini : cette étape est lancée par pi-gen."
[ -n "${HAKOS_RACINE:-}" ] || erreur "HAKOS_RACINE n'est pas défini : lancer la construction avec scripts/construire.sh."

# on_chroot (fonction de pi-gen) n'est pas écrite pour « set -u » ni « pipefail » : CAPSH_ARG
# peut manquer et « mount | grep -q » peut finir en SIGPIPE. On l'appelle donc sans ces options.
dans_chroot() { (set +u +o pipefail; on_chroot "$@"); }

BOITE="$ROOTFS_DIR/opt/box"
UNITE=hakos-premier-demarrage.service
UNITES=(hakos-parefeu.service "$UNITE" hakos-assistant.service hakos-noms.service)
# hakos-etat.service n'est pas activé : son minuteur le lance chaque minute.

# hakos-assistant.service va dans /usr/lib/systemd/system : une fois la HAKO installée,
# « systemctl mask » le remplace par un lien vers /dev/null dans /etc/systemd/system, ce qu'il ne
# peut pas faire si le fichier de l'unité y est déjà.
for unite in "${UNITES[@]}"; do
	dossier=/etc/systemd/system
	[ "$unite" != hakos-assistant.service ] || dossier=/usr/lib/systemd/system
	install -o root -g root -m 0644 "$HAKOS_RACINE/rootfs/opt/box/systemd/$unite" "$ROOTFS_DIR$dossier/$unite"
done
for unite in hakos-etat.service hakos-etat.timer; do
	install -o root -g root -m 0644 "$HAKOS_RACINE/rootfs/opt/box/systemd/$unite" "$ROOTFS_DIR/etc/systemd/system/$unite"
done
install -o root -g root -m 0644 "$HAKOS_RACINE/rootfs/opt/box/systemd/hakos-tmpfiles.conf" "$ROOTFS_DIR/etc/tmpfiles.d/hakos.conf"

# Utilisateur de l'assistant : système, sans connexion ni dossier personnel, dans le groupe
# docker (créé par l'étape 01-docker).
dans_chroot <<-EOF
	set -e
	getent group docker >/dev/null
	id -u hakos-assistant >/dev/null 2>&1 || useradd --system --user-group --no-create-home \\
		--home-dir /nonexistent --shell /usr/sbin/nologin --groups docker hakos-assistant
	systemctl enable ${UNITES[*]} hakos-etat.timer
EOF

for unite in "${UNITES[@]}"; do
	[ -L "$ROOTFS_DIR/etc/systemd/system/multi-user.target.wants/$unite" ] || erreur "$unite n'est pas activé."
done
[ -L "$ROOTFS_DIR/etc/systemd/system/timers.target.wants/hakos-etat.timer" ] || erreur "hakos-etat.timer n'est pas activé."
[ -x "$ROOTFS_DIR/usr/bin/avahi-publish" ] || erreur "avahi-publish absent (paquet avahi-utils) : hakos-noms n'annoncerait aucun nom."
[ -L "$ROOTFS_DIR/etc/systemd/system/docker.service.requires/hakos-parefeu.service" ] ||
	erreur "docker.service ne requiert pas hakos-parefeu.service : Docker pourrait démarrer sans pare-feu."
grep -q '^hakos-assistant:' "$ROOTFS_DIR/etc/passwd" || erreur "utilisateur hakos-assistant absent."
grep -Eq '^docker:[^:]*:[0-9]+:(.*,)?hakos-assistant(,|$)' "$ROOTFS_DIR/etc/group" ||
	erreur "hakos-assistant n'est pas dans le groupe docker."
[ -e "$ROOTFS_DIR/usr/lib/systemd/system/docker.service" ] || [ -e "$ROOTFS_DIR/lib/systemd/system/docker.service" ] ||
	erreur "docker.service est absent de l'image : l'étape 01-docker doit installer Docker."
[ -x "$BOITE/firstboot.sh" ] || erreur "/opt/box/firstboot.sh est absent ou n'est pas exécutable."

manquants=()
for chemin in lib/commun.sh lib/premier-demarrage.sh lib/phase.sh parefeu/hakos.nft versions.env profil \
	assistant/assistant.py assistant/comptes.py assistant/foyer.py assistant/installation.py \
	assistant/mots.txt home/assistant/index.html home/nginx/defaut.conf home/nginx/accueil.conf \
	home/nginx/assistant.conf home/nginx/photos.conf home/nginx/entetes-page.conf \
	home/nginx/arret.conf home/nginx/noms.conf home/nginx/mandataire-immich.conf \
	home/site/index.html home/site/accueil.js home/site/arret.html noms/noms.py etat/etat.py \
	home/docker-compose.yml home/env.modele \
	immich/docker-compose.yml immich/env.modele \
	nextcloud/docker-compose.yml nextcloud/env.modele; do
	[ -f "$BOITE/$chemin" ] || manquants+=("/opt/box/$chemin")
done
[ ${#manquants[@]} -eq 0 ] || erreur "fichiers absents de l'image : ${manquants[*]}"

profil=$(tr -d '[:space:]' <"$BOITE/profil")
case $profil in
	dev | prod) ;;
	*) erreur "/opt/box/profil contient « $profil » au lieu de dev ou prod." ;;
esac
if [ -n "${HAKOS_PROFIL:-}" ] && [ "$profil" != "$HAKOS_PROFIL" ]; then
	erreur "/opt/box/profil vaut $profil alors que la construction est en profil $HAKOS_PROFIL."
fi

shopt -s nullglob
archives=("$BOITE"/images/*.tar)
shopt -u nullglob
[ ${#archives[@]} -gt 0 ] || erreur "aucune archive d'image Docker dans /opt/box/images."

# Secrets, fiche et marqueur naissent sur chaque box au premier démarrage, jamais dans l'image.
[ ! -e "$BOITE/.initialized" ] || erreur "/opt/box/.initialized est dans l'image : le premier démarrage ne tournerait jamais."
envs=$(find "$BOITE" -name .env -print)
[ -z "$envs" ] || erreur "fichier(s) .env dans l'image, alors que les secrets doivent être tirés sur la box : $envs"
[ ! -e "$ROOTFS_DIR/root/fiche-installation.txt" ] || erreur "/root/fiche-installation.txt est dans l'image."
[ ! -e "$ROOTFS_DIR/var/lib/hakos/installee" ] || erreur "/var/lib/hakos/installee est dans l'image : l'assistant ne tournerait jamais."
for chemin in lib/phase.sh assistant/assistant.py noms/noms.py etat/etat.py; do
	[ -x "$BOITE/$chemin" ] || erreur "/opt/box/$chemin n'est pas exécutable."
done

echo "Premier démarrage prêt : ${UNITES[*]} et hakos-etat.timer activés, profil $profil, ${#archives[@]} archive(s) d'image à charger."
