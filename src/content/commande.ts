/**
 * Textes de la page Commander (/commander/) : étapes, champs, messages
 * d'erreur, récapitulatif, confirmation et notice sur les données.
 *
 * Les prix viennent de src/data/tarifs.ts et la description des offres de
 * src/content/offres.ts. Une information manquante s'écrit
 * todo('ce qui manque', '[texte provisoire]') : elle s'affiche surlignée en
 * jaune et `npm run todos` la recense dans TODO.md.
 *
 * Les messages d'erreur disent quoi faire, en une phrase courte. Dans
 * « {max} », le formulaire écrit la longueur maximale du champ.
 */
import { company } from '../data/entreprise.ts';
import { payment, shippingCost } from '../data/faits.ts';
import { routes } from '../data/navigation.ts';
import { pricing } from '../data/tarifs.ts';
import { emailLink, phoneLink } from '../lib/commande/inline.ts';
import { findStorage } from '../lib/commande/pricing.ts';
import type { LinkValue, RichText, TimeSlotId } from '../lib/commande/types.ts';
import type { OrderField, ValidationCode } from '../lib/commande/validation.ts';
import { isTodo, todo } from '../lib/todo.ts';
import { callbackDelay } from './offres.ts';

export interface FieldCopy {
  readonly label: string;
  /** Aide sous l'intitulé (facultative). */
  readonly hint?: string;
  /** Message affiché pour chaque raison de refus possible. */
  readonly messages: Partial<Record<ValidationCode, string>>;
}

const retention = todo(
  'Durée de conservation des informations d’une demande de commande',
  '[durée de conservation]',
);

const email = emailLink(company.email);
const phone = phoneLink(company.phone);
const includedStorage = findStorage(pricing, pricing.includedStorage);

/** Hors de la zone : la box est envoyée (src/data/entreprise.ts), écrit ici en début de phrase. */
const outside = company.serviceArea.outside;
const shippedInstallation = isTodo(outside)
  ? outside
  : `${outside.charAt(0).toUpperCase()}${outside.slice(1)}.`;

