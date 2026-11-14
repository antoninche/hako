#!/usr/bin/env python3
"""HakOS : API locale de la première installation (service hakos-assistant).

Sert /api/installation/ (status, register, check, accounts) sur un socket Unix, derrière le nginx
de l'accueil, qui sert aussi la page de la HAKO. Contrat : docs/page-box.md du dossier site/ de
antoninche/hako.
Bibliothèque standard de Python seulement.

Variables (valeurs de la box par défaut ; les essais les changent) :
  HAKOS_BOITE       /opt/box : .initialized y marque la fin du premier démarrage
  HAKOS_ETAT        /var/lib/hakos : marqueur « installee », réglage de l'accueil (accueil/phase.conf)
  HAKOS_SOCKET      /run/hakos-assistant/api.sock
  HAKOS_IMMICH_URL  http://127.0.0.1:12283
  HAKOS_MOTS        /opt/box/assistant/mots.txt
  HAKOS_NFT         /usr/sbin/nft
Une fois la HAKO installée, le service s'arrête ; /opt/box/lib/phase.sh le masque.
"""

import ipaddress
import json
import os
import re
import socket
import socketserver
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler
from pathlib import Path

import comptes
import foyer
from installation import Installation, Refus

PREFIXE = '/api/installation/'
TAILLE_MAX = 16 * 1024
ENTETE_SESSION = 'X-Hako-Session'
NOM_BOX = re.compile(r'hako(-[0-9]{1,3})?(\.local)?')
# Réseaux de la maison (et la box elle-même) : la page n'est servie qu'en IPv4 privée.
RESEAUX_PRIVES = tuple(ipaddress.IPv4Network(r) for r in (
    '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '169.254.0.0/16', '127.0.0.0/8'))
ROUTES_GET = {'status'}
ROUTES_POST = {'register', 'check', 'accounts'}


def journal(texte):
    print(texte, flush=True)


def hote_accepte(hote):
    """Noms de la box (hako.local, hako-2.local…) ou adresse IPv4 privée, avec ou sans port.

    Défense contre le « DNS rebinding » : une page d'un autre site, même résolue vers la box,
    porte son propre nom dans Host. Le port ne compte pas (essais par un port redirigé).
    """
    if not hote:
        return False
    nom, _, port = hote.rpartition(':') if ':' in hote else (hote, '', '')
    if port and not port.isdigit():
        return False
    nom = nom.lower()
    if NOM_BOX.fullmatch(nom):
        return True
    try:
        adresse = ipaddress.IPv4Address(nom)
    except ValueError:
        return False
    return any(adresse in reseau for reseau in RESEAUX_PRIVES)


class Gestionnaire(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    server_version = 'HakOS'
    sys_version = ''

    def address_string(self):
        return 'nginx'

    def log_message(self, format, *args):  # noqa: A002 : signature de BaseHTTPRequestHandler
        pass  # pas de journal d'accès : le nginx n'envoie ni adresse ni jeton à journaliser

    def _repondre(self, statut, corps):
        donnees = json.dumps(corps, ensure_ascii=False, separators=(',', ':')).encode()
        self.send_response(statut)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(donnees)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(donnees)

    def _route(self, routes):
        chemin = self.path.split('?', 1)[0]
        if not chemin.startswith(PREFIXE):
            return None
        route = chemin[len(PREFIXE):]
        return route if route in routes else None

    def _controler_origine(self):
        hote = self.headers.get('Host', '')
        if not hote_accepte(hote):
            raise Refus(403, 'forbidden')
        origine = self.headers.get('Origin')
        if origine is not None and origine != f'http://{hote}':
            raise Refus(403, 'forbidden')

    def _lire_corps(self):
        if not (self.headers.get('Content-Type') or '').lower().startswith('application/json'):
            raise Refus(415, 'invalid_request')
        if self.headers.get('Transfer-Encoding'):
            raise Refus(411, 'invalid_request')
        try:
            longueur = int(self.headers.get('Content-Length', ''))
        except ValueError:
            raise Refus(411, 'invalid_request') from None
        if not 0 <= longueur <= TAILLE_MAX:
            raise Refus(413, 'invalid_request')
        try:
            corps = json.loads(self.rfile.read(longueur) or b'{}')
        except ValueError:
            raise Refus(400, 'invalid_request') from None
        if not isinstance(corps, dict):
            raise Refus(400, 'invalid_request')
        return corps

    def _traiter(self, methode):
        installation = self.server.installation
        routes = ROUTES_GET if methode == 'GET' else ROUTES_POST
        try:
            route = self._route(routes)
            if route is None:
                raise Refus(404, 'not_found')
            self._controler_origine()
            jeton = self.headers.get(ENTETE_SESSION)
            if methode == 'GET':
                self._repondre(200, installation.etat(jeton))
                return
            corps = self._lire_corps()
            if route == 'register':
                self._repondre(201, installation.inscrire(jeton, corps.get('firstNames')))
            elif route == 'check':
                self._repondre(200, installation.verifier_fiche(jeton, corps.get('typed')))
            else:
                self._repondre(202, installation.creer(jeton))
        except Refus as refus:
            self._repondre(refus.statut, {'error': refus.code})
        except Exception as erreur:  # noqa: BLE001 : la page reçoit une erreur lisible
            journal(f'erreur interne ({type(erreur).__name__})')
            self._repondre(500, {'error': 'internal'})

    def do_GET(self):  # noqa: N802 : nom imposé par BaseHTTPRequestHandler
        self._traiter('GET')

    def do_POST(self):  # noqa: N802
        self._traiter('POST')

    def _refuser_methode(self):
        self._repondre(405, {'error': 'method_not_allowed'})

    do_PUT = do_DELETE = do_PATCH = do_OPTIONS = do_HEAD = _refuser_methode  # noqa: N815


class Serveur(socketserver.ThreadingMixIn, socketserver.UnixStreamServer):
    daemon_threads = True
    request_queue_size = 32

    def __init__(self, chemin, installation):
        self.installation = installation
        super().__init__(chemin, Gestionnaire)

    def get_request(self):
        requete, _ = super().get_request()
        requete.settimeout(30)
        return requete, ('nginx', 0)


def fabrique_pret(boite, immich, docker):
    """Vrai une fois le premier démarrage fini et les deux applications prêtes ; reste vrai ensuite."""
    etat = {'pret': False, 'dernier': 0.0}
    verrou = threading.Lock()

    def pret():
        with verrou:
            if etat['pret']:
                return True
            if time.monotonic() - etat['dernier'] < 2:
                return False
            etat['dernier'] = time.monotonic()
            etat['pret'] = ((boite / '.initialized').exists() and immich.repond()
                            and docker.sante(comptes.PROJET_NEXTCLOUD, 'nextcloud') == 'healthy')
            return etat['pret']

    return pret


def main():
    boite = Path(os.environ.get('HAKOS_BOITE', '/opt/box'))
    etat = Path(os.environ.get('HAKOS_ETAT', '/var/lib/hakos'))
    chemin_socket = os.environ.get('HAKOS_SOCKET', '/run/hakos-assistant/api.sock')
    if (etat / 'installee').exists():
        journal('HAKO déjà installée : rien à faire.')
        return 0
    mots = foyer.lire_mots(os.environ.get('HAKOS_MOTS', str(Path(__file__).with_name('mots.txt'))))
    docker = comptes.Docker()
    immich = comptes.Immich(os.environ.get('HAKOS_IMMICH_URL', 'http://127.0.0.1:12283'), docker)
    createur = comptes.Createur(immich, comptes.Nextcloud(docker), etat, docker,
                                os.environ.get('HAKOS_NFT', '/usr/sbin/nft'), journal)
    installation = Installation(mots, createur, fabrique_pret(boite, immich, docker), journal)

    if os.path.exists(chemin_socket):
        os.unlink(chemin_socket)
    serveur = Serveur(chemin_socket, installation)
    # Le nginx (conteneur, utilisateur nginx) doit pouvoir s'y connecter ; le dossier reste à nous.
    os.chmod(chemin_socket, 0o666)
    fil = threading.Thread(target=serveur.serve_forever, name='http', daemon=True)
    fil.start()
    journal(f'API de la première installation prête ({len(mots)} mots dans la liste).')
    installation.fin.wait()
    # Le temps que nginx recharge sa configuration : la page lit encore « installed » ici.
    time.sleep(10)
    serveur.shutdown()
    serveur.server_close()
    try:
        os.unlink(chemin_socket)
    except FileNotFoundError:
        pass
    journal('Service arrêté : la HAKO est installée.')
    return 0


if __name__ == '__main__':
    socket.setdefaulttimeout(None)
    sys.exit(main())
