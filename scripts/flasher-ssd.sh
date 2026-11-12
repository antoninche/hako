#!/usr/bin/env bash
# Écrit une image MaBox OS sur un SSD branché au Mac (boîtier USB), avec garde-fous :
# - l'image doit avoir l'empreinte attendue (fichier SHA256SUMS de son dossier) ;
# - le disque doit être un disque entier, externe et physique, jamais celui du Mac, et sans
#   partition Apple (APFS, HFS+) : un tel disque est un disque de Mac ou de sauvegarde Time Machine ;
# - il faut retaper l'identifiant du disque pour confirmer, et le disque est revérifié juste avant
#   l'écriture (débranché ou remplacé pendant la confirmation : abandon) ;
# - le premier Mio de l'image (table MBR) est d'abord écrit à zéro : sans table de partitions, macOS
#   ne monte pas bootfs pendant l'écriture. TOUTE l'image est alors relue et comparée, partition de
#   démarrage comprise, puis le premier Mio est écrit et relu en dernier.
#
# Usage : scripts/flasher-ssd.sh [--simulation] <image.img.xz> <diskN>
#   --simulation : fait toutes les vérifications et affiche ce qui serait fait, sans rien écrire.
# Pour trouver diskN : « diskutil list external physical » avant puis après avoir branché le SSD.
set -euo pipefail

MIO=1048576

usage() {
	echo "Usage : $0 [--simulation] <image.img.xz> <diskN>" >&2
	exit 2
}
erreur() {
	echo "Erreur : $*" >&2
	exit 1
}

simulation=0
if [ "${1:-}" = "--simulation" ]; then
	simulation=1
	shift
fi
[ "$#" -eq 2 ] || usage
image="$1"
disque="${2#/dev/}"
cible="/dev/r$disque"

[ "$(uname -s)" = "Darwin" ] || erreur "ce script est fait pour macOS."
[[ "$disque" =~ ^disk[0-9]+$ ]] || erreur "donner un disque entier, par exemple disk4 (pas disk4s1 ni rdisk4)."
[ -f "$image" ] || erreur "image introuvable : $image"
case "$image" in
	*.img.xz) ;;
	*) erreur "l'image doit être un fichier .img.xz produit par la construction." ;;
esac
for outil in diskutil plutil xz shasum od mktemp; do
	command -v "$outil" >/dev/null 2>&1 || erreur "$outil introuvable."
done
# Chemin absolu : sous sudo, un autre « dd » du PATH (GNU coreutils) refuserait bs=4m.
[ -x /bin/dd ] || erreur "/bin/dd introuvable."

ecriture=0
temp="$(mktemp -d "${TMPDIR:-/tmp}/mabox-flash.XXXXXX")"
fin() {
	code=$?
	rm -rf "$temp"
	if [ "$code" -ne 0 ] && [ "$ecriture" -eq 1 ]; then
		echo "Écriture inachevée : le SSD est inutilisable en l'état, relancer le script." >&2
	fi
}
trap fin EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

dossier="$(cd "$(dirname "$image")" >/dev/null && pwd)"
nom="$(basename "$image")"

echo "1/5 Empreinte de l'image"
[ -f "$dossier/SHA256SUMS" ] || erreur "SHA256SUMS absent de $dossier."
ligne="$(awk -v n="$nom" '$2 == n || $2 == "*" n' "$dossier/SHA256SUMS")"
[ -n "$ligne" ] || erreur "$nom n'est pas listé dans SHA256SUMS."
(cd "$dossier" && printf '%s\n' "$ligne" | shasum -a 256 -c -) || erreur "empreinte fausse : image abîmée ou modifiée."

taille="$(xz --robot --list "$image" | awk '$1 == "totals" {print $5}')"
[[ "$taille" =~ ^[0-9]+$ ]] && [ "$taille" -ge $((2 * MIO)) ] && [ $((taille % MIO)) -eq 0 ] ||
	erreur "taille décompressée illisible ou non multiple de 1 Mio : cas non prévu."

