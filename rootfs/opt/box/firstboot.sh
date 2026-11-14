#!/bin/bash
# HakOS : premier démarrage de la box.
# Lancé une seule fois par hakos-premier-demarrage.service, tant que /opt/box/.initialized
# n'existe pas. Sortie dans le journal : journalctl -u hakos-premier-demarrage
#
#   1. garde-fous du Pi 5 : version de l'EEPROM dans le journal ; pages mémoire de 4 Kio, sinon
#      arrêt, avec une page qui l'explique sur http://hako.local ; machine-id propre à la box ;
#      clés d'hôte SSH en profil dev
#   2. apprentissage automatique d'Immich selon la mémoire (7 Gio)
#   3. secrets : un .env par service (0600, root), jamais affiché
#   4. docker load des archives de /opt/box/images, supprimées une fois chargées
#   5. pare-feu (lib/phase.sh), puis docker compose up -d : accueil, Immich, Nextcloud, et
#      attente de leur santé
#   6. Nextcloud sans compte : administrateur technique supprimé, .env nettoyé
#   7. fiche d'installation /root/fiche-installation.txt (0600)
#   8. /opt/box/.initialized, seulement si tout a réussi : l'assistant de première installation
#      (hakos-assistant) laisse alors la famille créer ses comptes
#
# Relance sûre après un échec : les .env présents sont gardés, seules les archives restantes
# sont chargées, docker compose est relancé. Commande : systemctl start hakos-premier-demarrage
# Variables d'essai (HAKOS_BOITE, HAKOS_ESSAI, HAKOS_MEMOIRE_KIO, HAKOS_PAGE_OCTETS,
# HAKOS_DELAI_SANTE, HAKOS_ETAT) : lib/commun.sh
set -euo pipefail
umask 077

ICI=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib/commun.sh disable=SC1091
. "$ICI/lib/commun.sh"
# shellcheck source=lib/premier-demarrage.sh disable=SC1091
. "$ICI/lib/premier-demarrage.sh"

# Sous systemd, HOME n'est pas défini pour root : docker y range sa configuration.
export HOME="${HOME:-/root}"

trap fin_premier_demarrage EXIT
debut=$(date +%s)

verifier_conditions
journal "HakOS : premier démarrage (dossier $HAKOS_BOITE, profil $PROFIL)."
if [ "$HAKOS_ESSAI" = 1 ]; then
	journal "Mode essai : rien n'est modifié dans /etc, la fiche va dans $HAKOS_BOITE."
fi

etape 1 "matériel et identité du système"
verifier_materiel
identite_systeme

etape 2 "mémoire et apprentissage automatique"
choisir_apprentissage

etape 3 "secrets"
creer_secrets

etape 4 "images Docker"
charger_images

etape 5 "services"
demarrer_services

etape 6 "Nextcloud sans compte"
nextcloud_sans_compte

etape 7 "fiche d'installation"
ecrire_fiche

etape 8 "fin"
touch "$HAKOS_BOITE/.initialized"
duree=$(($(date +%s) - debut))
journal "Premier démarrage réussi en $((duree / 60)) min $((duree % 60)) s : $HAKOS_BOITE/.initialized créé."
