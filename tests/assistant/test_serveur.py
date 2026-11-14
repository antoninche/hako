"""API HTTP sur un vrai socket Unix : routes, codes, en-têtes, contrôle de l'hôte et de l'origine."""

import http.client
import json
import socket
import tempfile
import threading
import unittest
from pathlib import Path

from commun import mots_essai

import assistant
from installation import Installation


class ConnexionUnix(http.client.HTTPConnection):
    def __init__(self, chemin):
        super().__init__('localhost', timeout=5)
        self.chemin = chemin

    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(5)
        self.sock.connect(self.chemin)


class Rien:
    def creer(self, comptes, signaler):
        pass

    def terminer(self):
        pass


class Api(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.TemporaryDirectory()
        self.chemin = str(Path(self.dossier.name) / 'api.sock')
        self.installation = Installation(mots_essai(), Rien(), lambda: True, lambda texte: None)
        self.serveur = assistant.Serveur(self.chemin, self.installation)
        threading.Thread(target=self.serveur.serve_forever, daemon=True).start()

    def tearDown(self):
        self.serveur.shutdown()
        self.serveur.server_close()
        self.dossier.cleanup()

    def appel(self, methode, route, corps=None, entetes=None, brut=None):
        connexion = ConnexionUnix(self.chemin)
        tous = {'Host': 'hako.local'}
        tous.update(entetes or {})
        donnees = brut
        if corps is not None:
            donnees = json.dumps(corps).encode()
            tous.setdefault('Content-Type', 'application/json')
        connexion.request(methode, '/api/installation/' + route, body=donnees, headers=tous)
        reponse = connexion.getresponse()
        texte = reponse.read()
        connexion.close()
        return reponse.status, reponse.getheader('Content-Type'), json.loads(texte) if texte else None

    def test_parcours(self):
        self.assertEqual(self.appel('GET', 'status')[0::2], (200, {'phase': 'ready', 'busy': False}))
        statut, type_, corps = self.appel('POST', 'register', {'firstNames': ['Hélène', 'Zoé', 'Zoë']},
                                          {'Origin': 'http://hako.local'})
        self.assertEqual(statut, 201)
        self.assertTrue(type_.startswith('application/json'))
        self.assertEqual([c['login'] for c in corps['accounts']],
                         ['helene@hako.local', 'zoe@hako.local', 'zoe2@hako.local'])
        self.assertEqual(corps['accounts'][1]['firstName'], 'Zoé')
        session = {'X-Hako-Session': corps['token']}
        self.assertEqual(self.appel('GET', 'status', entetes=session)[2], {'phase': 'registered', 'busy': False})
        self.assertEqual(self.appel('GET', 'status')[2], {'phase': 'registered', 'busy': True})
        self.assertEqual(self.appel('POST', 'register', {'firstNames': ['Léa']})[0::2], (409, {'error': 'busy'}))
        self.assertEqual(self.appel('POST', 'accounts', {})[0::2], (401, {'error': 'no_session'}))
        self.assertEqual(self.appel('POST', 'check', {'typed': 'non'})[2], {'result': 'wrong'})
        statut, _, corps = self.appel('POST', 'accounts', {}, session)
        self.assertEqual(statut, 202)
        self.assertEqual(set(corps['progress']), {'photos', 'files', 'finish'})

    def test_hote_et_origine(self):
        for hote in ('hako.local', 'hako-2.local', 'HAKO.LOCAL:80', '192.168.1.20', '10.0.0.3:80',
                     '127.0.0.1', '127.0.0.1:8081'):
            with self.subTest(hote=hote):
                self.assertEqual(self.appel('GET', 'status', entetes={'Host': hote})[0], 200)
        for hote in ('exemple.fr', 'hako.local.exemple.fr', '8.8.8.8', '[::1]', 'hako.local:x', ''):
            with self.subTest(hote=hote):
                self.assertEqual(self.appel('GET', 'status', entetes={'Host': hote})[0], 403)
        statut, _, _ = self.appel('POST', 'register', {'firstNames': ['Hélène']},
                                  {'Origin': 'http://exemple.fr'})
        self.assertEqual(statut, 403)

    def test_requetes_refusees(self):
        self.assertEqual(self.appel('GET', 'inconnue')[0], 404)
        self.assertEqual(self.appel('GET', 'register')[0], 404)
        self.assertEqual(self.appel('PUT', 'status')[0], 405)
        self.assertEqual(self.appel('POST', 'register', brut=b'{"firstNames":["A"]}',
                                    entetes={'Content-Type': 'text/plain'})[0], 415)
        self.assertEqual(self.appel('POST', 'register', brut=b'[1]',
                                    entetes={'Content-Type': 'application/json'})[0], 400)
        gros = json.dumps({'firstNames': ['a' * 20000]}).encode()
        self.assertEqual(self.appel('POST', 'register', brut=gros,
                                    entetes={'Content-Type': 'application/json'})[0], 413)
        self.assertEqual(self.appel('POST', 'register', {'firstNames': 'Hélène'})[0::2],
                         (400, {'error': 'invalid_names'}))


class Hote(unittest.TestCase):
    def test_hote_accepte(self):
        self.assertTrue(assistant.hote_accepte('hako'))
        self.assertTrue(assistant.hote_accepte('hako-12.local'))
        self.assertFalse(assistant.hote_accepte('hakox.local'))
        self.assertFalse(assistant.hote_accepte('203.0.113.9'))


if __name__ == '__main__':
    unittest.main()
