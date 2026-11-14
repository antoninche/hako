"""Tests du service hakos-etat : lecture de vcgencmd, de psql et de la santé des conteneurs."""

import json
import os
import tempfile
import unittest
from pathlib import Path

import commun  # noqa: F401 : chemin du code de la box
import etat


class Vcgencmd(unittest.TestCase):
    def test_temperature(self):
        self.assertEqual(etat.lire_temperature("temp=52.1'C\n"), 52.1)
        self.assertEqual(etat.lire_temperature("temp=48'C"), 48.0)
        self.assertIsNone(etat.lire_temperature(None))
        self.assertIsNone(etat.lire_temperature('error=1'))

    def test_aucun_ralentissement(self):
        self.assertEqual(etat.lire_ralentissement('throttled=0x0\n'), {
            'chaleur': False, 'chaleur_depuis_demarrage': False,
            'alimentation': False, 'alimentation_depuis_demarrage': False})

    def test_ralentissements(self):
        # 0x50005 : sous-tension et ralentie maintenant, et depuis le démarrage.
        self.assertEqual(etat.lire_ralentissement('throttled=0x50005'), {
            'chaleur': True, 'chaleur_depuis_demarrage': True,
            'alimentation': True, 'alimentation_depuis_demarrage': True})
        # 0x80000 : limite de température atteinte plus tôt, plus maintenant.
        self.assertEqual(etat.lire_ralentissement('throttled=0x80000'), {
            'chaleur': False, 'chaleur_depuis_demarrage': True,
            'alimentation': False, 'alimentation_depuis_demarrage': False})
        self.assertIsNone(etat.lire_ralentissement(''))


class Immich(unittest.TestCase):
    def test_nombre_de_photos(self):
        self.assertEqual(etat.lire_nombre('12431\n'), 12431)
        self.assertEqual(etat.lire_nombre('0'), 0)
        for sortie in (None, '', 'ERROR', '-1'):
            self.assertIsNone(etat.lire_nombre(sortie), sortie)

    def test_requete_sans_donnee_personnelle(self):
        self.assertTrue(etat.REQUETE_PHOTOS.startswith('SELECT count(*) FROM asset'))


class Sante(unittest.TestCase):
    def test_etats(self):
        self.assertEqual(etat.lire_sante('running|healthy\n'), 'ok')
        self.assertEqual(etat.lire_sante('running|'), 'ok')
        self.assertEqual(etat.lire_sante('running|starting'), 'demarrage')
        self.assertEqual(etat.lire_sante('restarting|'), 'demarrage')
        self.assertEqual(etat.lire_sante('running|unhealthy'), 'panne')
        self.assertEqual(etat.lire_sante('exited|'), 'panne')
        self.assertEqual(etat.lire_sante(None), 'panne')


class Ecriture(unittest.TestCase):
    def test_fichier_entier_et_lisible_par_nginx(self):
        with tempfile.TemporaryDirectory() as dossier:
            sortie = Path(dossier) / 'etat.json'
            etat.ecrire(sortie, {'photos': 3, 'sauvegarde': None})
            self.assertEqual(json.loads(sortie.read_text()), {'photos': 3, 'sauvegarde': None})
            self.assertEqual(os.stat(sortie).st_mode & 0o777, 0o644)
            self.assertEqual(sorted(p.name for p in Path(dossier).iterdir()), ['etat.json'])

    def test_version(self):
        with tempfile.TemporaryDirectory() as dossier:
            versions = Path(dossier) / 'versions.env'
            versions.write_text('# commentaire\nHAKOS_VERSION=2026.11.1\nAUTRE=x\n')
            self.assertEqual(etat.lire_valeur(versions, 'HAKOS_VERSION'), '2026.11.1')
            self.assertIsNone(etat.lire_valeur(versions, 'ABSENTE'))
            self.assertIsNone(etat.lire_valeur(Path(dossier) / 'absent', 'HAKOS_VERSION'))


if __name__ == '__main__':
    unittest.main()
