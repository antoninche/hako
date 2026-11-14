#!/usr/bin/env python3
"""HakOS : noms des applications sur le réseau de la maison (service hakos-noms).

avahi annonce déjà le nom de la box : hako.local, ou hako-2.local pour une deuxième box sur le
même réseau (avahi choisit seul ce nom en cas de conflit). Ce service annonce en plus, comme de
simples adresses (enregistrement A, sans enregistrement inverse : avahi-publish -a -R) :
  <nom>-photos.local    Immich, servi par le nginx de l'accueil sur le port 80
  <nom>-fichiers.local  Nextcloud, idem
où <nom> est le nom qu'avahi a pris (hako, hako-2…), à l'adresse IPv4 de la box (celle de la
route par défaut). Toutes les 10 s, il suit les changements de nom et d'adresse, et relance
avahi-publish s'il s'est arrêté (conflit de nom, avahi redémarré).

Il ajoute aussi l'adresse IPv4 de la box aux domaines de confiance de Nextcloud (index 9 de
trusted_domains), une fois la box initialisée : http://<adresse IP>:8080 marche alors en secours.

Bibliothèque standard de Python seulement. Journal : journalctl -u hakos-noms (adresses et noms
de la box seulement, rien sur les personnes).

Variables d'essai : HAKOS_BOITE (/opt/box), HAKOS_INTERVALLE (10, en secondes).
"""

import ipaddress
import json
import os
import re
import signal
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path

APPLICATIONS = ('photos', 'fichiers')
NOM_BOX = re.compile(r'[a-z0-9]([a-z0-9-]{0,40}[a-z0-9])?')
# Domaines de confiance de Nextcloud : 0 (localhost) et 1 à 4 (NEXTCLOUD_TRUSTED_DOMAINS de
# env.modele) viennent de l'installation ; l'adresse IP de la box prend l'index 9.
INDEX_IP = 9
# Interfaces de la box qui mènent au réseau de la maison (pas celles de Docker ni des essais).
INTERFACES_MAISON = re.compile(r'(eth|en|wlan|wl)[a-z0-9]*')
RELANCE = 30
arret = threading.Event()


def journal(texte):
    print(texte, flush=True)


def lancer(*commande, delai=20):
    try:
        return subprocess.run(commande, capture_output=True, text=True, timeout=delai,
                              stdin=subprocess.DEVNULL, check=False)
    except (OSError, subprocess.TimeoutExpired):
        return None


def lire_nom_avahi(sortie):
    """Nom d'hôte d'avahi dans la réponse de busctl (« s "hako-2" »), ou None."""
    trouve = re.fullmatch(r's "([^"]*)"\s*', sortie or '')
    if not trouve:
        return None
    nom = trouve.group(1).lower()
    return nom if NOM_BOX.fullmatch(nom) else None


def nom_avahi():
    """Nom qu'avahi annonce pour la box (hako, hako-2…), lu par D-Bus ; None si avahi ne répond pas."""
    resultat = lancer('busctl', '--system', 'call', 'org.freedesktop.Avahi', '/',
                      'org.freedesktop.Avahi.Server', 'GetHostName', delai=5)
    if resultat is None or resultat.returncode != 0:
        return None
    return lire_nom_avahi(resultat.stdout)


def noms_voulus(nom):
    return tuple(f'{nom}-{application}.local' for application in APPLICATIONS)


def adresse_valable(texte):
    try:
        adresse = ipaddress.IPv4Address(texte)
    except ValueError:
        return False
    return not (adresse.is_loopback or adresse.is_unspecified or adresse.is_multicast)


def premiere_adresse(interfaces):
    """Première IPv4 d'une interface de la maison, dans la sortie JSON de « ip -4 addr »."""
    for interface in interfaces or ():
        if not INTERFACES_MAISON.fullmatch(str(interface.get('ifname', ''))):
            continue
        for adresse in interface.get('addr_info') or ():
            if adresse.get('family') == 'inet' and adresse_valable(adresse.get('local', '')):
                return adresse['local']
    return None


def adresse_ipv4():
    """Adresse IPv4 de la box : celle de la route par défaut, sinon celle d'une interface de la maison."""
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as essai:
        try:
            # Aucun paquet n'est envoyé : connect() d'UDP choisit seulement la route.
            essai.connect(('192.0.2.1', 9))
            adresse = essai.getsockname()[0]
            if adresse_valable(adresse):
                return adresse
        except OSError:
            pass
    resultat = lancer('ip', '-j', '-4', 'addr', 'show', 'scope', 'global', delai=5)
    if resultat is None or resultat.returncode != 0:
        return None
    try:
        return premiere_adresse(json.loads(resultat.stdout or '[]'))
    except ValueError:
        return None


