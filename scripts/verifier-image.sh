#!/usr/bin/env bash
# Vérifie une image HakOS construite, sans la démarrer. À lancer sur le Mac :
#   scripts/verifier-image.sh [deploy/image_AAAA-MM-JJ-hakos-PROFIL.img.xz]
#   make verifier-image [IMAGE=deploy/image_AAAA-MM-JJ-hakos-PROFIL.img.xz]
#
# Dans la VM Colima, en root, l'image est décompressée dans un dossier temporaire, attachée en
# lecture seule (losetup -r -P), et ses deux partitions sont montées en lecture seule. Une ligne
# « OK … » ou « ÉCHEC … » par contrôle, puis un bilan ; code de sortie 1 si un contrôle échoue.
# Démontage, losetup -d et suppression de l'image décompressée sont faits dans tous les cas, puis
# fstrim rend la place au Mac.
#
# Sans argument (make verifier-image), l'image vérifiée est la plus récente de deploy/.
#
# Le script se relance lui-même dans la VM (option interne --dans-la-vm) : le dépôt doit y être
# visible au même chemin, ce que fait le montage virtiofs de Colima pour le dossier personnel.
set -euo pipefail

RACINE="$(cd -- "$(dirname -- "$0")/.." && pwd)"
SCRIPT="$RACINE/scripts/verifier-image.sh"

erreur() {
	echo "Erreur : $*" >&2
	exit 1
}

# --- Côté Mac : contrôles préalables, puis relance dans la VM ---

if [ "${1:-}" != "--dans-la-vm" ]; then
	if [ "$#" -gt 1 ]; then
		echo "Usage : $0 [deploy/image_….img.xz]" >&2
		exit 2
	fi
	if [ "$#" -eq 0 ]; then
		recente=""
		for candidate in "$RACINE"/deploy/image_*-hakos-*.img.xz; do
			[ -f "$candidate" ] || continue
			if [ -z "$recente" ] || [ "$candidate" -nt "$recente" ]; then
				recente="$candidate"
			fi
		done
		[ -n "$recente" ] || erreur "aucune image HakOS dans deploy/ : la construire (make build-dev ou make build-prod) ou donner son chemin."
		echo "Image la plus récente de deploy/ : ${recente#"$RACINE"/}"
		set -- "$recente"
	fi
	[ -f "$1" ] || erreur "image introuvable : $1"
	case "$1" in
		*.img.xz) ;;
		*) erreur "l'image doit être un fichier .img.xz produit par la construction." ;;
	esac
	image="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
	case "$image$RACINE" in
		*[[:space:]]*) erreur "le chemin de l'image ou du dépôt contient une espace : cas non prévu." ;;
	esac
	for outil in colima xz; do
		command -v "$outil" >/dev/null 2>&1 || erreur "$outil introuvable."
	done
	colima status >/dev/null 2>&1 || erreur "la VM Colima ne tourne pas (colima start)."
	# Le dépôt et l'image doivent être visibles dans la VM au même chemin (montage virtiofs).
	if ! colima ssh -- test -r "$SCRIPT" || ! colima ssh -- test -r "$image"; then
		erreur "le dépôt n'est pas visible dans la VM Colima au chemin $RACINE (montage virtiofs du dossier personnel absent ?)."
	fi
	taille="$(xz --robot --list "$image" | awk '$1 == "totals" {print $5}')"
	[[ "$taille" =~ ^[0-9]+$ ]] || erreur "taille décompressée de l'image illisible."
	# colima ssh rend le code 1 en cas d'échec et ajoute une ligne « level=fatal » : on la retire.
	if colima ssh -- sudo -n bash "$SCRIPT" --dans-la-vm "$image" "$taille" 2> >(grep -v 'level=fatal msg="exit status' >&2); then
		exit 0
	fi
	exit 1
fi

# --- Dans la VM Colima, en root ---

image="$2"
taille="$3"
nom="$(basename "$image")"
[ "$(id -u)" -eq 0 ] || erreur "la vérification dans la VM doit tourner en root."
for outil in python3 losetup mount umount mountpoint udevadm dpkg-query apt-config sha256sum fstrim; do
	command -v "$outil" >/dev/null 2>&1 || erreur "$outil introuvable dans la VM."
done

