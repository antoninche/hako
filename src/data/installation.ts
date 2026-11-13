/**
 * Faits du guide d’installation (/installer/) : l’adresse de la HAKO sur le
 * réseau de la maison, les adresses des applications Immich et Nextcloud dans
 * les boutiques, quelques repères techniques, et les informations que
 * l’équipe doit encore confirmer.
 *
 * Les textes du guide sont dans src/content/installation.ts : ils lisent ce
 * fichier. Ici, seulement des faits.
 *
 * - L’adresse de la HAKO s’écrit une seule fois : BOX_HOST. Le lien du guide,
 *   l’adresse écrite en grand et celle d’une deuxième HAKO en découlent. Si
 *   le nom change, changez-le ici seulement : tout le guide suit.
 * - Les adresses des applications ont été vérifiées le 13 novembre 2026 (voir
 *   le commentaire de `apps`). Si l’une change, corrigez-la ici.
 * - Les repères techniques (`requirements`) viennent de la vérification
 *   technique du parcours d’installation (documentations d’Apple, d’Android
 *   et de Microsoft, 13 novembre 2026).
 * - Une information encore inconnue s’écrit todo('ce qui manque', '[texte
 *   provisoire]') : le site l’affiche surlignée en jaune et `npm run todos`
 *   la recense dans TODO.md. Quand elle est connue, remplacez tout l’appel
 *   todo(…) par le texte entre apostrophes droites. Le texte se lit à
 *   l’endroit où le texte provisoire s’affiche, par exemple :
 *     firstBoot: todo('Durée du premier démarrage…', '[durée à mesurer]'),
 *   devient
 *     firstBoot: 'environ 20 minutes',
 *   et le guide affiche « Patientez : comptez environ 20 minutes. »
 *
 * Typographie : comme dans src/data/entreprise.ts, écrivez des espaces
 * ordinaires ; withFrenchTypography (src/lib/typography.ts) pose les espaces
 * insécables avant « : » et à l’intérieur des guillemets « ». Pour
 * l’apostrophe, écrivez ’. Un texte provisoire court (« [à confirmer] »)
 * garde des espaces insécables, pour ne pas se couper en fin de ligne.
 *
 * Ce fichier n’importe que src/lib/, avec l’extension .ts : un test lancé
 * par node --test peut donc le lire.
 */
import { todo, type Maybe } from '../lib/todo.ts';
import { withFrenchTypography } from '../lib/typography.ts';

/* ---------- Adresse de la HAKO ---------- */

/** Nom de la HAKO sur le réseau de la maison : le seul endroit où il s’écrit. */
export const BOX_HOST = 'hako.local';

/**
 * Nom d’une deuxième HAKO branchée sur le même réseau : un nom déjà pris
 * reçoit « -2 » (RFC 6762, section 9 ; Avahi, sur la HAKO, écrit
 * hako-2.local).
 */
const SECOND_BOX_HOST = BOX_HOST.replace(/\.local$/, '-2.local');

/**
 * Adresses de la page de la HAKO. Le lien s’ouvre dans le même onglet : le
 * bouton « Retour » du navigateur ramène au guide, à la même étape. Ces
 * adresses restent dans le HTML : aucun script du navigateur ne doit les
 * contenir (contrôle `npm run check:dist`).
 */
export const boxAddress = {
  host: BOX_HOST,
  /** Lien vers la page de la HAKO. */
  url: `http://${BOX_HOST}/`,
  /** Adresse écrite en grand, à recopier : « http:// » compris, sans barre finale. */
  display: `http://${BOX_HOST}`,
  secondHost: SECOND_BOX_HOST,
  secondUrl: `http://${SECOND_BOX_HOST}/`,
  secondDisplay: `http://${SECOND_BOX_HOST}`,
} as const;

/* ---------- Applications des téléphones ---------- */

export interface StoreLinks {
  readonly name: string;
  /** App Store d’Apple (iPhone, iPad), vitrine française. */
  readonly appStore: string;
  /** Google Play (Android), pages en français. */
  readonly googlePlay: string;
}