class Annonce:
    """Un nom annoncé par avahi-publish, relancé s'il s'arrête."""

    def __init__(self, nom, adresse):
        self.nom = nom
        self.adresse = adresse
        self.processus = None
        self.prochain = 0.0

    def entretenir(self, maintenant):
        if self.processus is not None:
            code = self.processus.poll()
            if code is None:
                return
            erreur = (self.processus.stderr.read() if self.processus.stderr else '').strip().splitlines()
            raison = erreur[-1] if erreur else f'code {code}'
            journal(f'{self.nom} : avahi-publish arrêté ({raison}) ; nouvel essai dans {RELANCE} s')
            self.processus = None
            self.prochain = maintenant + RELANCE
        if maintenant < self.prochain:
            return
        try:
            self.processus = subprocess.Popen(
                ['avahi-publish', '-a', '-R', self.nom, self.adresse],
                stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
        except OSError as erreur:
            journal(f'{self.nom} : avahi-publish impossible à lancer ({erreur.strerror})')
            self.prochain = maintenant + RELANCE

    def arreter(self):
        if self.processus is not None and self.processus.poll() is None:
            self.processus.terminate()
            try:
                self.processus.wait(5)
            except subprocess.TimeoutExpired:
                self.processus.kill()
        self.processus = None


def conteneur_nextcloud():
    resultat = lancer('docker', 'ps', '-q', '--filter', 'label=com.docker.compose.project=hakos-nextcloud',
                      '--filter', 'label=com.docker.compose.service=nextcloud')
    if resultat is None or resultat.returncode != 0:
        return None
    return resultat.stdout.split()[0] if resultat.stdout.split() else None


def occ(ident, *arguments):
    return lancer('docker', 'exec', '-u', 'www-data', ident, 'php', 'occ', '--no-interaction', '--no-ansi',
                  *arguments, delai=60)


def nextcloud_accepte(adresse, boite):
    """Ajoute l'adresse aux domaines de confiance de Nextcloud ; vrai si c'est fait (ou déjà là)."""
    if not (boite / '.initialized').exists():
        return False
    ident = conteneur_nextcloud()
    if not ident:
        return False
    lecture = occ(ident, 'config:system:get', 'trusted_domains')
    if lecture is None or lecture.returncode != 0:
        return False
    if adresse in lecture.stdout.split():
        return True
    ecriture = occ(ident, 'config:system:set', 'trusted_domains', str(INDEX_IP), f'--value={adresse}')
    if ecriture is None or ecriture.returncode != 0:
        return False
    journal(f'Nextcloud : {adresse} parmi les domaines de confiance (adresse de secours :8080)')
    return True


def main():
    boite = Path(os.environ.get('HAKOS_BOITE', '/opt/box'))
    intervalle = float(os.environ.get('HAKOS_INTERVALLE', '10'))
    signal.signal(signal.SIGTERM, lambda *_: arret.set())
    signal.signal(signal.SIGINT, lambda *_: arret.set())
    annonces = {}
    precedent = None
    adresse_nextcloud = None
    journal('Noms des applications : service démarré.')
    while not arret.is_set():
        nom, adresse = nom_avahi(), adresse_ipv4()
        voulues = {n: adresse for n in noms_voulus(nom)} if nom and adresse else {}
        if (nom, adresse) != precedent:
            if voulues:
                journal(f'Annonce de {" et ".join(voulues)} → {adresse}')
            else:
                journal(f'Rien à annoncer : nom avahi {nom or "illisible"}, adresse IPv4 {adresse or "absente"}')
            precedent = (nom, adresse)
        for nom_annonce in list(annonces):
            if annonces[nom_annonce].adresse != voulues.get(nom_annonce):
                annonces.pop(nom_annonce).arreter()
        maintenant = time.monotonic()
        for nom_annonce, adresse_annonce in voulues.items():
            annonces.setdefault(nom_annonce, Annonce(nom_annonce, adresse_annonce)).entretenir(maintenant)
        if adresse and adresse != adresse_nextcloud and nextcloud_accepte(adresse, boite):
            adresse_nextcloud = adresse
        arret.wait(intervalle)
    for annonce in annonces.values():
        annonce.arreter()
    journal('Noms des applications : service arrêté.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
