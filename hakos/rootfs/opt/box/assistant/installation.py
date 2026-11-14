"""Où en est la première installation : phases, session de l'appareil qui a la main, essais.

Contrat de la page de la HAKO : docs/page-box.md du dossier site/ de antoninche/hako. Tout vit
dans la mémoire du processus : les mots de passe, le jeton (seulement son empreinte), le compteur d'essais faux.
Un redémarrage remet la HAKO en « ready » (ou « preparing ») : la page tire alors de nouveaux
mots de passe, et la création met à jour les comptes déjà créés.

Phases : preparing → ready → registered → creating → installed.
Une installation à la fois : register ouvre une session (jeton de 256 bits). Toute requête qui
porte le bon jeton est un signe de vie ; la page en donne un toutes les 30 s. Sans signe de vie
pendant DELAI_VERROU, un autre appareil peut recommencer (register). Un check réussi donne la
session à l'appareil qui l'a fait : la fiche de secours sert de preuve.
"""

import hashlib
import hmac
import secrets
import threading
import time

import foyer

DELAI_VERROU = 120  # secondes sans signe de vie avant qu'un autre appareil puisse recommencer
ESSAIS_FAUX_MAX = 10
TACHES = ('photos', 'files', 'finish')


class EchecCreation(Exception):
    """Création arrêtée. Le message va dans le journal : jamais de prénom, identifiant ni secret."""


class Refus(Exception):
    """Requête refusée : code HTTP et code d'erreur du contrat ({"error": code})."""

    def __init__(self, statut, code):
        super().__init__(code)
        self.statut = statut
        self.code = code


def _empreinte(jeton):
    return hashlib.sha256(jeton.encode()).digest()