travail=""
boucle=""
nettoyer() {
	set +e
	# Rien à défaire tant que le dossier de travail n'existe pas (et surtout pas « /boot » de la VM).
	[ -n "$travail" ] || return 0
	for point in "$travail/boot" "$travail/racine"; do
		if mountpoint -q "$point" 2>/dev/null; then
			umount "$point" 2>/dev/null || umount -l "$point"
		fi
	done
	[ -z "$boucle" ] || losetup -d "$boucle"
	rm -rf "$travail"
	fstrim -a >/dev/null 2>&1
}
trap nettoyer EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

libre=$(($(df -Pk /var/tmp | awk 'NR == 2 {print $4}') * 1024))
if [ "$libre" -lt $((taille + 1073741824)) ]; then
	erreur "place insuffisante dans la VM : $((libre / 1048576)) Mio libres dans /var/tmp, il en faut $((taille / 1048576 + 1024))."
fi
travail="$(mktemp -d /var/tmp/hakos-verif.XXXXXX)"

reussis=0
echecs=0
ok() {
	printf 'OK     %s\n' "$*"
	reussis=$((reussis + 1))
}
echec() {
	printf 'ÉCHEC  %s\n' "$*"
	echecs=$((echecs + 1))
}
# valeur CLÉ FICHIER : valeur de la dernière ligne CLÉ=… du fichier (vide si absente).
valeur() {
	awk -v cle="$1" 'index($0, cle "=") == 1 {v = substr($0, length(cle) + 2)} END {print v}' "$2" 2>/dev/null || true
}
# lien CHEMIN : cible du lien symbolique, vide si ce n'est pas un lien.
lien() {
	readlink "$1" 2>/dev/null || true
}
# montrer : chemins lus sur l'entrée, tels qu'ils seront sur la box, sur une seule ligne.
montrer() {
	sed -e "s#^$R##" -e "s#^$B#/boot/firmware#" | tr '\n' ' '
}

echo "Vérification de $nom ($((taille / 1048576)) Mio décompressée)."

dossier="$(dirname "$image")"
ligne="$(awk -v n="$nom" '$2 == n || $2 == "*" n' "$dossier/SHA256SUMS" 2>/dev/null || true)"
if [ -n "$ligne" ] && (cd "$dossier" && printf '%s\n' "$ligne" | sha256sum -c --status -); then
	ok "empreinte de $nom conforme à SHA256SUMS"
else
	echec "empreinte de $nom absente de SHA256SUMS ou fausse"
fi

# xz n'est pas installé dans la VM Colima : le module lzma de Python le remplace.
echo "Décompression dans la VM…"
if ! python3 -I - "$image" "$travail/image.img" <<'FIN'
import lzma, shutil, sys
with lzma.open(sys.argv[1]) as entree, open(sys.argv[2], "xb") as sortie:
    shutil.copyfileobj(entree, sortie, 8 << 20)
FIN
then
	erreur "décompression impossible : image abîmée ou place insuffisante dans la VM."
fi
boucle="$(losetup -r -P --show -f "$travail/image.img")"
udevadm settle 2>/dev/null || true
[ -b "${boucle}p1" ] && [ -b "${boucle}p2" ] || erreur "partitions de l'image introuvables sur $boucle."
B="$travail/boot"
R="$travail/racine"
mkdir "$B" "$R"
mount -t vfat -o ro "${boucle}p1" "$B"
mount -t ext4 -o ro,noload "${boucle}p2" "$R"

# --- Identité ---

hote="$(cat "$R/etc/hostname" 2>/dev/null || true)"
if [ "$hote" = hako ]; then
	ok "nom d'hôte hako"
else
	echec "nom d'hôte « $hote », attendu hako"
fi

shopt -s nullglob
cles_hote=("$R"/etc/ssh/ssh_host_*_key)
shopt -u nullglob
if [ "$(cat "$R/etc/machine-id" 2>/dev/null)" = uninitialized ] && [ "${#cles_hote[@]}" -eq 0 ]; then
	ok "identité vierge : machine-id « uninitialized », aucune clé d'hôte SSH (tirées au premier démarrage)"
else
	echec "identité commune à toutes les box : machine-id « $(cat "$R/etc/machine-id" 2>/dev/null) », ${#cles_hote[@]} clé(s) d'hôte SSH"
fi

