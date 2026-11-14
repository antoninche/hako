#!/bin/bash
# HakOS, étape 00-systeme : règles système des deux profils, puis verrouillage en prod.
# Lancé par build.sh de pi-gen dans le conteneur, depuis ce dossier ; ROOTFS_DIR est le système
# de l'étape maison. Les fichiers viennent du Mac par virtiofs (UID 501) : copie avec install -o root.
set -euo pipefail

erreur() {
	echo "Erreur (00-systeme) : $*" >&2
	exit 1
}

# on_chroot (fonction de pi-gen) n'est pas écrite pour « set -u » ni « pipefail » : CAPSH_ARG
# peut manquer et « mount | grep -q » peut finir en SIGPIPE. On l'appelle donc sans ces options.
dans_chroot() { (set +u +o pipefail; on_chroot "$@"); }

# Profil de la box, lu par le premier démarrage et le test sur la box.
install -d -o root -g root -m 755 "${ROOTFS_DIR}/opt/box"
printf '%s\n' "${HAKOS_PROFIL}" >"${ROOTFS_DIR}/opt/box/profil"
chown root:root "${ROOTFS_DIR}/opt/box/profil"
chmod 644 "${ROOTFS_DIR}/opt/box/profil"

# SSH : nos réglages dans sshd_config.d, que Debian lit avant le reste de sshd_config.
grep -q '^Include /etc/ssh/sshd_config.d/\*\.conf' "${ROOTFS_DIR}/etc/ssh/sshd_config" ||
	erreur "/etc/ssh/sshd_config ne lit plus /etc/ssh/sshd_config.d : 10-hakos.conf serait ignoré."
install -d -o root -g root -m 755 "${ROOTFS_DIR}/etc/ssh/sshd_config.d"
install -o root -g root -m 644 files/10-hakos.conf "${ROOTFS_DIR}/etc/ssh/sshd_config.d/10-hakos.conf"

# Mises à jour automatiques : seulement l'origine Debian-Security. Les dépôts Raspberry Pi et Docker
# ne sont pas mis à jour seuls (voir files/52hakos-securite).
install -o root -g root -m 644 files/52hakos-securite "${ROOTFS_DIR}/etc/apt/apt.conf.d/52hakos-securite"
AUTO="${ROOTFS_DIR}/etc/apt/apt.conf.d/20auto-upgrades"
if ! grep -q '^APT::Periodic::Update-Package-Lists "1";' "$AUTO" ||
	! grep -q '^APT::Periodic::Unattended-Upgrade "1";' "$AUTO"; then
	erreur "$AUTO n'active pas les mises à jour automatiques."
fi
# apt doit lire nos fichiers sans erreur et ne garder que Debian-Security.
origines="$(dans_chroot <<-'EOF'
	apt-config dump | grep '^Unattended-Upgrade::Origins-Pattern::' || true
EOF
)"
if [ -z "$origines" ] || grep -qv 'label=Debian-Security' <<<"$origines"; then
	erreur "unattended-upgrades n'est pas limité à Debian-Security : ${origines:-liste vide}"
fi

# Noyau du Pi 5 : la ligne kernel= ne vaut que dans la section [pi5].
CONFIG_TXT="${ROOTFS_DIR}/boot/firmware/config.txt"
[ -f "${ROOTFS_DIR}/boot/firmware/kernel8.img" ] ||
	erreur "kernel8.img absent de /boot/firmware : impossible de choisir le noyau à pages de 4 Kio."
if ! grep -q '^kernel=kernel8\.img$' "$CONFIG_TXT"; then
	cat >>"$CONFIG_TXT" <<-'EOF'

		# HakOS : sur Pi 5, noyau à pages mémoire de 4 Kio (kernel8.img) au lieu du noyau à pages
		# de 16 Kio (kernel_2712.img), par prudence pour les images Docker (jemalloc, Postgres,
		# Immich), prévues pour des pages de 4 Kio. Avec auto_initramfs=1, le firmware charge
		# alors initramfs8, créé à l'export comme initramfs_2712.
		[pi5]
		kernel=kernel8.img
		[all]
	EOF
fi

# cmdline.txt : contrôleur mémoire des cgroups pour Docker (limites de mémoire des conteneurs).
# Le fichier tient sur une seule ligne ; chaque paramètre n'est ajouté qu'une fois.
CMDLINE="${ROOTFS_DIR}/boot/firmware/cmdline.txt"
[ "$(grep -c '' "$CMDLINE")" -eq 1 ] || erreur "$CMDLINE devrait tenir sur une seule ligne."
for parametre in cgroup_enable=memory cgroup_memory=1; do
	if ! grep -qE "(^|[[:space:]])${parametre}([[:space:]]|\$)" "$CMDLINE"; then
		sed -i "1s/\$/ ${parametre}/" "$CMDLINE"
	fi
done

# avahi annonce hako.local ; rpi-connect-lite (accès à distance de Raspberry Pi) est retiré.
# Ses dépendances devenues inutiles partent à l'export (dist-upgrade --auto-remove --purge).
dans_chroot <<-'EOF'
	systemctl enable avahi-daemon
	apt-get purge -y rpi-connect-lite
EOF

# Profil prod : aucun accès. SSH masqué (le fichier « ssh » sur bootfs ne le rallume pas,
# sshswitch étant masqué lui aussi) et compte hako verrouillé. Le Wi-Fi et le Bluetooth restent actifs.
if [ "${HAKOS_PROFIL}" = prod ]; then
	[ ! -e "${ROOTFS_DIR}/home/${FIRST_USER_NAME}/.ssh/authorized_keys" ] ||
		erreur "une clé SSH est présente dans l'image prod (/home/${FIRST_USER_NAME}/.ssh/authorized_keys)."
	dans_chroot <<-EOF
		systemctl mask ssh.service ssh.socket sshswitch.service
		usermod -L "${FIRST_USER_NAME}"
	EOF
	grep -q "^${FIRST_USER_NAME}:!" "${ROOTFS_DIR}/etc/shadow" ||
		erreur "le compte ${FIRST_USER_NAME} n'est pas verrouillé."
fi
