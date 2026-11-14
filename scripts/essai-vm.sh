#!/usr/bin/env bash
# HakOS : essai d'une box neuve dans la VM Colima, sans construction pi-gen. En root, dans la VM :
#   colima ssh -- sudo ~/Code/mabox-os/scripts/essai-vm.sh installer
#   colima ssh -- sudo ~/Code/mabox-os/scripts/essai-vm.sh defaire
#
# installer : fait dans la VM ce que font stage-box/02-applications et 03-premier-demarrage
#             (/opt/box, profil prod, utilisateur hakos-assistant, unités hakos-parefeu,
#             hakos-premier-demarrage et hakos-assistant, tmpfiles), puis lance le vrai premier
#             démarrage par systemd et en mesure la durée, en essai (HAKOS_ESSAI=1 : machine-id
#             et SSH intacts, fiche dans /opt/box) comme sur un Pi 5 de 4 Go
#             (HAKOS_MEMOIRE_KIO=4000000). Les images Docker figées doivent déjà être dans Docker
#             (aucune archive n'est copiée).
# defaire   : arrête et retire tout ce qu'« installer » a mis (conteneurs et données compris).
# Ensuite : sudo env HAKOS_ESSAI=1 HAKOS_MEMOIRE_KIO=4000000 /opt/box/test-sur-boitier.sh \
#           [--assistant N [--coupure]]
set -euo pipefail

DEPOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
UNITES=(hakos-parefeu.service hakos-premier-demarrage.service hakos-assistant.service)

echec() {
	echo "Erreur : $*" >&2
	exit 1
}

defaire() {
	local service
	systemctl unmask hakos-assistant.service >/dev/null 2>&1 || true
	systemctl disable --now "${UNITES[@]}" >/dev/null 2>&1 || true
	for service in nextcloud immich home; do
		if [ -f "/opt/box/$service/docker-compose.yml" ]; then
			(cd "/opt/box/$service" && docker compose down -v --remove-orphans >/dev/null 2>&1) || true
		fi
	done
	nft delete table inet hakos 2>/dev/null || true
	ip netns del hakos-voisin 2>/dev/null || true
	ip link del hv0 2>/dev/null || true
	for unite in "${UNITES[@]}"; do
		rm -f "/etc/systemd/system/$unite" "/usr/lib/systemd/system/$unite"
	done
	rm -rf /etc/systemd/system/hakos-premier-demarrage.service.d
	rm -f /etc/tmpfiles.d/hakos.conf
	rm -rf /opt/box /var/lib/hakos /run/hakos-assistant
	if id -u hakos-assistant >/dev/null 2>&1; then
		userdel hakos-assistant
	fi
	systemctl daemon-reload
	systemctl reset-failed >/dev/null 2>&1 || true
	echo "Essai défait : unités, conteneurs, /opt/box et /var/lib/hakos retirés."
}

installer() {
	local source="$DEPOT/rootfs/opt/box" fichier relatif mode debut
	[ ! -e /opt/box ] || echec "/opt/box existe déjà : lancer d'abord « $0 defaire »."
	[ -s "$source/assistant/mots.txt" ] && [ -s "$source/home/assistant/index.html" ] ||
		echec "liste de mots ou page de la HAKO absente du dépôt."
	install -d -m 0755 /opt/box /opt/box/images
	find "$source" -mindepth 1 -type d -print0 | while IFS= read -r -d '' dossier; do
		install -d -m 0755 "/opt/box/${dossier#"$source"/}"
	done
	find "$source" -type f ! -name .DS_Store ! -name '._*' -print0 | while IFS= read -r -d '' fichier; do
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
	install -m 0644 "$source/systemd/hakos-parefeu.service" "$source/systemd/hakos-premier-demarrage.service" /etc/systemd/system/
	install -m 0644 "$source/systemd/hakos-assistant.service" /usr/lib/systemd/system/
	install -m 0644 "$source/systemd/hakos-tmpfiles.conf" /etc/tmpfiles.d/hakos.conf
	install -d -m 0755 /etc/systemd/system/hakos-premier-demarrage.service.d
	printf '[Service]\nEnvironment=HAKOS_ESSAI=1 HAKOS_MEMOIRE_KIO=4000000\n' \
		>/etc/systemd/system/hakos-premier-demarrage.service.d/essai.conf
	id -u hakos-assistant >/dev/null 2>&1 || useradd --system --user-group --no-create-home \
		--home-dir /nonexistent --shell /usr/sbin/nologin --groups docker hakos-assistant
	systemd-tmpfiles --create /etc/tmpfiles.d/hakos.conf
	systemctl daemon-reload
	systemctl enable "${UNITES[@]}" >/dev/null 2>&1
	systemctl start hakos-parefeu.service hakos-assistant.service
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
	installer) installer ;;
	defaire) defaire ;;
	*) echec "usage : $0 installer|defaire" ;;
esac