profil="$(cat "$R/opt/box/profil" 2>/dev/null || true)"
case "$profil" in
	dev | prod)
		if [[ "$nom" == *hakos* && "$nom" == *"$profil"* ]]; then
			ok "profil $profil, conforme au nom de l'image"
		else
			echec "profil $profil, mais le nom de l'image ($nom) ne contient pas « hakos » et « $profil »"
		fi
		;;
	*) echec "/opt/box/profil absent ou illisible : « $profil »" ;;
esac

# --- /opt/box ---

boite="$R/opt/box"
manque=""
for chemin in home immich nextcloud images lib firstboot.sh test-sur-boitier.sh versions.env \
	home/docker-compose.yml home/env.modele immich/docker-compose.yml immich/env.modele \
	immich/config/immich-sans-ml.json nextcloud/docker-compose.yml nextcloud/env.modele; do
	[ -e "$boite/$chemin" ] || manque="$manque $chemin"
done
if [ -z "$manque" ]; then
	ok "/opt/box complet : dossiers, compose et env.modele des trois services"
else
	echec "/opt/box incomplet, manque :$manque"
fi

droits=""
for script in firstboot.sh test-sur-boitier.sh essai-assistant.py lib/phase.sh assistant/assistant.py; do
	droits="$droits $(stat -c '%a' "$boite/$script" 2>/dev/null || echo absent)"
done
if [ "$droits" = " 755 755 755 755 755" ]; then
	ok "firstboot.sh, test-sur-boitier.sh, essai-assistant.py, lib/phase.sh et assistant/assistant.py exécutables (0755)"
else
	echec "droits de firstboot.sh, test-sur-boitier.sh, essai-assistant.py, lib/phase.sh, assistant/assistant.py :$droits (attendu 755)"
fi

# --- Assistant de première installation (lot 5) ---

manque=""
for chemin in assistant/assistant.py assistant/comptes.py assistant/foyer.py assistant/installation.py \
	parefeu/hakos.nft home/nginx/defaut.conf home/nginx/accueil.conf home/nginx/assistant.conf \
	home/nginx/photos.conf home/nginx/entetes-page.conf home/assistant/index.html; do
	[ -s "$boite/$chemin" ] || manque="$manque $chemin"
done
mots="$(grep -cE '^[a-z]{4,8}$' "$boite/assistant/mots.txt" 2>/dev/null || echo 0)"
if [ -z "$manque" ] && [ "$mots" = 4096 ] && [ "$(sort -u "$boite/assistant/mots.txt" | wc -l)" = 4096 ]; then
	ok "assistant complet : service, pare-feu, nginx, page de la HAKO, liste de 4 096 mots distincts"
else
	echec "assistant incomplet : manque${manque:- rien}, liste de mots : $mots mot(s) valable(s) sur 4096"
fi
if cmp -s <(cd "$boite/home/assistant" && find . -type f -print0 | sort -z | xargs -0 sha256sum) \
	<(cd "$RACINE/rootfs/opt/box/home/assistant" && find . -type f ! -name .DS_Store -print0 | sort -z | xargs -0 sha256sum); then
	ok "page de la HAKO identique à celle du dépôt (commit $(valeur HAKO_SITE_COMMIT "$boite/versions.env" | cut -c 1-7) de hako-site)"
else
	echec "page de la HAKO (/opt/box/home/assistant) différente de celle du dépôt"
fi
if grep -q "^127.0.0.1:12283:2283" <(sed -n "s/^ *- '\(.*\)'$/\1/p" "$boite/immich/docker-compose.yml") &&
	grep -q '^    network_mode: host$' "$boite/home/docker-compose.yml"; then
	ok "Immich publié sur 127.0.0.1:12283 seulement, nginx de l'accueil sur le réseau de la box"
else
	echec "ports : Immich pas limité à 127.0.0.1:12283, ou nginx de l'accueil hors du réseau de la box"
fi
if [ ! -e "$R/var/lib/hakos/installee" ]; then
	ok "aucun marqueur d'installation (/var/lib/hakos/installee)"
else
	echec "/var/lib/hakos/installee est dans l'image : l'assistant ne tournerait jamais, les ports seraient ouverts"
fi

etranger="$(find "$boite" \( ! -uid 0 -o ! -gid 0 \) -print 2>/dev/null | head -n 3 || true)"
if [ ! -d "$boite" ]; then
	echec "/opt/box absent"
elif [ -z "$etranger" ]; then
	ok "tout /opt/box appartient à root"
else
	echec "fichiers de /opt/box hors de root (UID du Mac recopié ?) : $(montrer <<<"$etranger")"
