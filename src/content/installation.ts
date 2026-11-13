/**
 * Textes du guide d’installation (/installer/) : tout ce que la page affiche,
 * libellés des boutons et du chronomètre compris. Le script de la page
 * n’écrit aucun texte lui-même : il lit ceux-ci dans la page.
 *
 * Le guide accompagne une personne qui reçoit sa HAKO chez elle et
 * l’installe seule, sans s’y connaître en informatique : phrases courtes,
 * un geste par ligne, chaque mot technique expliqué la première fois,
 * jamais de reproche ni d’urgence.
 *
 * Comment modifier les textes :
 * - Chaque étape a un identifiant (`id`) qui sert d’ancre dans l’adresse de
 *   la page (#etape-cable) : ne le changez pas. Les titres des étapes sont
 *   dans `titles` : les renvois d’une étape à l’autre les reprennent.
 * - Une étape dit quoi faire (`actions` : un geste par ligne, verbe à
 *   l’impératif), pourquoi (`why`), comment savoir que c’est bon
 *   (`success`), puis « Ça ne marche pas ? » (`problems`). Chaque cas a un
 *   titre (ce que la personne constate), « Pourquoi » (`why` : la cause en
 *   mots simples) et « Que faire » (`fix` : des gestes précis, dans
 *   l’ordre). `devices` signale un cas propre à un appareil.
 * - Un texte est une liste de morceaux mis bout à bout : du texte, une
 *   information manquante (todo(…), écrite dans src/data/installation.ts)
 *   ou un lien { label, href }. C’est la forme de RichText
 *   (src/lib/commande/types.ts) : src/components/commande/RichText.astro
 *   sait l’afficher.
 * - Les faits (adresse de la HAKO, adresses des applications, versions
 *   d’Android, de macOS et de Windows, informations à confirmer) sont dans
 *   src/data/installation.ts. Les liens vers les pages du site lisent
 *   src/data/navigation.ts.
 * - Dans un libellé, « {n} », « {total} », « {m} » et « {s} » sont
 *   remplacés par la page : « {n} étapes faites sur {total} » devient
 *   « 3 étapes faites sur 8 ».
 *
 * Vocabulaire : notre produit s’appelle toujours « la HAKO » ou « votre
 * HAKO » ; l’appareil de l’opérateur, « votre box internet ». Jamais « box »
 * seul : on ne saurait pas duquel des deux il s’agit.
 *
 * Typographie : apostrophe ’, espaces insécables avant « : », « ; », « ? »,
 * « ! » et à l’intérieur des guillemets « ». withFrenchTypography ne
 * s’applique pas dans src/content/ : ces espaces sont tapées ici.
 */
import { loginExample, pending } from '../data/assistant';
import { company } from '../data/entreprise';
import { backupCopy } from '../data/faits';
import {
  apps,
  appsMinVersion,
  boxAddress,
  boxPage,
  requirements,
  toConfirm,
} from '../data/installation';
import { routes } from '../data/navigation';
import { emailLink, phoneLink } from '../lib/commande/inline';
import type { Maybe } from '../lib/todo';
import type { Link } from './la-box';
import { videosOnline } from './tutoriels';

/* ---------- Formes des textes ---------- */

/** Identifiants des étapes, dans l’ordre. Ils servent d’ancre : #etape-cable. */
export type StepId =
  | 'carton'
  | 'place'
  | 'cable'
  | 'alimentation'
  | 'preparation'
  | 'page'
  | 'installation'
  | 'applications';

/** Appareil choisi à l’étape « Ouvrez la page de votre HAKO ». */
export type DeviceId = 'iphone' | 'android' | 'ordinateur';

/** Morceau de texte : du texte, une information manquante ou un lien. */
export type Piece = Maybe<string> | Link;

/** Une ou quelques phrases, en morceaux mis bout à bout (même forme que RichText). */
export type Sentence = readonly Piece[];

/** Un cas de « Ça ne marche pas ? ». */
export interface Problem {
  /** Identifiant court, unique dans l’étape (ancre possible : #etape-cable-pas-de-cable). */
  readonly id: string;
  /** Ce que la personne constate, avec ses mots. */
  readonly title: string;
  /** Pourquoi : la cause, en mots simples. */
  readonly why: readonly Sentence[];
  /** Que faire : des gestes précis, dans l’ordre. */
  readonly fix: readonly Sentence[];
  /** Cas propre à certains appareils (sans cette clé : tous). */
  readonly devices?: readonly DeviceId[];
}

/** Encadré à lire dans une étape. */
export interface Note {
  readonly title: string;
  readonly text: readonly Sentence[];
}

/** Liste titrée (ce que la page de la HAKO demande, ce qu’elle fait). */
export interface ListBlock {
  readonly title: string;
  readonly items: readonly Sentence[];
}

interface StepBase {
  /** Nom court, pour la liste des étapes. */
  readonly short: string;
  /** Titre, à l’impératif. */
  readonly title: string;
  /** Une ou deux phrases sous le titre. */
  readonly intro?: readonly Sentence[];
  /** Quoi faire : un geste par ligne. */
  readonly actions: readonly Sentence[];
  /** Pourquoi on le fait. */
  readonly why: readonly Sentence[];
  /** Comment savoir que c’est bon. */
  readonly success: readonly Sentence[];
  /** Encadrés. */
  readonly notes?: readonly Note[];
  /** Phrase juste au-dessus du bouton « C’est fait ». */
  readonly nextHint?: Sentence;
  /** Phrase d’entrée de « Ça ne marche pas ? ». */
  readonly problemsIntro?: Sentence;
  readonly problems: readonly Problem[];
}

export interface PlainStep extends StepBase {
  readonly id: 'carton' | 'place' | 'cable' | 'alimentation';
}

/** Chronomètre de l’étape « Laissez la HAKO se préparer ». */
export interface Chronometer {
  readonly title: string;
  readonly intro: string;
  readonly start: string;
  readonly reset: string;
  /** Nom du temps affiché. */
  readonly label: string;
  /**
   * Ligne d’état tant que le chronomètre n’est pas lancé (le temps affiche
   * alors « 0 min 00 s », en pâle) ; c’est aussi ce que lisent les lecteurs
   * d’écran.
   */
  readonly idle: string;
  /** Temps affiché : « {m} » minutes, « {s} » secondes sur deux chiffres. */
  readonly display: string;
  /** Temps lu par les lecteurs d’écran, une fois par minute au plus. */
  readonly spoken: { readonly zero: string; readonly one: string; readonly many: string };
  /** Le chronomètre ne garde rien en mémoire. */
  readonly memory: string;
  /** Sans JavaScript, à la place du chronomètre. */
  readonly noscript: string;
}

export interface PreparationStep extends StepBase {
  readonly id: 'preparation';
  readonly chronometer: Chronometer;
}

/** Bouton vers la page de la HAKO, et son adresse écrite en grand. */
export interface OpenPage {
  /** Texte du bouton (lien qui s’ouvre dans le même onglet). */
  readonly label: string;
  readonly href: string;
  readonly addressLabel: string;
  /** Adresse écrite en grand, à recopier. */
  readonly address: string;
  /** Sous le bouton. */
  readonly hint: Sentence;
  /** Sous l’adresse : comment la taper sur un autre appareil. */
  readonly typeIt: Sentence;
}

/** Consignes propres à un type d’ordinateur (Mac, Windows). */
export interface DeviceVariant {
  readonly id: string;
  readonly title: string;
  readonly text: readonly Sentence[];
}

/** Consignes pour un appareil. */
export interface DeviceGuide {
  readonly id: DeviceId;
  /** Libellé du choix. */
  readonly label: string;
  /** Titre des consignes. */
  readonly title: string;
  readonly actions: readonly Sentence[];
  readonly note?: Sentence;
  readonly variants?: readonly DeviceVariant[];
}

export interface DeviceChoice {
  readonly question: string;
  readonly hint: Sentence;
  /** Pour qui ne sait pas quel appareil il a. */
  readonly unsure: string;
  readonly options: readonly DeviceGuide[];
}

export interface PageStep extends StepBase {
  readonly id: 'page';
  readonly open: OpenPage;
  /**
   * Juste au-dessus du bouton : ce qui va se passer, à lire avant d’appuyer
   * (la page de la HAKO remplace le guide et lance la première installation).
   */
  readonly beforeOpen: Note;
  /** Comment revenir au guide depuis la page de la HAKO (aussi au-dessus du bouton). */
  readonly back: Note;
  readonly devices: DeviceChoice;
}

export interface InstallationStep extends StepBase {
  readonly id: 'installation';
  /** Ce que la page de la HAKO va demander. */
  readonly asks: ListBlock;
  /** Ce qu’elle va faire. */
  readonly does: ListBlock;
  /**
   * Phrase et lien vers la démonstration (/installer/demonstration/) : les
   * mêmes écrans, avec des exemples, pour les voir avant de commencer.
   */
  readonly demo: Sentence;
  readonly demoLink: Link;
  /** Le bouton de l’étape « page », repris après les gestes : on le trouve en lisant. */
  readonly open: Link;
}

/** Une application à installer sur les téléphones. */
export interface AppCopy {
  readonly id: 'immich' | 'nextcloud';
  readonly name: string;
  /** À quoi elle sert, en quelques mots. */
  readonly role: string;
  readonly text: string;
  /** Liens vers l’App Store et Google Play. */
  readonly links: readonly Link[];
}

export interface ApplicationsStep extends StepBase {
  readonly id: 'applications';
  readonly apps: readonly AppCopy[];
  /** Pour aller plus loin. */
  readonly more: Sentence;
}

export type Step = PlainStep | PreparationStep | PageStep | InstallationStep | ApplicationsStep;

/** Un objet à réunir avant de commencer. */
export interface Need {
  /** Choisit l’icône affichée à côté (src/components/installation/BeforeYouStart.astro). */
  readonly id: 'hako' | 'cable' | 'prise' | 'appareil' | 'impression';
  /** Intitulé court, en D-DIN gras : ce qu’il faut avoir. */
  readonly text: Sentence;
  /** Explications, un paragraphe par phrase ou groupe de phrases. */
  readonly detail?: readonly Sentence[];
}

/** Un mot du lexique. */
export interface Term {
  readonly term: string;
  readonly definition: string;
}

/* ---------- Titres et liens repris d’une étape à l’autre ---------- */