/**
 * Applications à installer sur les téléphones et les tablettes. Adresses
 * vérifiées le 13 novembre 2026 (chaque page répond 200) :
 * - Immich : la documentation d’Immich donne ces deux adresses
 *   (docs/docs/partials/_mobile-app-download.md du dépôt immich-app/immich).
 *   App Store : page « App Immich - App Store », éditeur FUTO Computing.
 *   Google Play : page « Immich – Applications sur Google Play », éditeur FUTO.
 * - Nextcloud : les dépôts nextcloud/ios et nextcloud/android donnent ces
 *   deux adresses dans leur README. App Store : page « App Nextcloud - App
 *   Store », éditeur Nextcloud GmbH. Google Play : page « Nextcloud –
 *   Applications sur Google Play », éditeur Nextcloud.
 */
export const apps = {
  immich: {
    name: 'Immich',
    appStore: 'https://apps.apple.com/fr/app/immich/id1613945652',
    googlePlay: 'https://play.google.com/store/apps/details?id=app.alextran.immich&hl=fr',
  },
  nextcloud: {
    name: 'Nextcloud',
    appStore: 'https://apps.apple.com/fr/app/nextcloud/id1125420102',
    googlePlay: 'https://play.google.com/store/apps/details?id=com.nextcloud.client&hl=fr',
  },
} as const satisfies Readonly<Record<'immich' | 'nextcloud', StoreLinks>>;

/* ---------- Repères techniques ---------- */

/**
 * Versions à partir desquelles un appareil sait ouvrir l’adresse de la HAKO
 * (vérification technique du 13 novembre 2026) :
 * - android : Android résout les noms en .local depuis une mise à jour de
 *   fin 2021 ; c’est sûr à partir d’Android 13, attesté sous Android 12,
 *   absent d’Android 10 et 11. Jamais en données mobiles ni avec un VPN.
 * - macos : depuis macOS 15, Chrome, Firefox et Edge doivent recevoir
 *   l’autorisation « Réseau local » ; Safari en est exempté (Apple, TN3179).
 * - windows : Microsoft annonce la prise en charge des noms en .local depuis
 *   Windows 10 (version 1703). Confiance moyenne : à tester sur des
 *   ordinateurs Windows 10 et 11.
 */
export const requirements = {
  android: '12',
  macos: '15',
  windows: '10',
} as const;

/* ---------- Page de la HAKO, citée par le guide ---------- */

/**
 * Ce qu’affiche la page de la HAKO, cité mot pour mot par le guide (titres
 * des écrans, boutons, lignes de la fiche de secours). La démonstration fait
 * foi : ces textes sont recopiés de src/content/assistant.ts, que le guide ne
 * peut pas importer (c’est lui qui importe le guide). Si un de ces textes
 * change là-bas, changez-le ici : tests/unit/installation-page-hako.test.ts
 * vérifie que chacun y figure encore.
 */
export const boxPage = {
  /** En haut de chaque écran. */
  header: 'Première installation',
  /** Premier écran, et son bouton. */
  welcome: 'Bienvenue',
  start: 'Commencer',
  /** Écran d’attente, pendant le premier démarrage, et son bouton. */
  preparing: 'Votre HAKO se prépare encore',
  reload: 'Recharger la page',
  /** Bouton de l’écran de la fiche. */
  print: 'Imprimer ou enregistrer la fiche',
  /** Écran de la vérification de la fiche. */
  check: 'Vérifiez votre fiche',
  /** Bouton qui lance la création des comptes, après la vérification. */
  create: 'Créer les comptes',
  /** Dernier écran, et sa première phrase. */
  ready: 'C’est prêt',
  installed: 'Votre HAKO est installée',
  /** Bouton de l’écran « C’est prêt » qui ramène au guide, à l’étape des applications. */
  backToGuide: 'Revenir au guide pour installer les applications',
  /** Boutons de l’écran « C’est prêt », puis de la page une fois la HAKO installée. */
  photos: 'Mes photos',
  files: 'Mes fichiers',
  /**
   * Titre de l’écran affiché à la place de « Bienvenue » quand la première
   * installation est déjà faite (la même phrase ouvre l’écran « C’est prêt »).
   */
  alreadyInstalled: 'Votre HAKO est installée',
  /** Partie de la fiche de secours qui donne les trois adresses, et deux de ses lignes. */
  sheetBox: 'Votre HAKO',
  sheetPhotos: 'Photos (application Immich)',
  sheetFiles: 'Fichiers (application Nextcloud)',
} as const;

