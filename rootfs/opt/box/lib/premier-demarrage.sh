# shellcheck shell=bash
#
# HakOS : étapes du premier démarrage, appelées dans l'ordre par /opt/box/firstboot.sh.
# À charger après lib/commun.sh. Chaque fonction s'arrête par « echec » au premier problème.

ETAPE="vérifications"
PROFIL=""
MEMOIRE_KIO=""
ML_ACTIF=""
LIGNES_ML=()

# etape N TITRE : annonce une étape dans le journal.
etape() {
	ETAPE=$2
	journal "Étape $1/8 : $2"
}

# fin_premier_demarrage : appelée à la sortie du script (trap EXIT), explique un échec.
# Rien à ajouter quand la box est déjà initialisée : le refus de verifier_conditions suffit.
fin_premier_demarrage() {
	local code=$?
	if [ "$code" -ne 0 ] && [ ! -e "$HAKOS_BOITE/.initialized" ]; then
		echo "Erreur : premier démarrage interrompu à l'étape « $ETAPE » (code $code). La box n'est pas marquée comme initialisée." >&2
		if [ "$HAKOS_ESSAI" = 1 ]; then
			echo "Après correction, relancer le script : les .env déjà créés sont gardés." >&2
		else
			echo "Après correction, relancer : systemctl start hakos-premier-demarrage (les .env déjà créés sont gardés)." >&2
		fi
	fi
}

# lire_profil : « dev » ou « prod », lu dans $HAKOS_BOITE/profil ; « essai » s'il manque en essai.
lire_profil() {
	local fichier="$HAKOS_BOITE/profil" profil=""
	if [ -r "$fichier" ]; then
		profil=$(tr -d '[:space:]' <"$fichier")
	fi
	case $profil in
		dev | prod) printf '%s\n' "$profil" ;;
		"")
			[ "$HAKOS_ESSAI" = 1 ] || echec "profil absent : $fichier doit contenir dev ou prod."
			printf 'essai\n'
			;;
		*) echec "profil inconnu dans $fichier : « $profil » (dev ou prod attendu)." ;;
	esac
}

verifier_conditions() {
	local service dossier
	case $HAKOS_ESSAI in
		0 | 1) ;;
		*) echec "HAKOS_ESSAI vaut 0 ou 1 (reçu : $HAKOS_ESSAI)." ;;
	esac
	[[ $HAKOS_DELAI_SANTE =~ ^[1-9][0-9]*$ ]] || echec "HAKOS_DELAI_SANTE doit être un nombre de secondes (reçu : $HAKOS_DELAI_SANTE)."
	[ -z "$HAKOS_MEMOIRE_KIO" ] || [[ $HAKOS_MEMOIRE_KIO =~ ^[0-9]+$ ]] || echec "HAKOS_MEMOIRE_KIO doit être un nombre de kio (reçu : $HAKOS_MEMOIRE_KIO)."
	[ -d "$HAKOS_BOITE" ] || echec "dossier de la box introuvable : $HAKOS_BOITE"
	HAKOS_BOITE=$(cd -- "$HAKOS_BOITE" && pwd)
	[ ! -e "$HAKOS_BOITE/.initialized" ] || echec "la box est déjà initialisée ($HAKOS_BOITE/.initialized existe) : le premier démarrage ne se relance pas."
	if [ "$(id -u)" -ne 0 ] && [ "$HAKOS_ESSAI" != 1 ]; then
		echec "le premier démarrage doit tourner en root."
	fi
	[ -r "$HAKOS_BOITE/versions.env" ] || echec "fichier des versions introuvable : $HAKOS_BOITE/versions.env"
	for service in "${HAKOS_SERVICES[@]}"; do
		dossier="$HAKOS_BOITE/$service"
		[ -f "$dossier/docker-compose.yml" ] || echec "fichier compose introuvable : $dossier/docker-compose.yml"
		[ -f "$dossier/env.modele" ] || echec "modèle d'environnement introuvable : $dossier/env.modele"
	done
	command -v openssl >/dev/null || echec "openssl est introuvable : impossible de tirer les secrets."
	command -v docker >/dev/null || echec "docker est introuvable."
	docker compose version >/dev/null 2>&1 </dev/null || echec "le greffon docker compose est introuvable."
	docker info >/dev/null 2>&1 </dev/null || echec "le moteur Docker ne répond pas (voir : systemctl status docker)."
	PROFIL=$(lire_profil)
}