/** Titres des étapes. */
const titles = {
  carton: 'Ouvrez le carton',
  place: 'Choisissez la place de la HAKO',
  cable: 'Reliez la HAKO à votre box internet',
  alimentation: 'Branchez le bloc d’alimentation',
  preparation: 'Laissez la HAKO se préparer',
  page: 'Ouvrez la page de votre HAKO',
  installation: 'Faites la première installation',
  applications: 'Installez les applications sur vos téléphones',
} as const satisfies Record<StepId, string>;

/** Renvoi vers une autre étape : « l’étape « Choisissez la place de la HAKO » ». */
const toStep = (id: StepId): Link => ({
  label: 'l’étape « ' + titles[id] + ' »',
  href: `#etape-${id}`,
});

/**
 * Renvoi vers un cas « Ça ne marche pas ? » : le lien ouvre l’étape avec ce
 * cas déjà déplié (#etape-cable-pas-de-cable). `id` est celui du cas.
 */
const toProblem = (step: StepId, id: string, label: string): Link => ({
  label,
  href: `#etape-${step}-${id}`,
});

/** Lien vers la page Contact. */
const contactLink = (label: string): Link => ({ label, href: routes.contact });

/** Lien vers la page de la HAKO, écrit avec son adresse. */
const boxLink: Link = { label: boxAddress.display, href: boxAddress.url };

/** Nom du bouton qui ouvre la page de la HAKO, cité dans les consignes. */
const openLabel = 'Ouvrir la page de votre HAKO';

/** Titre de l’encadré qui dit comment revenir au guide (étape « page »). */
const backTitle = 'Pour revenir à ce guide';

/** Un libellé de la page de la HAKO (src/data/installation.ts, boxPage), entre guillemets. */
const quote = (label: string): string => '« ' + label + ' »';

/** Lien vers la page des tutoriels. */
const tutorialsLink: Link = { label: 'nos tutoriels vidéo', href: routes.tutorials };

/**
 * Renvoi vers les tutoriels : au futur tant qu’aucune vidéo n’est en ligne
 * (même règle que la page Tutoriels, src/content/tutoriels.ts), avec un moyen
 * de nous joindre en attendant. Même forme que la démonstration
 * (src/content/assistant.ts) : « … à votre rythme : nos tutoriels vidéo,
 * bientôt en ligne. »
 */
const tutorialsSentence = (lead: string): Sentence =>
  videosOnline
    ? [lead + ', voyez ', tutorialsLink, '.']
    : [
        lead + ' : ',
        tutorialsLink,
        ', bientôt en ligne. En attendant, ',
        contactLink('écrivez-nous ou appelez-nous'),
        '.',
      ];

/* ---------- Étapes ---------- */

