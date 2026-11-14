#!/bin/bash
# stage-box, étape 03 : premier démarrage de HakOS.
# L'étape 02 a déjà copié rootfs/opt/box dans l'image (firstboot.sh, lib/, systemd/…).
# Celle-ci installe l'unité hakos-premier-demarrage.service dans /etc/systemd/system, l'active,
# puis vérifie que l'image contient ce dont le premier démarrage a besoin, et aucun secret
# ni marqueur d'une box déjà initialisée.
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

install -o root -g root -m 0644 "$HAKOS_RACINE/rootfs/opt/box/systemd/$UNITE" "$ROOTFS_DIR/etc/systemd/system/$UNITE"
dans_chroot <<-EOF
	systemctl enable $UNITE
EOF

[ -L "$ROOTFS_DIR/etc/systemd/system/multi-user.target.wants/$UNITE" ] || erreur "$UNITE n'est pas activé."
[ -e "$ROOTFS_DIR/usr/lib/systemd/system/docker.service" ] || [ -e "$ROOTFS_DIR/lib/systemd/system/docker.service" ] ||
	erreur "docker.service est absent de l'image : l'étape 01-docker doit installer Docker."
[ -x "$BOITE/firstboot.sh" ] || erreur "/opt/box/firstboot.sh est absent ou n'est pas exécutable."

manquants=()
for chemin in lib/commun.sh lib/premier-demarrage.sh versions.env profil \
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

echo "Premier démarrage prêt : $UNITE activé, profil $profil, ${#archives[@]} archive(s) d'image à charger."