export const commandePage = {
  meta: {
    title: 'Commander votre box',
    description:
      'Choisissez Hako Home ou Hako Pro et votre stockage, laissez vos coordonnées, puis vérifiez le récapitulatif : trois étapes. Aucun paiement en ligne.',
  },
  intro: {
    kicker: 'Commander',
    title: 'Votre box en trois étapes',
    lead: 'Aucun paiement en ligne : nous vous appelons pour confirmer.',
  },
  demoNotice: {
    title: 'Formulaire de démonstration',
    text: [
      'Ce formulaire n’envoie encore rien : ce que vous saisissez reste dans votre navigateur. Pour commander dès maintenant, écrivez-nous à ',
      email,
      ' ou appelez le ',
      phone,
      '.',
    ] satisfies RichText,
  },
  /** Note affichée seulement quand JavaScript est désactivé. */
  noscript: [
    'Ce formulaire a besoin de JavaScript pour calculer votre total et préparer votre demande. Sans JavaScript, vous pouvez lire les trois étapes ci-dessous, mais pas envoyer votre demande. Pour commander, écrivez-nous à ',
    email,
    ' ou appelez le ',
    phone,
    '.',
  ] satisfies RichText,
  requiredNote: 'Tous les champs sont obligatoires, sauf ceux marqués « facultatif ».',
  optional: 'facultatif',

  stepsLabel: 'Étapes de la commande',
  /** « {n} » : numéro de l'étape. */
  stepOf: 'Étape {n} sur 3',
  stepDone: '(terminée)',
  steps: {
    1: { title: 'Votre box' },
    2: { title: 'Vos coordonnées' },
    3: { title: 'Récapitulatif' },
  },
  next: 'Continuer',
  back: 'Retour',

  offer: { legend: 'Votre offre', then: 'puis ' },
  storage: {
    legend: 'Votre stockage',
    hint: `${includedStorage.label} est compris dans les deux offres.`,
    included: 'Compris',
  },
  total: {
    title: 'Votre total',
    oneTime: 'À payer une fois',
    monthly: 'Abonnement',
    commitment: 'Durée d’engagement',
    deposit: 'Acompte à la commande',
    depositOf: 'du total',
    note: 'Aucun paiement maintenant.',
  },

  groups: {
    contact: 'Vous',
    address: 'Adresse d’installation',
    company: 'Votre entreprise',
    companyHint: 'Seulement pour Hako Pro.',
    timeSlots: 'À quel moment pouvons-nous vous appeler ?',
    timeSlotsHint: 'Plusieurs choix possibles.',
  },
  timeSlots: [
    { id: 'matin', label: 'Le matin' },
    { id: 'apres-midi', label: 'L’après-midi' },
    { id: 'fin-de-journee', label: 'En fin de journée' },
  ] satisfies readonly { id: TimeSlotId; label: string }[],

  fields: {
    firstName: { label: 'Prénom', messages: { required: 'Indiquez votre prénom.' } },
    lastName: { label: 'Nom', messages: { required: 'Indiquez votre nom.' } },
    email: {
      label: 'Adresse e-mail',
      messages: {
        required: 'Indiquez votre adresse e-mail.',
        invalid: 'Vérifiez votre adresse e-mail : elle s’écrit sous la forme nom@domaine.fr.',
      },
    },
    phone: {
      label: 'Téléphone',
      hint: 'Nous vous appelons à ce numéro pour confirmer la commande.',
      messages: {
        required: 'Indiquez un numéro de téléphone pour que nous puissions vous appeler.',
        invalid: 'Vérifiez votre numéro : 10 chiffres, commençant par 0 (ou par +33).',
      },
    },
    address: {
      label: 'Adresse',
      hint: 'Numéro et rue, bâtiment, étage…',
      messages: { required: 'Indiquez l’adresse où installer la box.' },
    },
    postalCode: {
      label: 'Code postal',
      hint: company.serviceArea.sentence,
      messages: {
        required: 'Indiquez votre code postal.',
        invalid: 'Le code postal compte 5 chiffres, par exemple 13100.',
      },
    },
    city: { label: 'Commune', messages: { required: 'Indiquez votre commune.' } },
    companyName: {
      label: 'Nom de l’entreprise',
      messages: { required: 'Indiquez le nom de votre entreprise.' },
    },
    users: {
      label: 'Nombre de personnes',
      hint: 'Combien de personnes auront un compte sur la box ?',
      messages: {
        required: 'Indiquez combien de personnes auront un compte.',
        invalid: 'Indiquez un nombre entier, 1 ou plus.',
      },
    },
    availabilityNote: {
      label: 'Précisions',
      hint: 'Par exemple : un jour à éviter.',
      messages: {},
    },
    acceptTerms: {
      label: 'J’ai lu et j’accepte les conditions générales de vente.',
      messages: {
        unchecked: 'Pour envoyer votre demande, acceptez les conditions générales de vente.',
      },
    },
    acceptPrivacy: {
      label: 'J’ai lu comment mes données sont utilisées.',
      messages: {
        unchecked:
          'Pour envoyer votre demande, confirmez que vous avez lu comment vos données sont utilisées.',
      },
    },
  } satisfies Record<OrderField, FieldCopy>,
  tooLong: 'Ce texte est trop long : {max} caractères au maximum.',

  /** Code postal hors de la zone : la demande reste possible, la box est envoyée. */
  serviceArea: {
    outside: [
      'Ce code postal semble hors de notre zone d’intervention. Vous pouvez tout de même commander : ',
      outside,
      '. Frais d’envoi : ',
      shippingCost,
      '.',
    ] satisfies RichText,
  },

  errors: {
    /** Titre du résumé des erreurs ; « {n} » : nombre d'erreurs. */
    titleOne: 'Il y a 1 point à corriger',
    titleMany: 'Il y a {n} points à corriger',
    prefix: 'Erreur : ',
  },

  recap: {
    boxTitle: 'Votre box',
    contactTitle: 'Vos coordonnées',
    editBox: 'Modifier',
    editBoxContext: 'votre box',
    editContact: 'Modifier',
    editContactContext: 'vos coordonnées',
    offer: 'Offre',
    storage: 'Stockage',
    name: 'Prénom et nom',
    email: 'E-mail',
    phone: 'Téléphone',
    address: 'Adresse d’installation',
    /** Selon le code postal : installation chez vous, ou envoi de la box. */
    installation: 'Installation',
    installationAtHome: 'Chez vous, par notre équipe, avec une formation sur place.',
    installationShipped: shippedInstallation,
    company: 'Entreprise',
    users: 'Nombre de personnes',
    timeSlots: 'Moments pour vous appeler',
    noPreference: 'Pas de préférence',
    note: 'Précisions',
  },
  payment: [
    'Aucun paiement maintenant : nous vous appelons sous ',
    callbackDelay,
    ' pour confirmer votre commande et convenir de l’installation ou de l’envoi. ',
    payment,
  ] satisfies RichText,
  consents: {
    legend: 'Avant d’envoyer',
    termsLink: {
      label: 'Lire les conditions générales de vente (en cours de rédaction)',
      href: routes.terms,
    } satisfies LinkValue,
    newTab: '(s’ouvre dans un nouvel onglet)',
    privacyLink: {
      label: 'Lire « Vos données », plus bas sur cette page',
      href: '#vos-donnees',
    } satisfies LinkValue,
  },
  submit: 'Envoyer ma demande',
  sending: 'Envoi en cours…',
  sendError:
    'L’envoi n’a pas fonctionné. Ce que vous avez saisi est toujours là : réessayez dans un instant.',

  confirmation: {
    title: 'Mode démonstration : aucune donnée n’a été envoyée',
    text: 'Ce formulaire n’est pas encore en service : votre demande ne nous est pas parvenue.',
    contact: [
      'Pour commander dès maintenant, écrivez-nous à ',
      email,
      ' ou appelez le ',
      phone,
      '.',
    ] satisfies RichText,
    back: 'Revenir à ma demande',
  },

  privacy: {
    title: 'Vos données',
    intro: 'Ce que nous faisons des informations de ce formulaire.',
    items: [
      {
        term: 'À quoi elles servent',
        text: ['À traiter votre demande : vous appeler, fixer le rendez-vous et installer la box.'],
      },
      {
        term: 'Combien de temps nous les gardons',
        text: ['Nous les gardons ', retention, '.'],
      },
      {
        term: 'Vos droits',
        text: [
          'Vous pouvez les consulter, les corriger ou les faire supprimer en nous écrivant à ',
          email,
          '.',
        ],
      },
    ] satisfies readonly { term: string; text: RichText }[],
    more: { label: 'Notre politique de confidentialité', href: routes.privacy } satisfies LinkValue,
  },
} as const;