# taille_page : taille des pages mémoire en octets, HAKOS_PAGE_OCTETS pour un essai.
taille_page() {
	local octets=$HAKOS_PAGE_OCTETS
	[ -n "$octets" ] || octets=$(getconf PAGESIZE 2>/dev/null) || octets=""
	printf '%s\n' "${octets:-illisible}"
}

# journaliser_eeprom : version du chargeur de démarrage (EEPROM du Pi 5) dans le journal, par
# rpi-eeprom-update (version en place et version livrée avec l'image), sinon par vcgencmd.
# Le démarrage sur SSD NVMe demande un EEPROM du 6/12/2023 ou plus récent ; celui de juin 2024
# démarre sur la carte M.2 HAT+ sans réglage. rpi-eeprom-update.service installe au démarrage la
# version livrée si elle est plus récente. Rien n'est bloquant ici : la box a déjà démarré.
journaliser_eeprom() {
	local sortie ligne date_en_place=""
	sortie=$(rpi-eeprom-update 2>&1 </dev/null) || true
	if [[ $sortie == *CURRENT:* ]]; then
		while IFS= read -r ligne; do
			ligne=${ligne#"${ligne%%[![:space:]]*}"}
			case $ligne in
				BOOTLOADER:* | CURRENT:* | LATEST:*) journal "  EEPROM : $ligne" ;;
			esac
			if [[ $ligne =~ ^CURRENT:.*\(([0-9]+)\)$ ]] && [ -z "$date_en_place" ]; then
				date_en_place=${BASH_REMATCH[1]}
			fi
		done <<<"$sortie"
	elif sortie=$(vcgencmd bootloader_version 2>/dev/null </dev/null) && [ -n "$sortie" ]; then
		journal "  EEPROM : ${sortie%%$'\n'*}"
		[[ $sortie =~ timestamp\ ([0-9]+) ]] && date_en_place=${BASH_REMATCH[1]}
	else
		journal "  EEPROM : version illisible (rpi-eeprom-update et vcgencmd absents : ce n'est pas un Raspberry Pi)"
		return 0
	fi
	# 1717200000 : 1er juin 2024.
	if [[ $date_en_place =~ ^[0-9]+$ ]] && [ "$date_en_place" -lt 1717200000 ]; then
		journal "  attention : EEPROM antérieur à juin 2024 ; rpi-eeprom-update.service le mettra à jour au prochain démarrage"
	fi
}

# arreter_box RAISON TEXTE : le premier démarrage refuse le matériel. Marqueur $HAKOS_ETAT/arret,
# pare-feu fermé, et seule la page d'arrêt sur http://hako.local (nginx de l'accueil, arret.conf),
# pour que la famille sache quoi faire. Immich et Nextcloud ne démarrent pas. À chaque démarrage,
# le premier démarrage recommence et lève l'arrêt si le matériel convient.
arreter_box() {
	local raison=$1 texte=$2 nginx archive="$HAKOS_BOITE/images/nginx.tar" sortie
	journal "  ARRÊT : $texte"
	if [ "$(id -u)" -ne 0 ]; then
		journal "  essai sans root : pas de page d'arrêt"
		echec "$texte"
	fi
	install -d -m 755 "$HAKOS_ETAT"
	printf '%s\n' "$raison" >"$HAKOS_ETAT/arret"
	chmod 644 "$HAKOS_ETAT/arret"
	creer_env home
	nginx=$(lire_valeur "$HAKOS_BOITE/versions.env" NGINX_IMAGE) || nginx=""
	if [ -n "$nginx" ] && ! docker image inspect "$nginx" >/dev/null 2>&1 </dev/null && [ -f "$archive" ]; then
		# L'archive reste en place : le vrai chargement (étape 4) la supprimera.
		sortie=$(docker load -i "$archive" 2>&1 </dev/null) || journal "  attention : docker load de nginx a échoué : $sortie"
	fi
	if (cd -- "$HAKOS_BOITE/home" && docker compose up -d </dev/null) >/dev/null 2>&1; then
		"$HAKOS_BOITE/lib/phase.sh" recharger || true
		journal "  page d'arrêt servie sur le port 80 (http://hako.local)"
	else
		journal "  attention : nginx de l'accueil n'a pas démarré, pas de page d'arrêt"
	fi
	echec "$texte"
}

