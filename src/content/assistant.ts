/**
 * Textes de la page de la HAKO qui fait la première installation, et de sa
 * démonstration sur le site (/installer/demonstration/).
 *
 * La page de la HAKO s’ouvre chez la personne, à http://hako.local, une fois
 * la HAKO branchée et prête (guide /installer/, étape « Faites la première
 * installation »). Elle crée un compte pour chaque personne de la maison et
 * lui donne son mot de passe, pendant l’installation seulement. Sur le site,
 * la même page tourne en démonstration, avec une HAKO simulée dans le
 * navigateur : rien n’est envoyé, rien n’est gardé, tout s’oublie au
 * rechargement.
 *
 * Tout ce que ces pages affichent est ici, libellés des boutons compris. Le
 * script n’écrit aucun texte lui-même : il lit ceux-ci dans la page
 * (attributs data-*, gabarits <template>). Il ne doit jamais importer ce
 * fichier.
 *
 * Le fichier a quatre parties :
 * - `page` : la page du site autour de la démonstration (titre, chapeau, ce
 *   que l’on voit, pourquoi c’est une démonstration, liens vers le guide) ;
 * - `demo` : les mentions propres à la démonstration (bandeau permanent,
 *   notes qui remplacent ce que seule une vraie HAKO peut faire, fiche
 *   marquée « EXEMPLE »). La vraie page de la HAKO ne les affiche jamais ;
 * - `common`, `screens` et `states` : la page de la HAKO elle-même, la même
 *   en démonstration et chez la personne. D’abord ce qui revient sur chaque
 *   écran, puis les sept écrans dans l’ordre (`order`), puis les écrans
 *   d’attente et d’erreur, hors du parcours ;
 * - `printout` : la fiche de secours, une page A4 à imprimer.
 *
 * Ce fichier lit les titres des étapes du guide (src/content/installation.ts)
 * pour ses renvois : le guide ne doit donc jamais l’importer. Son lien vers
 * la démonstration s’écrit dans ses propres textes, avec DEMO_ROUTE
 * (src/data/assistant.ts).
 *
 * Comment modifier les textes :
 * - Chaque écran dit quoi faire (`lead`, sous le titre), pourquoi (`why`),
 *   puis « Ça ne marche pas ? » (`problems`). Chaque cas a un titre (ce que
 *   la personne constate, avec ses mots), « Pourquoi » (`why` : la cause en
 *   mots simples) et « Que faire » (`fix` : des gestes précis, dans l’ordre).
 *   C’est la forme du guide (src/content/installation.ts) : ses composants
 *   (GuideText, GuideNote, FaqItem) savent l’afficher.
 * - Un texte est une liste de morceaux mis bout à bout : du texte, une
 *   information manquante (todo(…), écrite dans src/data/assistant.ts ou
 *   src/data/installation.ts) ou un lien { label, href }. L’adresse de la
 *   HAKO (boxAddress.display) reste un morceau à part : GuideText l’écrit
 *   alors comme une adresse à recopier.
 * - Dans un libellé, « {prenom} », « {identifiant} », « {n} » et « {total} »
 *   sont remplacés par la page : « Mot de passe de {prenom} » devient « Mot
 *   de passe de Camille ». Ces libellés restent du texte simple, sans lien.
 * - Les faits (nombre de personnes, forme des identifiants, mots de passe
 *   d’exemple, informations à confirmer) sont dans src/data/assistant.ts.
 *   L’adresse de la HAKO et les informations que le guide attend aussi
 *   viennent de src/data/installation.ts, les liens vers les pages du site
 *   de src/data/navigation.ts.
 * - Les liens de la page de la HAKO vers le site (guide, FAQ, contact)
 *   s’ouvrent dans un nouvel onglet, suivis de `common.newTab` : quitter la
 *   page en pleine installation effacerait les mots de passe affichés. Seuls
 *   les liens de retour au guide de l’écran « C’est prêt » restent dans le
 *   même onglet. Sur la vraie HAKO, ces liens porteront l’adresse complète du
 *   site (Assistant.astro, siteUrl) : la page y est servie par la HAKO.
 *
 * Ce que ces textes ne disent jamais :
 * - « box » seul : notre produit est « la HAKO » ou « votre HAKO »,
 *   l’appareil de l’opérateur « votre box internet » ;
 * - que les échanges ou le disque sont chiffrés : ils ne le sont pas ;
 * - « nous ne pourrions pas » : nous disons ce que nous faisons, « nous ne
 *   gardons aucun moyen d’accès », et rien de plus ;
 * - une durée, une adresse ou une procédure que l’équipe n’a pas
 *   confirmée : elle s’écrit todo(…).
 *
 * Ton : vouvoiement, phrases courtes, un geste par phrase, chaque mot
 * technique expliqué la première fois, jamais de reproche ni d’urgence.
 *
 * Typographie : apostrophe ’, espaces insécables (U+00A0) avant « : », « ; »,
 * « ? », « ! » et à l’intérieur des guillemets « ». withFrenchTypography ne
 * s’applique pas dans src/content/ : ces espaces sont tapées ici, et
 * tests/unit/assistant-textes.test.ts les vérifie.
 */
import { company } from '../data/entreprise';
import {
  FIRST_NAME_MAX_LENGTH,
  LOGIN_DOMAIN,
  MAX_PEOPLE,
  duplicateExample,
  loginExample,
  pending,
} from '../data/assistant';
import { boxAddress, toConfirm } from '../data/installation';
import { routes } from '../data/navigation';
import { emailLink, phoneLink } from '../lib/commande/inline';
import type { Maybe } from '../lib/todo';
import { installation, type StepId as GuideStepId } from './installation';
import { videosOnline } from './tutoriels';
import type { Link } from './la-box';

/* ---------- Formes des textes ---------- */

/** Écrans du parcours de la page de la HAKO, dans l’ordre. */
export type ScreenId =
  'welcome' | 'people' | 'passwords' | 'sheet' | 'check' | 'accounts' | 'ready';

/** Écrans numérotés (« Écran 2 sur 5 ») : tous, sauf l’accueil et la fin. */
export type StepScreenId = Exclude<ScreenId, 'welcome' | 'ready'>;

/** Écrans d’attente et d’erreur, hors du parcours. */
export type StateId = 'preparing' | 'unreachable' | 'stopped' | 'unexpected' | 'installed';

/** Morceau de texte : du texte, une information manquante ou un lien. */
export type Piece = Maybe<string> | Link;

/** Une ou quelques phrases, en morceaux mis bout à bout (même forme que dans le guide). */
export type Sentence = readonly Piece[];

/** Un cas de « Ça ne marche pas ? » (même forme que dans le guide). */
export interface Problem {
  /** Identifiant court, unique dans l’écran. */
  readonly id: string;
  /** Ce que la personne constate, avec ses mots. */
  readonly title: string;
  /** Pourquoi : la cause, en mots simples. */
  readonly why: readonly Sentence[];
  /** Que faire : des gestes précis, dans l’ordre. */
  readonly fix: readonly Sentence[];
}

/** Encadré. */
export interface Note {
  readonly title: string;
  readonly text: readonly Sentence[];
}

/** Liste titrée. */
export interface ListBlock {
  readonly title: string;
  readonly items: readonly Sentence[];
}

/** Ce que montre chaque écran du parcours. */
interface ScreenBase {
  /** Titre de l’écran (h2) : il reçoit le focus quand l’écran s’affiche. */
  readonly title: string;
  /** Sous le titre : où l’on est, et quoi faire. */
  readonly lead: readonly Sentence[];
  /** Encadrés, après le contenu propre à l’écran. */
  readonly notes?: readonly Note[];
  /** « Pourquoi ? » : à quoi sert cet écran. */
  readonly why?: readonly Sentence[];
  /** « Ça ne marche pas ? » */
  readonly problems?: readonly Problem[];
}

