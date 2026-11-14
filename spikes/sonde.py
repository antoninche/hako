#!/usr/bin/env python3
"""Sonde HTTP de l'essai c : dit si HÔTE:PORT répond. Usage : sonde.py HÔTE PORT

Affiche « ouvert <code HTTP> » ou « fermé (<raison>) ». Bibliothèque standard seulement.
"""

import http.client
import socket
import sys

hote, port = sys.argv[1], int(sys.argv[2])
try:
    connexion = http.client.HTTPConnection(hote, port, timeout=4)
    connexion.request('GET', '/api/server/ping' if port == 2283 else '/status.php' if port == 8080 else '/')
    print(f'ouvert {connexion.getresponse().status}')
except ConnectionRefusedError:
    print('fermé (refusé)')
except ConnectionResetError:
    print('fermé (réinitialisé)')
except (socket.timeout, TimeoutError):
    print('fermé (délai dépassé)')
except OSError as erreur:
    print(f'fermé ({erreur.__class__.__name__})')