# Premier Mio de l'image, table MBR comprise : il sera écrit en dernier, après la relecture.
# pipefail est coupé dans ce sous-shell : head ferme le tube avant la fin de xz, c'est voulu.
(
	set +o pipefail
	xz -dc "$image" | head -c "$MIO" >"$temp/debut.bin"
)
[ "$(wc -c <"$temp/debut.bin" | tr -d ' ')" -eq "$MIO" ] || erreur "début de l'image illisible."
mbr="$(head -c 512 "$temp/debut.bin" | od -An -v -tx1 | tr -d ' \n')"
[ "${#mbr}" -eq 1024 ] && [ "${mbr:1020:4}" = "55aa" ] || erreur "l'image ne commence pas par une table MBR valide."
le32() { echo $((16#${1:6:2}${1:4:2}${1:2:2}${1:0:2})); }
for i in 0 1 2 3; do
	[ "${mbr:$((900 + 32 * i)):2}" = "00" ] || [ "$(le32 "${mbr:$((908 + 32 * i)):8}")" -ge 2048 ] ||
		erreur "une partition de l'image commence dans le premier Mio : cas non prévu."
done

cle() { printf '%s' "$info" | plutil -extract "$1" raw -o - - 2>/dev/null || echo "?"; }
verifier_disque() {
	externes="$(diskutil list -plist external physical | plutil -extract WholeDisks json -o - -)" ||
		erreur "liste des disques externes illisible."
	case "$externes" in
		*"\"$disque\""*) ;;
		*) erreur "/dev/$disque n'est pas un disque externe physique (voir « diskutil list external physical »)." ;;
	esac
	info="$(diskutil info -plist "$disque")" || erreur "disque $disque inconnu."
	[ "$(cle Internal)" = "false" ] || erreur "/dev/$disque est un disque interne : refusé."
	[ "$(cle WholeDisk)" = "true" ] || erreur "/dev/$disque n'est pas un disque entier."
	[ "$(cle VirtualOrPhysical)" != "Virtual" ] || erreur "/dev/$disque est un disque virtuel : refusé."
	[ "$(cle DeviceBlockSize)" = "512" ] || erreur "/dev/$disque a des secteurs de $(cle DeviceBlockSize) octets, l'image suppose 512 : cas non prévu."
	# Le volume / est dans un conteneur APFS synthétisé (disk3 sur un Mac Apple Silicon) : il faut
	# remonter à ses disques physiques (APFSPhysicalStores), sinon ce contrôle ne protège rien.
	magasins="$(diskutil info -plist / | plutil -extract APFSPhysicalStores json -o - - | grep -o 'disk[0-9][0-9s]*')" ||
		erreur "disque système du Mac introuvable."
	for magasin in $magasins; do
		parent="$(diskutil info -plist "$magasin" | plutil -extract ParentWholeDisk raw -o - -)" ||
			erreur "disque système du Mac introuvable."
		[ "$disque" != "$parent" ] || erreur "/dev/$disque porte le système du Mac : refusé."
	done
	# Partitions Apple (APFS, HFS+) : disque de Mac ou de sauvegarde Time Machine, jamais le SSD d'une
	# box. Les noms de leurs volumes n'apparaissent pas dans « diskutil list diskN ».
	partitions="$(diskutil list -plist "$disque" | plutil -convert json -o - -)" || erreur "partitions de $disque illisibles."
	case "$partitions" in
		*'"Content":"Apple_'*) erreur "/dev/$disque contient des partitions Apple (APFS ou HFS+) : disque de Mac ou de sauvegarde Time Machine ? Refusé. Si c'est bien le SSD de la box, l'effacer d'abord en ExFAT dans Utilitaire de disque, puis relancer." ;;
	esac
	capacite="$(cle TotalSize)"
	[[ "$capacite" =~ ^[0-9]+$ ]] || erreur "taille du disque illisible."
	[ "$capacite" -ge "$taille" ] || erreur "disque trop petit ($capacite octets) pour l'image ($taille octets)."
	identite="$(cle MediaName) | $capacite octets | $(cle BusProtocol) | $(cle IORegistryEntryName)"
}