class Installation:
    """État de l'installation, partagé entre les fils du serveur et celui de la création."""

    def __init__(self, mots, createur, pret, journal, horloge=time.monotonic,
                 delai_verrou=DELAI_VERROU, demarrer_fil=None):
        self._mots = mots
        self._createur = createur      # objet avec creer(comptes, signaler) et terminer()
        self._pret = pret              # vrai quand les applications sont prêtes
        self._journal = journal        # journal(texte) : jamais de prénom, identifiant ni secret
        self._horloge = horloge
        self._delai_verrou = delai_verrou
        self._demarrer_fil = demarrer_fil or self._fil
        self._verrou = threading.Lock()
        self.phase = 'preparing'
        self._comptes = None
        self._empreinte = None
        self._vu = 0.0
        self._essais_faux = 0
        self._avancement = dict.fromkeys(TACHES, 'waiting')
        self.fin = threading.Event()   # posé une fois la HAKO installée

    # --- Session ---

    def _session_valide(self, jeton):
        if not jeton or self._empreinte is None:
            return False
        return hmac.compare_digest(_empreinte(jeton), self._empreinte)

    def _ouvrir_session(self):
        jeton = secrets.token_urlsafe(32)
        self._empreinte = _empreinte(jeton)
        self._vu = self._horloge()
        return jeton

    def _verrou_vivant(self):
        return self._empreinte is not None and self._horloge() - self._vu < self._delai_verrou

    def _signe_de_vie(self, jeton):
        """Vrai si le jeton est celui de la session ; renouvelle alors le verrou."""
        if self._session_valide(jeton):
            self._vu = self._horloge()
            return True
        return False

    def _actualiser_phase(self):
        if self.phase == 'preparing' and self._pret():
            self.phase = 'ready'
            self._journal('applications prêtes : installation possible')
        if self.phase == 'preparing':
            raise Refus(503, 'preparing')

    # --- Routes ---

    def etat(self, jeton):
        with self._verrou:
            if self.phase == 'preparing' and not self._pret():
                return {'phase': 'preparing', 'busy': False}
            if self.phase == 'preparing':
                self._actualiser_phase()
            a_la_main = self._signe_de_vie(jeton)
            reponse = {'phase': self.phase,
                       'busy': self.phase in ('registered', 'creating') and not a_la_main}
            if self.phase == 'creating':
                reponse['progress'] = dict(self._avancement)
            return reponse

    def inscrire(self, jeton, prenoms_bruts):
        with self._verrou:
            self._actualiser_phase()
            if self.phase in ('creating', 'installed'):
                raise Refus(409, 'wrong_phase')
            prenoms = foyer.verifier_prenoms(prenoms_bruts)
            if prenoms is None:
                raise Refus(400, 'invalid_names')
            if self.phase == 'registered' and not self._session_valide(jeton) and self._verrou_vivant():
                raise Refus(409, 'busy')
            self._comptes = foyer.creer_comptes(prenoms, self._mots)
            self._essais_faux = 0
            self._avancement = dict.fromkeys(TACHES, 'waiting')
            self.phase = 'registered'
            nouveau = self._ouvrir_session()
            self._journal(f'mots de passe remis pour {len(prenoms)} personne(s), nouvelle session')
            return {'accounts': [{'firstName': c.prenom, 'login': c.identifiant,
                                  'owner': c.responsable, 'password': c.mot_de_passe}
                                 for c in self._comptes],
                    'token': nouveau}

    def verifier_fiche(self, jeton, tape):
        with self._verrou:
            self._actualiser_phase()
            if self.phase not in ('registered', 'creating') or self._comptes is None:
                raise Refus(409, 'wrong_phase')
            if not isinstance(tape, str) or len(tape) > 200:
                raise Refus(400, 'invalid_request')
            if self._essais_faux >= ESSAIS_FAUX_MAX:
                raise Refus(423, 'too_many_wrong')
            attendu = self._comptes[0].mot_de_passe.encode()
            if not hmac.compare_digest(tape.strip().lower().encode(), attendu):
                self._essais_faux += 1
                self._journal(f'mot de passe de la fiche faux ({self._essais_faux}/{ESSAIS_FAUX_MAX})')
                return {'result': 'wrong'}
            if self._signe_de_vie(jeton):
                return {'result': 'ok'}
            self._journal('fiche vérifiée : la session passe à cet appareil')
            return {'result': 'ok', 'token': self._ouvrir_session()}

    def creer(self, jeton):
        with self._verrou:
            self._actualiser_phase()
            if self.phase not in ('registered', 'creating'):
                raise Refus(409, 'wrong_phase')
            if not self._signe_de_vie(jeton):
                raise Refus(401, 'no_session')
            if self.phase == 'registered':
                self.phase = 'creating'
                self._avancement = dict.fromkeys(TACHES, 'waiting')
                self._journal(f'création des comptes : {len(self._comptes)} personne(s)')
                self._demarrer_fil(self._comptes)
            return {'progress': dict(self._avancement)}

    # --- Création, dans son propre fil ---

    def _fil(self, comptes):
        threading.Thread(target=self.executer_creation, args=(comptes,),
                         name='creation', daemon=True).start()

    def _signaler(self, tache, etat):
        with self._verrou:
            self._avancement[tache] = etat

    def executer_creation(self, comptes):
        debut = time.monotonic()
        try:
            self._createur.creer(comptes, self._signaler)
            self._signaler('finish', 'running')
            self._createur.terminer()
        except Exception as erreur:  # noqa: BLE001 : toute erreur rend la main à la page
            with self._verrou:
                self.phase = 'registered'
                self._avancement = dict.fromkeys(TACHES, 'waiting')
            # Seuls les messages d'EchecCreation sont sûrs ; les autres peuvent citer un identifiant.
            detail = str(erreur) if isinstance(erreur, EchecCreation) else type(erreur).__name__
            self._journal(f'création arrêtée : {detail}')
            return
        with self._verrou:
            self._avancement = dict.fromkeys(TACHES, 'done')
            self.phase = 'installed'
            self._comptes = None
            self._empreinte = None
        self._journal(f'HAKO installée : comptes créés en {time.monotonic() - debut:.0f} s')
        self.fin.set()
