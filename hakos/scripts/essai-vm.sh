#!/usr/bin/env bash
# HakOS : essai d'une box neuve dans la VM Colima, sans démarrer de Raspberry Pi. En root, dans la VM :
#   colima ssh -- sudo ~/Code/mabox-os/scripts/essai-vm.sh installer [IMAGE]
#   colima ssh -- sudo ~/Code/mabox-os/scripts/essai-vm.sh defaire
#
# installer : fait dans la VM ce que font stage-box/02-applications et 03-premier-demarrage
#             (/opt/box, utilisateur hakos-assistant, unités hakos-parefeu,
#             hakos-premier-demarrage, hakos-assistant, hakos-noms et hakos-etat.timer, tmpfiles),
#             puis lance le vrai premier démarrage par systemd et en mesure la durée, en essai
#             (HAKOS_ESSAI=1 : machine-id et SSH intacts, fiche dans /opt/box) comme sur un Pi 5
#             de 4 Go (HAKOS_MEMOIRE_KIO=4000000).
#             Sans IMAGE : /opt/box vient du dépôt, en profil prod ; les images Docker figées
#             doivent déjà être dans Docker (aucune archive n'est copiée).
#             Avec IMAGE (deploy/image_…-hakos-prod.img.xz, chemin vu de la VM) : /opt/box, ses
#             archives d'images et les unités systemd viennent de l'image construite, montée en
#             lecture seule ; le premier démarrage charge alors les archives, comme sur la box.
#             avahi-daemon et avahi-utils doivent être installés dans la VM : le temps de l'essai,
#             avahi y annonce le nom hako (hako.local, hako-photos.local, hako-fichiers.local).
#             vcgencmd n'existe pas dans la VM : la page d'état reçoit une température et un état
#             d'alimentation d'exemple (48,3 °C, aucun ralentissement).
#             HAKOS_PAGE_OCTETS=16384 dans l'environnement simule le noyau à pages de 16 Kio : le
#             premier démarrage doit s'arrêter et servir la page d'arrêt.
# defaire   : arrête et retire tout ce qu'« installer » a mis (conteneurs et données compris), et
#             rend à avahi le nom de la VM.
# Ensuite : sudo env HAKOS_ESSAI=1 HAKOS_MEMOIRE_KIO=4000000 /opt/box/test-sur-boitier.sh \
#           [--assistant N [--coupure]]
set -euo pipefail

DEPOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
UNITES=(hakos-parefeu.service hakos-premier-demarrage.service hakos-assistant.service hakos-noms.service)
ESSAI_OUTILS=/usr/local/lib/hakos-essai

echec() {
	echo "Erreur : $*" >&2
	exit 1
}

defaire() {
	local service
	systemctl unmask hakos-assistant.service >/dev/null 2>&1 || true
	systemctl disable --now "${UNITES[@]}" hakos-etat.timer >/dev/null 2>&1 || true
	systemctl stop hakos-etat.service >/dev/null 2>&1 || true
	for service in nextcloud immich home; do
		if [ -f "/opt/box/$service/docker-compose.yml" ]; then
			(cd "/opt/box/$service" && docker compose down -v --remove-orphans >/dev/null 2>&1) || true
		fi
	done
	nft delete table inet hakos 2>/dev/null || true
	ip netns del hakos-voisin 2>/dev/null || true
	ip link del hv0 2>/dev/null || true
	for unite in "${UNITES[@]}" hakos-etat.service hakos-etat.timer; do
		rm -f "/etc/systemd/system/$unite" "/usr/lib/systemd/system/$unite"
	done
	rm -rf /etc/systemd/system/hakos-premier-demarrage.service.d /etc/systemd/system/hakos-etat.service.d
	rm -f /etc/tmpfiles.d/hakos.conf
	rm -rf /opt/box /var/lib/hakos /run/hakos-assistant /run/hakos-etat "$ESSAI_OUTILS"
	if id -u hakos-assistant >/dev/null 2>&1; then
		userdel hakos-assistant
	fi
	if command -v avahi-set-host-name >/dev/null 2>&1 && systemctl is-active -q avahi-daemon; then
		avahi-set-host-name "$(hostname -s)" >/dev/null 2>&1 || true
	fi
	systemctl daemon-reload
	systemctl reset-failed >/dev/null 2>&1 || true
	echo "Essai défait : unités, conteneurs, /opt/box et /var/lib/hakos retirés."
}

