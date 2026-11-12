/**
 * Textes de la page « La box » (/la-box/).
 *
 * Tout le texte visible de la page est ici : les composants de
 * src/components/la-box/ ne font que le mettre en forme.
 *
 * - Un paragraphe est une liste de morceaux mis bout à bout. Une information
 *   encore inconnue s'écrit todo('ce qui manque', '[texte provisoire]') : elle
 *   s'affiche surlignée en jaune et `npm run todos` la recense dans TODO.md.
 * - Les licences et les adresses officielles ont été vérifiées à la source le
 *   12 novembre 2026 : les preuves sont dans docs/logiciels.md. Si l'une
 *   change, corrigez les deux fichiers ensemble.
 * - Typographie : apostrophe ’, espaces insécables avant « : » et à
 *   l'intérieur des guillemets « ». Un texte provisoire court entre
 *   crochets (« [à confirmer] ») ne se coupe pas : ses espaces sont
 *   insécables. Un texte provisoire long garde des espaces ordinaires pour
 *   pouvoir passer à la ligne sur un écran étroit, sauf après « à ».
 */
import { company } from '../data/entreprise';
import { backupCopy, homePageLicense, remoteAccess } from '../data/faits';
import { routes, type NavLink } from '../data/navigation';
import { pricing } from '../data/tarifs';
import { formatList } from '../lib/format';
import { isTodo, todo, type Maybe } from '../lib/todo';

/** Un mot en japonais (le kanji du logo), lu avec la bonne langue par les lecteurs d'écran. */
export interface Japanese {
  readonly ja: string;
}

/**
 * Morceaux d'un paragraphe : du texte, une information manquante ou un mot
 * japonais. Ce type sert aussi aux pages Notre engagement et Tutoriels.
 */
export type Paragraph = readonly (Maybe<string> | Japanese)[];

/** Lien affiché dans le texte (pages La box, Notre engagement et Tutoriels). */
export interface Link extends NavLink {
  /** Langue de la page visée quand elle n'existe pas en français : « en » pour l'anglais. */
  readonly hreflang?: 'en';
}

export interface Part {
  readonly name: string;
  readonly text: readonly Paragraph[];
}

export interface Software {
  /** Identifiant court, sans espace (sert d'ancre dans la page). */
  readonly id: string;
  readonly name: string;
  /** Ce qu'il fait, en deux ou trois mots. */
  readonly role: string;
  readonly text: readonly Paragraph[];
  /** Adresse affichée en texte : elle ne s'ouvre que depuis la maison. */
  readonly address?: string;
  readonly license: Maybe<string>;
  readonly links: readonly Link[];
}

export interface SoftwareGroup {
  readonly title: string;
  readonly items: readonly Software[];
}

export interface Reason {
  readonly title: string;
  readonly text: readonly Paragraph[];
}

export interface Limit {
  /** Identifiant court, sans espace (sert d'ancre dans la page). */
  readonly id: string;
  readonly title: string;
  readonly text: readonly Paragraph[];
  readonly links?: readonly Link[];
}

/* ---------- Stockage (repris de src/data/tarifs.ts) ---------- */

const includedStorage =
  pricing.storage.find((option) => option.id === pricing.includedStorage)?.label ?? '';
const storageOptions = formatList(
  pricing.storage
    .filter((option) => option.id !== pricing.includedStorage)
    .map((option) => option.label),
  'or',
);

/* ---------- Recette du système de la box ---------- */

/**
 * Adresse du dépôt public de la recette. Une fois le dépôt publié, remplacez
 * l'appel todo(…) par l'adresse entre apostrophes droites : le lien et la
 * phrase qui l'annonce changent tout seuls.
 */
const recipeLink: Maybe<string> = todo(
  'Adresse du dépôt public de la recette du système de la box (image système), à publier',
  '[lien à venir]',
);

/* ---------- Page ---------- */