echo "2/5 Disque /dev/$disque"
verifier_disque
identite_verifiee="$identite"

echo "3/5 Confirmation"
diskutil list "/dev/$disque"
printf 'Modèle : %s | Taille : %s Go | Liaison : %s\n' "$(cle MediaName)" "$((capacite / 1000000000))" "$(cle BusProtocol)"
echo "TOUT le contenu de /dev/$disque va être effacé et remplacé par $nom."
if [ "$simulation" -eq 1 ]; then
	echo "Simulation : rien n'est écrit. Voici ce qui serait lancé :"
	echo "  diskutil unmountDisk /dev/$disque"
	echo "  image avec son premier Mio à zéro | sudo /bin/dd of=$cible bs=4m iflag=fullblock status=progress"
	echo "  relecture et comparaison des $((taille / MIO)) Mio écrits"
	echo "  écriture puis relecture du premier Mio (table MBR)"
	echo "  diskutil eject /dev/$disque"
	exit 0
fi
read -r -p "Pour confirmer, tapez exactement $disque : " reponse </dev/tty
[ "$reponse" = "$disque" ] || {
	echo "Abandon : rien n'a été écrit."
	exit 1
}

echo "4/5 Écriture (quelques minutes ; macOS demande le mot de passe administrateur)"
sudo -v
# Le SSD a pu être débranché ou remplacé pendant la confirmation : on revérifie juste avant d'écrire.
verifier_disque
[ "$identite" = "$identite_verifiee" ] || erreur "/dev/$disque n'est plus le disque vérifié ($identite) : rien n'a été écrit."
diskutil unmountDisk "/dev/$disque"
ecriture=1
# Flux écrit : l'image avec son premier Mio remplacé par des zéros. Sur un tube, « dd skip » lit
# exactement le bon nombre d'octets, environ dix fois plus vite que « tail -c +N » de macOS.
flux() {
	head -c "$MIO" /dev/zero
	xz -dc "$image" | /bin/dd bs=1m skip=1 status=none
}
flux | sudo /bin/dd of="$cible" bs=4m iflag=fullblock status=progress
echo "Si macOS affiche « disque illisible », cliquer sur « Ignorer »."

echo "5/5 Relecture"
attendu="$(flux | shasum -a 256 | awk '{print $1}')"
lu="$(sudo /bin/dd if="$cible" bs=1m count=$((taille / MIO)) status=none | shasum -a 256 | awk '{print $1}')"
[ "$lu" = "$attendu" ] || erreur "l'image relue ne correspond pas à l'image écrite (SSD ou adaptateur défaillant ?)."
# Table de partitions en dernier : macOS montera bootfs juste après, la relecture est déjà faite.
sudo /bin/dd if="$temp/debut.bin" of="$cible" bs=1m count=1 conv=notrunc status=none
debut_lu="$(sudo /bin/dd if="$cible" bs=1m count=1 status=none | shasum -a 256 | awk '{print $1}')"
[ "$debut_lu" = "$(shasum -a 256 <"$temp/debut.bin" | awk '{print $1}')" ] || erreur "la table de partitions relue ne correspond pas à l'image."
ecriture=0
echo "Relecture conforme : toute l'image a été relue, partition de démarrage comprise."

diskutil eject "/dev/$disque" || echo "macOS refuse l'éjection : éjecter le SSD dans le Finder avant de le débrancher." >&2
echo "Terminé : le SSD peut être monté sur le Pi. Ne rien ajouter dans la partition « bootfs »."