# copier_depot : /opt/box et les unités depuis le dépôt (comme stage-box/02 et 03), profil prod.
copier_depot() {
	local source="$DEPOT/rootfs/opt/box" fichier relatif mode
	[ -s "$source/assistant/mots.txt" ] && [ -s "$source/home/assistant/index.html" ] ||
		echec "liste de mots ou page de la HAKO absente du dépôt."
	install -d -m 0755 /opt/box /opt/box/images
	find "$source" -mindepth 1 -type d ! -name __pycache__ -print0 | while IFS= read -r -d '' dossier; do
		install -d -m 0755 "/opt/box/${dossier#"$source"/}"
	done
	find "$source" -type f ! -name .DS_Store ! -name '._*' ! -name '*.pyc' -print0 | while IFS= read -r -d '' fichier; do
		relatif="${fichier#"$source"/}"
		mode=0644
		if [[ "$relatif" == *.sh ]] || [ -x "$fichier" ]; then
			mode=0755
		fi
		install -o root -g root -m "$mode" "$fichier" "/opt/box/$relatif"
	done
	install -m 0644 "$DEPOT/versions.env" /opt/box/versions.env
	install -m 0755 "$DEPOT/scripts/test-sur-boitier.sh" /opt/box/test-sur-boitier.sh
	install -m 0755 "$DEPOT/scripts/essai-assistant.py" /opt/box/essai-assistant.py
	printf 'prod\n' >/opt/box/profil
	# Comme dans l'image : hakos-assistant dans /usr/lib/systemd/system, pour pouvoir le masquer.
	install -m 0644 "$source/systemd/hakos-parefeu.service" "$source/systemd/hakos-premier-demarrage.service" \
		"$source/systemd/hakos-noms.service" "$source/systemd/hakos-etat.service" "$source/systemd/hakos-etat.timer" \
		/etc/systemd/system/
	install -m 0644 "$source/systemd/hakos-assistant.service" /usr/lib/systemd/system/
	install -m 0644 "$source/systemd/hakos-tmpfiles.conf" /etc/tmpfiles.d/hakos.conf
}

# copier_image IMAGE : /opt/box (archives comprises) et les unités depuis l'image construite.
# Sous-shell : le nettoyage (démontage, losetup -d, image décompressée) se fait à sa sortie.
copier_image() (
	local image=$1 unite R
	travail=""
	boucle=""
	# shellcheck disable=SC2329 # appelée par le piège EXIT
	nettoyer() {
		[ -n "$travail" ] || return 0
		umount "$travail/racine" 2>/dev/null || true
		[ -z "$boucle" ] || losetup -d "$boucle" || true
		rm -rf "$travail"
		fstrim -a >/dev/null 2>&1 || true
	}
	trap nettoyer EXIT
	[ -f "$image" ] || echec "image introuvable dans la VM : $image"
	travail=$(mktemp -d /var/tmp/hakos-essai.XXXXXX)
	echo "Décompression de $(basename "$image")…"
	python3 -I -c 'import lzma, shutil, sys
with lzma.open(sys.argv[1]) as e, open(sys.argv[2], "xb") as s:
    shutil.copyfileobj(e, s, 8 << 20)' "$image" "$travail/image.img"
	boucle=$(losetup -r -P --show -f "$travail/image.img")
	udevadm settle 2>/dev/null || true
	mkdir "$travail/racine"
	mount -t ext4 -o ro,noload "${boucle}p2" "$travail/racine"
	R="$travail/racine"
	[ -x "$R/opt/box/firstboot.sh" ] || echec "/opt/box/firstboot.sh absent de l'image."
	cp -a "$R/opt/box" /opt/box
	for unite in hakos-parefeu.service hakos-premier-demarrage.service hakos-noms.service hakos-etat.service hakos-etat.timer; do
		install -m 0644 "$R/etc/systemd/system/$unite" /etc/systemd/system/
	done
	install -m 0644 "$R/usr/lib/systemd/system/hakos-assistant.service" /usr/lib/systemd/system/
	install -m 0644 "$R/etc/tmpfiles.d/hakos.conf" /etc/tmpfiles.d/hakos.conf
	echo "/opt/box et unités copiés depuis l'image (profil $(cat /opt/box/profil), $(find /opt/box/images -name '*.tar' | wc -l) archive(s))."
)

