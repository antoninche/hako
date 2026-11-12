/**
 * Forme des informations de src/data/entreprise.ts. Les textes eux-mêmes sont
 * dans entreprise.ts ; ce fichier ne change que si l'on ajoute un nouveau
 * genre d'information.
 */
import type { Maybe } from '../lib/todo';

export type SocialId = 'linkedin' | 'youtube' | 'facebook' | 'instagram' | 'peertube';

export interface SocialLink {
  readonly id: SocialId;
  /** Nom du réseau, affiché à côté de son icône. */
  readonly name: string;
  /** Adresse complète de la page (https://…). */
  readonly url: Maybe<string>;
}

export interface Founder {
  /** Domaine dont s'occupe la personne, affiché tel quel. */
  readonly role: string;
  readonly name: Maybe<string>;
  /** Portrait : chemin de l'image, une fois la photo choisie. */
  readonly portrait: Maybe<string>;
  /** Présentation courte, deux ou trois phrases. */
  readonly bio: Maybe<string>;
  /** Adresse complète du profil LinkedIn (https://…). */
  readonly linkedin: Maybe<string>;
}

export interface Company {
  readonly name: string;
  /** Le kanji du logo, et une phrase qui explique le nom. */
  readonly kanji: string;
  readonly nameMeaning: string;
  /** Phrase d'accroche principale. */
  readonly headline: string;
  /** Promesse, juste sous l'accroche. */
  readonly promise: string;
  /** Jamais une adresse Gmail : notre propre nom de domaine ou Proton Mail. */
  readonly email: Maybe<string>;
  readonly phone: Maybe<string>;
  readonly domain: Maybe<string>;
  readonly serviceArea: {
    /** Phrase affichée dans le pied de page. */
    readonly sentence: string;
    /** Ce que nous proposons en dehors de cette zone. */
    readonly outside: Maybe<string>;
  };
  readonly social: readonly SocialLink[];
  readonly founders: readonly Founder[];
  /** Phrases fixes du pied de page. */
  readonly siteNotes: {
    readonly privacy: string;
    readonly freeSoftware: string;
  };
}
