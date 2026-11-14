/**
 * Crédits : polices, icônes et code créés par d'autres, avec leur licence.
 * Affichés sur la page des mentions légales, rubrique « Crédits ».
 *
 * Sources, versions et vérifications : docs/licences.md, docs/fonts.md et
 * docs/icons.md. Les textes des licences des polices, de Bootstrap Icons,
 * de three.js et de meshoptimizer sont servis par le site lui-même
 * (public/fonts/ et public/licences/).
 * On écrit des espaces ordinaires : les espaces insécables et l'apostrophe
 * courbe sont ajoutées à l'affichage (src/lib/typography.ts).
 */
import { withFrenchTypography } from '../lib/typography';

export interface Credit {
  /** Ce qui est emprunté, tel qu'affiché. */
  readonly work: string;
  /** Auteur ou titulaire des droits, comme il se nomme lui-même. */
  readonly author: string;
  /** Nom de la licence et adresse de son texte. */
  readonly license: { readonly name: string; readonly href: string };
  /** Modifications faites pour le site (la licence CC BY-SA demande de les signaler). */
  readonly changes?: string;
}

export const creditsIntro = withFrenchTypography(
  'Ce site utilise des polices, des icônes et du code créés par d’autres, sous licence libre.',
);

export const credits: readonly Credit[] = withFrenchTypography([
  {
    work: 'Police Fraunces (titres)',
    author: 'The Fraunces Project Authors (Undercase Type)',
    license: { name: 'SIL Open Font License 1.1', href: '/fonts/fraunces/OFL.txt' },
    changes: 'découpée pour le français',
  },
  {
    work: 'Police Atkinson Hyperlegible Next (texte)',
    author: 'The Atkinson Hyperlegible Next Project Authors (Braille Institute)',
    license: {
      name: 'SIL Open Font License 1.1',
      href: '/fonts/atkinson-hyperlegible-next/OFL.txt',
    },
    changes: 'découpée pour le français',
  },
  {
    work: 'Police D-DIN (navigation et boutons)',
    author: 'Datto Inc.',
    license: { name: 'SIL Open Font License 1.1', href: '/fonts/d-din/OFL-1.1.txt' },
  },
  {
    work: 'Logo PeerTube',
    author: 'Framasoft',
    license: {
      name: 'CC BY-SA 4.0',
      href: 'https://creativecommons.org/licenses/by-sa/4.0/deed.fr',
    },
    changes:
      'version d’une seule couleur reprise de Simple Icons, couleur changée ; notre version reste sous la même licence',
  },
  {
    work: 'Icône LinkedIn',
    author: 'Bootstrap Icons, © 2019-2024 The Bootstrap Authors',
    license: { name: 'MIT', href: '/licences/bootstrap-icons-LICENSE.txt' },
    changes: 'agrandie, couleur changée',
  },
  {
    work: 'Bibliothèque three.js (scène 3D de l’accueil)',
    author: 'three.js authors',
    license: { name: 'MIT', href: '/licences/three-LICENSE.txt' },
  },
  {
    work: 'Décodeur meshoptimizer (modèles 3D compressés)',
    author: 'Arseny Kapoulkine',
    license: { name: 'MIT', href: '/licences/meshoptimizer-LICENSE.txt' },
  },
]);

export const trademarksNote = withFrenchTypography(
  'LinkedIn, YouTube, Facebook, Instagram et PeerTube sont des marques de leurs propriétaires.',
);
