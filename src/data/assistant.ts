/**
 * Faits de la page de la HAKO qui fait la première installation, et de sa
 * démonstration sur le site : combien de personnes, la forme des
 * identifiants, les mots de passe d’exemple de la démonstration, et les
 * informations que l’équipe doit encore confirmer.
 *
 * Les textes sont dans src/content/assistant.ts : ils lisent ce fichier.
 * Ici, seulement des faits.
 *
 * - Personnes : de 1 à 8 à la première installation. La première de la
 *   liste est responsable de la HAKO.
 * - Identifiant d’une personne : son prénom en minuscules, sans accent ni
 *   espace, suivi de @hako.local. C’est le même pour les photos (Immich) et
 *   pour les fichiers (Nextcloud). Deux personnes au même prénom : la
 *   deuxième reçoit « 2 », la troisième « 3 »… (camille2@hako.local). Le nom
 *   qui suit « @ » est celui de la HAKO (BOX_HOST, src/data/installation.ts) :
 *   s’il change là-bas, les identifiants suivent.
 * - Vrai mot de passe : quatre mots français et un nombre de 10 à 99, en
 *   minuscules, séparés par des tirets, tirés au hasard par la HAKO elle-même,
 *   jamais par le site. Le mot « exemple » n’est pas dans sa liste de mots.
 * - Mots de passe de la démonstration (EXAMPLE_PASSWORDS) : toujours les
 *   mêmes, ils commencent par « exemple » et finissent par 00. Aucun vrai mot
 *   de passe ne peut donc leur ressembler. Ne les tirez jamais au hasard : une
 *   démonstration qui inventerait des mots de passe crédibles pourrait être
 *   prise pour la vraie installation.
 * - Une information encore inconnue s’écrit todo('ce qui manque', '[texte
 *   provisoire]') : le site l’affiche surlignée en jaune et `npm run todos`
 *   la recense dans TODO.md. Quand elle est connue, remplacez tout l’appel
 *   todo(…) par le texte entre apostrophes droites. Le texte se lit à
 *   l’endroit où le texte provisoire s’affiche, par exemple :
 *     accountsDuration: todo('Durée de la création des comptes…', '[durée à mesurer]'),
 *   devient
 *     accountsDuration: 'environ deux minutes',
 *   et la page affiche « Comptez environ deux minutes. »
 * - Les informations que le guide attend aussi (fiche perdue, ajouter une
 *   personne, page fermée en cours de route, engagement sur les mots de
 *   passe) restent dans `toConfirm` (src/data/installation.ts) : chacune ne
 *   s’écrit qu’une fois, et les deux pages affichent le même repère.
 *
 * Typographie : comme dans src/data/installation.ts, écrivez des espaces
 * ordinaires ; withFrenchTypography (src/lib/typography.ts) pose les espaces
 * insécables avant « : » et à l’intérieur des guillemets « ». Pour
 * l’apostrophe, écrivez ’. Un texte provisoire court (« [à confirmer] »)
 * garde des espaces insécables, pour ne pas se couper en fin de ligne.
 *
 * Ce fichier n’importe que src/lib/ et src/data/installation.ts, avec
 * l’extension .ts : un test lancé par node --test peut donc le lire.
 */
import { BOX_HOST } from './installation.ts';
import { todo, type Maybe } from '../lib/todo.ts';
import { withFrenchTypography } from '../lib/typography.ts';

/* ---------- Page de démonstration ---------- */

/**
 * Adresse de la page de démonstration sur le site. À l’intégration, elle
 * rejoint `routes` (src/data/navigation.ts), où sont réunies les adresses
 * de toutes les pages : remplacez alors cette constante par la route.
 */
export const DEMO_ROUTE = '/installer/demonstration/';

/* ---------- Les personnes de la maison ---------- */

/** Nombre de personnes à la première installation : de MIN_PEOPLE à MAX_PEOPLE. */
export const MIN_PEOPLE = 1;
export const MAX_PEOPLE = 8;

/**
 * Longueur maximale d’un prénom, en caractères. Avec un chiffre et
 * « @hako.local », l’identifiant reste sous les 64 caractères qu’accepte
 * Nextcloud pour un nom de compte (vérification technique du 13 novembre
 * 2026).
 */
export const FIRST_NAME_MAX_LENGTH = 40;

/** Ce qui suit le prénom dans un identifiant : « @hako.local ». */
export const LOGIN_DOMAIN = `@${BOX_HOST}`;

/** Prénom accentué et son identifiant, cités en exemple par la page. */
export const loginExample = {
  firstName: 'Hélène',
  login: `helene${LOGIN_DOMAIN}`,
} as const;

/** Identifiant de la deuxième personne au même prénom, cité en exemple. */
export const duplicateExample = {
  firstName: 'Camille',
  login: `camille2${LOGIN_DOMAIN}`,
} as const;

/* ---------- Démonstration ---------- */