# verifier_materiel : garde-fous du Pi 5. Version de l'EEPROM dans le journal ; pages mémoire de
# 4 Kio, sinon arrêt avec la page d'arrêt. Un arrêt précédent est levé si tout va bien.
verifier_materiel() {
	local pages
	journaliser_eeprom
	pages=$(taille_page)
	if [ "$pages" != "$HAKOS_PAGE_ATTENDUE" ]; then
		arreter_box pages "pages mémoire de $pages octets au lieu de $HAKOS_PAGE_ATTENDUE : noyau à pages de 16 Kio (kernel_2712.img) au lieu de kernel8.img. Il faut « kernel=kernel8.img » dans la section [pi5] de /boot/firmware/config.txt ; Immich et Nextcloud ne démarrent pas."
	fi
	journal "  pages mémoire de $pages octets, comme attendu (noyau kernel8.img sur Pi 5)"
	if [ -e "$HAKOS_ETAT/arret" ]; then
		if [ "$(id -u)" -eq 0 ]; then
			rm -f -- "$HAKOS_ETAT/arret"
			"$HAKOS_BOITE/lib/phase.sh" recharger || true
		fi
		journal "  arrêt précédent levé : le matériel convient maintenant"
	fi
}

# Étape 1 : machine-id propre à la box ; clés d'hôte SSH en profil dev.
# Raspberry Pi OS crée les clés au premier démarrage (regenerate_ssh_host_keys.service,
# paquet raspberrypi-sys-mods, qui lance ssh-keygen -A) : ici, seulement un filet de sécurité.
identite_systeme() {
	local id type manque=0
	if [ "$HAKOS_ESSAI" = 1 ]; then
		journal "  essai : machine-id et clés SSH laissés tels quels"
		return 0
	fi
	id=$(cat /etc/machine-id 2>/dev/null) || id=""
	if [[ $id =~ ^[0-9a-f]{32}$ ]]; then
		journal "  machine-id déjà propre à cette box"
	else
		systemd-machine-id-setup || echec "systemd-machine-id-setup a échoué : machine-id non créé."
		journal "  machine-id créé"
	fi
	if mountpoint -q /etc/machine-id; then
		systemd-machine-id-setup --commit || echec "systemd-machine-id-setup --commit a échoué : machine-id non enregistré sur le disque."
		journal "  machine-id enregistré sur le disque"
	fi
	if [ "$PROFIL" != dev ]; then
		journal "  profil $PROFIL : pas de SSH, clés d'hôte non concernées"
		return 0
	fi
	for type in rsa ecdsa ed25519; do
		[ -s "/etc/ssh/ssh_host_${type}_key" ] || manque=1
	done
	if [ "$manque" = 0 ]; then
		journal "  clés d'hôte SSH déjà présentes"
		return 0
	fi
	command -v ssh-keygen >/dev/null || echec "ssh-keygen est introuvable : clés d'hôte SSH impossibles à créer (profil dev)."
	ssh-keygen -A || echec "ssh-keygen -A a échoué."
	journal "  clés d'hôte SSH créées : elles manquaient encore"
	systemctl --no-block restart ssh.service || journal "  attention : ssh.service n'a pas pu être relancé, il prendra les clés au prochain démarrage"
}

# Étape 2 : apprentissage automatique d'Immich selon la mémoire (seuil 7 Gio).
# Le choix va dans immich/.env (étape 3). Un immich/.env déjà créé garde son choix.
choisir_apprentissage() {
	local env="$HAKOS_BOITE/immich/.env" conseil=0
	MEMOIRE_KIO=$(memoire_kio)
	if ml_possible "$MEMOIRE_KIO"; then
		conseil=1
	fi
	if [ -e "$env" ]; then
		if grep -qxF "$HAKOS_LIGNE_ML" "$env"; then
			ML_ACTIF=1
		elif grep -qxF "$HAKOS_LIGNE_SANS_ML" "$env"; then
			ML_ACTIF=0
		else
			echec "$env existe mais ne dit pas si l'apprentissage automatique est actif ($HAKOS_LIGNE_ML ou $HAKOS_LIGNE_SANS_ML)."
		fi
	else
		ML_ACTIF=$conseil
	fi
	if [ "$ML_ACTIF" = 1 ]; then
		LIGNES_ML=("$HAKOS_LIGNE_ML")
		journal "  mémoire $(en_gio "$MEMOIRE_KIO") ($MEMOIRE_KIO kio, seuil 7 Gio) : apprentissage automatique d'Immich activé ($HAKOS_LIGNE_ML)"
	else
		LIGNES_ML=("$HAKOS_LIGNE_SANS_ML")
		journal "  mémoire $(en_gio "$MEMOIRE_KIO") ($MEMOIRE_KIO kio, seuil 7 Gio) : apprentissage automatique d'Immich désactivé ($HAKOS_LIGNE_SANS_ML)"
	fi
	if [ "$ML_ACTIF" != "$conseil" ]; then
		journal "  attention : choix gardé d'une tentative précédente (immich/.env), différent de ce que donnerait la mémoire actuelle"
	fi
}