fi

if cmp -s "$boite/versions.env" "$RACINE/versions.env"; then
	ok "/opt/box/versions.env identique au versions.env du dépôt"
else
	echec "/opt/box/versions.env absent ou différent du versions.env du dépôt"
fi

# Une archive par image figée : étiquettes et architecture lues dans le manifest.json de chaque
# archive « docker save ».
attendues=""
if [ -f "$boite/versions.env" ]; then
	immich="$(valeur IMMICH_VERSION "$boite/versions.env")"
	for ref in "ghcr.io/immich-app/immich-server:$immich" "ghcr.io/immich-app/immich-machine-learning:$immich" \
		"$(valeur IMMICH_VALKEY_IMAGE "$boite/versions.env")" "$(valeur IMMICH_POSTGRES_IMAGE "$boite/versions.env")" \
		"$(valeur NEXTCLOUD_IMAGE "$boite/versions.env")" "$(valeur NEXTCLOUD_POSTGRES_IMAGE "$boite/versions.env")" \
		"$(valeur NGINX_IMAGE "$boite/versions.env")"; do
		# docker save écrit les noms courts : sans « docker.io/ » ni « library/ ».
		ref="${ref#docker.io/}"
		attendues="$attendues ${ref#library/}"
	done
fi
contenu="$(python3 -I - "$boite/images" <<'FIN' || true
import json, pathlib, sys, tarfile
for chemin in sorted(pathlib.Path(sys.argv[1]).glob("*.tar")):
    try:
        with tarfile.open(chemin) as archive:
            manifeste = json.load(archive.extractfile("manifest.json"))
            for entree in manifeste:
                config = json.load(archive.extractfile(entree["Config"]))
                for etiquette in entree.get("RepoTags") or ["(sans-étiquette)"]:
                    etiquette = etiquette.removeprefix("docker.io/").removeprefix("library/")
                    print(chemin.name, etiquette, config.get("architecture", "?"))
    except Exception as exc:
        print(chemin.name, "(illisible)", type(exc).__name__)
FIN
)"
archives="$(find "$boite/images" -maxdepth 1 -name '*.tar' 2>/dev/null | wc -l || true)"
probleme=""
for ref in $attendues; do
	trouve="$(awk -v r="$ref" '$2 == r {print $3; exit}' <<<"$contenu")"
	[ "$trouve" = arm64 ] || probleme="$probleme $ref(${trouve:-absente})"
done
if [ -n "$attendues" ] && [ -z "$probleme" ] && [ "$archives" -eq "$(wc -w <<<"$attendues")" ]; then
	ok "$archives archives d'images, une par image figée, toutes en arm64"
else
	[ -n "$probleme" ] || probleme=" nombre d'archives différent du nombre d'images figées"
	echec "archives d'images : $archives fichier(s) .tar, problème(s) :$probleme"
fi

# --- Services systemd et paquets ---

voulus="$R/etc/systemd/system/multi-user.target.wants"
inactives=""
for unite in hakos-premier-demarrage.service docker.service avahi-daemon.service; do
	[ -n "$(lien "$voulus/$unite")" ] || inactives="$inactives $unite"
done
if [ -f "$R/etc/systemd/system/hakos-premier-demarrage.service" ] && [ -z "$inactives" ]; then
	ok "hakos-premier-demarrage.service, docker.service et avahi-daemon.service activés"
else
	echec "unité absente de /etc/systemd/system ou non activée (multi-user.target.wants) :${inactives:- hakos-premier-demarrage.service}"
fi
if [ -f "$R/etc/systemd/system/hakos-parefeu.service" ] && [ -f "$R/usr/lib/systemd/system/hakos-assistant.service" ] &&
	[ -n "$(lien "$voulus/hakos-parefeu.service")" ] && [ -n "$(lien "$voulus/hakos-assistant.service")" ] &&
	[ -n "$(lien "$R/etc/systemd/system/docker.service.requires/hakos-parefeu.service")" ] &&
	[ -f "$R/etc/tmpfiles.d/hakos.conf" ]; then
	ok "hakos-parefeu (requis par docker) et hakos-assistant activés, dossiers de l'assistant (tmpfiles.d)"
else
	echec "hakos-parefeu, hakos-assistant ou /etc/tmpfiles.d/hakos.conf absent ou non activé"
