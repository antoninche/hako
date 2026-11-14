"""Prénoms, identifiants et mots de passe : mêmes résultats que la page de la HAKO.

cas-household.json vient de src/lib/assistant/household.ts (dépôt hako-site, commit de
HAKO_SITE_COMMIT) : checkPeople(liste, 40), cleanFirstName et assignLogins(…, '@hako.local').
"""

import json
import re
import tempfile
import unittest
from pathlib import Path

from commun import ASSISTANT, mots_essai

import foyer

CAS = json.loads((Path(__file__).with_name('cas-household.json')).read_text(encoding='utf-8'))
MOT_DE_PASSE_PAGE = re.compile(r'^[a-z]+(?:-[a-z]+){3}-[1-9][0-9]$')


class Identifiants(unittest.TestCase):
    def test_memes_resultats_que_la_page(self):
        for cas in CAS:
            with self.subTest(entree=cas['entree']):
                propres = [foyer.nettoyer_prenom(p) for p in cas['entree']]
                self.assertEqual(propres, cas['propres'])
                erreurs = [{'index': i, 'code': 'ownerMissing' if i == 0 and e == 'missing' else e}
                           for i, e in enumerate(map(foyer.erreur_prenom, propres)) if e]
                self.assertEqual(erreurs, cas['erreurs'])
                self.assertEqual(foyer.identifiants(propres), cas['identifiants'])

    def test_liste_acceptee_ou_refusee(self):
        self.assertEqual(foyer.verifier_prenoms(['  Hélène ', 'Marc']), ['Hélène', 'Marc'])
        for mauvaise in ([], ['A'] * 9, [''], ['Marc', 'R2D2'], 'Hélène', [3], None, ['x' * 41]):
            with self.subTest(liste=mauvaise):
                self.assertIsNone(foyer.verifier_prenoms(mauvaise))
        self.assertEqual(len(foyer.verifier_prenoms(['Camille'] * 8)), 8)


class MotsDePasse(unittest.TestCase):
    def test_format_de_la_page(self):
        mots = mots_essai()
        for _ in range(500):
            mot = foyer.tirer_mot_de_passe(mots)
            self.assertRegex(mot, MOT_DE_PASSE_PAGE)
            self.assertTrue(10 <= int(mot.rsplit('-', 1)[1]) <= 99)

    def test_comptes_distincts_et_responsable(self):
        comptes = foyer.creer_comptes(['Hélène', 'Marc', 'Marc'], mots_essai())
        self.assertEqual([c.identifiant for c in comptes],
                         ['helene@hako.local', 'marc@hako.local', 'marc2@hako.local'])
        self.assertEqual([c.responsable for c in comptes], [True, False, False])
        self.assertEqual(len({c.mot_de_passe for c in comptes}), 3)

    def test_liste_de_l_image(self):
        mots = foyer.lire_mots(ASSISTANT / 'mots.txt')
        self.assertEqual(len(mots), foyer.TAILLE_LISTE)

    def test_liste_refusee(self):
        with tempfile.TemporaryDirectory() as dossier:
            chemin = Path(dossier) / 'mots.txt'
            for contenu in (['tulipe'] * 4096, mots_essai()[:-1] + ('exemple',),
                            mots_essai()[:-1] + ('été',), mots_essai()[:100]):
                chemin.write_text('\n'.join(contenu) + '\n', encoding='utf-8')
                with self.assertRaises(ValueError):
                    foyer.lire_mots(chemin)


if __name__ == '__main__':
    unittest.main()