# creer_env SERVICE [LIGNE…] : crée $HAKOS_BOITE/SERVICE/.env (0600, root) s'il n'existe pas.
# Contenu : les lignes CLÉ=valeur de versions.env, puis celles de env.modele où chaque
# __SECRET__ devient une valeur aléatoire distincte (openssl rand -hex 24), puis les LIGNEs.
# Un .env déjà présent est gardé tel quel : la base de données a pu être créée avec ses secrets.
# Aucun secret n'est jamais écrit dans le journal.
creer_env() {
	local service=$1
	shift
	local dossier="$HAKOS_BOITE/$service"
	local cible="$dossier/.env" modele="$dossier/env.modele"
	local contenu ligne secret provisoire secrets=0 numero=0
	if [ -e "$cible" ]; then
		[ -s "$cible" ] || echec "$cible existe mais il est vide : le supprimer seulement si la base de $(libelle "$service") n'a jamais démarré, puis relancer."
		if grep -q '__SECRET__' "$cible"; then
			echec "$cible contient encore __SECRET__."
		fi
		journal "  $(libelle "$service") : .env déjà présent, gardé tel quel"
		return 0
	fi
	contenu=$(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$HAKOS_BOITE/versions.env") || echec "aucune ligne CLÉ=valeur dans $HAKOS_BOITE/versions.env"
	contenu+=$'\n'
	while IFS= read -r ligne || [ -n "$ligne" ]; do
		numero=$((numero + 1))
		ligne=${ligne%$'\r'}
		case $ligne in
			'' | '#'*) continue ;;
		esac
		[[ $ligne =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] || echec "$modele, ligne $numero : une ligne CLÉ=valeur est attendue."
		while [[ $ligne == *__SECRET__* ]]; do
			secret=$(openssl rand -hex 24) || echec "openssl rand a échoué."
			[[ $secret =~ ^[0-9a-f]{48}$ ]] || echec "openssl rand n'a pas rendu un secret valide."
			ligne=${ligne/__SECRET__/$secret}
			secrets=$((secrets + 1))
		done
		contenu+="$ligne"$'\n'
	done <"$modele"
	for ligne in "$@"; do
		contenu+="$ligne"$'\n'
	done
	# Écriture dans un fichier provisoire du même dossier, puis renommage : un .env existe
	# entier ou pas du tout, même si la box s'éteint pendant l'écriture.
	provisoire=$(mktemp "$dossier/.env.XXXXXX") || echec "impossible d'écrire dans $dossier"
	printf '%s' "$contenu" >"$provisoire"
	chmod 600 "$provisoire"
	if [ "$(id -u)" -eq 0 ]; then
		chown root:root "$provisoire"
	fi
	mv -f "$provisoire" "$cible"
	journal "  $(libelle "$service") : .env créé, $secrets secret(s) tiré(s) au hasard"
}

# Étape 3 : un .env par service ; celui d'Immich reçoit en plus le choix de l'étape 2, celui de
# Nextcloud un administrateur technique, pour que Nextcloud s'installe seul au premier lancement,
# sans installateur web. L'étape 6 supprime ce compte et retire ces lignes.
creer_secrets() {
	local service secret
	for service in "${HAKOS_SERVICES[@]}"; do
		case $service in
			immich) creer_env "$service" "${LIGNES_ML[@]}" ;;
			nextcloud)
				secret=$(openssl rand -hex 24) || echec "openssl rand a échoué."
				creer_env "$service" "NEXTCLOUD_ADMIN_USER=$HAKOS_NC_TECHNIQUE" "NEXTCLOUD_ADMIN_PASSWORD=$secret"
				;;
			*) creer_env "$service" ;;
		esac
	done
}