const steps = [
  {
    id: 'carton',
    short: 'Le carton',
    title: titles.carton,
    actions: [
      ['Ouvrez le carton.'],
      ['Sortez votre HAKO et son bloc d’alimentation (le chargeur fourni).'],
      ['Posez-les sur une table, le temps de leur choisir une place.'],
    ],
    why: [
      [
        'Pour vérifier que rien ne manque et que rien n’a souffert du transport, avant de brancher quoi que ce soit.',
      ],
    ],
    success: [
      [
        'Vous avez devant vous votre HAKO et son bloc d’alimentation. Dans le carton : ',
        toConfirm.boxContents,
        '.',
      ],
    ],
    problems: [
      {
        id: 'pas-de-cable',
        title: 'Il n’y a pas de câble réseau dans le carton.',
        why: [['C’est normal : le câble réseau n’est pas fourni. Vous en avez peut-être déjà un.']],
        fix: [
          ['Regardez dans le carton de votre box internet : il y en a souvent un.'],
          ['Sinon, ', toProblem('cable', 'pas-de-cable', 'voyez quel câble acheter'), '.'],
        ],
      },
      {
        id: 'alimentation-absente',
        title: 'Le bloc d’alimentation n’est pas dans le carton.',
        why: [
          [
            'Il a pu être oublié à l’emballage. La HAKO a besoin d’une alimentation puissante : un autre chargeur pourrait être trop faible pour elle.',
          ],
        ],
        fix: [
          ['Ne branchez pas la HAKO sur un autre chargeur.'],
          [contactLink('Écrivez-nous'), ' pour nous le signaler.'],
        ],
      },
      {
        id: 'abimee',
        title: 'Votre HAKO semble abîmée.',
        why: [
          [
            'Le transport a pu la secouer : un boîtier fêlé, ou quelque chose qui bouge à l’intérieur quand vous la penchez doucement.',
          ],
        ],
        fix: [
          ['Ne la branchez pas.'],
          ['Prenez en photo le carton et votre HAKO.'],
          [contactLink('Écrivez-nous'), ' avec ces photos : nous vous dirons quoi faire.'],
        ],
      },
    ],
  },
  {
    id: 'place',
    short: 'La place',
    title: titles.place,
    actions: [
      ['Posez la HAKO près de votre box internet, sur un meuble stable.'],
      ['Vérifiez qu’une prise électrique libre est à portée.'],
      ['Laissez de l’air autour : pas de placard fermé, rien posé dessus.'],
      ['Tenez-la loin de la chaleur (radiateur, soleil direct) et de l’eau.'],
    ],
    why: [
      [
        'La HAKO se relie à votre box internet par un câble, et elle restera branchée en permanence : c’est elle qui garde vos photos et vos fichiers.',
      ],
      ['Elle a aussi besoin d’air : son ventilateur la garde au frais.'],
    ],
    success: [
      [
        'La HAKO est posée à l’air libre, près d’une prise électrique, et un câble réseau peut aller jusqu’à votre box internet sans être tendu.',
      ],
    ],
    problems: [
      {
        id: 'autre-piece',
        title: 'Votre box internet est dans une autre pièce.',
        why: [['L’installation se fait avec un câble entre la HAKO et votre box internet.']],
        fix: [
          [
            'Prenez un câble réseau plus long : il fonctionne aussi bien, même sur plusieurs dizaines de mètres.',
          ],
          [
            'Autre solution : deux boîtiers appelés CPL, qui font passer le réseau par les fils électriques de la maison. Ils se vendent au même rayon que les câbles réseau.',
          ],
        ],
      },
      {
        id: 'prise-electrique',
        title: 'Il n’y a plus de prise électrique libre.',
        why: [
          [
            'Près d’une box internet, les prises sont souvent déjà occupées : télévision, décodeur, téléphone.',
          ],
        ],
        fix: [['Branchez une multiprise : elle convient à la HAKO.']],
      },
      {
        id: 'meuble-ferme',
        title: 'La seule place possible est dans un meuble fermé.',
        why: [['Enfermée, la HAKO garde sa chaleur. Elle a besoin d’air pour rester au frais.']],
        fix: [['Laissez la porte du meuble ouverte, ou choisissez une étagère ouverte.']],
      },
    ],
  },
  {
    id: 'cable',
    short: 'Le câble',
    title: titles.cable,
    actions: [
      [
        'Branchez un bout du câble réseau dans la prise réseau de la HAKO : ',
        toConfirm.networkPort,
        '.',
      ],
      [
        'Poussez le bout du câble jusqu’à entendre un petit « clic » : son clip en plastique le bloque.',
      ],
      [
        'Ne débranchez aucun des câbles déjà branchés sur votre box internet : internet, la télévision et le téléphone en dépendent.',
      ],
      [
        'Branchez l’autre bout dans une prise réseau libre de votre box internet. Ces prises sont souvent marquées « LAN », « Ethernet » ou d’un numéro.',
      ],
    ],
    why: [
      [
        'C’est par ce câble que la HAKO rejoint le réseau de la maison : tous les appareils reliés à votre box internet, par le Wi-Fi ou par un câble. Vos appareils pourront ensuite la trouver.',
      ],
    ],
    success: [
      ['Le câble tient des deux côtés : il ne ressort pas quand vous tirez doucement dessus.'],
    ],
    problems: [
      {
        id: 'pas-de-cable',
        title: 'Vous n’avez pas de câble réseau.',
        why: [
          ['Le câble réseau n’est pas fourni avec la HAKO, et l’installation se fait avec lui.'],
        ],
        fix: [
          ['Regardez dans le carton de votre box internet : il y en a souvent un.'],
          [
            'Sinon, demandez « un câble Ethernet » (on dit aussi « câble RJ45 ») dans un magasin d’informatique ou de bricolage, ou dans une grande surface.',
          ],
          [
            'N’importe quel câble RJ45 de catégorie 5e ou plus convient, plat ou rond : inutile de prendre le plus cher.',
          ],
          ['Prenez-le un peu plus long que la distance mesurée, pour qu’il ne soit pas tendu.'],
        ],
      },
      {
        id: 'prises-occupees',
        title: 'Toutes les prises réseau de votre box internet sont occupées.',
        why: [
          [
            'Une box internet n’a que quelques prises réseau. Un décodeur de télévision, une console ou un ordinateur les occupent parfois toutes.',
          ],
        ],
        fix: [
          [
            'Débranchez un appareil dont vous pouvez vous passer, comme un ancien ordinateur, et branchez la HAKO à sa place. Ne débranchez ni le câble de la fibre, ni celui du décodeur de télévision.',
          ],
          [
            'Ou ajoutez un petit boîtier qui multiplie les prises réseau, appelé « switch » réseau. Reliez-le à votre box internet avec un câble, puis branchez-y la HAKO. Il se vend au même rayon que les câbles, et se branche en général sur une prise électrique.',
          ],
        ],
      },
      {
        id: 'mauvaise-prise',
        title:
          'Le câble est branché sur la prise du téléphone, sur celle de la fibre, ou sur la prise « WAN ».',
        why: [
          [
            'Votre box internet a d’autres prises qui ressemblent à une prise réseau. Celle du téléphone est plus petite. Celle de la fibre et la prise « WAN » font arriver internet dans votre box internet : la HAKO n’y trouve pas le réseau de la maison.',
          ],
        ],
        fix: [
          [
            'Branchez le câble dans une prise de la même taille que son bout, souvent marquée « LAN », « Ethernet » ou d’un numéro.',
          ],
          [
            'Ne débranchez pas le câble de la fibre ni celui du téléphone : ils apportent internet et le téléphone chez vous.',
          ],
        ],
      },
      {
        id: 'prise-murale',
        title:
          'Vous n’avez pas de box internet à vous, seulement une prise réseau au mur (résidence, immeuble, foyer).',
        why: [
          [
            'Cette prise relie la HAKO au réseau de tout le bâtiment, partagé avec d’autres logements. Ces réseaux empêchent souvent les appareils de se voir entre eux : la page de votre HAKO risque de ne pas s’ouvrir. Et sur un réseau partagé, l’appareil d’un voisin pourrait faire la première installation à votre place.',
          ],
        ],
        fix: [
          [
            'Pour l’instant, la HAKO ne s’installe pas sur un réseau partagé avec d’autres logements : ne la branchez pas sur cette prise.',
          ],
          [contactLink('Écrivez-nous'), ' avant d’aller plus loin.'],
        ],
      },
      {
        id: 'bout-bloque',
        title: 'Le bout du câble n’entre pas dans la prise.',
        why: [
          [
            'Il n’entre que dans un sens. Si la prise vous semble trop petite, c’est sans doute celle du téléphone.',
          ],
        ],
        fix: [
          ['Retournez le bout du câble, sans forcer.'],
          ['S’il n’entre toujours pas, essayez une autre prise de votre box internet.'],
        ],
      },
    ],
  },
  {
    id: 'alimentation',
    short: 'Le bloc d’alimentation',
    title: titles.alimentation,
    actions: [
      [
        'Branchez le câble du bloc d’alimentation sur la HAKO, dans la petite prise ovale (on l’appelle USB-C) : ',
        toConfirm.powerPort,
        '. N’utilisez aucune autre prise.',
      ],
      ['Branchez le bloc d’alimentation sur une prise électrique.'],
    ],
    why: [
      [
        'La HAKO a besoin de courant pour fonctionner. Elle démarre toute seule dès qu’elle est branchée : vous n’avez aucun bouton à presser. Son petit bouton rond sert à l’éteindre ',
        toConfirm.powerButton,
        ' : n’y touchez pas.',
      ],
      [
        'Le bloc fourni lui donne tout le courant dont elle a besoin : un autre chargeur pourrait être trop faible.',
      ],
    ],
    success: [
      [
        'Le bloc d’alimentation est branché des deux côtés : sur la prise électrique et sur la HAKO.',
      ],
      [
        'Le voyant de la HAKO : ',
        toConfirm.led,
        '. Même allumé, il ne dit pas si la HAKO est prête : elle doit encore se préparer, à ',
        toStep('preparation'),
        '.',
      ],
    ],
    nextHint: [
      'Juste après avoir branché la HAKO, passez à ',
      toStep('preparation'),
      ' : notez l’heure sur un papier, puis lancez le chronomètre.',
    ],
    problems: [
      {
        id: 'autre-chargeur',
        title: 'Vous avez branché un autre chargeur que le bloc fourni.',
        why: [
          [
            'La HAKO a besoin d’une alimentation puissante. Un chargeur de téléphone ou d’ordinateur ne donne souvent pas assez de courant : la HAKO peut alors ne pas démarrer, ou s’arrêter au hasard.',
          ],
        ],
        fix: [
          ['Débranchez ce chargeur.'],
          ['Branchez le bloc d’alimentation fourni avec la HAKO.'],
          [
            'Vous ne le retrouvez pas ? ',
            contactLink('Écrivez-nous'),
            ' : nous vous dirons lequel utiliser.',
          ],
        ],
      },
      {
        id: 'allumee',
        title: 'Vous ne savez pas si la HAKO est allumée.',
        why: [['Un câble mal enfoncé, ou une multiprise éteinte, suffit à la priver de courant.']],
        fix: [
          [
            'Vérifiez que le bloc d’alimentation est bien enfoncé des deux côtés : dans la prise électrique et dans la HAKO.',
          ],
          ['Si vous utilisez une multiprise avec un interrupteur, vérifiez qu’il est allumé.'],
          ['Essayez une autre prise électrique, par exemple celle d’une lampe qui fonctionne.'],
          [
            'Pour vérifier, ouvrez plus tard la page de votre HAKO : elle s’ouvre quand la HAKO est prête. Voyez ',
            toStep('page'),
            '.',
          ],
        ],
      },
      {
        id: 'voyant',
        title: 'Le voyant de la HAKO clignote, ou reste rouge.',
        why: [['Le voyant de la HAKO : ', toConfirm.led, '.']],
        fix: [
          [
            'Vérifiez que vous utilisez le bloc d’alimentation fourni, bien enfoncé des deux côtés.',
          ],
          [
            'Débranchez le bloc de la prise électrique, attendez 10 secondes, puis rebranchez-le : la HAKO redémarre.',
          ],
          [
            'Le voyant clignote encore, ou reste rouge ? ',
            contactLink('Écrivez-nous'),
            ' en nous décrivant ce qu’il fait.',
          ],
        ],
      },
      {
        id: 'bouton',
        title: 'Vous avez appuyé sur le petit bouton rond de la HAKO.',
        why: [
          [
            'Ce bouton éteint la HAKO, même pendant sa préparation : son voyant passe alors au rouge ',
            toConfirm.powerButton,
            '.',
          ],
        ],
        fix: [
          ['Appuyez une fois sur ce bouton : la HAKO redémarre ', toConfirm.powerButton, '.'],
          [
            'Si rien ne change, débranchez le bloc d’alimentation de la prise électrique, attendez 10 secondes, puis rebranchez-le.',
          ],
        ],
      },
    ],
  },
  {
    id: 'preparation',
    short: 'La préparation',
    title: titles.preparation,
    intro: [
      [
        'À son premier démarrage, la HAKO se prépare toute seule : elle installe les applications de vos photos et de vos fichiers. Vous n’avez rien à faire.',
      ],
    ],
    actions: [
      ['Laissez la HAKO branchée, sans y toucher.'],
      [
        'Notez l’heure du branchement sur un papier, puis lancez le chronomètre : il repart de zéro si ce guide se recharge.',
      ],
      ['Patientez : comptez ', toConfirm.firstBoot, '.'],
    ],
    why: [
      [
        'La HAKO installe ses applications une seule fois, à son premier démarrage : c’est pourquoi ce premier démarrage prend du temps.',
      ],
    ],
    success: [
      ['Pour le savoir, passez à ', toStep('page'), ' et appuyez sur « ' + openLabel + ' ».'],
      [
        'Si la HAKO n’est pas encore prête, votre navigateur (Safari, Chrome, Firefox ou Edge) affiche un message d’erreur, par exemple « Safari ne peut pas ouvrir la page » ou « Ce site est inaccessible ». Rien n’est cassé : revenez à ce guide avec la flèche de retour du navigateur, attendez 5 minutes, puis réessayez.',
      ],
      [
        'Ou la page de votre HAKO s’ouvre sur ' +
          quote(boxPage.preparing) +
          ' : restez-y, et appuyez sur ' +
          quote(boxPage.reload) +
          ' 5 minutes plus tard.',
      ],
      ['Le chronomètre compte seulement le temps écoulé : il ne sait pas quand la HAKO aura fini.'],
    ],
    notes: [
      {
        title: 'Pendant l’attente',
        text: [
          [
            'Allumez votre imprimante et vérifiez qu’elle a du papier, ou préparez une feuille et un stylo.',
          ],
          [
            'Pensez au prénom de chaque personne de la maison qui aura un compte, et choisissez la personne responsable de la HAKO : en général, celle qui fait l’installation.',
          ],
          [
            'Vous pouvez déjà installer sur vos téléphones les applications Immich (photos) et Nextcloud (fichiers), sans les ouvrir : voyez ',
            toStep('applications'),
            ', puis revenez ici avec la flèche de retour du navigateur.',
          ],
        ],
      },
    ],
    chronometer: {
      title: 'Chronomètre',
      intro:
        'Lancez-le juste après avoir branché la HAKO : il compte alors le temps écoulé depuis le branchement.',
      start: 'Lancer le chronomètre',
      reset: 'Remettre à zéro',
      label: 'Temps écoulé depuis le branchement',
      idle: 'Pas encore lancé',
      display: '{m} min {s} s',
      spoken: { zero: 'Moins d’une minute', one: '1 minute', many: '{n} minutes' },
      memory:
        'Ce chronomètre ne garde rien en mémoire : si vous rechargez ou fermez cette page, il repart de zéro. Votre HAKO, elle, continue sa préparation.',
      noscript:
        'Le chronomètre ne s’affiche pas sur ce navigateur. Notez simplement l’heure à laquelle vous avez branché la HAKO.',
    },
    problems: [
      {
        id: 'debranchee',
        title: 'La HAKO a été débranchée pendant sa préparation.',
        why: [['Sans courant, la HAKO s’arrête, et sa préparation avec elle.']],
        fix: [
          ['Rebranchez-la, puis remettez le chronomètre à zéro.'],
          ['Ce qui se passe ensuite : ', toConfirm.resumeAfterUnplug, '.'],
        ],
      },
      {
        id: 'chronometre-a-zero',
        title: 'Le chronomètre est revenu à zéro.',
        why: [
          [
            'Ce guide ne garde rien sur votre appareil. Si la page est rechargée ou fermée, le chronomètre repart de zéro. Votre HAKO, elle, continue sa préparation.',
          ],
        ],
        fix: [['Comptez à partir de l’heure notée au branchement, ou relancez le chronomètre.']],
      },
      {
        id: 'longue',
        title: 'La préparation vous semble longue.',
        why: [
          [
            'La première fois, la HAKO a beaucoup à installer. Les démarrages suivants n’auront plus ce travail à faire.',
          ],
        ],
        fix: [
          ['Laissez-la branchée et patientez encore.'],
          [
            'Sa page ne s’ouvre toujours pas au bout de ',
            toConfirm.slowBoot,
            ' ? ',
            contactLink('Écrivez-nous'),
            '.',
          ],
        ],
      },
    ],
  },
  {
    id: 'page',
    short: 'La page de la HAKO',
    title: titles.page,
    intro: [
      [
        'Votre HAKO a sa propre page, un peu comme un site internet. Elle ne s’ouvre que chez vous, depuis un appareil relié au réseau de la maison.',
      ],
    ],
    actions: [
      [
        'Prenez de préférence un appareil qui imprime déjà sur votre imprimante : vous y imprimerez directement la fiche de secours.',
      ],
      [
        'Choisissez-le ci-dessous, et suivez ses consignes : elles se terminent par le bouton « ' +
          openLabel +
          ' ».',
      ],
    ],
    why: [
      [
        'C’est sur cette page que se fait la première installation. Elle ne passe pas par internet : c’est pourquoi seul un appareil relié au réseau de la maison peut l’ouvrir.',
      ],
    ],
    success: [
      [
        'La page de votre HAKO s’affiche à la place de ce guide : en haut, ' +
          quote(boxPage.header) +
          ', puis le titre ' +
          quote(boxPage.welcome) +
          ' et le bouton ' +
          quote(boxPage.start) +
          '.',
      ],
      [
        'Elle affiche ' +
          quote(boxPage.preparing) +
          ' ? Attendez 5 minutes, puis appuyez sur ' +
          quote(boxPage.reload) +
          '.',
      ],
    ],
    notes: [
      {
        title: 'Deux mots à connaître',
        text: [
          [
            'Le navigateur est l’application qui ouvre les pages internet : Safari, Chrome, Firefox ou Edge, par exemple.',
          ],
          [
            'La barre d’adresse est la zone du navigateur où s’écrit l’adresse de la page : en haut de l’écran, ou en bas dans Safari sur iPhone.',
          ],
        ],
      },
      {
        title: 'Si votre navigateur affiche « Non sécurisé »',
        text: [
          [
            'Ce message est normal : l’adresse de votre HAKO commence par http://, sans « s ». Sa page n’a donc pas de cadenas. Elle ne passe pas par internet, seulement par le réseau de la maison. Sur votre propre Wi-Fi, vous pouvez continuer.',
          ],
        ],
      },
    ],
    open: {
      label: openLabel,
      href: boxAddress.url,
      addressLabel: 'Adresse à taper',
      address: boxAddress.display,
      hint: [
        'Ce bouton ne marche que sur un appareil relié au réseau de la maison. La page de votre HAKO s’ouvre alors à la place de ce guide.',
      ],
      typeIt: [
        'Sur un autre appareil, tapez cette adresse en entier dans la barre d’adresse, puis appuyez sur la touche Entrée, ou sur la touche en bas à droite du clavier d’un téléphone. Tapez bien « http:// » au début : sans lui, votre navigateur cherche « ' +
          boxAddress.host +
          ' » sur internet, et ne trouve pas votre HAKO.',
      ],
    },
    beforeOpen: {
      title: 'Avant d’appuyer sur ce bouton',
      text: [
        [
          'La page de votre HAKO va remplacer ce guide. Elle vous demandera le prénom de chaque personne de la maison, en commençant par la personne responsable, puis affichera vos mots de passe, pendant l’installation seulement.',
        ],
        [
          'Allumez votre imprimante, ou préparez une feuille et un stylo. Ne prenez pas les mots de passe en photo.',
        ],
        ['Votre navigateur affichera peut-être « Non sécurisé » : chez vous, c’est attendu.'],
        [
          'Avant d’appuyer, lisez ',
          toStep('installation'),
          ' : elle dit ce que la page va vous demander. Le même bouton vous attend à la fin.',
        ],
      ],
    },
    back: {
      title: backTitle,
      text: [
        [
          'Pendant la première installation, n’utilisez ni la flèche de retour du navigateur, ni le geste de retour du téléphone : vous pourriez quitter la page de votre HAKO avant la fin. Pour revenir à l’écran d’avant, utilisez les boutons de la page de votre HAKO.',
        ],
        [
          'À la fin, sur l’écran ' +
            quote(boxPage.ready) +
            ', appuyez sur ' +
            quote(boxPage.backToGuide) +
            ' : ce bouton vous ramène à ce guide, à l’étape « ' +
            titles.applications +
            ' ».',
        ],
      ],
    },
    devices: {
      question: 'Avec quel appareil ouvrez-vous la page de votre HAKO ?',
      hint: [
        'Sans imprimante, prenez l’appareil sur lequel vous lisez ce guide : vous n’aurez qu’à appuyer sur le bouton « ' +
          openLabel +
          ' ».',
      ],
      unsure:
        'Vous ne savez pas ? Une pomme dessinée au dos de l’appareil indique un iPhone, un iPad ou un Mac. Un téléphone ou une tablette sans pomme fonctionne sans doute avec Android.',
      options: [
        {
          id: 'iphone',
          label: 'iPhone ou iPad',
          title: 'Sur un iPhone ou un iPad',
          actions: [
            [
              'Revenez à l’écran d’accueil de l’appareil : appuyez sur le bouton rond sous l’écran ou, s’il n’y en a pas, glissez le doigt du bas de l’écran vers le haut.',
            ],
            ['Ouvrez Réglages (une roue dentée grise), puis touchez Wi-Fi.'],
            [
              'Vérifiez que le Wi-Fi est activé, et que le réseau coché porte le nom écrit sur l’étiquette de votre box internet.',
            ],
            [
              'Si vous lisez ce guide sur cet iPhone ou cet iPad, revenez-y en ouvrant Safari (une boussole bleue). Puis appuyez sur le bouton « ' +
                openLabel +
                ' », plus bas, après l’encadré « ' +
                backTitle +
                ' ».',
            ],
            ['Sinon, ouvrez Safari et touchez la barre d’adresse, en général en bas de l’écran.'],
            [
              'Tapez ',
              boxAddress.display,
              ', puis appuyez sur la touche en bas à droite du clavier.',
            ],
          ],
          note: [
            'Safari est conseillé : il ouvre la page de votre HAKO sans autorisation à donner.',
          ],
        },
        {
          id: 'android',
          label: 'Android',
          title: 'Sur un téléphone ou une tablette Android',
          actions: [
            [
              'Ouvrez les Paramètres : vérifiez que le Wi-Fi est activé, et que l’appareil est relié au réseau qui porte le nom écrit sur l’étiquette de votre box internet.',
            ],
            [
              'Vérifiez que l’appareil a Android ' +
                requirements.android +
                ' ou plus récent : dans les Paramètres, cherchez « Version d’Android ».',
            ],
            [
              'Si une application de VPN est active, mettez-la en pause. Un VPN fait passer la connexion par un autre réseau, loin de chez vous.',
            ],
            [
              'Si vous lisez ce guide sur cet appareil, revenez-y, puis appuyez sur le bouton « ' +
                openLabel +
                ' », plus bas, après l’encadré « ' +
                backTitle +
                ' ».',
            ],
            ['Sinon, ouvrez Chrome et touchez la barre d’adresse.'],
            [
              'Tapez ',
              boxAddress.display,
              ', puis appuyez sur la touche en bas à droite du clavier.',
            ],
          ],
          note: [
            'La barre de recherche Google de l’écran d’accueil n’est pas une barre d’adresse : tapez l’adresse dans Chrome.',
          ],
        },
        {
          id: 'ordinateur',
          label: 'Ordinateur',
          title: 'Sur un ordinateur',
          actions: [
            [
              'Vérifiez que l’ordinateur est relié au Wi-Fi de la maison, ou à votre box internet par un câble réseau.',
            ],
            [
              'Si vous lisez ce guide sur cet ordinateur, cliquez sur le bouton « ' +
                openLabel +
                ' », plus bas, après l’encadré « ' +
                backTitle +
                ' ».',
            ],
            [
              'Sinon, ouvrez votre navigateur et cliquez dans la barre d’adresse, tout en haut de la fenêtre (au clavier : Ctrl et L, ou Cmd et L sur un Mac).',
            ],
            ['Tapez ', boxAddress.display, ', puis appuyez sur la touche Entrée.'],
          ],
          variants: [
            {
              id: 'windows',
              title: 'Sur un ordinateur Windows',
              text: [
                [
                  'Pour vérifier le Wi-Fi, cliquez sur l’icône du réseau, en bas à droite de l’écran, près de l’heure : le Wi-Fi marqué « Connecté » doit porter le nom écrit sur l’étiquette de votre box internet.',
                ],
                [
                  `Avec Windows\u00a0${requirements.windows} ou Windows\u00a011, ouvrez Edge, Chrome ou Firefox. Si la page ne s’ouvre pas, voyez `,
                  toProblem(
                    'page',
                    'windows',
                    '« Sur un ordinateur Windows, la page ne s’ouvre pas »',
                  ),
                  '.',
                ],
              ],
            },
            {
              id: 'mac',
              title: 'Sur un Mac',
              text: [
                [
                  'Ouvrez de préférence Safari : il n’a pas besoin d’autorisation pour ouvrir la page de votre HAKO.',
                ],
                [
                  'Avec Chrome, Firefox ou Edge, depuis macOS ' +
                    requirements.macos +
                    ', le Mac demande d’autoriser l’accès au « Réseau local » : acceptez. Sans cette autorisation, la page ne s’ouvre pas.',
                ],
                [
                  'Si la page ne s’ouvre pas, voyez ',
                  toProblem(
                    'page',
                    'mac-reseau-local',
                    '« Sur un Mac, Chrome, Firefox ou Edge n’ouvre pas la page »',
                  ),
                  '.',
                ],
              ],
            },
          ],
        },
      ],
    },
    problemsIntro: [
      'La page ne s’ouvre pas, ou le navigateur dit qu’elle est introuvable ? Vérifiez les cas ci-dessous, dans l’ordre.',
    ],
    problems: [
      {
        id: 'donnees-mobiles',
        title: 'Le téléphone est en 4G ou en 5G, pas en Wi-Fi.',
        devices: ['iphone', 'android'],
        why: [
          [
            'En 4G ou en 5G, le téléphone passe par le réseau de votre opérateur mobile, hors de chez vous. Il ne peut pas voir votre HAKO, joignable seulement depuis le réseau de la maison.',
          ],
        ],
        fix: [
          ['Activez le Wi-Fi et choisissez le réseau de votre box internet.'],
          ['Si le Wi-Fi est faible, rapprochez-vous de votre box internet.'],
          ['Puis rouvrez ', boxLink, '.'],
        ],
      },
      {
        id: 'wifi-invite',
        title:
          'L’appareil est relié au Wi-Fi invité, ou à un autre Wi-Fi que celui de votre box internet.',
        why: [
          [
            'Le Wi-Fi invité est un deuxième Wi-Fi, prévu pour les visiteurs. Comme les Wi-Fi publics ou d’hôtel, il empêche souvent les appareils de se voir entre eux : votre appareil ne trouve pas la HAKO.',
          ],
        ],
        fix: [
          ['Ouvrez les réglages Wi-Fi de l’appareil.'],
          [
            'Choisissez le Wi-Fi principal de votre box internet. Son nom et son mot de passe sont souvent écrits sur une étiquette, sous ou derrière la box internet.',
          ],
          ['Puis rouvrez ', boxLink, '.'],
        ],
      },
      {
        id: 'vpn',
        title: 'Un VPN est actif sur l’appareil.',
        why: [
          [
            'Un VPN est une application qui fait passer toute la connexion de l’appareil par un autre réseau, loin de chez vous : l’appareil ne voit plus votre HAKO. Certaines applications de sécurité en contiennent un.',
          ],
        ],
        fix: [
          [
            'Mettez le VPN en pause le temps de l’installation, depuis son application ou dans les réglages de l’appareil, rubrique « VPN ».',
          ],
          [
            'Sur un téléphone, le mot « VPN » ou une petite clé en haut de l’écran indique souvent qu’un VPN est actif.',
          ],
          ['Puis rouvrez ', boxLink, '.'],
        ],
      },
      {
        id: 'page-de-recherche',
        title: 'Une page de résultats de recherche s’affiche (Google, Bing, Qwant…).',
        why: [
          [
            'L’adresse a été tapée dans une zone de recherche, et non dans la barre d’adresse : le moteur de recherche cherche « ' +
              boxAddress.host +
              ' » sur internet, où votre HAKO n’existe pas.',
          ],
        ],
        fix: [
          ['Appuyez sur le bouton « ' + openLabel + ' » de ce guide.'],
          [
            'Ou tapez l’adresse dans la barre d’adresse, en commençant par http:// : dans Safari sur iPhone, elle est en général en bas de l’écran ; ailleurs, en haut.',
          ],
          [
            'Sur Android, la barre de recherche Google de l’écran d’accueil n’est pas une barre d’adresse : ouvrez d’abord Chrome.',
          ],
        ],
      },
      {
        id: 'en-preparation',
        title: 'La HAKO se prépare encore.',
        why: [
          [
            'Pendant son premier démarrage, la page de votre HAKO ne s’ouvre pas, ou affiche ' +
              quote(boxPage.preparing) +
              '.',
          ],
        ],
        fix: [
          [
            'Laissez la HAKO branchée et patientez : comptez ',
            toConfirm.firstBoot,
            ' depuis le branchement.',
          ],
          ['Puis réessayez : ', boxLink, '.'],
          [
            'Si la page affiche ' +
              quote(boxPage.preparing) +
              ', restez-y : appuyez sur ' +
              quote(boxPage.reload) +
              ' 5 minutes plus tard.',
          ],
        ],
      },
      {
        id: 'branchements',
        title: 'La HAKO n’est peut-être pas bien branchée.',
        why: [['Sans courant, ou sans câble réseau, la HAKO ne peut pas répondre.']],
        fix: [
          ['Vérifiez le câble réseau, des deux côtés : voyez ', toStep('cable'), '.'],
          ['Vérifiez l’alimentation : voyez ', toStep('alimentation'), '.'],
        ],
      },
      {
        id: 'android-ancien',
        title: `L’appareil a une version d’Android plus ancienne que la ${requirements.android}.`,
        devices: ['android'],
        why: [
          [
            'Les versions d’Android plus anciennes que la ' +
              requirements.android +
              ' ne savent pas ouvrir les adresses qui finissent par « .local », comme celle de votre HAKO.',
          ],
          [
            'Votre appareil ne pourra pas non plus utiliser les applications Immich et Nextcloud avec cette adresse.',
          ],
        ],
        fix: [
          ['Pour connaître la version : dans les Paramètres, cherchez « Version d’Android ».'],
          [
            'Faites l’installation avec un autre appareil, même emprunté : un ordinateur, un iPhone, un iPad, ou un appareil Android plus récent.',
          ],
          [
            'Solution de secours, pour l’installation comme pour les applications : ',
            toConfirm.fallbackAddress,
            '.',
          ],
        ],
      },
      {
        id: 'android-12',
        title: `Sous Android ${requirements.android}, la page ne s’ouvre pas.`,
        devices: ['android'],
        why: [
          [
            'Android ' +
              requirements.android +
              ' ne trouve les adresses en « .local » qu’avec une mise à jour récente du système Google Play ',
            toConfirm.android12,
            '.',
          ],
        ],
        fix: [
          [
            'Dans les Paramètres, cherchez « Mise à jour du système Google Play », et installez-la si elle vous est proposée.',
          ],
          ['Redémarrez l’appareil, puis réessayez : ', boxLink, '.'],
        ],
      },
      {
        id: 'iphone-autre-navigateur',
        title: 'Sur iPhone ou iPad, la page ne s’ouvre pas dans un autre navigateur que Safari.',
        devices: ['iphone'],
        why: [
          ['Safari ouvre toujours la page de votre HAKO, sans autorisation à donner.'],
          [
            'Chrome, Firefox et Edge aussi, en principe ',
            toConfirm.iosOtherBrowser,
            ' : la cause est sans doute ailleurs (Wi-Fi, VPN, adresse tapée sans http://).',
          ],
        ],
        fix: [['Ouvrez Safari et tapez ', boxAddress.display, ' dans la barre d’adresse.']],
      },
      {
        id: 'mac-reseau-local',
        title: 'Sur un Mac, Chrome, Firefox ou Edge n’ouvre pas la page.',
        devices: ['ordinateur'],
        why: [
          [
            'Depuis macOS ' +
              requirements.macos +
              ', ces navigateurs doivent recevoir l’autorisation « Réseau local » pour ouvrir la page de votre HAKO. Si la réponse a été « non », la page ne s’ouvre pas.',
          ],
        ],
        fix: [
          ['Ouvrez la page avec Safari, qui n’a pas besoin de cette autorisation.'],
          [
            'Ou rétablissez l’autorisation : ouvrez le menu Pomme, en haut à gauche de l’écran, puis Réglages Système, Confidentialité et sécurité, et Réseau local. Activez votre navigateur.',
          ],
          ['Si la page ne s’ouvre toujours pas, quittez le navigateur, puis rouvrez-le.'],
        ],
      },
      {
        id: 'windows',
        title: 'Sur un ordinateur Windows, la page ne s’ouvre pas.',
        devices: ['ordinateur'],
        why: [
          [
            'Windows sait en principe ouvrir les adresses en « .local » depuis Windows ' +
              requirements.windows +
              '. Une version plus ancienne, ou certains réglages, peuvent l’en empêcher.',
          ],
        ],
        fix: [
          [
            'Essayez avec un autre appareil, même emprunté : un iPhone, un iPad, un Mac ou un appareil Android récent.',
          ],
          ['Réglage à vérifier : ', toConfirm.windows, '.'],
          [
            'Vous n’avez pas d’autre appareil ? ',
            contactLink('Écrivez-nous ou appelez-nous'),
            ' avant d’aller plus loin.',
          ],
        ],
      },
      {
        id: 'deux-hako',
        title: 'Une autre HAKO est déjà branchée sur le même réseau.',
        why: [
          [
            'Deux appareils ne peuvent pas porter le même nom sur un réseau. La deuxième HAKO branchée prend donc automatiquement le nom « ' +
              boxAddress.secondHost +
              ' ».',
          ],
          ['L’adresse ', boxAddress.display, ' ouvre alors la page de l’autre HAKO.'],
          [
            'Après une coupure de courant, les deux HAKO peuvent échanger leurs noms ',
            toConfirm.namesAfterOutage,
            '.',
          ],
        ],
        fix: [
          [
            'Ouvrez ',
            { label: boxAddress.secondDisplay, href: boxAddress.secondUrl },
            ' pour atteindre la deuxième HAKO.',
          ],
        ],
      },
      {
        id: 'non-securise',
        title: 'Le navigateur affiche « Non sécurisé ».',
        why: [
          [
            'La page de votre HAKO n’a pas de cadenas : son adresse commence par http://, sans « s ». Ce qu’elle affiche n’est pas protégé sur son trajet, mais ce trajet reste dans la maison : il ne passe pas par internet.',
          ],
        ],
        fix: [
          ['Sur le Wi-Fi de votre maison, que seuls vos proches utilisent, vous pouvez continuer.'],
          [
            'Si ce réseau est partagé avec d’autres logements (résidence, immeuble), ne faites pas la première installation : quelqu’un d’autre sur ce réseau pourrait lire vos mots de passe. ',
            contactLink('Écrivez-nous'),
            ' avant d’aller plus loin.',
          ],
          [
            'Chrome vous demande de confirmer avant d’ouvrir la page ? Cela n’arrive que s’il est réglé au plus strict. Appuyez sur ',
            toConfirm.browserWarnings,
            '.',
          ],
        ],
      },
    ],
  },
  {
    id: 'installation',
    short: 'La première installation',
    title: titles.installation,
    intro: [
      [
        'La page de votre HAKO vous guide, écran par écran. Voici ce qu’elle va vous demander et ce qu’elle va faire.',
      ],
      ['Elle numérote ses propres écrans : ils font tous partie de cette étape 7 du guide.'],
      [
        'Vous avez déjà fait la première installation sur la page de votre HAKO, et pas seulement dans la démonstration ? Vérifiez seulement que vous avez votre fiche de secours, puis passez à l’étape suivante.',
      ],
    ],
    asks: {
      title: 'Ce qu’elle vous demande',
      items: [
        [
          'Le prénom de chaque personne de la maison qui aura un compte, en commençant par la personne responsable : celle qui s’occupera de la HAKO, en général vous.',
        ],
        [
          'De garder vos mots de passe sur une fiche de secours : imprimée, enregistrée en PDF ou recopiée à la main.',
        ],
        [
          'Le mot de passe de la personne responsable, que vous retapez en le lisant sur votre fiche : c’est la vérification de la fiche.',
        ],
      ],
    },
    does: {
      title: 'Ce que fait votre HAKO',
      items: [
        [
          'Elle crée un compte pour chaque personne, avec un identifiant (le nom qui sert à se connecter) et un mot de passe qu’elle invente.',
        ],
        [
          'Elle affiche ces mots de passe pendant l’installation seulement. Ensuite, elle ne peut plus les afficher : la fiche de secours en est la seule trace.',
        ],
      ],
    },
    demo: [
      'Pour voir ces écrans à l’avance, essayez la démonstration : les mêmes écrans, avec des exemples. Elle n’installe pas votre HAKO et n’envoie rien.',
    ],
    demoLink: {
      label: 'Voir la démonstration de la première installation',
      href: routes.installDemo,
    },
    actions: [
      [
        'Sur la page de votre HAKO, suivez les écrans dans l’ordre. Pour revenir à l’écran d’avant, utilisez ses boutons, jamais la flèche de retour du navigateur.',
      ],
      ['Sur l’écran ' + quote(boxPage.welcome) + ', appuyez sur ' + quote(boxPage.start) + '.'],
      [
        'Tapez d’abord le prénom de la personne responsable de la HAKO (en général, vous), puis celui de chaque personne de la maison.',
      ],
      [
        'Imprimez la fiche de secours avec le bouton ' +
          quote(boxPage.print) +
          '. Sans imprimante, enregistrez-la en PDF, ou recopiez-la à la main, caractère par caractère.',
      ],
      [
        'Vous la recopiez à la main ? Recopiez aussi les trois adresses de la partie ' +
          quote(boxPage.sheetBox) +
          ' : vous en aurez besoin à ',
        toStep('applications'),
        '.',
      ],
      [
        'Recopier la fiche prend quelques minutes : sur un téléphone ou une tablette, touchez l’écran de temps en temps, pour que l’appareil ne se mette pas en veille.',
      ],
      [
        'Gardez la fiche sous la main : sur l’écran ' +
          quote(boxPage.check) +
          ', retapez le mot de passe de la personne responsable, tel qu’il y est écrit.',
      ],
      [
        'Appuyez sur ' +
          quote(boxPage.create) +
          ', puis laissez la page ouverte et la HAKO branchée jusqu’à l’écran ' +
          quote(boxPage.ready) +
          '.',
      ],
      [
        'Sur l’écran ' +
          quote(boxPage.ready) +
          ', appuyez sur ' +
          quote(boxPage.backToGuide) +
          ' : vous revenez à ce guide, à l’étape suivante. Gardez votre fiche avec vous : elle y sert aussi.',
      ],
    ],
    open: { label: openLabel, href: boxAddress.url },
    why: [
      [
        'Ces mots de passe protègent les photos et les fichiers de chacun. Personne d’autre ne les a, pas même notre équipe : c’est notre engagement ',
        { label: '« Zéro accès »', href: routes.commitment },
        '.',
      ],
      [
        'Tant que la première installation n’est pas faite, n’importe quel appareil relié au réseau de la maison pourrait la faire à votre place. C’est pourquoi il vaut mieux la faire dès que la page de votre HAKO s’ouvre.',
      ],
    ],
    success: [
      [
        'La page de votre HAKO affiche ' +
          quote(boxPage.ready) +
          ' et ' +
          quote(boxPage.installed) +
          '.',
      ],
      ['Vous avez votre fiche de secours : imprimée, enregistrée ou recopiée.'],
    ],
    notes: [
      {
        title: 'Votre fiche de secours',
        text: [
          [
            'Évitez de la prendre en photo : votre téléphone pourrait envoyer la photo hors de chez vous, vers Google Photos ou iCloud.',
          ],
          [
            'Si vous l’enregistrez en PDF, le fichier peut être copié tout seul sur internet : dans iCloud ou Google Drive sur un téléphone, et souvent dans iCloud Drive ou OneDrive sur un ordinateur. Imprimez-le dès que possible, puis supprimez-le.',
          ],
          ['Ne l’envoyez à personne, ni par message ni par e-mail.'],
          [toConfirm.neverAsk],
        ],
      },
    ],
    problems: [
      {
        id: 'sans-imprimante',
        title: 'Vous n’avez pas d’imprimante.',
        why: [
          [
            'La page de votre HAKO n’affiche les mots de passe que pendant l’installation : il faut les garder ailleurs que sur l’écran.',
          ],
        ],
        fix: [
          [
            'Recopiez la fiche à la main, en vérifiant chaque caractère : c’est le plus sûr. N’oubliez pas les trois adresses de la partie ' +
              quote(boxPage.sheetBox) +
              '.',
          ],
          [
            'Ou enregistrez-la en PDF, puis imprimez-la plus tard chez un proche de confiance, en emportant votre appareil. Ne l’envoyez ni par message, ni par e-mail.',
          ],
        ],
      },
      {
        id: 'page-fermee',
        title: 'La page de votre HAKO s’est fermée avant la fiche de secours.',
        why: [['La page s’est fermée : l’appareil s’est mis en veille, ou un geste l’a fermée.']],
        fix: [
          ['Rouvrez ', boxLink, ' depuis le même appareil.'],
          ['Ce qui se passe ensuite : ', toConfirm.resumeInstall, '.'],
        ],
      },
      {
        id: 'deja-faite',
        title:
          'La page de votre HAKO affiche ' +
          quote(boxPage.alreadyInstalled) +
          ' au lieu de ' +
          quote(boxPage.welcome) +
          '.',
        why: [
          [
            'Quelqu’un a fait la première installation avant vous : une autre personne de la maison, ou un autre appareil relié au réseau de la maison.',
          ],
        ],
        fix: [
          [
            'Demandez aux personnes de la maison si l’une d’elles l’a faite : elle a la fiche de secours.',
          ],
          ['Sinon, ', contactLink('écrivez-nous'), ' avant d’aller plus loin.'],
        ],
      },
      {
        id: 'fiche-perdue',
        title: 'La fiche de secours est introuvable, ou une personne a oublié son mot de passe.',
        why: [
          [
            'Personne d’autre que vous n’a ces mots de passe, pas même notre équipe : nous ne pouvons pas vous les redonner.',
          ],
        ],
        fix: [
          [
            'Une personne a oublié son mot de passe ? La personne responsable de la HAKO peut lui en donner un nouveau, dans Immich puis dans Nextcloud : ',
            toConfirm.resetPassword,
            '.',
          ],
          ['La personne responsable a perdu le sien, ou la fiche : ', toConfirm.lostSheet, '.'],
          [contactLink('Écrivez-nous'), ' : nous vous guiderons.'],
        ],
      },
      {
        id: 'personne-oubliee',
        title: 'Une personne de la maison n’a pas de compte.',
        why: [
          ['Chaque personne a besoin de son propre compte pour garder ses photos et ses fichiers.'],
        ],
        fix: [['Pour ajouter une personne : ', toConfirm.addPerson, '.']],
      },
    ],
  },
  {
    id: 'applications',
    short: 'Les applications',
    title: titles.applications,
    intro: [
      [
        'Sur un téléphone ou une tablette, deux applications vous donnent accès à votre HAKO. Sur un ordinateur, rien à installer : voyez l’encadré « Sur un ordinateur », plus bas.',
      ],
    ],
    apps: [
      {
        id: 'immich',
        name: apps.immich.name,
        role: 'Photos et vidéos',
        text: 'Comme Google Photos, mais vos photos restent chez vous. Sur l’App Store et Google Play, choisissez l’application Immich publiée par FUTO.',
        links: [
          { label: 'Immich sur l’App Store (iPhone, iPad)', href: apps.immich.appStore },
          { label: 'Immich sur Google Play (Android)', href: apps.immich.googlePlay },
        ],
      },
      {
        id: 'nextcloud',
        name: apps.nextcloud.name,
        role: 'Fichiers',
        text: 'Comme Google Drive ou Dropbox, mais vos fichiers restent chez vous. Sur l’App Store et Google Play, choisissez l’application Nextcloud publiée par Nextcloud.',
        links: [
          { label: 'Nextcloud sur l’App Store (iPhone, iPad)', href: apps.nextcloud.appStore },
          { label: 'Nextcloud sur Google Play (Android)', href: apps.nextcloud.googlePlay },
        ],
      },
    ],
    actions: [
      [
        'Installez Immich et Nextcloud sur chaque téléphone, avec les liens plus bas : l’App Store pour un iPhone ou un iPad, Google Play pour un appareil Android.',
      ],
      [
        'L’App Store peut demander Face ID, Touch ID (le doigt sur le bouton rond) ou le mot de passe de votre compte Apple. Ce n’est ni le code qui déverrouille l’écran, ni un mot de passe de la fiche de secours.',
      ],
      [
        'Ouvrez l’application. Elle demande d’abord une adresse, propre à chaque application. Dans Immich : ',
        pending.photosAddress,
        '. Dans Nextcloud : ',
        pending.filesAddress,
        '.',
      ],
      [
        'Tapez-la en entier, en commençant par http://. Elle est aussi écrite sur votre fiche de secours, dans la partie ' +
          quote(boxPage.sheetBox) +
          ', aux lignes ' +
          quote(boxPage.sheetPhotos) +
          ' et ' +
          quote(boxPage.sheetFiles) +
          '.',
      ],
      ['Sur iPhone et iPad, Immich demande l’accès au « Réseau local » : acceptez.'],
      ['Dans Nextcloud, après l’adresse : ', toConfirm.nextcloudLogin, '.'],
      [
        'Connectez-vous avec l’identifiant et le mot de passe de la personne, écrits sur la fiche de secours. Dans Immich, la case de connexion demande une adresse e-mail : tapez l’identifiant de la fiche, pas votre adresse e-mail habituelle.',
      ],
      [
        'Dans Immich, activez la sauvegarde : l’application copie alors sur votre HAKO les photos du téléphone. Comment faire : ',
        toConfirm.immichBackup,
        '.',
      ],
    ],
    notes: [
      {
        title: 'Gardez aussi vos photos sur votre téléphone',
        text: [
          [...backupCopy.sentence],
          [
            'Ne supprimez donc pas les photos de votre téléphone une fois copiées sur votre HAKO, et gardez une autre copie de vos photos les plus précieuses.',
          ],
        ],
      },
      {
        title: 'Sur un ordinateur',
        text: [
          [
            'Ouvrez ',
            boxLink,
            ' : la page de votre HAKO propose ' +
              quote(boxPage.photos) +
              ' et ' +
              quote(boxPage.files) +
              '.',
          ],
          [
            'Connectez-vous avec l’identifiant et le mot de passe de la fiche de secours. Dans Immich, la case demande une adresse e-mail : tapez l’identifiant de la fiche.',
          ],
          [
            'Ajoutez la page à vos favoris (au clavier : Ctrl et D, ou Cmd et D sur un Mac) pour la retrouver.',
          ],
        ],
      },
    ],
    why: [
      [
        'Avec ces applications, chaque personne retrouve ses photos et ses fichiers sur son téléphone. Elle peut aussi copier sur la HAKO les photos qu’elle prend. Ces échanges passent par le Wi-Fi de la maison.',
      ],
    ],
    success: [
      [
        'L’application vous connecte à votre HAKO et affiche votre espace, vide au début. Une fois la sauvegarde activée, vos photos y arrivent peu à peu, par le Wi-Fi de la maison.',
      ],
    ],
    more: tutorialsSentence(
      'Pour la suite (retrouver vos données, récupérer vos photos de Google ou d’iCloud)',
    ),
    problems: [
      {
        id: 'sans-http',
        title: 'L’application ne trouve pas votre HAKO, alors que l’adresse semble juste.',
        why: [
          [
            'Sans « http:// » au début, l’application peut ajouter « https:// » toute seule : c’est le cas d’Immich. Or l’adresse de votre HAKO commence par « http:// ».',
          ],
        ],
        fix: [
          [
            'Effacez l’adresse et tapez-la en entier, en commençant par http:// (sans « s »), exactement comme sur votre fiche de secours.',
          ],
        ],
      },
      {
        id: 'reseau-local-refuse',
        title: 'Sur iPhone ou iPad, l’accès au « Réseau local » a été refusé.',
        devices: ['iphone'],
        why: [
          [
            'Sans cette autorisation, l’application n’a pas le droit de chercher votre HAKO sur le réseau de la maison.',
          ],
        ],
        fix: [
          ['Ouvrez Réglages, puis Confidentialité et sécurité, puis Réseau local.'],
          ['Activez l’application qui ne trouve pas votre HAKO.'],
          ['Rouvrez l’application.'],
        ],
      },
      {
        id: 'hors-wifi',
        title: 'Le téléphone n’est pas sur le Wi-Fi de la maison.',
        devices: ['iphone', 'android'],
        why: [
          [
            'Votre HAKO n’est pas ouverte sur internet : les applications ne la trouvent que depuis le réseau de la maison. En 4G, en 5G ou hors de chez vous, elles ne la voient pas : c’est voulu.',
          ],
          [
            'Pour en savoir plus : ',
            {
              label: 'Puis-je voir mes photos hors de chez moi ?',
              href: `${routes.faq}#hors-de-chez-moi`,
            },
          ],
        ],
        fix: [
          [
            'Activez le Wi-Fi et choisissez le réseau de votre box internet, puis rouvrez l’application.',
          ],
        ],
      },
      {
        id: 'adresse-oubliee',
        title: 'Vous n’avez plus l’adresse à taper dans l’application.',
        why: [
          [
            'Chaque application a sa propre adresse sur votre HAKO. Ce n’est pas ',
            boxAddress.display,
            ', l’adresse de la page de votre HAKO.',
          ],
        ],
        fix: [
          [
            'Dans Immich : ',
            pending.photosAddress,
            '. Dans Nextcloud : ',
            pending.filesAddress,
            '.',
          ],
          [
            'Elles sont aussi écrites sur votre fiche de secours, dans la partie ' +
              quote(boxPage.sheetBox) +
              '.',
          ],
        ],
      },
      {
        id: 'app-store',
        title: 'Sur iPhone ou iPad, l’App Store n’installe pas l’application.',
        devices: ['iphone'],
        why: [
          [
            'Chaque application demande une version assez récente du système de l’iPhone (iOS) : ' +
              appsMinVersion +
              '. Un appareil plus ancien ne peut pas l’installer.',
          ],
        ],
        fix: [
          [
            'Regardez la version d’iOS de votre appareil dans les Réglages, et faites la mise à jour si elle vous est proposée.',
          ],
          [
            'Sinon, ouvrez vos photos et vos fichiers sur la page de votre HAKO, depuis un ordinateur de la maison ou dans Safari : ',
            boxLink,
            '.',
          ],
        ],
      },
      {
        id: 'mot-de-passe-apple',
        title: 'L’App Store demande un mot de passe que vous ne connaissez pas.',
        devices: ['iphone'],
        why: [
          [
            'C’est le mot de passe de votre compte Apple. Il a souvent été créé par un proche. Ce n’est pas le code qui déverrouille l’écran.',
          ],
        ],
        fix: [
          ['Demandez-le à la personne qui a préparé votre appareil.'],
          ['Les applications peuvent s’installer plus tard : votre HAKO reste prête.'],
        ],
      },
      {
        id: 'android-ancien',
        title: `Sur un appareil Android plus ancien que la version ${requirements.android}, l’application ne trouve pas votre HAKO.`,
        devices: ['android'],
        why: [
          [
            'Ces versions d’Android ne savent pas trouver les adresses qui finissent par « .local ».',
          ],
        ],
        fix: [
          ['Solution de secours : ', toConfirm.fallbackAddress, '.'],
          [
            'En attendant, ouvrez vos photos et vos fichiers depuis un ordinateur, un iPhone ou un iPad de la maison.',
          ],
          ['Sinon, ', contactLink('écrivez-nous'), '.'],
        ],
      },
      {
        id: 'version',
        title: 'L’application dit que la version de votre HAKO ne convient pas.',
        why: [
          [
            'Votre téléphone met souvent ses applications à jour tout seul : l’application peut alors être plus récente que la version installée sur votre HAKO ',
            toConfirm.appTooNew,
            '.',
          ],
        ],
        fix: [
          [
            contactLink('Écrivez-nous'),
            ', en nous donnant le nom de l’application et le message affiché.',
          ],
        ],
      },
      {
        id: 'mot-de-passe-refuse',
        title: 'L’identifiant ou le mot de passe est refusé.',
        why: [
          [
            'Un seul caractère différent suffit : une lettre en trop, une majuscule ajoutée toute seule par le téléphone, un espace à la fin.',
          ],
        ],
        fix: [
          [
            'Votre mot de passe commence par « exemple » ? C’est celui de la démonstration : il n’ouvre rien. Faites la première installation sur la page de votre HAKO : voyez ',
            toStep('page'),
            '.',
          ],
          ['Retapez-les en recopiant la fiche de secours caractère par caractère.'],
          ['Vérifiez que le téléphone n’a pas mis de majuscule au début.'],
          [
            'Sur un ordinateur, un chiffre tapé sans la touche Maj devient « à », « é » ou « & » : appuyez sur Maj en même temps, ou utilisez le pavé numérique.',
          ],
          [
            'Dans Immich, la case de connexion demande une adresse e-mail : tapez l’identifiant de la fiche de secours, pas votre adresse e-mail habituelle.',
          ],
          [
            'Toujours refusé ? Voyez ',
            toProblem(
              'installation',
              'fiche-perdue',
              '« La fiche de secours est introuvable, ou une personne a oublié son mot de passe »',
            ),
            '.',
          ],
        ],
      },
    ],
  },
] as const satisfies readonly Step[];

