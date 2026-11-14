"""Tests du service hakos-noms : nom lu dans avahi, noms annoncés, adresse de la box."""

import unittest

import commun  # noqa: F401 : chemin du code de la box
import noms


class NomAvahi(unittest.TestCase):
    def test_reponse_de_busctl(self):
        self.assertEqual(noms.lire_nom_avahi('s "hako"\n'), 'hako')
        self.assertEqual(noms.lire_nom_avahi('s "Hako-2"\n'), 'hako-2')

    def test_reponses_refusees(self):
        for sortie in ('', 's ""', 'b true', 's "hako.local"', 's "-hako"', 's "ha ko"', None):
            self.assertIsNone(noms.lire_nom_avahi(sortie), sortie)


class Noms(unittest.TestCase):
    def test_premiere_et_deuxieme_box(self):
        self.assertEqual(noms.noms_voulus('hako'), ('hako-photos.local', 'hako-fichiers.local'))
        self.assertEqual(noms.noms_voulus('hako-2'), ('hako-2-photos.local', 'hako-2-fichiers.local'))


class Adresse(unittest.TestCase):
    def test_adresses_valables(self):
        self.assertTrue(noms.adresse_valable('192.168.1.20'))
        for texte in ('127.0.0.1', '0.0.0.0', '224.0.0.251', 'fe80::1', 'hako', ''):
            self.assertFalse(noms.adresse_valable(texte), texte)

    def test_interfaces_de_la_maison_seulement(self):
        interfaces = [
            {'ifname': 'docker0', 'addr_info': [{'family': 'inet', 'local': '172.17.0.1'}]},
            {'ifname': 'br-1a2b', 'addr_info': [{'family': 'inet', 'local': '172.18.0.1'}]},
            {'ifname': 'veth12', 'addr_info': [{'family': 'inet', 'local': '169.254.3.3'}]},
            {'ifname': 'wlan0', 'addr_info': [{'family': 'inet', 'local': '192.168.1.31'}]},
            {'ifname': 'eth0', 'addr_info': [{'family': 'inet', 'local': '192.168.1.30'}]},
        ]
        self.assertEqual(noms.premiere_adresse(interfaces), '192.168.1.31')
        self.assertIsNone(noms.premiere_adresse(interfaces[:3]))
        self.assertIsNone(noms.premiere_adresse(None))


if __name__ == '__main__':
    unittest.main()
