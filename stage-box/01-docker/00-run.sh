#!/usr/bin/env bash
# Étape 01-docker : Docker Engine et le greffon compose, depuis le dépôt apt officiel de Docker
# pour Debian, comme le décrit https://docs.docker.com/engine/install/debian/ (Debian 13 trixie,
# arm64). Les services docker et containerd sont activés pour le démarrage de la box ; dockerd
# n'est jamais lancé dans le chroot.
#
# files/docker.asc : clé du dépôt, téléchargée depuis https://download.docker.com/linux/debian/gpg
# le 13 novembre 2026, empreinte vérifiée 9DC8 5822 9FC7 DD38 854A  E2D8 8D81 803C 0EBF CD88.
# files/daemon.json : rotation des journaux des conteneurs (3 fichiers de 10 Mo au plus).
set -euo pipefail

: "${ROOTFS_DIR:?variable de pi-gen absente}" "${RELEASE:?variable de pi-gen absente}" "${ARCH:?variable de pi-gen absente}"

# on_chroot (fonction de pi-gen) n'est pas écrite pour « set -u » ni « pipefail » : CAPSH_ARG
# peut manquer et « mount | grep -q » peut finir en SIGPIPE. On l'appelle donc sans ces options.
dans_chroot() { (set +u +o pipefail; on_chroot "$@"); }

install -d -o root -g root -m 0755 "${ROOTFS_DIR}/etc/apt/keyrings"
install -o root -g root -m 0644 files/docker.asc "${ROOTFS_DIR}/etc/apt/keyrings/docker.asc"

# Source apt au format deb822, avec la clé désignée par Signed-By.
SOURCE_APT="${ROOTFS_DIR}/etc/apt/sources.list.d/docker.sources"
cat >"$SOURCE_APT" <<EOF
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: ${RELEASE}
Components: stable
Architectures: ${ARCH}
Signed-By: /etc/apt/keyrings/docker.asc
EOF
chown root:root "$SOURCE_APT"
chmod 0644 "$SOURCE_APT"

# Paquets officiels, avec leurs recommandations comme dans la documentation de Docker
# (apparmor, pigz…). Dans le chroot, systemd ne tourne pas : les scripts des paquets
# activent les services sans les démarrer.
dans_chroot <<'EOF'
apt-get -o Acquire::Retries=3 update
apt-get -o Acquire::Retries=3 install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
EOF

if grep -qsxE 'dockerd|containerd' /proc/[0-9]*/comm; then
	echo "Erreur : dockerd ou containerd tourne pendant la construction, ce qui ne doit jamais arriver." >&2
	exit 1
fi

install -d -o root -g root -m 0755 "${ROOTFS_DIR}/etc/docker"
install -o root -g root -m 0644 files/daemon.json "${ROOTFS_DIR}/etc/docker/daemon.json"

# Activation explicite, puis versions installées pour le journal de construction
# (le dépôt de Docker livre sa dernière version du jour de la construction).
dans_chroot <<'EOF'
systemctl enable docker.service containerd.service
systemctl is-enabled docker.service containerd.service >/dev/null
docker --version
docker compose version
dpkg-query -W -f='${Package} ${Version}\n' docker-ce docker-ce-cli containerd.io docker-compose-plugin
EOF
