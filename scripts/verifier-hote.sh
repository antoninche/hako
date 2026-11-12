#!/usr/bin/env bash
# Vérifie que la machine peut construire l'image MaBox OS.
# Lecture seule : ce script ne modifie rien. Code de sortie 1 si un point bloque.
set -uo pipefail

# Pic mesuré au lot 0 : environ 12 Gio sur le Mac et 9 Gio dans la VM, rendus ensuite par fstrim.
PLACE_MINI_GIO=20
PLACE_VM_MINI_GIO=15
bloquants=0
ok() { printf '  [ok]  %s\n' "$1"; }
ko() { printf '  [KO]  %s\n' "$1"; bloquants=$((bloquants + 1)); }
info() { printf '  [..]  %s\n' "$1"; }

echo "Machine"
arch="$(uname -m)"
case "$arch" in
	arm64 | aarch64) ok "processeur ARM 64 bits ($arch) : construction native, sans émulation" ;;
	*) ko "processeur $arch : il faudrait émuler l'ARM avec qemu, beaucoup trop lent" ;;
esac
if [ "$(uname -s)" = "Darwin" ]; then
	ram_gio=$(($(sysctl -n hw.memsize) / 1073741824))
else
	ram_gio=$(($(awk '/MemTotal/ {print $2}' /proc/meminfo) / 1048576))
fi
info "mémoire : $ram_gio Gio"
libre_gio=$(($(df -Pk "$HOME" | awk 'NR == 2 {print $4}') / 1048576))
if [ "$libre_gio" -ge "$PLACE_MINI_GIO" ]; then
	ok "place libre : $libre_gio Gio"
else
	ko "place libre : $libre_gio Gio, il en faut au moins $PLACE_MINI_GIO"
fi

echo "Outils"
for outil in git docker xz curl; do
	if command -v "$outil" >/dev/null 2>&1; then ok "$outil"; else ko "$outil introuvable"; fi
done

echo "Docker"
if docker_info="$(docker info --format '{{.OSType}}/{{.Architecture}}|{{.NCPU}}|{{.MemTotal}}|{{.ServerVersion}}' 2>/dev/null)"; then
	IFS='|' read -r plateforme ncpu mem version <<<"$docker_info"
	case "$plateforme" in
		linux/aarch64 | linux/arm64) ok "moteur Docker $version en $plateforme, $ncpu CPU, $((mem / 1073741824)) Gio" ;;
		*) ko "moteur Docker en $plateforme : il faut un moteur Linux ARM 64 bits" ;;
	esac
else
	ko "Docker ne répond pas (sur Mac : « colima start »)"
fi
if command -v colima >/dev/null 2>&1 && colima status >/dev/null 2>&1; then
	vm_libre_kio="$(colima ssh -- df -Pk /var/lib/docker 2>/dev/null | awk 'NR == 2 {print $4}')"
	if [[ "$vm_libre_kio" =~ ^[0-9]+$ ]] && [ $((vm_libre_kio / 1048576)) -ge "$PLACE_VM_MINI_GIO" ]; then
		ok "place libre dans la VM Colima : $((vm_libre_kio / 1048576)) Gio"
	else
		ko "place libre dans la VM Colima insuffisante ou illisible (il faut $PLACE_VM_MINI_GIO Gio)"
	fi
	boucles="$(colima ssh -- sudo -n losetup -a 2>/dev/null | wc -l | tr -d ' ')"
	if [ "$boucles" = "0" ]; then
		ok "aucun périphérique loop occupé dans la VM"
	else
		ko "périphériques loop occupés dans la VM (construction interrompue ?) : « colima restart », hors construction"
	fi
fi
if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx pigen_work; then
	ko "le conteneur pigen_work existe déjà : « docker rm -v pigen_work »"
fi

echo "Réseau"
for url in https://github.com https://archive.raspberrypi.com/debian/ https://deb.debian.org/debian/ https://registry-1.docker.io/v2/; do
	code="$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$url" || true)"
	case "$code" in
		2?? | 3?? | 401) ok "$url" ;;
		*) ko "$url injoignable (code $code)" ;;
	esac
done

if [ "$bloquants" -eq 0 ]; then
	echo "Tout est prêt pour construire."
else
	echo "$bloquants point(s) bloquant(s)."
	exit 1
fi