export const laBox = {
  meta: {
    title: 'La box : matériel et logiciels',
    description:
      'La box HAKO : une Raspberry Pi 5, un disque SSD, Immich pour les photos, Nextcloud pour les fichiers. Leurs licences, leurs sources et leurs limites.',
  },

  intro: {
    title: 'La box',
    lead: 'Un petit ordinateur, assemblé à la main en Provence, qui garde vos photos et vos fichiers chez vous. Voici ce qu’il contient, les logiciels qui le font fonctionner, et ses limites.',
    highlightsLabel: 'En bref',
    highlights: [
      'Raspberry Pi 5, 8 Go',
      `${includedStorage} de stockage inclus`,
      'Logiciels libres pour vos photos et fichiers',
      'Assemblée en Provence',
    ],
  },

  /** Petits libellés répétés dans la page. */
  labels: {
    license: 'Licence',
    address: 'Adresse',
    inEnglish: 'en anglais',
  },

  hardware: {
    id: 'materiel',
    title: 'Ce qu’il y a dedans',
    lead: 'Une petite carte, un disque, un ventilateur et un boîtier.',
    illustrationAlt:
      'La box en vue éclatée, de haut en bas : le couvercle, le ventilateur, la carte du disque SSD, la carte Raspberry Pi 5 et la base du boîtier.',
    parts: [
      {
        name: 'Une Raspberry Pi 5, 8 Go',
        text: [
          [
            'Le cerveau de la box : un petit ordinateur complet, sur une seule carte, avec 8 Go de mémoire vive (la mémoire de travail de l’ordinateur).',
          ],
        ],
      },
      {
        name: 'Un disque SSD NVMe, sur carte M.2',
        text: [
          [
            'C’est là que sont rangés vos photos et vos fichiers. Un SSD est un disque sans pièce qui bouge. Le nôtre est de type NVMe, un format de disque rapide, et il est posé sur une petite carte d’extension au format M.2.',
          ],
          [
            `${includedStorage} de stockage inclus, ${storageOptions} en option.`,
            ' Le « To », ou téraoctet, mesure la place disponible pour vos fichiers.',
          ],
        ],
      },
      {
        name: 'Un ventilateur',
        text: [['Il garde la box au frais, même quand elle travaille beaucoup.']],
      },
      {
        name: 'Un boîtier imprimé en 3D',
        text: [
          [
            'Un boîtier sobre, imprimé en 3D. Sur un côté, le logo : le kanji ',
            { ja: company.kanji },
            ', un caractère japonais, et le mot HAKO.',
          ],
        ],
      },
      {
        name: 'Le branchement',
        text: [
          [
            'La box se branche à votre box internet par un câble réseau (Ethernet). Le Wi-Fi reste possible si le câble n’est pas pratique chez vous.',
          ],
          ['Son alimentation est fournie avec la box.'],
        ],
      },
    ] satisfies readonly Part[],
    handmade: 'Chaque box est assemblée et vérifiée à la main, en Provence.',
  },

  software: {
    id: 'logiciels',
    title: 'Ce qui tourne dedans',
    lead: 'Les logiciels que nous installons et réglons pour vous. Pour chacun, voici son rôle, sa licence (les règles qui disent ce que chacun a le droit d’en faire) et où le trouver.',
    groups: [
      {
        title: 'Ce que vous utilisez',
        items: [
          {
            id: 'immich',
            name: 'Immich',
            role: 'Photos et vidéos',
            text: [
              [
                'L’album de toute la famille : vos photos et vos vidéos, rangées chez vous. C’est une alternative libre à Google Photos.',
              ],
            ],
            license: 'GNU AGPL v3',
            links: [
              { label: 'Site officiel d’Immich', href: 'https://immich.app/', hreflang: 'en' },
            ],
          },
          {
            id: 'nextcloud',
            name: 'Nextcloud',
            role: 'Fichiers',
            text: [
              [
                'Vos documents et vos fichiers, rangés en dossiers. C’est une alternative libre à Google Drive ou à Dropbox.',
              ],
              ['Avec Hako Pro, il gère aussi l’agenda et les contacts partagés de l’équipe.'],
            ],
            license: 'GNU AGPL v3 ou version ultérieure',
            links: [{ label: 'Site officiel de Nextcloud', href: 'https://nextcloud.com/fr/' }],
          },
          {
            id: 'page-accueil',
            name: 'La page d’accueil de la box',
            role: 'Point de départ',
            text: [
              [
                'Une page simple pour ouvrir vos photos et vos fichiers. Elle s’ouvre depuis un appareil connecté au réseau de la maison.',
              ],
            ],
            address: 'http://mabox.local',
            license: homePageLicense,
            links: [],
          },
        ],
      },
      {
        title: 'Ce qui fait tourner la box',
        items: [
          {
            id: 'raspberry-pi-os',
            name: 'Raspberry Pi OS Lite',
            role: 'Système de base',
            text: [
              [
                'Le logiciel de base qui fait fonctionner la box, comme Windows sur un ordinateur. Nous utilisons sa version allégée, sans bureau ni écran.',
              ],
              ['Il est construit sur Debian 13 « trixie », un système libre.'],
            ],
            // Pas « libre » tout court : la base Debian l’est, des micrologiciels ne le sont pas.
            license: 'En partie libre',
            links: [
              { label: 'Ce qui n’est pas libre', href: '#pas-tout-libre' },
              {
                label: 'Site officiel de Raspberry Pi OS',
                href: 'https://www.raspberrypi.com/software/',
                hreflang: 'en',
              },
              { label: 'Site officiel de Debian', href: 'https://www.debian.org/' },
            ],
          },
          {
            id: 'docker',
            name: 'Docker Engine',
            role: 'Rangement des logiciels',
            text: [
              [
                'Chaque logiciel de la box tourne dans son propre compartiment, appelé « conteneur », séparé des autres. On peut ainsi mettre à jour l’un sans toucher aux autres.',
              ],
            ],
            license: 'Apache 2.0',
            links: [
              {
                label: 'Site officiel de Docker Engine',
                href: 'https://docs.docker.com/engine/',
                hreflang: 'en',
              },
            ],
          },
        ],
      },
    ] satisfies readonly SoftwareGroup[],
  },

  openSource: {
    id: 'logiciels-libres',
    title: 'Pourquoi des logiciels libres ?',
    lead: 'Un logiciel libre est un logiciel dont le code, c’est-à-dire la recette, est public : chacun peut le lire, le vérifier, le modifier et le partager. Pour vous, cela change trois choses.',
    reasons: [
      {
        title: 'Tout le monde peut vérifier',
        text: [
          [
            'N’importe qui peut lire le code de ces logiciels et vérifier ce qu’ils font de vos données. Vous n’avez pas à nous croire sur parole.',
          ],
        ],
      },
      {
        title: 'Et si HAKO disparaît ?',
        text: [
          [
            'Votre box continue de fonctionner : elle tourne chez vous, sans avoir besoin de nous. Immich et Nextcloud sont libres et documentés publiquement. Vos photos, elles, restent des fichiers ordinaires.',
          ],
        ],
      },
      {
        title: 'Rien ne vous enferme',
        text: [
          [
            'Vos fichiers restent dans des formats courants. Si un jour vous voulez changer de solution, vous repartez avec vos photos et vos fichiers.',
          ],
        ],
      },
    ] satisfies readonly Reason[],
    recipe: {
      title: 'La recette de la box',
      text: [
        'Le système de la box est fabriqué à partir d’une recette : la liste exacte des logiciels et des réglages que nous installons. ',
        // Cette phrase suit l'adresse du dépôt : elle change toute seule une fois l'adresse renseignée.
        isTodo(recipeLink)
          ? 'Nous la publierons, pour que chacun puisse la relire.'
          : 'Elle est publiée : chacun peut la relire.',
      ] satisfies Paragraph,
      linkLabel: 'Dépôt de la recette',
      link: recipeLink,
    },
  },

  limits: {
    id: 'limites',
    title: 'Les limites, en toute franchise',
    lead: 'Nous préférons vous les dire avant que vous ne les découvriez.',
    items: [
      {
        id: 'pas-tout-libre',
        title: 'Tout n’est pas libre',
        text: [
          [
            'Le programme de démarrage de la carte Raspberry Pi 5, enregistré dans une petite puce mémoire, est fourni sans son code source. Le système contient aussi quelques micrologiciels fermés (de petits programmes intégrés aux composants), par exemple pour la puce Wi-Fi.',
          ],
          [
            'Enfin, la carte Raspberry Pi 5 n’est pas du matériel libre : ses plans détaillés ne sont pas publiés, et sa puce principale est conçue par Broadcom.',
          ],
        ],
        links: [
          {
            label: 'Licence du programme de démarrage',
            href: 'https://github.com/raspberrypi/rpi-eeprom/blob/master/LICENSE',
            hreflang: 'en',
          },
        ],
      },
      {
        id: 'acces-exterieur',
        title: 'Pas d’accès depuis l’extérieur, pour l’instant',
        // Mêmes phrases que sur l’accueil et les pages Offres et Notre engagement (src/data/faits.ts).
        text: [
          [remoteAccess.reason, ' ', remoteAccess.consequence],
          [remoteAccess.optionLead, remoteAccess.option, '.'],
        ],
      },
      {
        id: 'copie-de-secours',
        title: 'Pas encore de copie de secours',
        text: [backupCopy.sentence],
      },
    ] satisfies readonly Limit[],
  },

  next: {
    title: 'Envie d’en parler ?',
    text: 'Comparez les deux offres, ou posez-nous vos questions.',
    primary: { label: 'Voir les offres', href: routes.offers } satisfies Link,
    secondary: { label: 'Nous contacter', href: routes.contact } satisfies Link,
  },
} as const;