export interface WelcomeScreen extends ScreenBase {
  /** Ce que la personne va faire, dans l’ordre. */
  readonly plan: ListBlock;
  readonly duration: Sentence;
  /** Ce qu’il faut avoir sous la main. */
  readonly needs: ListBlock;
  readonly start: string;
}

/** Raisons de refuser la liste des personnes (une par message). */
export type PeopleError = 'ownerMissing' | 'missing' | 'tooLong' | 'characters' | 'full';

export interface PeopleScreen extends ScreenBase {
  /** Premier champ : la personne responsable de la HAKO. */
  readonly owner: { readonly label: string; readonly hint: string };
  readonly ownerNote: Note;
  /** Champs suivants : « {n} » est le rang de la personne (2, 3…). */
  readonly member: { readonly label: string };
  /**
   * Bouton qui retire une ligne. Nom lu par les lecteurs d’écran : `named`
   * quand le prénom est tapé, `numbered` sinon.
   */
  readonly remove: { readonly label: string; readonly named: string; readonly numbered: string };
  readonly add: string;
  /** Sous le bouton « Ajouter une personne ». */
  readonly limit: string;
  readonly login: {
    /** Sous chaque champ, une fois le prénom tapé : « {identifiant} ». */
    readonly preview: string;
    /**
     * À la place de `preview`, quand l’identifiant reçoit un chiffre :
     * « {autre} » est la personne qui a déjà l’identifiant « {pris} ».
     */
    readonly taken: string;
    /** Comment se forme un identifiant. */
    readonly rule: Sentence;
  };
  readonly children: Sentence;
  /** Au-dessus du formulaire, quand les mots de passe sont déjà créés. */
  readonly renew: Note;
  readonly next: string;
  readonly back: string;
  readonly errors: Readonly<Record<PeopleError, string>>;
}

export interface PasswordsScreen extends ScreenBase {
  /** Carte de chaque personne. */
  readonly card: {
    /** Étiquette de la première personne. */
    readonly owner: string;
    readonly login: string;
    readonly password: string;
    /** Nom du mot de passe lu par les lecteurs d’écran ; « {de_prenom} » : common.of. */
    readonly passwordOf: string;
  };
  /** Au-dessus des cartes, quand les prénoms ont été modifiés : nouveaux mots de passe. */
  readonly renewed: Note;
  readonly facts: ListBlock;
  readonly next: string;
  readonly back: string;
}

/** Une façon de garder la fiche. */
export interface Way {
  readonly id: 'imprimer' | 'pdf' | 'main';
  readonly title: string;
  readonly text: readonly Sentence[];
}

export interface SheetScreen extends ScreenBase {
  /** Titre de l’aperçu de la fiche, à l’écran. */
  readonly preview: string;
  readonly ways: { readonly title: string; readonly items: readonly Way[] };
  /** Le bouton ouvre la fenêtre d’impression, qui sait aussi enregistrer en PDF. */
  readonly print: string;
  /** Sous le bouton, après un premier appui. */
  readonly printed: Sentence;
  readonly next: string;
  readonly back: string;
}

/** Raisons de refuser le mot de passe recopié. */
export type CheckError = 'empty' | 'wrong' | 'uppercase' | 'space' | 'character' | 'again';

export interface CheckScreen extends ScreenBase {
  /** Sous le champ : le mot de passe n’est plus affiché, c’est voulu. */
  readonly hidden: Sentence;
  /** « {de_prenom} » : la personne responsable (common.of). */
  readonly field: { readonly label: string; readonly hint: string };
  /** Case qui montre ce que l’on tape. */
  readonly show: string;
  readonly submit: string;
  /** Libellé du bouton pendant la vérification. */
  readonly busy: string;
  /** Annoncé, puis affiché au-dessus du bouton « Créer les comptes ». */
  readonly success: string;
  readonly create: string;
  /** Retour à l’écran des mots de passe. */
  readonly review: string;
  /** « {de_prenom} » : la personne responsable. `again` : après trois essais. */
  readonly errors: Readonly<Record<CheckError, string>>;
  readonly back: string;
}

/** Une ligne de l’avancement de la création des comptes. */
export interface Task {
  readonly id: 'photos' | 'files' | 'finish';
  readonly label: string;
  /** Annoncé aux lecteurs d’écran quand la ligne est terminée. */
  readonly done: string;
}

export interface AccountsScreen extends ScreenBase {
  readonly tasks: readonly Task[];
  /** État de chaque ligne. */
  readonly status: { readonly waiting: string; readonly running: string; readonly done: string };
  /** Encadré, sous l’avancement. */
  readonly keep: Note;
}

/** Bouton « Mes photos » ou « Mes fichiers ». */
export interface AppButton {
  readonly id: 'photos' | 'files';
  readonly label: string;
  /** Surtitre de la carte : l’application. */
  readonly role: string;
  /** Adresse sur la HAKO : lien quand elle est connue, texte provisoire sinon. */
  readonly address: Maybe<string>;
}

export interface ReadyScreen extends ScreenBase {
  readonly apps: readonly AppButton[];
  readonly phones: {
    readonly title: string;
    readonly text: readonly Sentence[];
    /** Adresse à taper dans chaque application. */
    readonly addresses: readonly Sentence[];
    /** Bouton de retour au guide, dans le même onglet. */
    readonly guide: Link;
  };
  readonly later: Note;
  readonly next: ListBlock;
  /** Annoncé à l’arrivée sur l’écran. */
  readonly done: string;
}

/** Écran d’attente ou d’erreur. */
export interface StateScreen {
  readonly title: string;
  /** Ce qui se passe, et pourquoi. */
  readonly text: readonly Sentence[];
  /** Que faire, dans l’ordre. */
  readonly fix: readonly Sentence[];
  /** Bouton principal ; sans lui, l’écran montre « Mes photos » et « Mes fichiers ». */
  readonly action?: string;
}

/** La fiche de secours (une page A4, en portrait). */
export interface Printout {
  readonly title: string;
  /** Titre de la page pendant l’impression : le nom proposé pour le fichier PDF. */
  readonly fileName: string;
  readonly subtitle: string;
  /** Encadré, sous le titre. */
  readonly keep: readonly Sentence[];
  readonly box: {
    readonly title: string;
    readonly rows: readonly Sentence[];
    readonly note: Sentence;
  };
  readonly people: {
    readonly title: string;
    readonly columns: {
      readonly firstName: string;
      readonly login: string;
      readonly password: string;
    };
    /** Après le prénom de la première personne. */
    readonly owner: string;
    readonly note: Sentence;
  };
  readonly tips: ListBlock;
  /** Cadre à remplir à la main. */
  readonly notes: { readonly title: string; readonly hint: string };
  /** Suivi d’un filet à remplir à la main (pas de tirets bas : ils seraient lus). */
  readonly date: string;
  readonly footer: readonly Sentence[];
}

/* ---------- Liens repris d’un écran à l’autre ---------- */

/** Renvoi vers une étape du guide : « l’étape « Installez les applications… » ». */
function guideStep(id: GuideStepId): Link {
  const step = installation.steps.find((candidate) => candidate.id === id);
  if (!step) throw new Error(`Étape du guide introuvable (${id}).`);
  return { label: 'l’étape « ' + step.title + ' »', href: `${routes.install}#etape-${id}` };
}

/** Lien vers la page Contact. */
const contact = (label: string): Link => ({ label, href: routes.contact });

/** Le guide d’installation, depuis son début. */
const guide: Link = { label: 'le guide d’installation', href: routes.install };