/* ---------- Informations à confirmer ---------- */

export interface PendingFacts {
  /** Durée totale de l’installation, premier démarrage compris (en-tête du guide). */
  readonly totalDuration: Maybe<string>;
  /** Durée du premier démarrage (étapes « préparation » et « page »). */
  readonly firstBoot: Maybe<string>;
  /** Au-delà de ce délai, la préparation est anormalement longue. */
  readonly slowBoot: Maybe<string>;
  /** Ce que contient le carton, et comment le client trouve l’adresse de ce guide. */
  readonly boxContents: Maybe<string>;
  /** Où se trouve la prise réseau sur le boîtier (« à l’arrière, à gauche »). */
  readonly networkPort: Maybe<string>;
  /** Où se trouve la prise d’alimentation sur le boîtier. */
  readonly powerPort: Maybe<string>;
  /** Le voyant : visible ou non à travers le boîtier, où, et ce qu’il montre. */
  readonly led: Maybe<string>;
  /** Le petit bouton rond du boîtier : accessible, et réglé pour éteindre la HAKO ? */
  readonly powerButton: Maybe<string>;
  /** Ce qui se passe si la HAKO est débranchée pendant sa préparation. */
  readonly resumeAfterUnplug: Maybe<string>;
  /** Que faire si la page se ferme pendant la première installation. */
  readonly resumeInstall: Maybe<string>;
  /** Fiche de secours perdue, ou mot de passe oublié, par la personne responsable. */
  readonly lostSheet: Maybe<string>;
  /** Gestes de la personne responsable pour donner un nouveau mot de passe à une autre personne. */
  readonly resetPassword: Maybe<string>;
  /** Ajouter une personne après la première installation. */
  readonly addPerson: Maybe<string>;
  /** Hako Pro hors de notre zone : installé avec ce guide ? Combien de comptes ? */
  readonly hakoPro: Maybe<string>;
  /** Solution de secours quand hako.local ne s’ouvre pas. */
  readonly fallbackAddress: Maybe<string>;
  /** Android 12 : la page s’ouvre-t-elle sans mise à jour du système Google Play ? */
  readonly android12: Maybe<string>;
  /** Réglage de Windows à vérifier quand hako.local ne s’ouvre pas. */
  readonly windows: Maybe<string>;
  /** Noms hako.local et hako-2.local après une coupure de courant. */
  readonly namesAfterOutage: Maybe<string>;
  /** Bouton à choisir quand Chrome, en mode strict, demande de confirmer une page en http://. */
  readonly browserWarnings: Maybe<string>;
  /** Engagement des fondateurs : ne jamais demander de mot de passe. */
  readonly neverAsk: Maybe<string>;
  /** Navigateur à moteur propre (Union européenne) sur iPhone ou iPad. */
  readonly iosOtherBrowser: Maybe<string>;
  /** Comment activer la sauvegarde des photos dans Immich, sur le téléphone. */
  readonly immichBackup: Maybe<string>;
  /** Gestes de connexion dans l’application Nextcloud. */
  readonly nextcloudLogin: Maybe<string>;
  /** Application du téléphone trop récente pour la version d’Immich ou de Nextcloud de la HAKO. */
  readonly appTooNew: Maybe<string>;
}

