"""Phases, session, verrou de 2 minutes, essais faux, création reprise : sans réseau ni Docker."""

import unittest

from commun import mots_essai

from installation import DELAI_VERROU, ESSAIS_FAUX_MAX, EchecCreation, Installation, Refus


class Horloge:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


class Createur:
    def __init__(self):
        self.appels = []
        self.echec = None
        self.termine = 0

    def creer(self, comptes, signaler):
        self.appels.append(comptes)
        signaler('photos', 'running')
        if self.echec:
            raise self.echec
        signaler('photos', 'done')
        signaler('files', 'running')
        signaler('files', 'done')

    def terminer(self):
        self.termine += 1


def nouvelle(pret=True):
    horloge, createur, lignes = Horloge(), Createur(), []
    etat = {'pret': pret}
    installation = Installation(mots_essai(), createur, lambda: etat['pret'], lignes.append,
                                horloge=horloge, demarrer_fil=lambda comptes: None)
    return installation, horloge, createur, lignes, etat


class Phases(unittest.TestCase):
    def test_preparation_puis_pret(self):
        inst, _, _, _, etat = nouvelle(pret=False)
        self.assertEqual(inst.etat(None), {'phase': 'preparing', 'busy': False})
        with self.assertRaises(Refus) as refus:
            inst.inscrire(None, ['Hélène'])
        self.assertEqual((refus.exception.statut, refus.exception.code), (503, 'preparing'))
        etat['pret'] = True
        self.assertEqual(inst.etat(None), {'phase': 'ready', 'busy': False})

    def test_parcours_complet(self):
        inst, _, createur, lignes, _ = nouvelle()
        reponse = inst.inscrire(None, ['Hélène', 'Marc'])
        jeton = reponse['token']
        self.assertGreaterEqual(len(jeton), 43)
        self.assertEqual([c['login'] for c in reponse['accounts']], ['helene@hako.local', 'marc@hako.local'])
        self.assertEqual([c['owner'] for c in reponse['accounts']], [True, False])
        self.assertEqual(inst.etat(jeton), {'phase': 'registered', 'busy': False})
        self.assertEqual(inst.etat(None)['busy'], True)
        self.assertEqual(inst.creer(jeton), {'progress': {'photos': 'waiting', 'files': 'waiting',
                                                          'finish': 'waiting'}})
        self.assertEqual(inst.etat(jeton)['phase'], 'creating')
        self.assertEqual(inst.etat(None)['busy'], True)
        inst.executer_creation(inst._comptes)
        self.assertEqual(inst.etat(None), {'phase': 'installed', 'busy': False})
        self.assertTrue(inst.fin.is_set())
        self.assertIsNone(inst._comptes)
        self.assertEqual(createur.termine, 1)
        texte = '\n'.join(lignes)
        for secret in ['Hélène', 'helene', 'Marc', jeton] + [c['password'] for c in reponse['accounts']]:
            self.assertNotIn(secret, texte)

    def test_refus_selon_la_phase(self):
        inst, _, _, _, _ = nouvelle()
        for appel, statut, code in ((lambda: inst.verifier_fiche(None, 'x'), 409, 'wrong_phase'),
                                    (lambda: inst.creer(None), 409, 'wrong_phase'),
                                    (lambda: inst.inscrire(None, ['R2D2']), 400, 'invalid_names'),
                                    (lambda: inst.inscrire(None, []), 400, 'invalid_names')):
            with self.assertRaises(Refus) as refus:
                appel()
            self.assertEqual((refus.exception.statut, refus.exception.code), (statut, code))
        jeton = inst.inscrire(None, ['Hélène'])['token']
        with self.assertRaises(Refus) as refus:
            inst.creer(None)
        self.assertEqual(refus.exception.statut, 401)
        inst.creer(jeton)
        with self.assertRaises(Refus) as refus:
            inst.inscrire(jeton, ['Hélène'])
        self.assertEqual(refus.exception.code, 'wrong_phase')