/** Les tutoriels : au futur tant qu’aucune vidéo n’est en ligne (même règle que le guide). */
const tutorials: Sentence = videosOnline
  ? [
      'Pour prendre votre HAKO en main, à votre rythme : ',
      { label: 'nos tutoriels vidéo', href: routes.tutorials },
      '.',
    ]
  : ['Pour prendre votre HAKO en main, à votre rythme : nos tutoriels vidéo, bientôt en ligne.'];

/* ---------- Textes ---------- */

export const assistant = {
  /* ----- Page du site, autour de la démonstration ----- */

  page: {
    meta: {
      title: 'Démonstration de la première installation',
      description:
        'Essayez la page de votre HAKO qui crée un compte et un mot de passe pour chaque personne de la maison. Démonstration : rien n’est envoyé.',
    },
    intro: {
      kicker: 'Installer votre HAKO',
      title: 'Démonstration de la première installation',
      lead: 'Voici la page que votre HAKO affiche pour sa première installation. Elle crée un compte pour chaque personne de la maison, avec son mot de passe. Essayez-la ici, écran par écran, sans rien installer.',
      points: [
        {
          title: 'Ce que vous voyez',
          text: [
            [
              'Le cadre ci-dessous imite la page de votre HAKO, telle qu’elle s’affiche chez vous, à l’adresse ',
              boxAddress.display,
              '. Tapez des prénoms, découvrez les mots de passe, imprimez la fiche de secours : vous faites les mêmes gestes que pour la vraie installation.',
            ],
          ],
        },
        {
          title: 'Pourquoi c’est une démonstration',
          text: [
            [
              'Aucune HAKO n’est reliée à cette page : tout se passe dans votre navigateur. Rien n’est envoyé, rien n’est enregistré, et tout s’efface quand vous rechargez la page.',
            ],
            [
              'Les mots de passe affichés sont des exemples, toujours les mêmes : ils n’ouvrent rien.',
            ],
          ],
        },
        {
          title: 'Et chez vous ?',
          text: [
            [
              'La vraie première installation se fait sur la page de votre HAKO, jamais sur ce site.',
            ],
            [
              'C’est votre HAKO qui crée vos mots de passe, chez vous. Ils ne passent pas par internet. Nous ne gardons aucun moyen d’accès à vos données.',
            ],
            [
              'Pour installer votre HAKO, suivez ',
              guide,
              ' jusqu’à ',
              guideStep('installation'),
              '.',
            ],
          ],
        },
      ] satisfies readonly Note[],
    },
    /** Cadre qui entoure la démonstration ; l’adresse, décorative, imite la barre d’adresse. */
    frame: {
      label: 'La page de votre HAKO, en démonstration',
      address: boxAddress.display,
    },
    /** Sans JavaScript, à la place de la démonstration. */
    noscript: [
      'La démonstration a besoin de JavaScript. ',
      { label: 'Le guide d’installation', href: routes.install },
      ', lui, se lit sans.',
    ] satisfies Sentence,
    next: {
      title: 'Pour aller plus loin',
      links: [
        { label: 'Le guide d’installation', href: routes.install },
        { label: 'Questions fréquentes', href: routes.faq },
        { label: 'Nous contacter', href: routes.contact },
      ] satisfies readonly Link[],
    },
  },

  /* ----- Mentions de la démonstration (jamais sur la vraie HAKO) ----- */

  demo: {
    /** Bandeau permanent, en haut de chaque écran de la démonstration. */
    banner: {
      text: 'Démonstration : rien n’est envoyé, aucune HAKO n’est installée.',
      /** Recommence la démonstration (bouton du bandeau « Démonstration »). */
      restart: 'Recommencer',
      guide: {
        label: 'Revenir au guide',
        href: `${routes.install}#etape-installation`,
      } satisfies Link,
    },
    /** Annoncé aux lecteurs d’écran après « Recommencer ». */
    restarted: 'La démonstration repart du début.',
    /** Remplace, en démonstration, le pied de page de la HAKO (common.footer). */
    footer:
      'Démonstration : cette page imite celle de votre HAKO. Chez vous, elle vient de votre HAKO, et ne passe pas par internet.',
    /** Écran « Bienvenue », sous le chapeau. */
    welcome:
      'En démonstration, cette page vient du site HAKO, et aucune HAKO n’est branchée. Chez vous, elle viendra de votre HAKO.',
    /** Écran « Qui va utiliser votre HAKO ? ». */
    people: {
      note: 'En démonstration, tapez de vrais prénoms ou des prénoms inventés : ils restent sur votre appareil, et s’effacent quand vous rechargez la page.',
      fill: 'Remplir avec des prénoms d’exemple',
      fillNote: 'En démonstration, ce bouton tape pour vous des prénoms d’exemple.',
    },
    /** Écran « Vos mots de passe ». */
    passwords:
      'En démonstration, ces mots de passe sont des exemples, toujours les mêmes : ils commencent par « exemple » et finissent par 00. Sur votre HAKO, chaque mot de passe est tiré au hasard, et finit par un nombre de 10 à 99.',
    /** Écran « Vos mots de passe », après des prénoms modifiés (screens.passwords.renewed). */
    passwordsRenewed:
      'En démonstration, les mots de passe d’exemple restent les mêmes. Sur votre HAKO, ils changent.',
    /** Écran « Gardez vos mots de passe sur une fiche ». */
    sheet:
      'En démonstration, la fiche porte la mention « EXEMPLE ». Imprimez-la ou enregistrez-la pour voir à quoi elle ressemble, puis jetez-la : ses mots de passe n’ouvrent rien.',
    /** Écran « Vérifiez votre fiche ». */
    check: {
      fill: 'Remplir avec le mot de passe d’exemple',
      note: 'En démonstration, ce bouton tape pour vous le mot de passe de la fiche d’exemple.',
    },
    /** Écran « Votre HAKO crée vos comptes ». */
    accounts: 'En démonstration, la création ne prend que quelques secondes.',
    /** Écran « C’est prêt ». */
    ready: {
      /** Sous le titre : rien n’est installé. */
      note: 'En démonstration, rien n’a été installé et aucun compte n’a été créé : votre HAKO attend toujours sa première installation. Chez vous, cet écran s’affiche à la fin de la vraie installation.',
      apps: 'En démonstration, ces deux boutons ne mènent nulle part. Sur votre HAKO, « Mes photos » ouvre l’application Immich, et « Mes fichiers » l’application Nextcloud.',
      /** Remplace, en démonstration, le bouton de retour au guide (screens.ready.phones.guide). */
      guide: {
        label: 'Revenir au guide pour faire la vraie installation',
        href: `${routes.install}#etape-page`,
      } satisfies Link,
      /** Annoncé à l’arrivée sur l’écran, à la place de screens.ready.done. */
      done: 'Fin de la démonstration : aucune HAKO n’a été installée.',
      end: {
        title: 'Fin de la démonstration',
        text: [
          [
            'Chez vous, la page de votre HAKO s’arrête ici. Il reste ensuite à installer les applications sur les téléphones : c’est la dernière étape du guide.',
          ],
          ['Pour faire la vraie installation, revenez au guide, à ', guideStep('page'), '.'],
        ],
      } satisfies Note,
    },
    /** Fiche de secours de la démonstration. */
    printout: {
      /** Filigrane, en travers de la fiche, à l’écran comme à l’impression. */
      watermark: 'EXEMPLE',
      title: 'Fiche de secours (exemple)',
      fileName: 'Fiche de secours HAKO (exemple)',
      footer: 'Démonstration : ces mots de passe sont des exemples. Ils n’ouvrent aucune HAKO.',
    },
    /** Facultatif : montrer les écrans d’attente et d’erreur, par exemple au jury. */
    scenarios: {
      title: 'Voir un autre écran',
      hint: 'Ce que montre aussi la page de votre HAKO : quand quelque chose bloque, ou une fois installée.',
      items: {
        preparing: 'Votre HAKO se prépare encore',
        unreachable: 'Votre HAKO ne répond plus',
        stopped: 'La création des comptes s’est arrêtée',
        unexpected: 'Quelque chose s’est mal passé',
        installed: 'Votre HAKO est installée',
      } satisfies Readonly<Record<StateId, string>>,
    },
  },

  /* ----- Page de la HAKO : ce qui revient sur chaque écran ----- */

  common: {
    /** À côté du logo, en haut de chaque écran. */
    title: 'Première installation',
    /** En bas de chaque écran. */
    footer: 'Cette page vient de votre HAKO, chez vous : elle ne passe pas par internet.',
    /** Sans JavaScript. */
    noscript: [
      'Cette page a besoin de JavaScript, un réglage du navigateur qui est actif d’habitude. Essayez avec un autre navigateur, ou ',
      contact('écrivez-nous'),
      '.',
    ] satisfies Sentence,
    /**
     * Si le script ne démarre pas (navigateur trop ancien), à la place du
     * bouton « Commencer », qui ne répondrait pas.
     */
    stuck: [
      'Cette page ne démarre pas avec ce navigateur, sans doute trop ancien. Essayez avec un autre appareil, ou ',
      contact('écrivez-nous'),
      '.',
    ] satisfies Sentence,
    /** Titre, lu par les lecteurs d’écran, de l’indicateur des écrans. */
    stepsLabel: 'Les écrans de l’installation',
    /**
     * « {n} » : numéro de l’écran ; « {total} » : nombre d’écrans. « Écran »,
     * pas « Étape » : les étapes sont celles du guide.
     */
    stepOf: 'Écran {n} sur {total}',
    /** « {de_prenom} » des libellés : « de Marc », mais « d’Hélène » devant une voyelle ou un h. */
    of: { consonant: 'de {prenom}', vowel: 'd’{prenom}' },
    /** Après un écran fait, dans l’indicateur (lu par les lecteurs d’écran). */
    stepDone: '(faite)',
    /** Écrans numérotés, dans l’ordre, avec leur nom court dans l’indicateur. */
    steps: [
      { id: 'people', name: 'Les personnes' },
      { id: 'passwords', name: 'Les mots de passe' },
      { id: 'sheet', name: 'La fiche' },
      { id: 'check', name: 'La vérification' },
      { id: 'accounts', name: 'Les comptes' },
    ] satisfies readonly { readonly id: StepScreenId; readonly name: string }[],
    next: 'Continuer',
    back: 'Retour',
    /** Attente courte, quand la HAKO répond. */
    loading: 'Un instant…',
    retry: 'Réessayer',
    why: 'Pourquoi ?',
    problems: 'Ça ne marche pas ?',
    problemsHint: 'Choisissez ce qui vous arrive : chaque cas dit pourquoi, et que faire.',
    problemWhy: 'Pourquoi',
    problemFix: 'Que faire',
    /** Sous « Ça ne marche pas ? », sur chaque écran. */
    stillStuck: [
      'Ça bloque toujours ? ',
      contact('Écrivez-nous ou appelez-nous'),
      ', en nous disant sur quel écran vous êtes.',
    ] satisfies Sentence,
    /** Après chaque lien de la page de la HAKO vers le site, qui s’ouvre dans un nouvel onglet. */
    newTab: '(s’ouvre dans un nouvel onglet)',
    /** Résumé des erreurs ; « {n} » : nombre d’erreurs. */
    errors: {
      titleOne: 'Il y a 1 point à corriger',
      titleMany: 'Il y a {n} points à corriger',
      /** Avant chaque message, pour les lecteurs d’écran. */
      prefix: 'Erreur : ',
    },
    /** Panneau « Besoin d’aide ? », sur chaque écran. */
    help: {
      title: 'Besoin d’aide ?',
      text: [
        [
          'Cette page est expliquée dans le guide d’installation, à ',
          guideStep('installation'),
          '.',
        ],
        [
          'Une question ? Voyez ',
          { label: 'les questions fréquentes', href: routes.faq },
          ', ou ',
          contact('écrivez-nous'),
          '.',
        ],
        [toConfirm.neverAsk],
      ],
    } satisfies Note,
  },

  /** Ordre des écrans du parcours. */
  order: [
    'welcome',
    'people',
    'passwords',
    'sheet',
    'check',
    'accounts',
    'ready',
  ] satisfies readonly ScreenId[],

  /* ----- Page de la HAKO : les écrans du parcours ----- */

  screens: {
    welcome: {
      title: 'Bienvenue',
      lead: [
        [
          'Cette page vient de votre HAKO, pas d’internet. Si elle s’affiche, votre HAKO est bien branchée, et prête pour sa première installation.',
        ],
        ['Quand tout est prêt, appuyez sur « Commencer », en bas de cet écran.'],
      ],
      plan: {
        title: 'Ce que vous allez faire',
        items: [
          ['Taper le prénom de chaque personne de la maison.'],
          ['Découvrir le mot de passe de chacune : c’est votre HAKO qui le crée.'],
          [
            'Garder ces mots de passe sur une fiche de secours : une feuille imprimée, enregistrée en PDF ou recopiée à la main.',
          ],
          ['Vérifier votre fiche, puis laisser votre HAKO créer les comptes.'],
        ],
      },
      duration: ['Comptez ', pending.duration, '.'],
      needs: {
        title: 'Ce qu’il vous faut',
        items: [
          ['Le prénom de chaque personne qui aura un compte.'],
          [
            'Une imprimante reliée à cet appareil. Sinon, une feuille et un stylo, ou un fichier PDF à imprimer plus tard.',
          ],
          ['Un moment au calme : les mots de passe ne s’affichent que pendant l’installation.'],
        ],
      },
      notes: [
        {
          title: 'Quelqu’un vous aide ?',
          text: [
            [
              'Un proche ou un membre de notre équipe peut vous guider, mais c’est vous qui tapez, et vous qui gardez la fiche. Vos mots de passe ne regardent que vous.',
            ],
          ],
        },
      ],
      why: [
        [
          'Chaque personne aura son espace à elle, pour ses photos et ses fichiers, protégé par son propre mot de passe.',
        ],
        [
          'Votre HAKO crée ces mots de passe elle-même, chez vous. Nous ne gardons aucun moyen d’accès à vos données : c’est notre engagement ',
          { label: '« Zéro accès »', href: routes.commitment },
          '.',
        ],
      ],
      start: 'Commencer',
      problems: [
        {
          id: 'non-securise',
          title: 'Votre navigateur affiche « Non sécurisé ».',
          why: [
            [
              'Le navigateur, c’est l’application qui affiche cette page. Il le dit parce que l’adresse de votre HAKO commence par http://, sans « s » : sa page n’a pas de cadenas. Ce qu’elle affiche n’est pas chiffré pendant son trajet, mais ce trajet reste dans le réseau de la maison : il ne passe pas par internet.',
            ],
          ],
          fix: [
            [
              'Sur le Wi-Fi de votre maison, que seuls vos proches utilisent, vous pouvez continuer.',
            ],
            [
              'Si votre réseau est partagé avec d’autres logements (résidence, immeuble), arrêtez-vous ici et ',
              contact('écrivez-nous'),
              ' : quelqu’un d’autre sur ce réseau pourrait lire vos mots de passe.',
            ],
          ],
        },
        {
          id: 'autre-appareil',
          title: 'Votre imprimante est reliée à un autre appareil.',
          why: [
            [
              'Pour imprimer la fiche de secours sans détour, mieux vaut faire l’installation depuis l’appareil relié à l’imprimante.',
            ],
          ],
          fix: [
            [
              'Sur cet autre appareil, ouvrez ',
              boxAddress.display,
              ', puis appuyez sur « Commencer ».',
            ],
            ['Ou restez ici : vous pourrez enregistrer la fiche en PDF, ou la recopier à la main.'],
          ],
        },
      ],
    } satisfies WelcomeScreen,

    people: {
      title: 'Qui va utiliser votre HAKO ?',
      lead: [
        [
          'Tapez le prénom de chaque personne qui aura un compte. Chacune aura son espace à elle, pour ses photos et ses fichiers, avec son propre mot de passe.',
        ],
      ],
      owner: {
        label: 'Prénom de la personne responsable',
        hint: 'Elle s’occupera de la HAKO pour toute la maison. En général, c’est la personne qui fait cette installation.',
      },
      ownerNote: {
        title: 'La personne responsable',
        text: [
          [
            'C’est elle qui gérera les comptes de la maison. Choisissez une personne qui habite la maison.',
          ],
        ],
      },
      member: { label: 'Prénom de la personne {n}' },
      remove: {
        label: 'Retirer',
        named: 'Retirer {prenom}',
        numbered: 'Retirer la personne {n}',
      },
      add: 'Ajouter une personne',
      limit: `Jusqu’à ${MAX_PEOPLE} personnes.`,
      login: {
        preview: 'Identifiant : {identifiant}',
        taken:
          'Identifiant : {identifiant}. Le chiffre est ajouté parce que {autre} a déjà {pris}.',
        rule: [
          'Chaque personne aura un identifiant, le nom qui sert à se connecter : son prénom en minuscules, sans accent ni espace, suivi de ',
          LOGIN_DOMAIN,
          '. Par exemple, ',
          loginExample.firstName,
          ' devient ',
          loginExample.login,
          '.',
        ],
      },
      children: [
        'Les jeunes enfants n’ont pas forcément besoin d’un compte : leurs photos peuvent rester dans celui d’un parent.',
      ],
      renew: {
        title: 'Vos mots de passe sont déjà créés',
        text: [
          [
            'Si vous modifiez les prénoms, votre HAKO en créera de nouveaux pour tout le monde : votre fiche de secours sera à refaire.',
          ],
        ],
      },
      why: [
        [
          'Avec un compte chacun, chaque personne retrouve ses photos et ses fichiers à elle. Vous pourrez ensuite partager des albums et des dossiers entre vous.',
        ],
      ],
      next: 'Continuer',
      back: 'Retour',
      errors: {
        ownerMissing: 'Tapez le prénom de la personne responsable.',
        missing: 'Tapez un prénom, ou retirez cette ligne.',
        tooLong:
          'Ce prénom est trop long : ' + String(FIRST_NAME_MAX_LENGTH) + ' caractères au maximum.',
        characters:
          'Tapez le prénom en lettres de l’alphabet latin, de a à z, accents compris. Les espaces, les traits d’union (-) et les apostrophes sont acceptés.',
        full: `Vous avez atteint ${MAX_PEOPLE} personnes, le maximum pour cette installation.`,
      },
      problems: [
        {
          id: 'prenom-refuse',
          title: 'Un prénom est refusé.',
          why: [
            [
              'Un prénom ne peut contenir que des lettres de l’alphabet latin, accents compris, et si besoin des espaces, des traits d’union (-) ou des apostrophes. Les chiffres, les points et les émojis (les petits dessins du clavier) ne sont pas acceptés.',
            ],
          ],
          fix: [
            ['Effacez le prénom, puis retapez-le avec des lettres seulement.'],
            [
              'Un prénom écrit dans un autre alphabet (arabe, cyrillique, chinois…) se tape en lettres latines : Ivan pour Иван, par exemple.',
            ],
            ['Un surnom convient aussi, s’il ne contient que des lettres.'],
          ],
        },
        {
          id: 'meme-prenom',
          title: 'Deux personnes ont le même prénom, ou presque.',
          why: [
            [
              'Deux comptes ne peuvent pas avoir le même identifiant, et l’identifiant perd les accents : Zoé et Zoë donnent le même.',
            ],
          ],
          fix: [
            [
              'Vous n’avez rien à faire : votre HAKO ajoute un chiffre à l’identifiant de la deuxième personne, par exemple ',
              duplicateExample.login,
              '.',
            ],
            ['Sur la fiche de secours, notez à côté de chaque prénom qui est qui.'],
          ],
        },
        {
          id: 'trop-de-personnes',
          title: `Vous êtes plus de ${MAX_PEOPLE} dans la maison.`,
          why: [[`La première installation crée ${MAX_PEOPLE} comptes au plus.`]],
          fix: [
            [`Créez d’abord les comptes de ${MAX_PEOPLE} personnes.`],
            ['Pour ajouter les autres ensuite : ', toConfirm.addPerson, '.'],
          ],
        },
        {
          id: 'responsable',
          title: 'Vous ne savez pas qui choisir comme responsable.',
          why: [
            [
              'La personne responsable gérera les comptes de la maison : mieux vaut quelqu’un qui habite la maison, et qui pourra aider les autres.',
            ],
          ],
          fix: [
            ['Choisissez la personne qui fait cette installation, si elle habite la maison.'],
            ['Sinon, une personne de la maison à l’aise avec un téléphone ou un ordinateur.'],
          ],
        },
      ],
    } satisfies PeopleScreen,

    passwords: {
      title: 'Vos mots de passe',
      lead: [
        [
          'Votre HAKO vient de les créer, ici, chez vous. Personne d’autre ne les a, pas même notre équipe.',
        ],
      ],
      card: {
        owner: 'Responsable de la HAKO',
        login: 'Identifiant',
        password: 'Mot de passe',
        passwordOf: 'Mot de passe {de_prenom}',
      },
      renewed: {
        title: 'Nouveaux mots de passe',
        text: [
          [
            'Vous avez modifié les prénoms : votre HAKO a créé de nouveaux mots de passe pour tout le monde. Si vous aviez déjà fait une fiche, elle ne vaut plus : déchirez-la, puis refaites-la.',
          ],
        ],
      },
      facts: {
        title: 'Bon à savoir',
        items: [
          ['Un seul mot de passe par personne : il ouvre à la fois ses photos et ses fichiers.'],
          [
            'Ce sont des mots de tous les jours, en minuscules et sans accent, séparés par des tirets (-), avec un nombre à la fin. Les tirets font partie du mot de passe. Le zéro est barré, pour ne pas le confondre avec la lettre o.',
          ],
          [
            'L’identifiant ressemble à une adresse e-mail, mais ce n’en est pas une : il sert seulement à se connecter à votre HAKO.',
          ],
        ],
      },
      notes: [
        {
          title: 'Visibles pendant l’installation seulement',
          text: [
            [
              'Votre HAKO ne montre ces mots de passe que pendant cette installation. Une fois les comptes créés, elle ne pourra plus les afficher : à l’étape suivante, vous les gardez sur une fiche de secours.',
            ],
          ],
        },
      ],
      why: [
        [
          'Votre HAKO tire ces mots de passe au hasard : ils sont plus difficiles à deviner que ceux que l’on invente, et faciles à recopier.',
        ],
      ],
      next: 'Faire ma fiche de secours',
      back: 'Modifier les prénoms',
      problems: [
        {
          id: 'difficile-a-lire',
          title: 'Un caractère est difficile à lire.',
          why: [
            [
              'Un mot de passe ne contient que des lettres minuscules sans accent, des tirets (-) et deux chiffres à la fin. Jamais de majuscule, d’espace ni d’autre signe.',
            ],
            [
              'Les tirets font partie du mot de passe. Le zéro est barré, pour ne pas le confondre avec la lettre o.',
            ],
          ],
          fix: [
            [
              'Agrandissez la page : sur un téléphone ou une tablette, écartez deux doigts sur l’écran. Sur un ordinateur, appuyez en même temps sur Ctrl et + (Cmd et + sur un Mac).',
            ],
            ['Lisez le mot de passe mot par mot : ce sont des mots de tous les jours.'],
          ],
        },
        {
          id: 'prenom-faux',
          title: 'Un prénom ou un identifiant est mal écrit.',
          why: [['Une faute de frappe s’est glissée à l’écran précédent.']],
          fix: [
            [
              'Appuyez sur « Modifier les prénoms », corrigez, puis revenez ici. Vos mots de passe changeront : refaites alors votre fiche.',
            ],
          ],
        },
        {
          id: 'choisir',
          title: 'Vous préférez choisir votre mot de passe.',
          why: [
            [
              'Pour l’installation, votre HAKO crée les mots de passe elle-même : tirés au hasard, ils sont plus difficiles à deviner.',
            ],
          ],
          fix: [
            ['Gardez celui-ci pour l’installation.'],
            [
              'Vous pourrez le changer plus tard, dans l’application des photos et dans celle des fichiers. Changez-le dans les deux, puis notez le nouveau sur votre fiche.',
            ],
          ],
        },
      ],
    } satisfies PasswordsScreen,

    sheet: {
      title: 'Gardez vos mots de passe sur une fiche',
      lead: [
        [
          'Cette fiche de secours sera la seule trace de vos mots de passe. Une fois l’installation finie, votre HAKO ne pourra plus les afficher, et personne d’autre ne les a, pas même notre équipe.',
        ],
      ],
      preview: 'Aperçu de votre fiche',
      ways: {
        title: 'Choisissez une de ces trois façons',
        items: [
          {
            id: 'imprimer',
            title: 'Imprimez-la',
            text: [
              [
                'Appuyez sur « Imprimer ou enregistrer la fiche » : la fenêtre d’impression s’ouvre. Choisissez votre imprimante, puis lancez l’impression.',
              ],
            ],
          },
          {
            id: 'pdf',
            title: 'Ou enregistrez-la en PDF',
            text: [
              [
                'Un fichier PDF est un document enregistré sur votre appareil, à imprimer plus tard. Sur un ordinateur ou sur Android, appuyez sur le même bouton, puis choisissez « Enregistrer au format PDF » à la place de votre imprimante.',
              ],
              ['Sur un iPhone ou un iPad : ', pending.iosPdf, '.'],
              [
                'Imprimez ce fichier dès que possible, puis supprimez-le, sans oublier la corbeille : il peut être copié tout seul hors de chez vous (iCloud, Google Drive, OneDrive).',
              ],
            ],
          },
          {
            id: 'main',
            title: 'Ou recopiez-la à la main',
            text: [
              [
                'Sur une feuille, en lettres bien lisibles : les trois adresses de la partie « Votre HAKO », puis, pour chaque personne, son prénom, son identifiant et son mot de passe, sans oublier les tirets (-).',
              ],
              [
                'Cela prend quelques minutes. Sur un téléphone ou une tablette, touchez l’écran de temps en temps, pour que l’appareil ne se mette pas en veille.',
              ],
            ],
          },
        ],
      },
      print: 'Imprimer ou enregistrer la fiche',
      printed: [
        'La fenêtre d’impression ne s’est pas ouverte ? Voyez « Ça ne marche pas ? », plus bas.',
      ],
      notes: [
        {
          title: 'Où la ranger',
          text: [
            ['Avec vos papiers importants, à l’abri des regards.'],
            [
              'Ne la prenez pas en photo : votre téléphone pourrait envoyer la photo hors de chez vous, vers Google Photos ou iCloud.',
            ],
            ['Ne l’envoyez à personne, ni par message ni par e-mail.'],
          ],
        },
      ],
      why: [
        [
          'Si une personne oublie son mot de passe, la fiche le lui redonne. Elle vous servira aussi pour installer les applications sur vos téléphones.',
        ],
      ],
      next: 'J’ai ma fiche, continuer',
      back: 'Retour',
      problems: [
        {
          id: 'impression-bloquee',
          title: 'Rien ne se passe quand vous appuyez sur le bouton.',
          why: [
            [
              'La fenêtre d’impression s’est peut-être ouverte derrière cette page, ou votre navigateur l’a bloquée.',
            ],
          ],
          fix: [
            ['Sur un ordinateur, appuyez en même temps sur Ctrl et P (Cmd et P sur un Mac).'],
            [
              'Sur un iPhone ou un iPad, dans Safari : appuyez sur le bouton de partage (un carré d’où sort une flèche), puis sur « Imprimer ».',
            ],
            [
              'Sur Android, dans Chrome : ouvrez le menu (les trois points), puis « Partager » et « Imprimer ».',
            ],
          ],
        },
        {
          id: 'imprimante-absente',
          title: 'Votre imprimante n’apparaît pas dans la liste.',
          why: [
            [
              'Cet appareil ne trouve pas l’imprimante : elle est éteinte, reliée à un autre Wi-Fi, ou pas encore installée sur cet appareil.',
            ],
          ],
          fix: [
            ['Allumez l’imprimante, et vérifiez qu’elle est reliée au Wi-Fi de la maison.'],
            [
              'Sinon, enregistrez la fiche en PDF, puis imprimez-la plus tard depuis un appareil qui connaît votre imprimante.',
            ],
            ['Ou recopiez-la à la main.'],
          ],
        },
        {
          id: 'pdf-introuvable',
          title: 'Vous ne trouvez pas « Enregistrer au format PDF ».',
          why: [['Son nom et sa place changent selon l’appareil et le navigateur.']],
          fix: [
            [
              'Sur un ordinateur, ouvrez la liste des imprimantes, dans la fenêtre d’impression : « Enregistrer au format PDF » y figure en général. Sur un Mac, avec Safari, cherchez le bouton « PDF », en bas de la fenêtre.',
            ],
            [
              'Sur Android, touchez la liste des imprimantes, en haut de l’écran, puis « Enregistrer au format PDF ». Ensuite : ',
              pending.androidPdf,
              '.',
            ],
            ['Sur un iPhone ou un iPad : ', pending.iosPdf, '.'],
            ['Vous ne le trouvez toujours pas ? Recopiez la fiche à la main.'],
          ],
        },
        {
          id: 'sans-imprimante',
          title: 'Vous n’avez pas d’imprimante.',
          why: [
            [
              'Votre HAKO ne montre les mots de passe que pendant l’installation : il faut les garder ailleurs que sur l’écran.',
            ],
          ],
          fix: [
            ['Recopiez-la à la main, caractère par caractère : c’est le plus sûr.'],
            [
              'Ou enregistrez-la en PDF, puis imprimez-la plus tard chez un proche de confiance, en emportant votre appareil. Ne l’envoyez ni par message ni par e-mail.',
            ],
          ],
        },
        {
          id: 'photo',
          title: 'Vous aimeriez prendre la fiche en photo.',
          why: [
            [
              'Votre téléphone copie souvent ses photos sur internet, dans Google Photos ou iCloud : vos mots de passe sortiraient de chez vous.',
            ],
          ],
          fix: [['Imprimez la fiche, enregistrez-la en PDF, ou recopiez-la à la main.']],
        },
      ],
    } satisfies SheetScreen,

    check: {
      title: 'Vérifiez votre fiche',
      lead: [
        [
          'Prenez votre fiche de secours, sur papier ou en PDF. Tapez ci-dessous le mot de passe de la personne responsable, tel qu’il y est écrit.',
        ],
      ],
      hidden: [
        'Il n’est plus affiché à l’écran : c’est voulu. Ainsi, c’est bien votre fiche que vous vérifiez.',
      ],
      field: {
        label: 'Mot de passe {de_prenom}',
        hint: 'En minuscules, avec les tirets (-), sans espace.',
      },
      show: 'Afficher ce que je tape',
      submit: 'Vérifier',
      busy: 'Vérification…',
      success: 'C’est bien ça : votre fiche est prête. Appuyez sur « Créer les comptes ».',
      create: 'Créer les comptes',
      review: 'Revoir mes mots de passe',
      errors: {
        empty: 'Tapez le mot de passe {de_prenom}, tel qu’il est écrit sur votre fiche.',
        wrong:
          'Ce n’est pas tout à fait ça. Comparez avec votre fiche, mot par mot, sans oublier les tirets (-).',
        uppercase:
          'Il y a une majuscule : les mots de passe n’en ont pas. Votre téléphone l’a peut-être ajoutée de lui-même, au début.',
        space: 'Il y a un espace : les mots sont séparés par des tirets (-), sans espace.',
        character:
          'Il y a une lettre accentuée ou un signe (à, é, &…) : un mot de passe n’en a pas. Pour taper un chiffre sur un ordinateur, appuyez en même temps sur la touche Maj et sur la touche du chiffre.',
        again:
          'Votre fiche contient peut-être une erreur de copie. Revoyez vos mots de passe, puis corrigez votre fiche.',
      },
      notes: [
        {
          title: 'Vous avez recopié la fiche à la main ?',
          text: [
            [
              'Relisez aussi les autres mots de passe, un par un : appuyez sur « Revoir mes mots de passe », et comparez chaque caractère avec votre fiche.',
            ],
          ],
        },
      ],
      why: [
        [
          'Recopier un mot de passe montre que votre fiche est là, et lisible. Vérifiez-la maintenant : une fois les comptes créés, votre HAKO ne pourra plus vous montrer les mots de passe.',
        ],
      ],
      back: 'Retour',
      problems: [
        {
          id: 'refuse',
          title: 'Le mot de passe est refusé, alors que vous l’avez bien recopié.',
          why: [
            [
              'Un seul caractère différent suffit : une majuscule ajoutée par le téléphone, un espace à la fin, un tiret oublié, ou un mot changé par le correcteur automatique.',
            ],
            [
              'Sur un ordinateur, un chiffre tapé sans la touche Maj devient « à », « é » ou « & ».',
            ],
          ],
          fix: [
            ['Cochez « Afficher ce que je tape », pour voir ce que vous avez tapé.'],
            ['Comparez avec votre fiche, mot par mot.'],
            ['Effacez ce qui ne va pas, puis retapez lentement.'],
            [
              'Vous avez modifié les prénoms après avoir fait votre fiche ? Les mots de passe ont changé : appuyez sur « Revoir mes mots de passe », puis refaites votre fiche.',
            ],
          ],
        },
        {
          id: 'tiret',
          title: 'Vous ne trouvez pas le tiret (-) sur le clavier.',
          why: [['Sur un téléphone ou une tablette, le tiret est rangé avec les chiffres.']],
          fix: [
            [
              'Appuyez sur la touche « 123 », « ?123 » ou, sur un iPad, « .?123 », en bas du clavier : le tiret apparaît.',
            ],
            ['Pour revenir aux lettres, appuyez sur « ABC ».'],
          ],
        },
        {
          id: 'fiche-absente',
          title: 'Vous n’avez pas votre fiche sous les yeux.',
          why: [
            [
              'Elle est peut-être restée dans l’imprimante, ou dans un fichier que vous ne retrouvez pas.',
            ],
          ],
          fix: [
            ['Allez la chercher, puis revenez sur cette page.'],
            [
              'Vous ne la retrouvez pas ? Appuyez sur « Revoir mes mots de passe », puis refaites votre fiche.',
            ],
          ],
        },
      ],
    } satisfies CheckScreen,

    accounts: {
      title: 'Votre HAKO crée vos comptes',
      lead: [
        [
          'Elle prépare un espace pour chaque personne, dans l’application des photos, puis dans celle des fichiers. Comptez ',
          pending.accountsDuration,
          '.',
        ],
      ],
      tasks: [
        {
          id: 'photos',
          label: 'Les comptes des photos (Immich)',
          done: 'Les comptes des photos sont créés.',
        },
        {
          id: 'files',
          label: 'Les comptes des fichiers (Nextcloud)',
          done: 'Les comptes des fichiers sont créés.',
        },
        {
          id: 'finish',
          label: 'Les derniers réglages',
          done: 'Les derniers réglages sont faits.',
        },
      ],
      status: { waiting: 'À venir', running: 'En cours…', done: 'Terminé' },
      keep: {
        title: 'Pendant la création',
        text: [['Laissez votre HAKO branchée, et cette page ouverte.']],
      },
      why: [
        [
          'Une fois les comptes créés, votre HAKO oublie vos mots de passe : elle ne garde que de quoi les reconnaître quand vous vous connectez. Votre fiche en est donc la seule trace.',
        ],
      ],
      problems: [
        {
          id: 'long',
          title: 'C’est plus long que prévu.',
          why: [
            [
              'Votre HAKO prépare les comptes l’un après l’autre : plus vous êtes nombreux, plus cela prend de temps.',
            ],
          ],
          fix: [['Patientez encore un peu, sans débrancher votre HAKO ni fermer cette page.']],
        },
        {
          id: 'page-fermee',
          title: 'Vous avez fermé cette page pendant la création.',
          why: [['Un geste de travers, un appareil qui se met en veille : cela arrive.']],
          fix: [
            ['Rouvrez ', boxAddress.display, ' depuis le même appareil.'],
            ['Ce qui se passe ensuite : ', pending.closedDuringCreation, '.'],
          ],
        },
      ],
    } satisfies AccountsScreen,

    ready: {
      title: 'C’est prêt',
      lead: [
        [
          'Votre HAKO est installée : chaque personne a son compte, pour ses photos et ses fichiers. Vos mots de passe ne sont plus que sur votre fiche de secours.',
        ],
      ],
      apps: [
        {
          id: 'photos',
          label: 'Mes photos',
          role: 'Application Immich',
          address: pending.photosAddress,
        },
        {
          id: 'files',
          label: 'Mes fichiers',
          role: 'Application Nextcloud',
          address: pending.filesAddress,
        },
      ],
      phones: {
        title: 'Sur les téléphones de la maison',
        text: [
          [
            'Chaque personne installe deux applications sur son téléphone : Immich pour les photos, Nextcloud pour les fichiers. Elle s’y connecte avec l’identifiant et le mot de passe de la fiche.',
          ],
          ['Chaque application demande d’abord sa propre adresse :'],
        ],
        addresses: [
          ['Dans Immich : ', pending.photosAddress],
          ['Dans Nextcloud : ', pending.filesAddress],
        ],
        guide: {
          label: 'Revenir au guide pour installer les applications',
          href: `${routes.install}#etape-applications`,
        },
      },
      later: {
        title: 'Plus tard',
        text: [
          [
            'Ouvrez ',
            boxAddress.display,
            ' depuis un appareil de la maison : vous y retrouverez vos photos et vos fichiers. Ajoutez cette adresse à vos favoris.',
          ],
        ],
      },
      next: {
        title: 'Et maintenant ?',
        items: [
          [
            'Rangez votre fiche de secours avec vos papiers importants. Vous l’avez enregistrée en PDF ? Imprimez-la dès que possible, puis supprimez le fichier de cet appareil.',
          ],
          [
            'Donnez à chaque personne son identifiant et son mot de passe, de vive voix ou sur papier, jamais par message ni par e-mail.',
          ],
          [
            'Laissez votre HAKO branchée en permanence : c’est elle qui garde vos photos et vos fichiers.',
          ],
          [
            'Gardez aussi vos photos sur vos téléphones : votre HAKO n’a pas encore de copie de secours.',
          ],
          tutorials,
        ],
      },
      done: 'Votre HAKO est installée.',
      problems: [
        {
          id: 'bouton',
          title: '« Mes photos » ou « Mes fichiers » ne s’ouvre pas.',
          why: [
            ['Ces pages ne s’ouvrent que depuis un appareil relié au réseau de la maison.'],
            [
              'Pour en savoir plus : ',
              {
                label: 'Puis-je voir mes photos hors de chez moi ?',
                href: `${routes.faq}#hors-de-chez-moi`,
              },
            ],
          ],
          fix: [
            ['Vérifiez que cet appareil est relié au Wi-Fi de la maison.'],
            ['Attendez une minute, puis réessayez.'],
          ],
        },
        {
          id: 'application',
          title: 'Une application ne trouve pas votre HAKO.',
          why: [
            [
              'Souvent, l’adresse a été tapée sans « http:// » au début, ou le téléphone n’est pas sur le Wi-Fi de la maison.',
            ],
          ],
          fix: [['Suivez les cas expliqués à ', guideStep('applications'), '.']],
        },
        {
          id: 'mot-de-passe-refuse',
          title: 'L’identifiant ou le mot de passe est refusé.',
          why: [
            [
              'Un seul caractère différent suffit : une majuscule ajoutée par le téléphone, un espace à la fin, un tiret oublié.',
            ],
          ],
          fix: [
            ['Retapez-les en recopiant la fiche, caractère par caractère.'],
            ['Vérifiez que le téléphone n’a pas mis de majuscule au début.'],
          ],
        },
      ],
    } satisfies ReadyScreen,
  },

  /* ----- Page de la HAKO : écrans d’attente et d’erreur ----- */

  states: {
    /** Si la page s’ouvre pendant le premier démarrage de la HAKO. */
    preparing: {
      title: 'Votre HAKO se prépare encore',
      text: [
        [
          'C’est son premier démarrage : elle installe les applications de vos photos et de vos fichiers. Vous n’avez rien à faire.',
        ],
      ],
      fix: [
        ['Laissez votre HAKO branchée.'],
        [
          'Rechargez cette page un peu plus tard. Le guide dit combien de temps compter : ',
          guideStep('preparation'),
          '.',
        ],
      ],
      action: 'Recharger la page',
    },
    /** La HAKO ne répond plus, quel que soit l’écran. */
    unreachable: {
      title: 'Votre HAKO ne répond plus',
      text: [
        [
          'Cet appareil a peut-être quitté le Wi-Fi de la maison, ou s’est mis en veille. Ou votre HAKO a été débranchée.',
        ],
      ],
      fix: [
        ['Vérifiez que cet appareil est relié au Wi-Fi de la maison.'],
        ['Vérifiez que votre HAKO est branchée.'],
        ['Puis appuyez sur « Réessayer ».'],
        ['Pour reprendre l’installation : ', toConfirm.resumeInstall, '.'],
      ],
      action: 'Réessayer',
    },
    /** La création des comptes s’est arrêtée avant la fin. */
    stopped: {
      title: 'La création des comptes s’est arrêtée',
      text: [
        ['Votre HAKO n’a pas pu terminer : elle a peut-être été débranchée, ou elle a redémarré.'],
      ],
      fix: [
        [
          'Vérifiez que votre HAKO est branchée, et que cet appareil est relié au Wi-Fi de la maison.',
        ],
        ['Puis appuyez sur « Réessayer ».'],
        ['Ce que devient votre fiche : ', pending.afterStop, '.'],
      ],
      action: 'Réessayer',
    },
    /** Réponse que la page ne sait pas lire. */
    unexpected: {
      title: 'Quelque chose s’est mal passé',
      text: [['Votre HAKO a répondu de façon inattendue. Cela peut arriver.']],
      fix: [
        ['Appuyez sur « Réessayer ».'],
        [
          'Si ce message revient, ',
          contact('écrivez-nous'),
          ', en nous disant sur quel écran vous étiez.',
        ],
      ],
      action: 'Réessayer',
    },
    /**
     * La première installation est faite : l’écran de tous les jours, quand on
     * rouvre la page de la HAKO, avec « Mes photos » et « Mes fichiers ».
     */
    installed: {
      title: 'Votre HAKO est installée',
      text: [
        [
          'Sa première installation est faite. Pour voir vos photos ou vos fichiers, appuyez sur « Mes photos » ou « Mes fichiers ».',
        ],
      ],
      fix: [
        [
          'Vous n’avez pas fait la première installation ? Demandez aux personnes de la maison qui l’a faite : elle a la fiche de secours.',
        ],
        ['Personne ne l’a faite ? ', contact('Écrivez-nous'), ' avant d’aller plus loin.'],
        ['Vous avez perdu la fiche de secours ? ', toConfirm.lostSheet, '.'],
      ],
    },
  } satisfies Readonly<Record<StateId, StateScreen>>,

  /* ----- Fiche de secours (A4) ----- */

  printout: {
    title: 'Fiche de secours',
    fileName: 'Fiche de secours HAKO',
    subtitle: 'Les comptes et les mots de passe de votre HAKO',
    keep: [
      [
        'À ranger avec vos papiers importants. Cette fiche est la seule trace de vos mots de passe. Votre HAKO ne peut plus les afficher. Personne d’autre ne les a, pas même notre équipe.',
      ],
    ],
    box: {
      title: 'Votre HAKO',
      rows: [
        ['Adresse : ', boxAddress.display],
        ['Photos (application Immich) : ', pending.photosAddress],
        ['Fichiers (application Nextcloud) : ', pending.filesAddress],
      ],
      note: [
        'Ces adresses ne s’ouvrent qu’à la maison, depuis un appareil relié au Wi-Fi ou à votre box internet.',
      ],
    },
    people: {
      title: 'Les personnes de la maison',
      columns: { firstName: 'Prénom', login: 'Identifiant', password: 'Mot de passe' },
      owner: '(responsable de la HAKO)',
      note: [
        'Un seul mot de passe par personne : il ouvre ses photos et ses fichiers. Tapez-le avec ses tirets (-).',
      ],
    },
    tips: {
      title: 'Bon à savoir',
      items: [
        [
          'Rangez cette fiche à l’abri des regards. Ne la prenez pas en photo : votre téléphone pourrait envoyer la photo hors de chez vous.',
        ],
        [
          'Vous changez un mot de passe ? Changez-le dans l’application des photos et dans celle des fichiers, puis notez-le ci-dessous.',
        ],
        [
          'Une personne a oublié son mot de passe ? La personne responsable de la HAKO peut lui en donner un nouveau : ',
          toConfirm.resetPassword,
          '.',
        ],
        [toConfirm.neverAsk],
      ],
    },
    notes: { title: 'Notes', hint: 'Nouveau mot de passe, nouvelle personne…' },
    date: 'Date :',
    footer: [
      ['Fiche créée par votre HAKO, chez vous. Notre équipe n’en a aucune copie.'],
      ['Besoin d’aide ? ', emailLink(company.email), ' · ', phoneLink(company.phone)],
    ],
  } satisfies Printout,
} as const;