fi
compte="$(grep '^hakos-assistant:' "$R/etc/passwd" 2>/dev/null | cut -d: -f7)"
if [ "$compte" = /usr/sbin/nologin ] && grep -Eq '^docker:[^:]*:[0-9]+:(.*,)?hakos-assistant(,|$)' "$R/etc/group"; then
	ok "utilisateur hakos-assistant : sans connexion, dans le groupe docker"
else
	echec "utilisateur hakos-assistant absent, avec un shell (« $compte »), ou hors du groupe docker"
fi

etat_paquet() {
	dpkg-query --admindir="$R/var/lib/dpkg" -W -f='${db:Status-Status}' "$1" 2>/dev/null || echo absent
}
etats="$(etat_paquet docker-ce) $(etat_paquet docker-compose-plugin) $(etat_paquet nftables) $(etat_paquet python3)"
if [ "$etats" = "installed installed installed installed" ]; then
	ok "paquets docker-ce, docker-compose-plugin, nftables et python3 installés"
else
	echec "docker-ce, docker-compose-plugin, nftables et python3 : $etats"
fi
connect="$(etat_paquet rpi-connect-lite)"
case "$connect" in
	absent | not-installed) ok "rpi-connect-lite absent" ;;
	*) echec "rpi-connect-lite encore là : $connect" ;;
esac

# --- SSH et compte ---

sshd="$R/etc/ssh/sshd_config.d/10-hakos.conf"
if [ -f "$sshd" ] && grep -qix 'PasswordAuthentication no' "$sshd"; then
	ok "sshd : 10-hakos.conf présent, mot de passe refusé"
else
	echec "sshd : /etc/ssh/sshd_config.d/10-hakos.conf absent ou sans « PasswordAuthentication no »"
fi

cles="$R/home/hako/.ssh/authorized_keys"
case "$profil" in
	dev)
		if [ -s "$cles" ] && [ -n "$(lien "$voulus/ssh.service")" ]; then
			ok "profil dev : SSH activé, authorized_keys de hako présent"
		else
			echec "profil dev : authorized_keys de hako absent ou ssh.service non activé"
		fi
		;;
	prod)
		masques=""
		for unite in ssh.service ssh.socket sshswitch.service; do
			[ "$(lien "$R/etc/systemd/system/$unite")" = /dev/null ] || masques="$masques $unite"
		done
		mot_de_passe="$(awk -F: '$1 == "hako" {print $2}' "$R/etc/shadow" 2>/dev/null || true)"
		if [ -z "$masques" ] && [[ "$mot_de_passe" == '!'* ]] && [ ! -e "$cles" ]; then
			ok "profil prod : ssh.service, ssh.socket et sshswitch.service masqués, compte hako verrouillé, aucune clé"
		else
			echec "profil prod : non masqué(s) :${masques:- aucun} ; compte hako $([[ "$mot_de_passe" == '!'* ]] && echo verrouillé || echo 'NON verrouillé') ; authorized_keys $([ -e "$cles" ] && echo présent || echo absent)"
		fi
		;;
esac

# --- Mises à jour ---

# Réglages apt de l'image, lus par apt-config de la VM : APT_CONFIG désigne son dossier /etc/apt.
printf 'Dir::Etc "%s/etc/apt/";\n' "$R" >"$travail/apt.conf"
reglages="$(APT_CONFIG="$travail/apt.conf" apt-config dump 2>/dev/null || true)"
origines="$(sed -n 's/^Unattended-Upgrade::Origins-Pattern:: "\(.*\)";$/\1/p' <<<"$reglages")"
minuterie="$(lien "$R/etc/systemd/system/timers.target.wants/apt-daily-upgrade.timer")"
if [ "$(etat_paquet unattended-upgrades)" = installed ] && grep -qx 'APT::Periodic::Unattended-Upgrade "1";' <<<"$reglages" &&
	[ -n "$origines" ] && ! grep -qvi security <<<"$origines" && [ -n "$minuterie" ]; then
	ok "unattended-upgrades installé et activé, limité aux correctifs de sécurité Debian"
else
	[ -n "$minuterie" ] && minuterie=activée || minuterie=inactive
	echec "unattended-upgrades : paquet « $(etat_paquet unattended-upgrades) », minuterie apt-daily-upgrade $minuterie, origines : $(tr '\n' ' ' <<<"$origines")"
fi

# --- Démarrage ---