/**
 * Prénoms du bouton « Remplir avec des prénoms d’exemple » de la
 * démonstration : pour essayer sans taper les prénoms de sa famille.
 */
export const EXAMPLE_FIRST_NAMES = ['Hélène', 'Marc', 'Léa'] as const;

/**
 * Mots de passe de la démonstration, dans l’ordre des personnes : la
 * première personne reçoit le premier, et ainsi de suite. Un par personne
 * possible (MAX_PEOPLE). Toujours les mêmes : « exemple », trois mots
 * courants sans accent, puis 00. Ils ont la longueur d’un vrai mot de passe,
 * pour montrer à quoi il ressemble.
 */
export const EXAMPLE_PASSWORDS = [
  'exemple-tulipe-melon-givre-00',
  'exemple-cerise-tambour-nuage-00',
  'exemple-sapin-violon-plume-00',
  'exemple-orange-bateau-moulin-00',
  'exemple-pomme-girafe-sable-00',
  'exemple-citron-piano-colline-00',
  'exemple-prune-castor-jardin-00',
  'exemple-olive-lapin-brioche-00',
] as const;

/* ---------- Informations à confirmer ---------- */

export interface AssistantPendingFacts {
  /** Durée de la première installation sur la page de la HAKO (écran « Bienvenue »). */
  readonly duration: Maybe<string>;
  /** Durée de la création des comptes (écran « Votre HAKO crée vos comptes »). */
  readonly accountsDuration: Maybe<string>;
  /** Adresse de l’application des photos (Immich) sur la HAKO. */
  readonly photosAddress: Maybe<string>;
  /** Adresse de l’application des fichiers (Nextcloud) sur la HAKO. */
  readonly filesAddress: Maybe<string>;
  /** Création des comptes interrompue : ce que devient la fiche de secours. */
  readonly afterStop: Maybe<string>;
  /** Page de la HAKO fermée pendant la création des comptes. */
  readonly closedDuringCreation: Maybe<string>;
  /** Enregistrer la fiche en PDF sur un iPhone ou un iPad. */
  readonly iosPdf: Maybe<string>;
  /** Sur Android, les gestes qui suivent « Enregistrer au format PDF », et où se range le fichier. */
  readonly androidPdf: Maybe<string>;
}

/**
 * Informations que l’équipe doit encore confirmer, surtout par une mesure
 * ou un essai sur une HAKO de série. Rien ici ne s’invente : tant qu’une
 * valeur n’est pas connue, la page affiche le texte provisoire surligné en
 * jaune.
 */
export const pending: AssistantPendingFacts = withFrenchTypography<AssistantPendingFacts>({
  duration: todo(
    'Durée de la première installation sur la page de la HAKO, de « Commencer » à « C’est prêt », impression de la fiche comprise, mesurée sur une HAKO de série avec quatre personnes (par exemple « environ 15 minutes »)',
    '[durée à mesurer]',
  ),
  accountsDuration: todo(
    'Durée de la création des comptes (Immich puis Nextcloud) sur une HAKO de série, pour une personne et pour huit (par exemple « environ deux minutes »)',
    '[durée à mesurer]',
  ),
  // Adresses fixées par la spécification de MaBox OS : une fois la première
  // installation terminée, le nginx de la HAKO relaie :2283 vers Immich et
  // :8080 vers Nextcloud (pare-feu ouvert seulement après l’installation).
  photosAddress: `http://${BOX_HOST}:2283`,
  filesAddress: `http://${BOX_HOST}:8080`,
  afterStop: todo(
    'Création des comptes interrompue (HAKO débranchée ou redémarrée) : les mots de passe de la fiche de secours restent-ils valables, ou la HAKO en tire-t-elle de nouveaux, avec une fiche à refaire ? Texte qui suit « Ce que devient votre fiche : »',
    '[à confirmer]',
  ),
  closedDuringCreation: todo(
    'Page de la HAKO fermée pendant la création des comptes : la création continue-t-elle, et que montre http://hako.local quand on le rouvre ? Texte qui suit « Ce qui se passe ensuite : »',
    '[à confirmer]',
  ),
  iosPdf: todo(
    'Geste pour enregistrer la fiche de secours en PDF depuis la fenêtre d’impression d’un iPhone ou d’un iPad à jour (écarter deux doigts sur l’aperçu, puis le bouton de partage et « Enregistrer dans Fichiers » ?), à vérifier sur un appareil',
    '[geste à vérifier]',
  ),
  androidPdf: todo(
    'Gestes sur Android après « Enregistrer au format PDF », dans la fenêtre d’impression de Chrome (toucher le rond « PDF », puis « Enregistrer » ?), et dossier où se range le fichier (« Téléchargements », ouvert par l’application « Fichiers » ?), à vérifier sur un Android 12 d’entrée de gamme. Texte qui suit « Ensuite : »',
    '[gestes à vérifier]',
  ),
});
