/**
 * Images du prototype de la box et leurs textes : la galerie de la page
 * « La box » et l'image d'ouverture de l'accueil.
 *
 * Ce sont des images du modèle 3D du prototype, dessiné par l'équipe : des
 * images de synthèse, jamais des photos. Chaque légende le dit.
 * Les fichiers PNG viennent de scripts/prototype/prepare.mjs (captures
 * nettoyées et cadrées) ; Astro en tire des versions AVIF et WebP.
 *
 * Pour chaque vue :
 * - alt : ce que montre l'image, pour les personnes qui ne la voient pas
 *   (les lecteurs d'écran le lisent à sa place). Seulement ce qui se voit, et
 *   sans redire la légende : elle est lue juste après ;
 * - title : le nom de la vue, en tête de légende ;
 * - caption : la suite de la légende, sous l'image. Comme sur la page
 *   « La box », un paragraphe est une liste de morceaux : du texte, une
 *   information manquante ou un mot japonais.
 * Une information encore inconnue s'écrit todo('ce qui manque', '[texte
 * provisoire]') : elle s'affiche surlignée en jaune et `npm run todos` la
 * recense dans TODO.md.
 * Typographie : apostrophe ’, espaces insécables avant « : » et à l'intérieur
 * des guillemets « ».
 */
import type { ImageMetadata } from 'astro';

import arriere from '../assets/prototype/vue-arriere.png';
import dessus from '../assets/prototype/vue-dessus.png';
import troisQuarts from '../assets/prototype/vue-trois-quarts.png';
import { company } from '../data/entreprise';
import { nameSentence } from '../data/faits';
import type { Maybe } from '../lib/todo';
import type { Paragraph } from './la-box';

export interface PrototypeView {
  readonly image: ImageMetadata;
  readonly alt: string;
  readonly title: string;
  readonly caption: Paragraph;
  /**
   * true : le haut et le bas de l'image ne montrent que le fond de studio.
   * L'image peut alors se poser dans un panneau plus haut qu'elle (voir
   * PrototypeFigure, option float). Sur la vue de dessus, l'ombre touche le
   * bord haut : false. scripts/prototype/prepare.mjs affiche ces bandes de fond.
   */
  readonly backdropAtTopAndBottom: boolean;
}

/** Une finition de la box, affichée sous la galerie. */
export interface PrototypeDetail {
  readonly label: string;
  readonly value: Maybe<string>;
}

/** Début commun à toutes les légendes : ce ne sont pas des photos. */
const synthesis = 'Image de synthèse du prototype.';

export const prototypeViews = {
  troisQuarts: {
    image: troisQuarts,
    backdropAtTopAndBottom: true,
    alt: 'Un boîtier blanc perlé aux angles arrondis, vu de trois quarts, avec un bouton rond et un petit point sur le petit côté.',
    title: 'Vue de trois quarts',
    caption: [
      synthesis,
      ' Sur le couvercle, le kanji ',
      { ja: company.kanji },
      ' en relief. Sous le boîtier, le socle brun foncé.',
    ],
  },
  arriere: {
    image: arriere,
    backdropAtTopAndBottom: true,
    alt: 'Le boîtier vu de l’autre côté. Sur la grande face, deux longues fentes horizontales et trois petites ouvertures carrées ; sur la petite face, trois grandes ouvertures rectangulaires.',
    title: 'Vue arrière',
    caption: [synthesis, ' Les fentes d’aération et les ouvertures pour brancher les câbles.'],
  },
  dessus: {
    image: dessus,
    backdropAtTopAndBottom: false,
    alt: 'Le couvercle vu de dessus : un rectangle blanc perlé aux angles arrondis.',
    title: 'Vue de dessus',
    caption: [
      synthesis,
      ' Au centre du couvercle, le kanji ',
      { ja: company.kanji },
      ', qui veut dire « boîte » en japonais.',
    ],
  },
  /*
   * La vue en transparence (vue-interieur.png, déjà préparée par le script)
   * attend que l'équipe confirme l'intérieur de la box : sur ce modèle, aucun
   * ventilateur n'est dessiné et la carte du disque est sous la carte
   * Raspberry Pi 5, alors que la vue éclatée de la page « La box » montre un
   * ventilateur et la carte du disque au-dessus. Elle n'est pas importée d'ici
   * là : une image importée est publiée avec le site, même si aucune page ne
   * l'affiche. Une fois l'intérieur confirmé (et la vue éclatée corrigée s'il
   * le faut), importez-la et ajoutez-la à la fin de gallery.views :
   *   interieur: {
   *     image: interieur,
   *     backdropAtTopAndBottom: true,
   *     alt: 'Le boîtier en transparence\u00a0: à l’intérieur, deux cartes vertes empilées, avec des blocs gris pour les prises à une extrémité et le long d’un côté.',
   *     title: 'Vue en transparence',
   *     caption: [synthesis, ' À l’intérieur, deux cartes empilées\u00a0: la carte Raspberry Pi 5, le petit ordinateur de la box, et la petite carte qui porte le disque de stockage.'],
   *   },
   */
} as const satisfies Record<string, PrototypeView>;

export const prototype = {
  /** Section de la page « La box ». */
  gallery: {
    id: 'prototype',
    title: 'Le prototype, en images',
    intro:
      'Voici le prototype de la box, tel que nous l’avons dessiné en 3D. Ce sont des images de synthèse, pas des photos, et quelques détails peuvent encore changer.',
    views: [prototypeViews.troisQuarts, prototypeViews.arriere, prototypeViews.dessus],
    /** Les finitions choisies par l'équipe. */
    details: [
      { label: 'Teinte du boîtier', value: 'Blanc perlé (référence de couleur RAL 1013)' },
      { label: 'Socle', value: 'Brun foncé, imprimé en 3D dans une matière qui contient du bois' },
    ] satisfies readonly PrototypeDetail[],
  },

  /**
   * Image d'ouverture de l'accueil. Sa légende ne décrit pas l'image : le
   * texte de remplacement (alt) dit donc tout ce qui se voit. La légende
   * reprend la phrase qui explique le nom, la même que sur la page Notre
   * engagement (nameSentence, src/data/faits.ts) : le kanji se voit sur le
   * couvercle.
   */
  hero: {
    view: prototypeViews.troisQuarts,
    alt: 'Un boîtier blanc perlé aux angles arrondis, vu de trois quarts, avec le kanji du logo en relief sur le couvercle, posé sur un socle brun foncé.',
    caption: [
      'Le prototype de la box, en image de synthèse. ',
      nameSentence.before,
      { ja: nameSentence.kanji },
      nameSentence.after,
    ] satisfies Paragraph,
  },
} as const;
