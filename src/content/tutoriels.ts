/**
 * Textes de la page « Tutoriels » (/tutoriels/).
 *
 * Les vidéos sont publiées sur YouTube et sur PeerTube. Elles ne sont jamais
 * intégrées dans le site (aucun lecteur vidéo, aucune requête vers ces
 * plateformes) : chaque carte propose de simples liens.
 *
 * Pour publier une vidéo, remplacez l'appel todo(…) de son adresse par
 * l'adresse complète entre apostrophes droites, par exemple :
 *   youtube: todo('Adresse de la vidéo…', '[lien à venir]'),
 * devient
 *   youtube: 'https://www.youtube.com/watch?v=…',
 * Le lien apparaît alors tout seul sur la carte.
 *
 * Typographie : apostrophe ’, espaces insécables avant « : » et à
 * l'intérieur des guillemets « ».
 */
import { company } from '../data/entreprise';
import { backupCopy, moverOffers } from '../data/faits';
import { boxAddress } from '../data/installation';
import { routes } from '../data/navigation';
import { isTodo, todo, type Maybe } from '../lib/todo';
import type { Link, Paragraph } from './la-box';

/** Nom des vignettes, dans src/assets/illustrations/tutoriels/<nom>.svg. */
export type TutorialSlug =
  'prise-en-main' | 'acceder-donnees' | 'recuperer-photos' | 'verifier-sauvegarde';

export type Platform = 'youtube' | 'peertube';

export interface Tutorial {
  readonly slug: TutorialSlug;
  readonly title: string;
  readonly text: readonly Paragraph[];
  /** Adresses des vidéos ; à laisser vide tant que le tutoriel n'existe pas. */
  readonly videos?: Readonly<Record<Platform, Maybe<string>>>;
  /** Tutoriel pas encore disponible : la carte porte l'étiquette « Bientôt ». */
  readonly soon?: boolean;
}

/** Les deux plateformes, dans l'ordre d'affichage. */
const platforms = { youtube: 'YouTube', peertube: 'PeerTube' } as const satisfies Record<
  Platform,
  string
>;

/** Vrai dès qu'une vidéo a une adresse : les textes passent alors du futur au présent. */
const published = (items: readonly Tutorial[]): boolean =>
  items.some(
    (item) => item.videos !== undefined && Object.values(item.videos).some((url) => !isTodo(url)),
  );

const channels = company.social.filter(
  (link): link is (typeof company.social)[number] & { id: Platform } =>
    link.id === 'youtube' || link.id === 'peertube',
);

const items = [
  {
    slug: 'prise-en-main',
    title: 'Prise en main et installation',
    text: [
      [
        'Ce que nous installons chez vous, ou ce que vous installerez bientôt avec notre guide, puis vos premiers pas : ouvrir la page de votre HAKO, à l’adresse ',
        { address: boxAddress.display },
        ', depuis un appareil de la maison.',
      ],
    ],
    videos: {
      youtube: todo(
        'Adresse de la vidéo « Prise en main et installation » sur YouTube',
        '[lien à venir]',
      ),
      peertube: todo(
        'Adresse de la vidéo « Prise en main et installation » sur PeerTube',
        '[lien à venir]',
      ),
    },
  },
  {
    slug: 'acceder-donnees',
    title: 'Accéder à ses données',
    text: [
      [
        'Retrouver vos photos et vos fichiers depuis les appareils de la maison : ordinateur, tablette ou téléphone.',
      ],
    ],
    videos: {
      youtube: todo('Adresse de la vidéo « Accéder à ses données » sur YouTube', '[lien à venir]'),
      peertube: todo(
        'Adresse de la vidéo « Accéder à ses données » sur PeerTube',
        '[lien à venir]',
      ),
    },
  },
  {
    slug: 'recuperer-photos',
    title: 'Récupérer ses photos depuis Google Photos ou iCloud',
    text: [
      [
        'Rapatrier vos photos de Google Photos ou d’iCloud vers la box. C’est vous qui vous connectez à votre compte : nous ne voyons jamais vos identifiants.',
      ],
      // Les offres qui comprennent le déménageur : src/data/faits.ts.
      [
        'Avec ',
        moverOffers.names,
        ', nous vous aidons à le faire : c’est notre service « déménageur ».',
      ],
    ],
    videos: {
      youtube: todo(
        'Adresse de la vidéo « Récupérer ses photos depuis Google Photos ou iCloud » sur YouTube',
        '[lien à venir]',
      ),
      peertube: todo(
        'Adresse de la vidéo « Récupérer ses photos depuis Google Photos ou iCloud » sur PeerTube',
        '[lien à venir]',
      ),
    },
  },
  {
    slug: 'verifier-sauvegarde',
    title: 'Vérifier sa copie de secours',
    // La copie de secours n'existe pas encore : même phrase que sur les autres pages (src/data/faits.ts).
    text: [[...backupCopy.sentence, ' Ce tutoriel arrivera avec elle.']],
    soon: true,
  },
] as const satisfies readonly Tutorial[];