if awk '/^\[/ {section = $0} section == "[pi5]" && $0 == "kernel=kernel8.img" {trouve = 1} END {exit !trouve}' "$B/config.txt" &&
	[ -f "$B/kernel8.img" ] && [ -f "$B/initramfs8" ]; then
	ok "config.txt : noyau à pages de 4 Kio (kernel8.img) sur Pi 5, avec son initramfs"
else
	echec "config.txt : « kernel=kernel8.img » absent de la section [pi5], ou kernel8.img / initramfs8 absent de bootfs"
fi

ligne_commande="$(cat "$B/cmdline.txt" 2>/dev/null || true)"
if [ "$(wc -l <"$B/cmdline.txt" 2>/dev/null)" = 1 ] && [[ " $ligne_commande " == *" cgroup_enable=memory "* ]] &&
	[[ " $ligne_commande " == *" cgroup_memory=1 "* ]] && [[ " $ligne_commande " == *" resize "* ]]; then
	ok "cmdline.txt : une ligne, cgroup memory activé, agrandissement au premier démarrage gardé"
else
	echec "cmdline.txt : « $ligne_commande »"
fi

# --- Réseau ---

actives="$(grep -hvE '^[[:space:]]*(#|$)' "$B/network-config" "$B/user-data" 2>/dev/null || true)"
connexions="$(find "$R/etc/NetworkManager/system-connections" -type f 2>/dev/null | wc -l || true)"
if [ -z "$actives" ] && [ "$connexions" -eq 0 ]; then
	ok "aucun réseau préconfiguré : NetworkManager vide, user-data et network-config de bootfs sans ligne active"
else
	echec "réseau préconfiguré : $connexions connexion(s) NetworkManager, lignes actives dans bootfs : $(tr '\n' ' ' <<<"$actives")"
fi

# --- Secrets ---

fichiers_env="$(find "$R" "$B" -name '.env' -print 2>/dev/null | head -n 3 || true)"
if [ -z "$fichiers_env" ]; then
	ok "aucun fichier .env dans l'image"
else
	echec "fichier(s) .env dans l'image : $(montrer <<<"$fichiers_env")"
fi

# fouiller [CHEMIN_EXCLU] -- OPTIONS… : fichiers texte de l'image qui correspondent à la recherche
# grep. Les archives de /opt/box/images viennent des éditeurs des logiciels : jamais fouillées.
fouiller() {
	local exclu="$R/opt/box/images"
	if [ "$1" != "--" ]; then
		exclu="$1"
		shift
	fi
	shift
	find "$R" "$B" \( -path "$R/opt/box/images" -o -path "$exclu" \) -prune -o -type f -print0 2>/dev/null |
		xargs -0 -r grep -lI "$@" 2>/dev/null || true
}
# /usr ne contient que les fichiers des paquets Debian, dont des clés d'exemple et de test
# (documentation de cloud-init, tests de pycryptodome) : il n'est pas fouillé pour les clés.
# Le motif est écrit « PRIVATE[ ]KEY » pour que make lint ne le prenne pas pour une clé.
cles_privees="$(fouiller "$R/usr" -- -E -e '-----BEGIN ([A-Z0-9]+ )*PRIVATE[ ]KEY-----' |
	grep -vE "^$R/etc/ssh/ssh_host_[a-z0-9]+_key$" | head -n 5 || true)"
if [ -z "$cles_privees" ]; then
	ok "aucune clé privée dans l'image (hors clés d'hôte SSH)"
else
	echec "clé(s) privée(s) dans l'image : $(montrer <<<"$cles_privees")"
fi

traces="$(fouiller -- -F -e FIRST_USER_PASS -e PUBKEY_SSH_FIRST_USER -e "$RACINE/local" | head -n 5 || true)"
traces="$traces$(find "$R" "$B" \( -name pigen.conf -o -name mot-de-passe-dev -o -name cles-ssh-dev.pub \) -print 2>/dev/null | head -n 5 || true)"
if [ -z "$traces" ]; then
	ok "aucune trace de local/ (chemin, variables de configuration, noms de fichiers)"
else
	echec "traces de local/ dans l'image : $(montrer <<<"$traces")"
fi

echo
if [ "$echecs" -eq 0 ]; then
	echo "Bilan : $reussis contrôles réussis, aucun échec."
else
	echo "Bilan : $echecs échec(s) sur $((reussis + echecs)) contrôles."
	exit 1
fi
