#!/usr/bin/env bash
# HakOS, lot 5, essai c : ports 2283 et 8080 fermés au réseau par nftables pendant que le port 80
# sert la page de la box, puis ouverts.
#
# À lancer en root dans la VM Colima, après « spikes/preparer.sh demarrer » :
#   colima ssh -- sudo ~/Code/mabox-os-lot5/spikes/c-parefeu.sh
#
# Un « voisin » est simulé par un espace de noms réseau (ip netns) relié à la VM par une paire
# veth, en IPv4 (192.168.77.0/24) et en IPv6 (fd77::/64) : ses connexions arrivent par une vraie
# interface, comme celles d'un téléphone de la maison. Étapes :
#  0. témoin sans pare-feu : le voisin atteint 80, 2283 et 8080 (sinon l'essai ne prouve rien) ;
#  1. table inet hakos chargée : le voisin atteint 80, plus 2283 ni 8080, en IPv4 comme en IPv6 ;
#     la box elle-même atteint encore 127.0.0.1:2283 et 127.0.0.1:8080 ;
#  2. Docker redémarré : sa remise en place de ses règles ne touche pas notre table ;
#  3. ensemble vidé : le voisin atteint 2283 et 8080.
# Tout est défait à la fin (table, espace de noms, veth), même après un échec.
set -euo pipefail

ICI=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
NS=hakos-voisin
BOITE4=192.168.77.1
BOITE6=fd77::1
REUSSIS=0
ECHECS=0

echec() {
	echo "Erreur : $*" >&2
	exit 1
}

defaire() {
	ip netns del "$NS" 2>/dev/null || true
	ip link del hv0 2>/dev/null || true
	nft delete table inet hakos 2>/dev/null || true
}

# controle ATTENDU LIBELLÉ COMMANDE… : ATTENDU vaut « ouvert » ou « fermé ».
controle() {
	local attendu=$1 libelle=$2 obtenu
	shift 2
	obtenu=$("$@")
	if [[ $obtenu == "$attendu"* ]]; then
		REUSSIS=$((REUSSIS + 1))
		echo "OK     $libelle : $obtenu"
	else
		ECHECS=$((ECHECS + 1))
		echo "ÉCHEC  $libelle : $obtenu (attendu : $attendu)"
	fi
}

voisin() { ip netns exec "$NS" python3 "$ICI/sonde.py" "$@"; }
boite() { python3 "$ICI/sonde.py" "$@"; }

trois_ports() {
	local p80=$1 papps=$2
	controle "$p80" "voisin → $BOITE4:80 (page de la box)" voisin "$BOITE4" 80
	controle "$papps" "voisin → $BOITE4:2283 (photos)" voisin "$BOITE4" 2283
	controle "$papps" "voisin → $BOITE4:8080 (fichiers)" voisin "$BOITE4" 8080
	controle "$papps" "voisin → [$BOITE6]:2283 (IPv6)" voisin "$BOITE6" 2283
	controle "$papps" "voisin → [$BOITE6]:8080 (IPv6)" voisin "$BOITE6" 8080
}

attendre_immich() {
	local _
	for _ in $(seq 1 60); do
		[[ $(boite 127.0.0.1 2283) == ouvert* ]] && [[ $(boite 127.0.0.1 8080) == ouvert* ]] && return 0
		sleep 3
	done
	return 1
}

[ "$(id -u)" -eq 0 ] || echec "à lancer en root, dans la VM Colima."
command -v nft >/dev/null || echec "nft introuvable."
trap defaire EXIT
defaire

ip netns add "$NS"
ip link add hv0 type veth peer name hv1
ip link set hv1 netns "$NS"
ip addr add "$BOITE4/24" dev hv0
ip -6 addr add "$BOITE6/64" dev hv0 nodad
ip link set hv0 up
ip -n "$NS" addr add 192.168.77.2/24 dev hv1
ip -n "$NS" -6 addr add fd77::2/64 dev hv1 nodad
ip -n "$NS" link set hv1 up
ip -n "$NS" link set lo up

echo "--- 0. Sans pare-feu (témoin)"
trois_ports ouvert ouvert

echo "--- 1. Table inet hakos chargée"
nft -f "$ICI/hakos-parefeu.nft"
trois_ports ouvert fermé
controle ouvert "box → 127.0.0.1:2283" boite 127.0.0.1 2283
controle ouvert "box → 127.0.0.1:8080" boite 127.0.0.1 8080

echo "--- 2. Docker redémarré, table toujours là"
systemctl restart docker
attendre_immich || echec "Immich ou Nextcloud ne répond plus après le redémarrage de Docker."
table_intacte() { nft list set inet hakos ports_fermes 2>/dev/null | grep -q '2283, 8080' && echo oui || echo non; }
controle oui "table inet hakos intacte, ports 2283 et 8080 dans l'ensemble" table_intacte
trois_ports ouvert fermé

echo "--- 3. Ports ouverts (ensemble vidé)"
nft flush set inet hakos ports_fermes
trois_ports ouvert ouvert

echo "Bilan : $REUSSIS contrôles réussis, $ECHECS échec(s)."
[ "$ECHECS" -eq 0 ]