/**
 * Vrai dès qu’une vidéo est en ligne. Le guide d’installation s’en sert aussi
 * (src/content/installation.ts) : tant qu’il est faux, il annonce les
 * tutoriels au futur.
 */
export const videosOnline = published(items);

export const tutoriels = {
  meta: {
    title: 'Tutoriels vidéo pour prendre en main votre box',
    // Futur tant qu'aucune vidéo n'est en ligne, présent ensuite (voir published()).
    description: videosOnline
      ? 'Les tutoriels vidéo de HAKO : prise en main de la box, accès à vos données, photos récupérées depuis Google Photos ou iCloud. Sur YouTube et sur PeerTube.'
      : 'Les tutoriels vidéo de HAKO : prise en main de la box, accès à vos données, photos récupérées depuis Google Photos ou iCloud. À venir sur YouTube et PeerTube.',
  },

  intro: {
    title: 'Tutoriels',
    lead: videosOnline
      ? 'De courtes vidéos pour prendre votre box en main, à votre rythme, à regarder sur YouTube ou sur PeerTube.'
      : 'De courtes vidéos pour prendre votre box en main, à votre rythme. Vous pourrez les regarder sur YouTube ou sur PeerTube.',
    // Bientôt, hors de notre zone, la personne installera la HAKO elle-même : le guide écrit, pas à pas.
    guide: {
      text: 'Bientôt, hors de notre zone, vous installerez votre HAKO vous-même.',
      link: {
        label: 'Voir le guide d’installation pas à pas',
        href: routes.install,
      } satisfies Link,
    },
  },

  labels: {
    /** « Regarder sur YouTube », « Regarder sur PeerTube ». */
    watchOn: 'Regarder sur',
    soon: 'Bientôt',
    platforms,
  },

  /** Titre (lu par les lecteurs d'écran) de la liste des tutoriels. */
  listLabel: 'Les tutoriels',

  items,

  platformsNote: {
    title: 'YouTube et PeerTube',
    text: [
      [
        'Pour que ce site reste sans traceur, les vidéos n’y sont pas intégrées : chaque lien ouvre la vidéo directement sur YouTube ou sur PeerTube.',
      ],
      [
        'PeerTube est un outil libre de partage de vidéos, conçu par Framasoft, une association française à but non lucratif.',
      ],
    ] satisfies readonly Paragraph[],
    /** Nos chaînes (adresses dans src/data/entreprise.ts). */
    channelsLabel: 'Nos chaînes',
    channels,
    peertubeSite: {
      label: 'Découvrir PeerTube',
      href: 'https://joinpeertube.org/fr',
    } satisfies Link,
  },

  help: {
    text: 'Une question en attendant les vidéos ?',
    link: { label: 'Écrivez-nous', href: routes.contact } satisfies Link,
  },
} as const;