# Étape 4 : charge chaque archive de $HAKOS_BOITE/images, puis la supprime pour rendre la place.
# Après un échec, seules les archives restantes sont chargées.
charger_images() {
	local dossier="$HAKOS_BOITE/images" archive sortie ligne
	local -a archives=()
	if [ -d "$dossier" ]; then
		shopt -s nullglob
		archives=("$dossier"/*.tar)
		shopt -u nullglob
	fi
	if [ ${#archives[@]} -eq 0 ]; then
		journal "  aucune archive à charger dans $dossier"
		return 0
	fi
	for archive in "${archives[@]}"; do
		journal "  chargement de ${archive##*/} ($(du -h "$archive" | cut -f 1))"
		sortie=$(docker load -i "$archive" 2>&1 </dev/null) || echec "docker load a échoué pour $archive : $sortie"
		while IFS= read -r ligne; do
			[ -z "$ligne" ] || journal "    $ligne"
		done <<<"$sortie"
		rm -f -- "$archive"
	done
	journal "  ${#archives[@]} archive(s) chargée(s) puis supprimée(s)"
}

# decrire_etat « nom|état|santé » : « nom (état, santé …) » pour le journal.
decrire_etat() {
	local nom etat sante
	IFS='|' read -r nom etat sante <<<"$1"
	if [ -n "$sante" ]; then
		printf '%s (%s, santé %s)\n' "$nom" "$etat" "$sante"
	else
		printf '%s (%s)\n' "$nom" "$etat"
	fi
}