class UneInstallationALaFois(unittest.TestCase):
    def test_autre_appareil_refuse_tant_que_la_page_vit(self):
        inst, horloge, _, _, _ = nouvelle()
        jeton = inst.inscrire(None, ['Hélène'])['token']
        for _ in range(10):  # la page donne signe de vie toutes les 30 s pendant 5 minutes
            horloge.t += 30
            inst.etat(jeton)
            with self.assertRaises(Refus) as refus:
                inst.inscrire(None, ['Léa'])
            self.assertEqual((refus.exception.statut, refus.exception.code), (409, 'busy'))

    def test_verrou_tombe_apres_deux_minutes_sans_signe_de_vie(self):
        inst, horloge, _, _, _ = nouvelle()
        ancien = inst.inscrire(None, ['Hélène'])['token']
        horloge.t += DELAI_VERROU - 1
        with self.assertRaises(Refus):
            inst.inscrire(None, ['Léa'])
        horloge.t += 1
        nouveau = inst.inscrire(None, ['Léa'])['token']
        self.assertTrue(inst.etat(ancien)['busy'])
        self.assertFalse(inst.etat(nouveau)['busy'])
        with self.assertRaises(Refus) as refus:
            inst.creer(ancien)
        self.assertEqual(refus.exception.statut, 401)

    def test_page_qui_a_la_main_peut_recommencer(self):
        inst, _, _, _, _ = nouvelle()
        premier = inst.inscrire(None, ['Hélène'])
        second = inst.inscrire(premier['token'], ['Hélène', 'Marc'])
        self.assertNotEqual(premier['accounts'][0]['password'], second['accounts'][0]['password'])

    def test_session_expiree_mais_personne_n_a_repris(self):
        inst, horloge, _, _, _ = nouvelle()
        jeton = inst.inscrire(None, ['Hélène'])['token']
        horloge.t += 10 * DELAI_VERROU
        self.assertEqual(inst.creer(jeton)['progress']['photos'], 'waiting')


class Fiche(unittest.TestCase):
    def test_la_fiche_donne_la_main(self):
        inst, _, _, _, _ = nouvelle()
        reponse = inst.inscrire(None, ['Hélène', 'Marc'])
        mot = reponse['accounts'][0]['password']
        self.assertEqual(inst.verifier_fiche(None, reponse['accounts'][1]['password']), {'result': 'wrong'})
        resultat = inst.verifier_fiche(None, f'  {mot.upper()} ')
        self.assertEqual(resultat['result'], 'ok')
        self.assertTrue(inst.etat(reponse['token'])['busy'])
        self.assertFalse(inst.etat(resultat['token'])['busy'])
        self.assertEqual(inst.verifier_fiche(resultat['token'], mot), {'result': 'ok'})

    def test_dix_essais_faux_puis_blocage(self):
        inst, _, _, _, _ = nouvelle()
        mot = inst.inscrire(None, ['Hélène'])['accounts'][0]['password']
        for _ in range(ESSAIS_FAUX_MAX):
            self.assertEqual(inst.verifier_fiche(None, 'faux-faux-faux-faux-10'), {'result': 'wrong'})
        with self.assertRaises(Refus) as refus:
            inst.verifier_fiche(None, mot)
        self.assertEqual((refus.exception.statut, refus.exception.code), (423, 'too_many_wrong'))


class CreationArretee(unittest.TestCase):
    def test_erreur_rend_la_main_et_reprise(self):
        inst, _, createur, lignes, _ = nouvelle()
        jeton = inst.inscrire(None, ['Hélène'])['token']
        inst.creer(jeton)
        createur.echec = EchecCreation('Immich ne répond pas')
        inst.executer_creation(inst._comptes)
        self.assertEqual(inst.etat(jeton), {'phase': 'registered', 'busy': False})
        self.assertIn('Immich ne répond pas', lignes[-1])
        createur.echec = KeyError('helene@hako.local')
        inst.creer(jeton)
        inst.executer_creation(inst._comptes)
        self.assertNotIn('helene', lignes[-1])
        createur.echec = None
        inst.creer(jeton)
        inst.executer_creation(inst._comptes)
        self.assertEqual(inst.etat(None)['phase'], 'installed')
        self.assertEqual(len(createur.appels), 3)
        self.assertEqual(len({c[0].mot_de_passe for c in createur.appels}), 1)

    def test_avancement_visible_pendant_la_creation(self):
        inst, _, _, _, _ = nouvelle()
        jeton = inst.inscrire(None, ['Hélène'])['token']
        inst.creer(jeton)
        inst._signaler('photos', 'done')
        inst._signaler('files', 'running')
        self.assertEqual(inst.etat(None)['progress'], {'photos': 'done', 'files': 'running',
                                                      'finish': 'waiting'})


if __name__ == '__main__':
    unittest.main()