/* ---------- Page ---------- */

/**
 * « de Salon-de-Provence à Toulon » : les deux bouts de notre zone, lus dans
 * sa phrase (company.serviceArea.sentence, src/data/entreprise.ts), le seul
 * endroit où s’écrivent les noms des villes.
 */
function zoneEnds(sentence: string): string {
  const found = /\bde\s+\S.*?\s+à\s+[^,.]+/u.exec(sentence);
  if (!found) {
    throw new Error(
      `Guide d’installation : la phrase de la zone (company.serviceArea.sentence) doit dire « de … à … ». Phrase lue : ${sentence}`,
    );
  }
  return found[0];
}

export const installation = {
  meta: {
    title: 'Installer votre HAKO pas à pas',
    description:
      'Le guide pour installer vous-même votre HAKO, en huit étapes : le carton, les branchements, la page de votre HAKO, la première installation et les applications.',
  },

  intro: {
    title: 'Installer votre HAKO',
    lead: 'Suivez les huit étapes dans l’ordre. Chacune dit quoi faire, comment vérifier que c’est bon, et quoi faire si ça bloque.',
    duration: [
      'Comptez ',
      toConfirm.totalDuration,
      ' en tout, dont une attente pendant que votre HAKO se prépare toute seule.',
    ] satisfies Sentence,
    /**
     * Ce guide servira quand nous enverrons la HAKO hors de notre zone
     * (company.serviceArea.outside) : ce n’est pas encore possible. Dans la
     * zone, nous l’installons chez vous.
     */
    shipped: [
      'Ce guide servira quand nous enverrons la HAKO hors de ',
      { label: 'notre zone d’intervention', href: `${routes.faq}#zone-intervention` },
      ', ce qui n’est pas encore possible. Dans la zone, ',
      zoneEnds(company.serviceArea.sentence),
      ', nous venons l’installer chez vous.',
    ] satisfies Sentence,
  },

  before: {
    title: 'Avant de commencer',
    lead: 'Réunissez ces quelques objets. Tout le reste se fait pas à pas. Votre box internet, c’est l’appareil de votre opérateur qui apporte internet chez vous : Livebox, Freebox, Bbox ou box SFR, par exemple. Ce n’est pas votre HAKO.',
    items: [
      {
        id: 'hako',
        text: ['Votre HAKO et son bloc d’alimentation'],
        detail: [['Dans le carton : ', toConfirm.boxContents, '.']],
      },
      {
        id: 'cable',
        text: ['Un câble réseau (Ethernet), non fourni'],
        detail: [
          [
            'Ses deux bouts ont un embout en plastique, souvent transparent, avec un petit clip. Le carton de votre box internet en contient peut-être un. L’installation se fait avec ce câble.',
          ],
          ['Mesurez la distance entre la place prévue pour la HAKO et votre box internet.'],
          [
            'Vérifiez qu’une prise réseau de votre box internet est libre : elle est souvent marquée « LAN » ou d’un numéro.',
          ],
          [
            'Pas de câble ? Demandez « un câble Ethernet » (ou « câble RJ45 ») dans un magasin d’informatique ou de bricolage, ou dans une grande surface. N’importe lequel de catégorie 5e ou plus convient, un peu plus long que la distance mesurée.',
          ],
          [
            'Plus de prise libre ? Débranchez un appareil dont vous pouvez vous passer, ou ajoutez un petit boîtier appelé « switch » réseau, vendu au même rayon.',
          ],
        ],
      },
      {
        id: 'prise',
        text: ['Une prise électrique libre, près de votre box internet'],
        detail: [['Une multiprise convient.']],
      },
      {
        id: 'appareil',
        text: ['Un téléphone, une tablette ou un ordinateur, relié au Wi-Fi de la maison'],
        detail: [
          [
            'Le Wi-Fi de la maison, c’est le réseau sans fil de votre box internet. C’est avec cet appareil que vous ouvrirez la page de votre HAKO.',
          ],
          [
            'Votre appareil n’est pas encore relié au Wi-Fi ? Le nom du Wi-Fi et son mot de passe (parfois appelé « clé ») sont souvent écrits sur une étiquette, sous ou derrière votre box internet.',
          ],
          [
            'Un téléphone ou une tablette Android doit avoir Android ' +
              requirements.android +
              ' ou plus récent : dans les Paramètres, cherchez « Version d’Android ». Plus ancien, il ne pourra ni ouvrir la page de votre HAKO, ni utiliser les applications des photos et des fichiers. Pour l’installation, prévoyez un ordinateur, un iPhone ou un iPad, même emprunté.',
          ],
          [
            'Pour les applications de l’étape 8, un iPhone ou un iPad doit avoir ' +
              appsMinVersion +
              ' : pour le voir, ouvrez Réglages, puis Général, puis Informations.',
          ],
          [
            'Pour installer ces applications, il vous faudra aussi le mot de passe de votre compte Apple (iPhone, iPad) ou Google (Android).',
          ],
        ],
      },
      {
        id: 'impression',
        text: ['Une imprimante allumée, avec du papier, ou une feuille et un stylo'],
        detail: [
          [
            'Pour garder sur une fiche de secours les mots de passe que votre HAKO va créer, à l’étape 7.',
          ],
          [
            'De préférence, ouvrez la page de votre HAKO avec un appareil qui imprime déjà sur cette imprimante. Vous pourrez aussi enregistrer la fiche en PDF, un document à imprimer plus tard.',
          ],
          [
            'Vérifiez avant de commencer que cet appareil imprime. Sur un iPhone : ouvrez une photo, appuyez sur le bouton de partage (un carré d’où sort une flèche), puis sur « Imprimer ». Si votre imprimante n’apparaît pas, prévoyez une feuille et un stylo.',
          ],
        ],
      },
    ] satisfies readonly Need[],
  },

  /** Les mots techniques du guide, expliqués. */
  glossary: {
    title: 'Les mots de ce guide',
    items: [
      {
        term: 'Box internet',
        definition:
          'L’appareil de votre opérateur qui apporte internet chez vous : Livebox, Freebox, Bbox ou box SFR, par exemple. Ce n’est pas votre HAKO.',
      },
      {
        term: 'Câble réseau (Ethernet)',
        definition:
          'Un câble qui relie deux appareils pour qu’ils échangent des données. Ses deux bouts ont un embout en plastique avec un petit clip.',
      },
      {
        term: 'Wi-Fi',
        definition:
          'Le réseau sans fil de votre box internet. Vos téléphones, tablettes et ordinateurs s’y relient.',
      },
      {
        term: 'Réseau de la maison',
        definition:
          'Tous les appareils reliés à votre box internet, par son Wi-Fi ou par un câble. Votre HAKO en fait partie.',
      },
      {
        term: 'Wi-Fi invité',
        definition:
          'Un deuxième Wi-Fi que certaines box internet proposent aux visiteurs. Il les empêche souvent de voir les appareils de la maison.',
      },
      {
        term: '4G, 5G',
        definition:
          'Les données mobiles de votre forfait de téléphone. Elles ne passent pas par votre box internet.',
      },
      {
        term: 'Navigateur',
        definition:
          'L’application qui ouvre les pages internet : Safari, Chrome, Firefox ou Edge, par exemple.',
      },
      {
        term: 'Barre d’adresse',
        definition:
          'La zone du navigateur où s’écrit l’adresse de la page : en haut de l’écran, ou en bas dans Safari sur iPhone. Ce n’est pas la zone de recherche de Google.',
      },
      {
        term: boxAddress.display,
        definition:
          'L’adresse de votre HAKO. Elle ne marche que chez vous, depuis un appareil relié au réseau de la maison.',
      },
      {
        term: 'VPN',
        definition:
          'Une application qui fait passer la connexion de l’appareil par un autre réseau, loin de chez vous. Certaines applications de sécurité en contiennent un.',
      },
      {
        term: 'Fichier PDF',
        definition:
          'Un document enregistré sur votre appareil, que vous pouvez imprimer plus tard.',
      },
      {
        term: 'Compte',
        definition:
          'L’espace d’une personne sur votre HAKO, pour ses photos et ses fichiers. On y entre avec un identifiant et un mot de passe.',
      },
      {
        term: 'Identifiant',
        definition:
          'Le nom qui sert à se connecter, par exemple ' +
          loginExample.login +
          '. Il ressemble à une adresse e-mail, mais ce n’en est pas une.',
      },
      {
        term: 'Personne responsable',
        definition:
          'La première personne de la liste, à la première installation. C’est elle qui gérera les comptes de la maison.',
      },
      {
        term: 'Fiche de secours',
        definition:
          'La feuille qui réunit les identifiants et les mots de passe de la maison, imprimée, enregistrée en PDF ou recopiée pendant la première installation. C’en est la seule trace.',
      },
      {
        term: 'Application',
        definition:
          'Un programme. Sur un téléphone, on l’installe depuis l’App Store (iPhone, iPad) ou Google Play (Android). Votre HAKO a aussi les siennes : Immich et Nextcloud.',
      },
      {
        term: 'Immich',
        definition:
          'L’application de vos photos et de vos vidéos, sur votre HAKO et sur vos téléphones.',
      },
      {
        term: 'Nextcloud',
        definition: 'L’application de vos fichiers, sur votre HAKO et sur vos téléphones.',
      },
      {
        term: 'Sauvegarde (dans Immich)',
        definition:
          'La copie des photos du téléphone sur votre HAKO. Les photos restent aussi sur le téléphone.',
      },
    ] satisfies readonly Term[],
  },

  /** Libellés de l’interface : boutons, progression, titres des parties d’une étape. */
  labels: {
    /** Titre lu par les lecteurs d’écran de la liste des étapes. */
    stepsList: 'Les étapes de l’installation',
    /**
     * Après une étape validée par « C’est fait » pendant la visite, dans la
     * liste (lu par les lecteurs d’écran). Une étape seulement passée par un
     * lien n’est jamais dite « faite ».
     */
    stepDone: '(faite)',
    /** « {n} » : numéro de l’étape ; « {total} » : nombre d’étapes. */
    stepOf: 'Étape {n} sur {total}',
    /** Progression, à la fin du guide (avant : « Étape {n} sur {total} »). */
    progressEnd: 'Fin du guide',
    /** Sous 64rem, la liste des étapes se replie derrière ce libellé. */
    tocToggle: 'Aller directement à une étape',
    next: 'C’est fait, étape suivante',
    /** Bouton de la dernière étape. */
    finish: 'C’est fait, j’ai terminé',
    previous: 'Étape précédente',
    showAll: 'Afficher tout le guide sur une seule page',
    showOne: 'Revenir à une étape à la fois',
    restart: 'Revenir à la première étape',
    print: 'Imprimer ce guide',
    printHint: 'Toutes les étapes s’impriment, avec leurs aides : environ 45 pages.',
    actions: 'Ce qu’il faut faire',
    why: 'Pourquoi cette étape ?',
    success: 'Comment savoir que c’est bon ?',
    problems: 'Ça ne marche pas ?',
    problemsHint: 'Choisissez ce qui vous arrive : chaque cas dit pourquoi, et que faire.',
    problemWhy: 'Pourquoi',
    problemFix: 'Que faire',
    /** Sous « Ça ne marche pas ? », dans chaque étape. */
    stillStuck: [
      'Ça bloque toujours ? ',
      contactLink('Écrivez-nous ou appelez-nous'),
      ', en nous disant à quelle étape vous en êtes.',
    ] satisfies Sentence,
    /** Sans JavaScript, en haut du guide. */
    noscript:
      'Toutes les étapes s’affichent à la suite : suivez-les dans l’ordre. Le chronomètre et le choix de l’appareil ne s’affichent pas sur ce navigateur, mais vous pouvez faire toute l’installation sans eux.',
  },

  steps,

  finish: {
    title: 'Votre HAKO est installée',
    lead: 'C’est fini. Voici quelques conseils pour la suite.',
    items: [
      ['Rangez la fiche de secours avec vos papiers importants, à l’écart de la HAKO.'],
      [
        'Donnez à chaque personne son identifiant et son mot de passe, de vive voix ou sur papier, jamais par message ni par e-mail.',
      ],
      ['Laissez la HAKO branchée en permanence : c’est elle qui garde vos photos et vos fichiers.'],
      [
        'Pour revenir à la page de votre HAKO, ouvrez ',
        boxLink,
        ' depuis un appareil de la maison.',
      ],
      [
        'Pour la garder sous la main : dans Safari sur iPhone ou iPad, appuyez sur le bouton de partage (un carré d’où sort une flèche), puis sur « Ajouter aux favoris ». Sur un ordinateur : Ctrl et D, ou Cmd et D sur un Mac.',
      ],
    ] satisfies readonly Sentence[],
    next: tutorialsSentence('Pour prendre votre HAKO en main, à votre rythme'),
  },

  help: {
    title: 'Besoin d’aide ?',
    text: [
      [
        'Écrivez-nous ou appelez-nous, en nous disant à quelle étape vous en êtes et ce que vous voyez à l’écran. Une fois votre HAKO installée, nous pouvons aussi vous aider par appel vidéo.',
      ],
    ] satisfies readonly Sentence[],
    /** Coordonnées (src/data/entreprise.ts) : repère jaune tant qu’elles manquent. */
    contacts: [
      ['Par e-mail : ', emailLink(company.email)],
      ['Par téléphone : ', phoneLink(company.phone)],
    ] satisfies readonly Sentence[],
    link: { label: 'Toutes nos coordonnées', href: routes.contact } satisfies Link,
  },
} as const;