# attendre_projet SERVICE ÉCHÉANCE : attend que chaque conteneur du projet soit « healthy »
# (avec healthcheck) ou « running » (sans), au plus tard jusqu'à ÉCHÉANCE (date +%s).
attendre_projet() {
	local service=$1 echeance=$2
	local dossier="$HAKOS_BOITE/$1" nom services service_compose ids id etat texte
	local precedent="" dernier_journal=0 maintenant debut
	local -a attente prets noms
	nom=$(libelle "$service")
	services=$(cd -- "$dossier" && docker compose config --services </dev/null) || echec "docker compose config a échoué pour $nom ($dossier)."
	debut=$(date +%s)
	while :; do
		attente=()
		prets=()
		noms=()
		while IFS= read -r service_compose; do
			[ -n "$service_compose" ] || continue
			ids=$(cd -- "$dossier" && docker compose ps -a -q "$service_compose" </dev/null) || echec "docker compose ps a échoué pour $nom ($dossier)."
			if [ -z "$ids" ]; then
				attente+=("$service_compose (aucun conteneur)")
				noms+=("$service_compose")
				continue
			fi
			while IFS= read -r id; do
				etat=$(etat_conteneur "$id") || etat="$id|disparu|"
				if conteneur_pret "$etat"; then
					prets+=("${etat%%|*}")
				else
					attente+=("$(decrire_etat "$etat")")
					noms+=("${etat%%|*}")
				fi
			done <<<"$ids"
		done <<<"$services"
		if [ ${#attente[@]} -eq 0 ]; then
			journal "  $nom prêt en $(($(date +%s) - debut)) s : ${prets[*]}"
			return 0
		fi
		texte=$(printf '%s, ' "${attente[@]}")
		texte=${texte%, }
		maintenant=$(date +%s)
		if [ "$maintenant" -ge "$echeance" ]; then
			echec "délai dépassé ($HAKOS_DELAI_SANTE s pour tous les services) : $nom n'est pas prêt. En cause : $texte. Diagnostic : docker logs ${noms[0]}"
		fi
		if [ "$texte" != "$precedent" ] || [ $((maintenant - dernier_journal)) -ge 60 ]; then
			journal "  $nom : en attente de $texte"
			precedent=$texte
			dernier_journal=$maintenant
		fi
		sleep 5
	done
}

# demarrer_projet SERVICE ÉCHÉANCE : vérifie que les images du projet sont chargées,
# lance « docker compose up -d » dans son dossier, puis attend que tout soit prêt.
demarrer_projet() {
	local service=$1 echeance=$2
	local dossier="$HAKOS_BOITE/$1" nom images image
	local -a manquantes=()
	nom=$(libelle "$service")
	images=$(cd -- "$dossier" && docker compose config --images </dev/null) || echec "docker compose config a échoué pour $nom ($dossier) : fichier compose ou .env invalide."
	while IFS= read -r image; do
		[ -n "$image" ] || continue
		docker image inspect "$image" >/dev/null 2>&1 </dev/null || manquantes+=("$image")
	done <<<"$images"
	if [ ${#manquantes[@]} -gt 0 ]; then
		echec "image(s) absente(s) de Docker pour $nom : ${manquantes[*]} (archive manquante dans $HAKOS_BOITE/images ?)"
	fi
	journal "  $nom : docker compose up -d"
	(cd -- "$dossier" && docker compose up -d </dev/null) || echec "« docker compose up -d » a échoué pour $nom ($dossier)."
	attendre_projet "$service" "$echeance"
}

# Étape 5 : pare-feu et page du port 80 (lib/phase.sh, déjà lancé au démarrage par
# hakos-parefeu.service), puis les projets dans l'ordre (accueil, Immich, Nextcloud). Le délai
# HAKOS_DELAI_SANTE vaut pour l'ensemble, ce qui reste sous les 30 min de l'unité systemd.
demarrer_services() {
	local service echeance
	if [ "$(id -u)" -eq 0 ]; then
		"$HAKOS_BOITE/lib/phase.sh" appliquer || echec "pare-feu ou page du port 80 impossible à appliquer (lib/phase.sh)."
	else
		journal "  essai sans root : pare-feu non chargé"
	fi
	echeance=$(($(date +%s) + HAKOS_DELAI_SANTE))
	for service in "${HAKOS_SERVICES[@]}"; do
		demarrer_projet "$service" "$echeance"
	done
}

# occ_nextcloud ARGUMENT… : occ dans le conteneur de Nextcloud, en www-data.
occ_nextcloud() {
	local id
	id=$(cd -- "$HAKOS_BOITE/nextcloud" && docker compose ps -q nextcloud </dev/null) || return 1
	[ -n "$id" ] || return 1
	docker exec -u www-data "$id" php occ --no-interaction --no-ansi "$@" </dev/null
}

# nextcloud_mandataire : Nextcloud fait confiance au nginx de l'accueil, qui le sert sous le nom
# hako-fichiers.local. nginx joint 127.0.0.1:8080 ; Docker relaie alors la connexion depuis la
# passerelle du réseau du projet (hakos-nextcloud_default). Cette passerelle, et elle seule, est
# un mandataire de confiance : Nextcloud lit l'adresse de l'appareil dans X-Forwarded-For, et son
# frein des mots de passe vise le bon appareil. Les appareils qui passent par le port 8080 gardent
# leur propre adresse (Docker la conserve) et ne peuvent pas se faire passer pour un autre.
nextcloud_mandataire() {
	local passerelle
	passerelle=$(docker network inspect --format '{{range .IPAM.Config}}{{.Gateway}} {{end}}' hakos-nextcloud_default 2>/dev/null </dev/null) || passerelle=""
	passerelle=${passerelle%% *}
	[[ $passerelle =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || echec "passerelle du réseau hakos-nextcloud_default illisible : mandataire de Nextcloud impossible à régler."
	occ_nextcloud config:system:set trusted_proxies 0 --value="$passerelle" >/dev/null ||
		echec "réglage trusted_proxies de Nextcloud impossible."
	occ_nextcloud config:system:set forwarded_for_headers 0 --value=HTTP_X_FORWARDED_FOR >/dev/null ||
		echec "réglage forwarded_for_headers de Nextcloud impossible."
	journal "  Nextcloud : nginx de l'accueil reconnu comme mandataire (passerelle $passerelle)"
}

# Étape 6 : Nextcloud installé sans compte. L'administrateur technique de l'étape 3 est supprimé :
# les comptes de la famille viennent de l'assistant (occ suffit). Nextcloud ne contacte pas
# internet pour juger des mots de passe. Les lignes NEXTCLOUD_ADMIN_* quittent le .env et le
# conteneur est recréé sans elles. Se rejoue sans dommage après un échec.
nextcloud_sans_compte() {
	local env="$HAKOS_BOITE/nextcloud/.env" provisoire statut
	statut=$(occ_nextcloud status --output=json) || echec "occ status a échoué : Nextcloud ne répond pas."
	[[ $statut == *'"installed":true'* ]] || echec "Nextcloud ne s'est pas installé seul (occ status : installed ≠ true)."
	if occ_nextcloud user:info "$HAKOS_NC_TECHNIQUE" >/dev/null 2>&1; then
		occ_nextcloud user:delete "$HAKOS_NC_TECHNIQUE" >/dev/null || echec "suppression du compte technique de Nextcloud impossible."
		journal "  Nextcloud : compte technique supprimé"
	else
		journal "  Nextcloud : aucun compte technique"
	fi
	occ_nextcloud config:system:set has_internet_connection --type=boolean --value=false >/dev/null ||
		echec "réglage has_internet_connection de Nextcloud impossible."
	nextcloud_mandataire
	if grep -q '^NEXTCLOUD_ADMIN_' "$env"; then
		provisoire=$(mktemp "$env.XXXXXX") || echec "impossible d'écrire dans $HAKOS_BOITE/nextcloud"
		grep -v '^NEXTCLOUD_ADMIN_' "$env" >"$provisoire" || true
		chmod 600 "$provisoire"
		if [ "$(id -u)" -eq 0 ]; then
			chown root:root "$provisoire"
		fi
		mv -f "$provisoire" "$env"
		journal "  Nextcloud : lignes NEXTCLOUD_ADMIN_* retirées du .env, conteneur recréé"
		demarrer_projet nextcloud "$(($(date +%s) + HAKOS_DELAI_SANTE))"
	fi
}

# Étape 7 : fiche d'installation (0600) : /root/fiche-installation.txt, ou
# $HAKOS_BOITE/fiche-installation.txt en essai. Elle ne contient aucun secret.
ecrire_fiche() {
	local fiche nom identifiant="" quand immich nextcloud ml provisoire
	if [ "$HAKOS_ESSAI" = 1 ]; then
		fiche="$HAKOS_BOITE/fiche-installation.txt"
	else
		fiche=/root/fiche-installation.txt
	fi
	nom=$(uname -n)
	nom=${nom%%.*}
	# Une fiche laissée par une tentative précédente garde son identifiant.
	if [ -f "$fiche" ]; then
		identifiant=$(sed -n 's/^Identifiant d.installation *: *\([0-9a-f-]\{36\}\)$/\1/p' "$fiche")
		identifiant=${identifiant%%$'\n'*}
	fi
	if [ -z "$identifiant" ]; then
		identifiant=$(cat /proc/sys/kernel/random/uuid) || echec "impossible de tirer l'identifiant d'installation."
	fi
	quand=$(date '+%d/%m/%Y à %H:%M (%Z)')
	immich=$(lire_valeur "$HAKOS_BOITE/versions.env" IMMICH_VERSION) || immich="inconnue"
	nextcloud=$(lire_valeur "$HAKOS_BOITE/versions.env" NEXTCLOUD_IMAGE) || nextcloud="inconnue"
	nextcloud=${nextcloud##*:}
	if [ "$ML_ACTIF" = 1 ]; then
		ml="activé"
	else
		ml="désactivé"
	fi
	provisoire=$(mktemp "$fiche.XXXXXX") || echec "impossible d'écrire la fiche $fiche"
	cat >"$provisoire" <<-FICHE
		HakOS : fiche d'installation
		============================

		Nom de la box               : $nom
		Identifiant d'installation  : $identifiant
		Date d'installation         : $quand
		Profil                      : $PROFIL
		Mémoire                     : $(en_gio "$MEMOIRE_KIO")
		Apprentissage automatique   : $ml (seuil : 7 Gio de mémoire)
		Immich                      : $immich
		Nextcloud                   : $nextcloud

		Adresses, depuis un appareil branché sur le même réseau
		  Accueil et état de la box : http://$nom.local
		  Photos (Immich)           : http://$nom-photos.local   (secours : http://$nom.local:2283)
		  Fichiers (Nextcloud)      : http://$nom-fichiers.local (secours : http://$nom.local:8080)
		  Une deuxième box sur le même réseau prend le nom $nom-2 : http://$nom-2.local, etc.

		Comptes des personnes de la maison
		  Créés par la page de la HAKO : http://$nom.local (assistant de première installation).
		  D'ici là, les ports des photos et des fichiers restent fermés au réseau.

		À FAIRE (lot sauvegarde) : clé de récupération
		  Emplacement réservé. Cette version de HakOS ne crée aucune clé de récupération.
	FICHE
	chmod 600 "$provisoire"
	if [ "$(id -u)" -eq 0 ]; then
		chown root:root "$provisoire"
	fi
	mv -f "$provisoire" "$fiche"
	journal "  fiche écrite : $fiche (mode 600, sans secret)"
}