installer() {
	local debut
	[ ! -e /opt/box ] || echec "/opt/box existe déjà : lancer d'abord « $0 defaire »."
	if ! command -v avahi-publish >/dev/null 2>&1 || ! systemctl is-active -q avahi-daemon; then
		echec "avahi absent de la VM : sudo apt-get install -y avahi-daemon avahi-utils"
	fi
	if [ -n "${1:-}" ]; then
		copier_image "$1"
	else
		copier_depot
	fi
	install -d -m 0755 /etc/systemd/system/hakos-premier-demarrage.service.d
	printf '[Service]\nEnvironment=HAKOS_ESSAI=1 HAKOS_MEMOIRE_KIO=4000000%s\n' \
		"${HAKOS_PAGE_OCTETS:+ HAKOS_PAGE_OCTETS=$HAKOS_PAGE_OCTETS}" \
		>/etc/systemd/system/hakos-premier-demarrage.service.d/essai.conf
	# vcgencmd d'exemple pour la page d'état (la VM n'est pas un Raspberry Pi).
	install -d -m 0755 "$ESSAI_OUTILS"
	cat >"$ESSAI_OUTILS/vcgencmd" <<-'FIN'
		#!/bin/sh
		# Essai dans la VM : valeurs d'exemple, comme un Pi 5 au repos avec son ventilateur.
		case "$1" in
			measure_temp) echo "temp=48.3'C" ;;
			get_throttled) echo "throttled=0x0" ;;
			*) exit 1 ;;
		esac
	FIN
	chmod 0755 "$ESSAI_OUTILS/vcgencmd"
	install -d -m 0755 /etc/systemd/system/hakos-etat.service.d
	printf '[Service]\nEnvironment=HAKOS_VCGENCMD=%s/vcgencmd\n' "$ESSAI_OUTILS" \
		>/etc/systemd/system/hakos-etat.service.d/essai.conf
	avahi-set-host-name hako >/dev/null || echec "avahi refuse le nom hako."
	id -u hakos-assistant >/dev/null 2>&1 || useradd --system --user-group --no-create-home \
		--home-dir /nonexistent --shell /usr/sbin/nologin --groups docker hakos-assistant
	systemd-tmpfiles --create /etc/tmpfiles.d/hakos.conf
	systemctl daemon-reload
	systemctl enable "${UNITES[@]}" hakos-etat.timer >/dev/null 2>&1
	systemctl start hakos-parefeu.service hakos-assistant.service hakos-noms.service hakos-etat.timer
	echo "Premier démarrage (systemctl start hakos-premier-demarrage)…"
	debut=$SECONDS
	systemctl start hakos-premier-demarrage.service || {
		journalctl -u hakos-premier-demarrage -o cat --no-pager | tail -20
		echec "premier démarrage en échec."
	}
	echo "Premier démarrage réussi en $((SECONDS - debut)) s."
}

[ "$(id -u)" -eq 0 ] || echec "à lancer en root, dans la VM Colima."
case ${1:-} in
	installer) installer "${2:-}" ;;
	defaire) defaire ;;
	*) echec "usage : $0 installer [IMAGE]|defaire" ;;
esac
