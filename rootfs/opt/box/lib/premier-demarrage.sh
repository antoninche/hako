# shellcheck shell=bash
#
# HakoS : étapes du premier démarrage, appelées dans l'ordre par /opt/box/firstboot.sh.
# À charger après lib/commun.sh. Chaque fonction s'arrête par « echec » au premier problème.

ETAPE="vérifications"
PROFIL=""
MEMOIRE_KIO=""
ML_ACTIF=""
LIGNES_ML=()

# etape N TITRE : annonce une étape dans le journal.
etape() {
	ETAPE=$2
	journal "Étape $1/7 : $2"
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

# Étape 3 : un .env par service ; celui d'Immich reçoit en plus le choix de l'étape 2.
creer_secrets() {
	local service
	for service in "${HAKOS_SERVICES[@]}"; do
		if [ "$service" = immich ]; then
			creer_env "$service" "${LIGNES_ML[@]}"
		else
			creer_env "$service"
		fi
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

# Étape 5 : démarre les projets dans l'ordre (accueil, Immich, Nextcloud). Le délai
# HAKOS_DELAI_SANTE vaut pour l'ensemble, ce qui reste sous les 30 min de l'unité systemd.
demarrer_services() {
	local service echeance
	echeance=$(($(date +%s) + HAKOS_DELAI_SANTE))
	for service in "${HAKOS_SERVICES[@]}"; do
		demarrer_projet "$service" "$echeance"
	done
}

# Étape 6 : fiche d'installation (0600) : /root/fiche-installation.txt, ou
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
		HakoS : fiche d'installation
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
		  Accueil                   : http://$nom.local
		  Photos (Immich)           : http://$nom.local:2283
		  Fichiers (Nextcloud)      : http://$nom.local:8080

		À faire tout de suite
		  Créer le compte administrateur d'Immich : http://$nom.local:2283
		  Créer le compte administrateur de Nextcloud : http://$nom.local:8080
		  Tant que ces comptes n'existent pas, n'importe quel appareil du réseau peut les créer.

		À FAIRE (lot sauvegarde) : clé de récupération
		  Emplacement réservé. Cette version de HakoS ne crée aucune clé de récupération.
	FICHE
	chmod 600 "$provisoire"
	if [ "$(id -u)" -eq 0 ]; then
		chown root:root "$provisoire"
	fi
	mv -f "$provisoire" "$fiche"
	journal "  fiche écrite : $fiche (mode 600, sans secret)"
}