/**
 * Versions d’iOS demandées par les applications (relevé du 13 novembre 2026
 * sur l’App Store : iOS 15.0 pour Immich, iOS 17.0 pour Nextcloud). La
 * version d’Android demandée par Google Play n’est pas relevée : le guide ne
 * s’en sert pas.
 */
export const appsMinVersion =
  'iOS 15 ou plus récent pour Immich, iOS 17 ou plus récent pour Nextcloud';

/**
 * Informations que l’équipe doit encore confirmer, surtout par une
 * mesure sur une HAKO de série. Rien ici ne s’invente : tant qu’une valeur
 * n’est pas connue, le guide affiche le texte provisoire surligné en jaune.
 * Pour les prises et le voyant, le texte provisoire décrit le prototype
 * (docs/model-contract.md, « Le modèle provisoire et le prototype ») : il
 * reste à confirmer sur une HAKO de série.
 */
export const toConfirm: PendingFacts = withFrenchTypography<PendingFacts>({
  totalDuration: todo(
    'Durée totale de l’installation par le client, premier démarrage compris, mesurée sur une HAKO de série (par exemple « environ 45 minutes »)',
    '[durée à mesurer]',
  ),
  firstBoot: todo(
    'Durée du premier démarrage de la HAKO (préparation des applications), mesurée sur une HAKO de série (par exemple « environ 20 minutes »)',
    '[durée à mesurer]',
  ),
  slowBoot: todo(
    'Délai après le branchement au-delà duquel la préparation est anormale et le client doit nous écrire (par exemple « une heure »)',
    '[délai à confirmer]',
  ),
  boxContents: todo(
    'Contenu exact du carton (HAKO, bloc d’alimentation, papier qui donne l’adresse de ce guide ?) et moyen par lequel le client reçoit l’adresse du guide (e-mail d’envoi ?)',
    '[contenu du carton à confirmer]',
  ),
  networkPort: todo(
    'Emplacement de la prise réseau sur le boîtier de série de la HAKO. Sur le prototype : sur le petit côté opposé au bouton rond, dans l’une des trois grandes ouvertures (les deux autres sont des prises USB, plus plates)',
    '[sur le petit côté opposé au bouton rond, dans l’une des trois grandes ouvertures : à confirmer]',
  ),
  powerPort: todo(
    'Emplacement de la prise d’alimentation (USB-C) sur le boîtier de série de la HAKO. Sur le prototype : sur la grande face des fentes d’aération, dans l’une des trois petites ouvertures (les deux autres, pour un écran, ne servent pas)',
    '[sur la grande face des fentes d’aération, dans l’une des trois petites ouvertures : à confirmer]',
  ),
  led: todo(
    'Voyant de la HAKO sur le boîtier de série : visible ou non, emplacement, et ce qu’il montre une fois branchée. Sur le prototype : un petit point sur le petit côté, à côté du bouton rond ; sur un Raspberry Pi 5 nu, rouge à la mise sous tension, puis vert fixe en marche, rouge après un arrêt ; clignotements = signal de panne',
    '[un petit point à côté du bouton rond, rouge juste après le branchement, puis vert : à confirmer]',
  ),
  powerButton: todo(
    'Petit bouton rond du boîtier (bouton d’alimentation du Raspberry Pi 5) : reste-t-il accessible sur le boîtier de série, et l’image garde-t-elle son réglage d’origine (un appui éteint la HAKO, un nouvel appui la rallume) ?',
    '[à confirmer]',
  ),
  resumeAfterUnplug: todo(
    'Reprise de la préparation si la HAKO est débranchée pendant son premier démarrage : reprend-elle seule, faut-il faire quelque chose ?',
    '[à vérifier]',
  ),
  resumeInstall: todo(
    'Première installation interrompue (page fermée, appareil en veille) avant la fiche de secours : comment la reprendre ?',
    '[procédure à venir]',
  ),
  lostSheet: todo(
    'Procédure si la personne responsable perd la fiche de secours ou oublie son mot de passe, sans accès de l’équipe à la HAKO (une autre personne reçoit un nouveau mot de passe de la personne responsable : voir resetPassword). Repris par la page de la HAKO après « Vous avez perdu la fiche de secours ? »',
    '[procédure à venir]',
  ),
  resetPassword: todo(
    'Gestes exacts, sur la version figée de la HAKO, pour que la personne responsable donne un nouveau mot de passe à une personne de la maison : dans Immich (Administration, Utilisateurs) puis dans Nextcloud (Comptes). Repris par le guide et par la fiche de secours, après « peut lui en donner un nouveau »',
    '[gestes à confirmer]',
  ),
  addPerson: todo(
    'Ajouter une personne de la maison après la première installation : procédure (où, par qui, d’où vient son mot de passe, fiche à compléter)',
    '[procédure à venir]',
  ),
  hakoPro: todo(
    'Installation de Hako Pro hors de notre zone : par le client avec ce guide ou par nous ; nombre de comptes à la première installation (8 au plus aujourd’hui) ; réglage des droits par dossier',
    '[à confirmer]',
  ),
  fallbackAddress: todo(
    'Solution de secours quand hako.local ne s’ouvre pas (Android plus ancien que la version 12, certains ordinateurs Windows) : adresse en chiffres lue dans la liste des appareils de la box internet (Nextcloud doit alors l’accepter, et elle peut changer), ou autre',
    '[solution de secours à venir]',
  ),
  android12: todo(
    'Android 12 : la page de la HAKO s’ouvre-t-elle sans la « Mise à jour du système Google Play » récente ? À vérifier sur un Android 12 d’entrée de gamme (analyse de recherche, partie C4 : confiance moyenne)',
    '[à vérifier]',
  ),
  windows: todo(
    'Ordinateur Windows 10 ou 11 : réglage à vérifier quand hako.local ne s’ouvre pas (profil réseau « Public » ?), avec son chemin exact',
    '[à vérifier]',
  ),
  namesAfterOutage: todo(
    'Deux HAKO sur le même réseau : les noms hako.local et hako-2.local restent-ils attachés à la même HAKO après une coupure de courant qui les redémarre toutes les deux ?',
    '[à vérifier]',
  ),
  browserWarnings: todo(
    'Chrome en mode le plus strict (« Toujours utiliser des connexions sécurisées ») : message exact avant d’ouvrir la page de la HAKO en http://, et bouton à choisir pour continuer',
    '[bouton à confirmer]',
  ),
  neverAsk: todo(
    'Engagement à confirmer par les fondateurs : ne jamais demander leurs mots de passe aux clients',
    '[Nous ne vous demanderons jamais vos mots de passe, ni par téléphone, ni par e-mail.]',
  ),
  iosOtherBrowser: todo(
    'iPhone ou iPad : Chrome, Firefox et Edge (bâtis sur WebKit) sont exemptés de l’autorisation « Réseau local » comme Safari (Apple TN3179) ; les navigateurs à moteur propre autorisés dans l’Union européenne ne sont pas vérifiés',
    '[à vérifier]',
  ),
  immichBackup: todo(
    'Procédure exacte dans Immich (version figée sur la HAKO) pour activer la sauvegarde des photos, et autorisation « Photos » demandée par l’iPhone et par Android (choix à faire)',
    '[procédure à confirmer]',
  ),
  nextcloudLogin: todo(
    'Connexion dans l’application Nextcloud, sur iPhone et sur Android, avec la version figée sur la HAKO : adresse en http:// acceptée ? invite « Réseau local » ? page de connexion et bouton pour autoriser l’application (libellés exacts)',
    '[gestes à vérifier]',
  ),
  appTooNew: todo(
    'Application Immich ou Nextcloud du téléphone, mise à jour par sa boutique, qui refuse la version figée sur la HAKO (Immich v3.4.1) : message affiché, cause et que faire',
    '[à vérifier]',
  ),
});
