# Installation de la box HAKO par le client

Parcours et textes exacts : le guide public (/installer/), l’assistant de première installation servi par la box, la fiche de secours, la démonstration publique et la carte d’installation.

**Conventions**
- Le texte à afficher est écrit tel quel. Ce qui ne s’affiche pas commence par « Note pour l’équipe ».
- {prenom}, {n}, {numero}… : valeurs remplies par la page, comme « {n} » dans src/content/commande.ts.
- [TODO: …] : information non confirmée, à transcrire avec todo(…). Récapitulatif en partie 6.
- [TODO: coordonnées du support] : reprendre company.email et company.phone (src/data/entreprise.ts), déjà en attente.
- Les chemins src/… sont ceux du dossier site/ de antoninche/hako.
- Typographie : apostrophe ’ partout. Les espaces avant « : », « ; », « ! », « ? », « » » et après « « » sont des espaces ordinaires. À la transcription, envelopper l’objet exporté dans withFrenchTypography() (src/lib/typography.ts), comme dans src/data/entreprise.ts : la fonction les rend insécables. Vérification faite : il ne manque aucune de ces espaces (621 en tout), et le texte qui sort de la fonction est conforme.
- Vocabulaire : « box internet » désigne celle de l’opérateur ; « la box » ou « votre box HAKO » désigne la nôtre. Ne jamais écrire « box » seul quand il peut s’agir des deux.
- Découpage proposé de src/content/installation.ts : guide, assistant, fiche, demonstration, carte. La démonstration et la vraie box affichent les mêmes textes d’assistant : les garder dans un seul fichier, partagé avec le dépôt de la box.

## 0. À lire d’abord

### Choix retenus, à valider
1. **Deux parties.** Le guide public /installer/ accompagne les gestes : carton, branchements, attente, ouverture de la page de la box. L’assistant de première installation est servi par la box elle-même, à http://hako.local. Il crée sur la box tous les mots de passe et ne les remet qu’une fois. Les mots de passe ne passent jamais par le site public : c’est la condition du « zéro accès ».
2. **Adresse de la box** : hako.local (le cahier des charges disait mabox.local).
3. **Code d’installation** : unique pour chaque box et imprimé sur une carte glissée dans le carton. Il ne sert qu’à l’installation. Sur un réseau partagé (résidence, immeuble), il empêche un voisin d’installer la box à la place du client.
4. **Comptes** : un par personne du foyer. La première personne est responsable de la box : elle administre Immich et Nextcloud. La box crée un mot de passe pour chaque personne, le même pour les photos et pour les fichiers. Proposition : 4 mots courants sans accents, tirés d’une liste de 2 048 mots et séparés par des tirets (environ 44 bits ; 5 mots pour plus de marge). [TODO: format des mots de passe à confirmer]
5. **Démonstration** : l’assistant tourne aussi sur le site public. La box y est simulée dans le navigateur, avec le même code d’interface que sur la vraie box.

### À mettre à jour ailleurs si ces choix sont validés
- mabox.local devient hako.local dans :
  - src/content/tutoriels.ts (tutoriel « Prise en main et installation ») ;
  - src/content/la-box.ts (adresse de la page d’accueil) ;
  - src/content/faq/branchement.mdx ;
  - src/data/faits.ts (texte du repère homePageLicense).
  Côté box : le nom d’hôte devient hako, et les domaines de confiance de Nextcloud changent aussi.
- FAQ « Avez-vous accès à mes photos ? » : la phrase « c’est vous qui créez vos comptes et choisissez vos mots de passe » n’est plus exacte. Proposition : « pendant l’installation, votre box crée vos comptes et vos mots de passe, chez vous, et vous êtes les seuls à les recevoir ». La phrase de src/content/engagement.ts (« c’est vous qui créez vos comptes pendant l’installation ») reste juste.
- Page La box et FAQ « Comment brancher la box chez moi ? » : elles disent que « le Wi-Fi est aussi possible ». Pour une box envoyée, c’est faux tant qu’aucune procédure ne permet de régler le Wi-Fi. [TODO: Wi-Fi sans câble pour une box envoyée]
- src/data/entreprise.ts (serviceArea.outside) : retirer « à venir » quand /installer/ sera en ligne.
- Navigation : ajouter /installer/ au pied de page (proposition : « Installer ma box »). Ajouter aussi un lien depuis la FAQ « Comment brancher la box chez moi ? » et depuis le tutoriel « Prise en main et installation ».
- Cahier des charges de la box : l’assistant remplace la création du compte Nextcloud prévue pendant la visite. La fiche /root/fiche-installation.txt peut rester, comme fiche technique sans aucun mot de passe.

### Ce que la box doit garantir pour que ces textes restent vrais (travail nouveau, à ajouter aux lots 2 et 3)
- **Code d’installation** :
  - créé à la préparation de chaque box et imprimé sur sa carte ;
  - gardé sur la box sous forme d’empreinte seulement ;
  - refusé une fois l’installation terminée ;
  - essais limités (proposition : 5 essais, puis attente croissante).
- **Page « Votre box se prépare »** : servie dès le début du premier démarrage, avant Immich et Nextcloud, avec l’avancement réel.
- **Mots de passe** :
  - créés sur la box par un tirage aléatoire sûr ;
  - montrés seulement à l’appareil qui a donné le bon code ;
  - effacés dès la création des comptes : la box ne peut plus les réafficher.
- **Reprise après une coupure** (page fermée, box débranchée), sans changer les mots de passe déjà remis. La création des comptes continue même si la page est fermée.
- **Identifiant** : Immich se connecte avec une adresse de type e-mail, et Nextcloud accepte aussi la connexion par adresse e-mail. Proposition : prenom@hako.local pour les deux, sans accents ni espaces (« Marie-Hélène » donne marie-helene@hako.local). [TODO: identifiant à confirmer]
- **Date de la fiche** : prise sur l’appareil du client. Sans internet, l’horloge de la box peut être fausse au premier démarrage.
- **Rien ne part sur internet depuis l’assistant** : aucune ressource extérieure, aucune requête vers le site public.
- **Première connexion à Immich et à Nextcloud** : aucun écran technique, aucun texte en anglais. Il faut régler à l’avance l’accueil d’administration d’Immich et couper l’écran de bienvenue de Nextcloud. [TODO: à vérifier sur les versions retenues]
- **Promesse « rien ne sort de chez vous »** : avec leurs réglages par défaut, Immich et Nextcloud peuvent contacter internet. Immich cherche les nouvelles versions et charge ses fonds de carte. Nextcloud cherche ses mises à jour, consulte son magasin d’applications et contrôle les mots de passe en ligne. [TODO: vérifier et couper ce qui doit l’être]
- **Pas de cadenas** : la page de la box est en http. Sur un réseau partagé (résidence, immeuble), ce qu’elle affiche traverse ce réseau sans chiffrement. À traiter dans une version suivante.

### Questions ouvertes
- La fiche est perdue et la personne responsable a oublié son mot de passe : sans SSH, comment reprendre la main ? Il faudra un geste physique (bouton, clé USB…). [TODO: procédure de secours]
- Ajouter une personne plus tard : depuis la page d’accueil de la box, ou séparément dans Immich et Nextcloud ? [TODO: ajout d’une personne]
- Certains téléphones Android n’ouvrent pas hako.local : quelle solution de secours ? [TODO: solution de secours Android]
- Logement sans box internet à soi (résidence, foyer) : l’installation est-elle possible ? [TODO: réseau partagé]

### Vérifications techniques
- Android n’ouvre les adresses en .local que depuis une mise à jour de fin 2021, absente d’Android 10 et 11. Les retours varient selon les appareils : [Home Assistant Community](https://community.home-assistant.io/t/detail-mdns-android-os-limitations-on-the-web-server-components-documentation/374099), [Esper](https://www.esper.io/blog/android-dessert-bites-26-mdns-local-47912385).
- Sur iPhone, Chrome et Firefox demandent l’autorisation d’accéder au réseau local ; Safari ne la demande pas : [forum des développeurs Apple](https://developer.apple.com/forums/thread/811690).
- Chrome n’affiche pas son avertissement sur les pages en http quand le nom n’est pas unique, comme ceux en .local : [guide Chromium « Ask-before-HTTP »](https://chromium.googlesource.com/chromium/src/+/main/docs/security/ask-before-http/ask-before-http-adoption-guide.md).

## 1. Le guide public : /installer/

### La page
- **Titre de l’onglet** : Installer votre box HAKO, pas à pas
- **Description** : Le guide pour installer vous-même votre box HAKO : le carton, les branchements, le premier démarrage, puis l’assistant de votre box, qui crée vos mots de passe chez vous.

### En-tête
- **Titre** : Installer votre box
- **Chapeau** : Sept étapes, à suivre dans l’ordre. Aucune connaissance en informatique n’est nécessaire.
- **Encadré « Combien de temps ? »** : Comptez environ [TODO: durée totale de l’installation], dont [TODO: durée du premier démarrage] d’attente pendant que la box se prépare toute seule.
- **Encadré « Dans notre zone d’intervention »** : Nous installons la box chez vous, avec le même assistant : vous n’avez rien à préparer. Ce guide sert quand nous vous envoyons la box.
- **Lien** : Essayer l’assistant en démonstration (vers /installer/demonstration/)

### Éléments communs à toutes les étapes
- **Liste des étapes**, titre lu par les lecteurs d’écran : Les étapes de l’installation
- **Noms courts des étapes** : Le carton · La place · Le câble · L’alimentation · La préparation · La page de la box · L’assistant
- **Indicateur** : Étape {n} sur 7
- **Étape validée** : (terminée)
- **Bouton principal** : C’est fait. Nom lu par les lecteurs d’écran : « C’est fait : {titre de l’étape} ».
- **Bouton secondaire** : Étape précédente
- **Titre des signes de réussite** : Comment savoir que c’est bon ?
- **Titre du dépannage**, bloc repliable : Un problème ?
- **Lien en bas de page** : Recommencer depuis le début
- **Sans JavaScript** : Toutes les étapes s’affichent ici, à la suite : suivez-les dans l’ordre. Le minuteur et le choix de l’appareil ont besoin de JavaScript, mais l’installation se fait très bien sans.
- **Note pour l’équipe** : « C’est fait » marque l’étape comme terminée et ouvre la suivante. Les cases à cocher sont un aide-mémoire : elles ne bloquent jamais le bouton. L’étape en cours est gardée dans l’adresse de la page (#etape-3) : rien n’est enregistré sur l’appareil.

### Étape 1 · Ouvrez le carton
- **Titre** : Ouvrez le carton
- **Gestes** :
  1. Sortez la box HAKO et son alimentation.
  2. Gardez la carte d’installation à portée de main : elle servira à l’étape 6.
- **Cases à cocher « Dans le carton »** :
  - La box HAKO
  - Son alimentation : un bloc à brancher sur une prise électrique, avec son câble [TODO: modèle d’alimentation fourni]
  - La carte d’installation, avec votre code
  - [TODO: autre contenu du carton, s’il y en a : notice, fiche de secours vierge…]
- **Cases à cocher « À prévoir de votre côté »** :
  - Un câble réseau (Ethernet). Il n’est pas fourni. Ses prises ressemblent à celles d’un téléphone fixe, en un peu plus larges.
  - Un téléphone, une tablette ou un ordinateur relié au Wi-Fi de la maison
  - Une imprimante, ou à défaut une feuille et un stylo
- **Comment savoir que c’est bon ?** Vous avez devant vous la box, son alimentation, la carte d’installation et un câble réseau.
- **Un problème ?**
  - **Je n’ai pas de câble réseau.** Regardez dans le carton de votre box internet : il y en a souvent un. Sinon, demandez « un câble Ethernet » dans un magasin d’informatique ou de bricolage. Pour sa longueur, voyez l’étape 2. Le câble est indispensable pour l’installation.
  - **Il manque quelque chose dans le carton.** Contactez-nous : [TODO: coordonnées du support]. Donnez-nous le numéro de la box, écrit sur la carte d’installation.
  - **La box semble abîmée.** Ne la branchez pas, et contactez-nous : nous vous dirons quoi faire.
  - **Je ne trouve pas la carte d’installation.** Regardez au fond du carton [TODO: emplacement de la carte dans le carton]. Si elle n’y est pas, contactez-nous avec le numéro écrit sous la box [TODO: étiquette avec le numéro de la box].

### Étape 2 · Choisissez la place de la box
- **Titre** : Choisissez la place de la box
- **Gestes** :
  1. Posez la box à plat, près de votre box internet (Livebox, Freebox, Bbox, box SFR…).
  2. Vérifiez qu’une prise électrique est à portée.
  3. Laissez de l’air autour : pas de meuble fermé, rien posé dessus.
  4. Tenez-la à l’écart des sources de chaleur, comme un radiateur.
- **Comment savoir que c’est bon ?** La box est posée à plat, à l’air libre, et le câble réseau va jusqu’à votre box internet sans être tendu.
- **Un problème ?**
  - **Ma box internet est dans une autre pièce.** Un câble réseau plus long fonctionne très bien, même sur plusieurs dizaines de mètres. Autre solution : des boîtiers CPL, qui font passer le réseau par les prises électriques de la maison.
  - **Il n’y a plus de prise électrique libre.** Une multiprise convient.

### Étape 3 · Reliez la box à votre box internet
- **Titre** : Reliez la box à votre box internet
- **Gestes** :
  1. Branchez le câble réseau dans la prise réseau de la box HAKO [TODO: emplacement de la prise réseau sur le boîtier]. Poussez jusqu’au clic.
  2. Branchez l’autre bout dans une prise libre de votre box internet. Ces prises sont souvent marquées « LAN », « Ethernet » ou d’un chiffre.
  3. Évitez la prise marquée « WAN » ou « Fibre » : elle sert à l’arrivée d’internet.
- **Comment savoir que c’est bon ?** Le câble tient des deux côtés : il ne ressort pas quand vous tirez doucement dessus. Les petites lumières des prises s’allumeront à l’étape suivante, une fois l’alimentation branchée.
- **Un problème ?**
  - **Le câble n’entre pas.** Retournez la prise : elle n’entre que dans un sens. Ne forcez pas. Si la prise de la box internet semble trop petite, c’est sans doute celle du téléphone : prenez-en une autre.
  - **Aucune prise n’est libre sur ma box internet.** Débranchez un appareil qui ne vous sert pas pendant l’installation. Ou ajoutez un petit boîtier qui multiplie les prises réseau (un « switch »), vendu au même endroit que les câbles.
  - **Je n’ai pas de box internet à moi** (résidence, foyer, hôtel). Contactez-nous avant de commencer. [TODO: installation possible sur un réseau partagé ?]

### Étape 4 · Branchez l’alimentation
- **Titre** : Branchez l’alimentation
- **Gestes** :
  1. Branchez le câble de l’alimentation sur la box, dans la petite prise ovale (USB-C) [TODO: emplacement de la prise sur le boîtier].
  2. Branchez le bloc sur une prise électrique.
  3. C’est tout : la box démarre toute seule, sans bouton à presser.
- **Texte sous le bouton** : Appuyez sur « C’est fait » juste après avoir branché : le minuteur de l’étape suivante démarrera.
- **Comment savoir que c’est bon ?** Un voyant s’allume sur la box [TODO: voyant visible à travers le boîtier ? emplacement et couleurs (Raspberry Pi 5 : vert en marche, rouge à l’arrêt)]. Les petites lumières de la prise réseau s’allument ou clignotent [TODO: visibles avec le boîtier ?].
- **Un problème ?**
  - **Rien ne s’allume.** Vérifiez que les deux bouts du câble d’alimentation sont bien enfoncés. Essayez une autre prise électrique, par exemple celle d’une lampe qui fonctionne.
  - **Le voyant est rouge.** [TODO: sens du voyant rouge sur la box HAKO et geste à faire ; sur une Raspberry Pi 5, rouge veut dire à l’arrêt]
  - **J’ai utilisé un autre chargeur.** Branchez l’alimentation fournie : un chargeur de téléphone est souvent trop faible pour la box.
  - **Les lumières de la prise réseau restent éteintes.** Vérifiez les deux bouts du câble réseau, puis essayez une autre prise de votre box internet.

### Étape 5 · Laissez la box se préparer
- **Titre** : Laissez la box se préparer
- **Texte** : À son premier démarrage, votre box se prépare toute seule. Elle crée ses propres codes secrets, différents de ceux de toutes les autres box, puis installe vos applications. Comptez environ [TODO: durée du premier démarrage, mesurée sur une box de série].
- **Gestes** :
  1. Laissez la box branchée.
  2. Faites une pause : cette page vous dira quand continuer.
- **Minuteur** :
  - Avant le départ : Le minuteur vous dit quand votre box devrait être prête. Bouton : Lancer le minuteur
  - Pendant : Votre box se prépare. Il reste environ {n} minutes. Au singulier : Il reste environ 1 minute.
  - À la fin : C’est le moment : votre box devrait être prête.
  - Bouton secondaire : Relancer le minuteur
  - Sous le minuteur : Vous pouvez aussi continuer avant la fin : la page de votre box affiche où elle en est. Si vous fermez ce guide, votre box continue sans vous.
- **Note pour l’équipe** : le minuteur démarre tout seul quand on appuie sur « C’est fait » à l’étape 4. Il se recalcule au retour sur la page, par exemple après une mise en veille du téléphone. Pour les lecteurs d’écran, une annonce par minute au plus.
- **Comment savoir que c’est bon ?** Le minuteur est terminé. Si vous passez à l’étape suivante plus tôt, la page de votre box vous dira s’il lui faut encore quelques minutes.
- **Un problème ?**
  - **J’ai débranché la box pendant sa préparation.** Ce n’est pas grave. Rebranchez-la et relancez le minuteur : elle reprend sa préparation. [TODO: vérifier la reprise après une coupure de courant]
  - **J’ai fermé cette page.** Votre box continue sa préparation. Attendez le temps indiqué, puis passez à l’étape suivante.

### Étape 6 · Ouvrez la page de votre box
- **Titre** : Ouvrez la page de votre box
- **Texte** : Votre box a sa propre page. Elle ne s’ouvre que chez vous, depuis un appareil relié au Wi-Fi de la maison.
- **Choix 1, question** : Avec quel appareil allez-vous ouvrir la page de votre box ?
  - Réponses : Un téléphone ou une tablette · Un ordinateur
  - Conseil sous la question : Le plus simple : un ordinateur relié à une imprimante, pour imprimer ensuite votre fiche de mots de passe.
- **Choix 2, pour un téléphone ou une tablette, question** : Quel modèle ?
  - Réponses : iPhone ou iPad · Android (Samsung, Xiaomi, Pixel…) · Je ne sais pas
  - Après « Je ne sais pas » : Si une pomme est dessinée au dos de l’appareil, c’est un iPhone ou un iPad. Sinon, c’est sans doute un Android.
- **Gestes, iPhone ou iPad** :
  1. Vérifiez que le Wi-Fi est activé et relié au réseau de la maison.
  2. Ouvrez l’appareil photo et visez le QR code 2, au dos de la carte d’installation.
  3. Appuyez sur le lien qui apparaît à l’écran.
- **Gestes, Android** :
  1. Vérifiez que le Wi-Fi est activé et relié au réseau de la maison.
  2. Ouvrez l’appareil photo et visez le QR code 2, au dos de la carte d’installation.
  3. Appuyez sur le lien qui apparaît. Si rien n’apparaît, ouvrez Chrome et tapez http://hako.local dans la barre d’adresse.
- **Gestes, ordinateur** :
  1. Vérifiez que l’ordinateur est relié au Wi-Fi de la maison, ou à votre box internet par un câble.
  2. Ouvrez votre navigateur, l’application qui ouvre les pages internet : Chrome, Edge, Firefox ou Safari.
  3. Cliquez dans la barre d’adresse, tout en haut de la fenêtre.
  4. Tapez http://hako.local, puis appuyez sur la touche Entrée.
  - Encadré : Tapez bien http:// au début. Sans lui, votre navigateur risque de chercher « hako.local » sur internet au lieu d’ouvrir votre box.
- **Bouton, pour tous** : Ouvrir la page de ma box. C’est un lien vers http://hako.local, qui s’ouvre dans un nouvel onglet. Texte lu par les lecteurs d’écran : « (s’ouvre dans un nouvel onglet) ».
  - Sous le bouton : Ce bouton ne fonctionne que si cet appareil est relié au Wi-Fi de la maison.
- **Comment savoir que c’est bon ?** Une page s’ouvre, avec le logo HAKO et le titre « Bienvenue ». Si la box n’a pas fini de se préparer, le titre est « Votre box se prépare » : attendez, cette page se met à jour toute seule.
- **Un problème ?**
  - **La page ne s’ouvre pas, ou elle est « introuvable ».** Dans l’ordre :
    1. Attendez encore [TODO: délai] minutes, puis réessayez : la box n’a peut-être pas fini de démarrer.
    2. Vérifiez que l’appareil est relié au Wi-Fi de la maison, pas seulement à la 4G ou à la 5G. Le Wi-Fi « invités » de votre box internet ne convient pas.
    3. Si une application de VPN est active sur l’appareil, mettez-la en pause le temps de l’installation. Un VPN fait passer votre connexion par un autre réseau.
    4. Vérifiez les lumières de la prise réseau de la box HAKO (étape 4).
    5. Essayez avec un autre appareil, de préférence un ordinateur ou un iPhone.
  - **Une page de résultats de recherche s’affiche** (Google, Bing, Qwant…). L’adresse a été tapée dans une zone de recherche. Tapez-la dans la barre d’adresse, en commençant par http://.
  - **Sur iPhone, Chrome ou Firefox demande l’accès au réseau local.** Acceptez : c’est ce qui permet d’ouvrir la page de votre box. Si vous avez refusé, ouvrez Réglages, puis Confidentialité et sécurité, puis Réseau local, et activez l’application. Vous pouvez aussi ouvrir la page avec Safari. [TODO: vérifier les libellés sur un iPhone à jour]
  - **Sur Android, la page ne s’ouvre toujours pas.** Certains téléphones Android, surtout les plus anciens, ne savent pas ouvrir les adresses en « .local ». Essayez avec un ordinateur ou un iPhone. [TODO: solution de secours pour Android, par exemple l’adresse de la box lue dans l’interface de la box internet]
  - **Un message indique « Non sécurisé ».** La page de votre box n’a pas le cadenas des sites internet, car elle ne passe pas par internet. Chez vous, sur votre propre Wi-Fi, vous pouvez continuer. [TODO: vérifier les messages des navigateurs actuels]

### Étape 7 · Suivez l’assistant de votre box
- **Titre** : Suivez l’assistant de votre box
- **Texte** : La page de votre box prend le relais. Elle vous guide écran par écran :
  - elle vous demande le code de votre carte d’installation ;
  - puis les prénoms des personnes de la maison ;
  - elle crée vos mots de passe et vous aide à les garder sur une fiche, imprimée ou recopiée ;
  - enfin, elle crée le compte de chacun.
- **Durée** : Comptez environ [TODO: durée de l’assistant].
- **Encadré** : Ce site ne voit rien de ce que vous faites sur la page de votre box : tout se passe chez vous.
- **Encadré** : Nous ne vous demanderons jamais vos mots de passe, ni par téléphone, ni par e-mail. [TODO: engagement à confirmer par les fondateurs]
- **Lien** : Voir l’assistant en démonstration
- **Comment savoir que c’est bon ?** La page de votre box affiche « C’est prêt ! » : votre box est installée.
- **Un problème ?**
  - **L’assistant affiche un message d’erreur.** Suivez ce qu’il indique : chaque message dit quoi faire. Si le problème continue, contactez-nous : [TODO: coordonnées du support].
  - **J’ai fermé la page de l’assistant.** Rouvrez-la comme à l’étape 6. Votre box vous propose de reprendre là où vous en étiez.

### Fin du guide, après « C’est fait » à l’étape 7
- **Titre** : Votre box est installée
- **Texte** :
  - Rangez votre fiche de secours avec vos papiers importants.
  - Installez les applications Immich et Nextcloud sur les téléphones de la maison : la page de votre box explique comment.
  - Pour la prise en main, regardez nos tutoriels vidéo.
- **Lien** : Voir les tutoriels (vers /tutoriels/)

### Encadré d’aide, en bas de page
- **Titre** : Besoin d’aide ?
- **Texte** : Écrivez-nous ou appelez-nous : [TODO: coordonnées du support]. Nous pouvons aussi vous aider par appel vidéo.

## 2. L’assistant de première installation, servi par la box

Adresse : http://hako.local. Six étapes numérotées, entre un écran d’accueil et un écran final. Gros caractères, gros boutons, une seule action principale par écran.

### Éléments communs
- **En-tête** : HAKO · Installation de votre box
- **Indicateur** : Étape {n} sur 6
- **Noms des étapes** : Code · Personnes · Mots de passe · Fiche · Vérification · Création des comptes
- **Boutons** : Continuer · Retour
- **Pied de page** : Cette page vient de votre box, chez vous. Rien de ce que vous tapez ici ne part sur internet.
- **Lien d’aide**, en haut de chaque écran : Besoin d’aide ?
  - Panneau : Le guide d’installation : [TODO: adresse du guide]. Pour nous joindre : [TODO: coordonnées du support]. Nous ne vous demanderons jamais vos mots de passe.
- **Chargement** : Un instant…
- **Bandeau « connexion perdue »** :
  - Titre : Votre box ne répond plus
  - Texte : Vérifiez que cet appareil est toujours relié au Wi-Fi de la maison, et que la box est branchée. Ce que vous avez déjà fait est gardé.
  - Bouton : Réessayer

### Écran 0 · Votre box se prépare
S’affiche pendant le premier démarrage, avant l’accueil.
- **Titre** : Votre box se prépare
- **Texte** : C’est son premier démarrage : elle crée ses codes secrets et installe vos applications. Cela prend environ [TODO: durée du premier démarrage].
- **Avancement**, chaque ligne marquée « Terminé », « En cours… » ou « À venir » :
  1. Codes secrets de la box
  2. Application des photos
  3. Application des fichiers
  4. Dernières vérifications
- **Sous la liste** : Cette page se met à jour toute seule. Laissez la box branchée.
- **Quand tout est fini** : la page passe d’elle-même à l’écran « Bienvenue ».
- **Si c’est long**, après [TODO: délai] : C’est plus long que prévu. Votre box travaille encore : laissez-lui quelques minutes de plus.
- **Si la préparation échoue** :
  - Titre : Votre box n’a pas pu se préparer
  - Texte : Cela peut arriver. Débranchez l’alimentation de la box, attendez dix secondes, puis rebranchez-la : elle reprendra sa préparation. Rouvrez cette page dans [TODO: délai] minutes.
  - Texte : Si ce message revient, contactez-nous en donnant ce code : {codeErreur}. Il nous dit ce qui bloque, sans rien révéler de vos données.
  - Bouton : Réessayer

### Écran 1 · Bienvenue
- **Titre** : Bienvenue
- **Chapeau** : Votre box HAKO est prête à être installée. Cette page vient de votre box, chez vous : rien de ce que vous tapez ici ne part sur internet.
- **Texte** : En quelques minutes, vous allez :
  1. taper le code de votre carte d’installation ;
  2. indiquer les prénoms des personnes de la maison ;
  3. recevoir vos mots de passe, créés par votre box, et les garder sur une fiche.
- **Il vous faut** : la carte d’installation, et une imprimante (ou une feuille et un stylo).
- **Durée** : Comptez environ [TODO: durée de l’assistant].
- **Encadré** : Un membre de l’équipe HAKO est à côté de vous ? Il vous guide, mais c’est vous qui tapez : vos mots de passe ne regardent que vous.
- **Bouton** : Commencer

### Écran 2 · Le code de votre carte (étape 1 sur 6)
- **Titre** : Le code de votre carte
- **Texte** : Il prouve que cette box est bien la vôtre. Il est écrit au dos de la carte d’installation, sous « Votre code d’installation ».
- **Champ** : Code d’installation
  - Aide : 12 chiffres. Les espaces ne comptent pas. [TODO: format du code]
- **Repère** : Numéro de cette box : {numero}. C’est le même que sur votre carte.
- **Bouton** : Valider le code. Pendant la vérification : Vérification…
- **Si le QR code a rempli le code** : Le code de votre carte est déjà rempli. Bouton : Continuer
- **Bloc repliable « Pourquoi ce code ? »** : Si votre réseau est partagé avec des voisins (immeuble, résidence), ce code empêche quelqu’un d’autre d’installer votre box à votre place. Il ne sert que pour l’installation.
- **Erreurs** :
  - Champ vide : Tapez le code écrit au dos de votre carte.
  - Mauvais nombre de chiffres : Le code compte 12 chiffres. Vérifiez qu’il n’en manque pas.
  - Code faux : Ce code ne correspond pas à cette box. Vérifiez chaque chiffre, puis réessayez.
  - Trop d’essais : Trop d’essais à la suite. Par sécurité, attendez {n} minutes avant de réessayer. Vérifiez aussi que votre carte porte le numéro de cette box : {numero}.
- **Note pour l’équipe** : clavier numérique sur téléphone, sans saisie automatique ni correction.

### Écran 3 · Les personnes de la maison (étape 2 sur 6)
- **Titre** : Qui va utiliser la box ?
- **Texte** : Indiquez le prénom de chaque personne qui aura son compte. Chacune aura son espace pour ses photos et ses fichiers, protégé par son propre mot de passe. Vous pourrez ensuite partager des albums et des dossiers entre vous.
- **Premier champ** : Votre prénom
  - Aide : Vous serez la personne responsable de la box.
- **Encadré « La personne responsable »** : Elle peut ajouter des personnes, et créer un nouveau mot de passe pour quelqu’un qui a oublié le sien.
- **Champs suivants** : Prénom de la personne {n}
- **Boutons** : Ajouter une personne · Retirer (nom lu par les lecteurs d’écran : « Retirer {prenom} »)
- **Aide** : Les jeunes enfants n’ont pas forcément besoin d’un compte : leurs photos peuvent rester dans celui d’un parent.
- **Limite** : Jusqu’à [TODO: nombre maximum de personnes] personnes. Vous pourrez en ajouter d’autres plus tard. [TODO: comment ajouter une personne après l’installation]
- **Erreurs** :
  - Votre prénom manque : Indiquez votre prénom.
  - Un autre prénom manque : Indiquez un prénom, ou retirez cette ligne.
  - Prénom en double : Deux personnes ont le même prénom. Ajoutez une initiale à l’un des deux, par exemple « Camille B. ».
  - Trop long : Ce prénom est trop long : 30 caractères au maximum. [TODO: longueur maximale d’un prénom]
  - Caractères refusés : Utilisez des lettres, et si besoin des espaces, des traits d’union (-) ou des apostrophes.
  - Limite atteinte : Vous avez atteint le nombre maximum de personnes.

### Écran 4 · Vos mots de passe (étape 3 sur 6)
- **Titre** : Vos mots de passe
- **Chapeau** : Votre box vient de les créer, ici, chez vous. Personne d’autre ne les connaît, pas même HAKO.
- **Pour chaque personne** :
  - {prenom}. Étiquette de la première personne : Responsable de la box
  - Identifiant : {identifiant}
  - Mot de passe : {motDePasse}
  - Lien : Proposer d’autres mots
- **À savoir** :
  - Un seul mot de passe par personne : il ouvre à la fois les photos et les fichiers.
  - Ce sont des mots courants, sans accents, séparés par des tirets (-) : faciles à lire et à recopier.
  - L’identifiant ressemble à une adresse e-mail, mais n’en est pas une : il sert seulement à se connecter à la box.
- **Encadré** : À l’étape suivante, vous allez imprimer ou recopier ces mots de passe. Une fois l’installation terminée, votre box ne pourra plus les afficher.
- **Si un mot de passe change après l’impression** : Vous avez changé un mot de passe : imprimez ou recopiez de nouveau votre fiche.
- **Exemple pour la maquette** : Camille · camille@hako.local · cerise-tambour-velours-falaise

### Écran 5 · La fiche de secours (étape 4 sur 6)
- **Titre** : Gardez vos mots de passe sur une fiche
- **Chapeau** : Cette fiche sera la seule trace de vos mots de passe. Une fois l’installation terminée, ni votre box ni HAKO ne pourront vous les redonner.
- **Trois façons de faire** :
  1. **Imprimer.** Le plus simple. Rangez ensuite la fiche avec vos papiers importants.
     - Bouton : Imprimer la fiche
     - Après l’appui : La fenêtre d’impression s’ouvre : choisissez votre imprimante, puis lancez l’impression.
     - Case : Imprimer aussi une carte à découper pour chaque personne
  2. **Enregistrer.** Un fichier PDF, à imprimer plus tard.
     - Bouton : Enregistrer la fiche
     - Mise en garde : Sur un téléphone, ce fichier peut être copié tout seul dans iCloud ou Google Drive. Imprimez-le dès que possible, puis supprimez-le.
  3. **Recopier à la main.** Sur une feuille, en lettres bien lisibles, sans oublier les tirets. [TODO: ou sur la fiche vierge du carton, si elle existe]
     - Bouton : Afficher la fiche en grand
- **Conseil** : Évitez de prendre la fiche en photo : votre téléphone pourrait envoyer la photo hors de chez vous, vers Google Photos ou iCloud.
- **Case à cocher** : J’ai ma fiche : imprimée, enregistrée ou recopiée.
- **Erreur** : Cochez la case quand votre fiche est prête.
- **Note pour l’équipe** : si la box ne sait pas produire de PDF, un seul bouton « Imprimer ou enregistrer la fiche », qui ouvre la fenêtre d’impression.

### Écran 6 · Vérification (étape 5 sur 6)
- **Titre** : Vérifions votre fiche
- **Texte** : Prenez votre fiche. Recopiez ici le mot de passe de {prenomResponsable}, tel qu’il y est écrit. Il n’est plus affiché à l’écran : c’est voulu.
- **Champ** : Mot de passe de {prenomResponsable}
- **Case** : Afficher ce que je tape
- **Bouton** : Vérifier. Pendant la vérification : Vérification…
- **Réussite** : C’est bien ça : votre fiche est prête. Bouton : Créer les comptes
- **Erreur** : Ce n’est pas tout à fait ça. Comparez avec votre fiche, mot par mot, sans oublier les tirets (-).
- **Après trois erreurs** : Votre fiche contient peut-être une erreur de copie. Revoyez vos mots de passe, puis corrigez votre fiche. Bouton : Revoir mes mots de passe
- **Encadré** : Votre navigateur (l’application qui affiche cette page) indique « Non sécurisé » ? Cette page n’a pas le cadenas des sites internet, car elle ne passe pas par internet. Chez vous, sur votre propre Wi-Fi, vous pouvez continuer.

### Écran 7 · Création des comptes (étape 6 sur 6)
- **Titre** : Création de vos comptes
- **Texte** : Votre box crée le compte de chaque personne. Cela prend environ [TODO: durée de création des comptes].
- **Avancement**, chaque ligne marquée « Terminé », « En cours… » ou « À venir » :
  1. Comptes photos (Immich)
  2. Comptes fichiers (Nextcloud)
  3. Derniers réglages
- **Sous la liste** : Laissez la box branchée. Si vous fermez cette page, la création continue : rouvrez http://hako.local pour la suivre.
- **Si la création s’arrête** :
  - Titre : La création des comptes s’est arrêtée
  - Texte : Rien n’est perdu : vos mots de passe restent ceux de votre fiche.
  - Bouton : Réessayer
- **Si elle s’arrête encore** : Débranchez l’alimentation de la box, attendez dix secondes, puis rebranchez-la. Rouvrez cette page dans [TODO: délai] minutes : la création reprendra là où elle s’était arrêtée. Si le problème revient, contactez-nous en donnant ce code : {codeErreur}.

### Écran 8 · C’est prêt !
- **Titre** : C’est prêt !
- **Chapeau** : Votre box est installée. Vos mots de passe ne sont plus que sur votre fiche : votre box ne peut plus les afficher.
- **Boutons** : Mes photos · Mes fichiers
- **Texte** : Pour revenir ici, ouvrez http://hako.local depuis un appareil de la maison. Ajoutez cette page à vos favoris.
- **Section « Sur les téléphones de la maison »** :
  - Texte : Pour chaque personne, installez les deux applications, puis connectez-vous avec l’identifiant et le mot de passe de sa fiche.
  - **Immich, pour les photos et les vidéos** :
    1. Installez l’application Immich, depuis l’App Store (iPhone) ou le Play Store (Android).
    2. À l’ouverture, tapez l’adresse de votre box : http://hako.local:2283 [TODO: adresse à confirmer]
    3. Tapez votre identifiant et votre mot de passe.
    4. Activez la sauvegarde : les photos du téléphone seront copiées sur la box chaque fois que vous êtes à la maison. [TODO: nom du réglage dans l’application]
  - **Nextcloud, pour les fichiers** :
    1. Installez l’application Nextcloud, depuis l’App Store ou le Play Store.
    2. Tapez l’adresse de votre box : http://hako.local:8080 [TODO: adresse à confirmer]
    3. Connectez-vous avec le même identifiant et le même mot de passe.
  - Liens : Immich sur l’App Store · Immich sur le Play Store · Nextcloud sur l’App Store · Nextcloud sur le Play Store [TODO: adresses officielles à vérifier]
  - Sur ordinateur, à côté d’un QR code : Pour ouvrir cette page sur un téléphone, visez ce QR code avec son appareil photo.
- **Section « Et maintenant ? »** :
  - Rangez votre fiche avec vos papiers importants.
  - Donnez à chaque personne son identifiant et son mot de passe.
  - Laissez la box branchée : elle garde vos photos et vos fichiers jour et nuit.
  - Le code de la carte d’installation ne sert plus. Gardez la carte pour le numéro de votre box.
  - Lien : Nos tutoriels vidéo [TODO: adresse du site public]

### Écrans particuliers
- **Installation déjà commencée** :
  - Titre : Une installation est en cours
  - Texte : Elle a commencé sur cet appareil ou sur un autre. Pour la reprendre ici, tapez de nouveau le code de votre carte.
  - Champ : Code d’installation
  - Bouton : Reprendre l’installation
  - Sous le bouton : Si l’installation est ouverte sur un autre appareil, elle s’y arrêtera.
- **Box déjà installée**, si quelqu’un rouvre l’assistant après la fin :
  - Titre : Cette box est déjà installée
  - Texte : Son installation est terminée : le code de la carte ne sert plus.
  - Boutons : Mes photos · Mes fichiers
  - Lien : Vous avez perdu votre fiche de secours ? [TODO: procédure de secours]
- **Erreur imprévue** :
  - Titre : Quelque chose s’est mal passé
  - Texte : Rechargez la page : ce que vous avez déjà fait est gardé par votre box. Si le message revient, contactez-nous en donnant ce code : {codeErreur}.
  - Bouton : Recharger la page

## 3. La fiche de secours, A4 à imprimer

Une page A4 en portrait. Une deuxième page, facultative, porte une carte à découper pour chaque personne. Gros caractères ; mots de passe dans une police où chaque lettre se distingue bien.

### Page 1
- **En-tête** : HAKO 箱
- **Titre** : Fiche de secours
- **Sous-titre** : Votre box HAKO et vos mots de passe
- **Encadré** : À garder avec vos papiers importants. Cette fiche est la seule trace de vos mots de passe : ni votre box ni HAKO ne peuvent vous les redonner.
- **Bloc « Votre box »** :
  - Numéro de la box : {numero}
  - Installée le : {date}
  - Page d’accueil : http://hako.local
  - Photos (application Immich) : http://hako.local:2283
  - Fichiers (application Nextcloud) : http://hako.local:8080
  - Ces adresses ne s’ouvrent qu’à la maison, depuis un appareil relié à votre Wi-Fi ou à votre box internet.
- **Bloc « Les personnes de la maison »**, une ligne par personne, dans l’ordre de l’assistant :

  | Prénom | Identifiant | Mot de passe |
  |---|---|---|
  | {prenom} (responsable de la box) | {identifiant} | {motDePasse} |
  | {prenom} | {identifiant} | {motDePasse} |

  - Sous le tableau : Un seul mot de passe par personne : il ouvre les photos et les fichiers. Recopiez-le avec ses tirets (-).
- **Bloc « Bon à savoir »** :
  - Rangez cette fiche dans un endroit sûr, pas à côté de la box.
  - Évitez de la prendre en photo : votre téléphone pourrait envoyer la photo hors de chez vous, vers Google Photos ou iCloud.
  - Une personne a oublié son mot de passe ? La personne responsable de la box peut lui en créer un nouveau. [TODO: procédure mot de passe oublié]
  - Vous changez un mot de passe ? Changez-le dans les deux applications, puis notez-le ci-dessous.
  - Vous avez perdu cette fiche ? [TODO: procédure de secours]
  - HAKO ne vous demandera jamais vos mots de passe, ni par téléphone, ni par e-mail. [TODO: engagement à confirmer]
- **Bloc « Notes »**, avec quatre lignes vides : Notes (nouveau mot de passe, nouvelle personne)
- **Pied de page** : Fiche créée par votre box le {date} à {heure}. HAKO n’en a pas de copie. Besoin d’aide ? [TODO: coordonnées du support]

### Page 2, facultative : une carte par personne
- **Titre** : À découper : une carte par personne
- **Chaque carte** :
  - HAKO · {prenom}
  - Identifiant : {identifiant}
  - Mot de passe : {motDePasse}
  - Photos : application Immich · Fichiers : application Nextcloud
  - Adresse de la box : http://hako.local, à la maison seulement
  - Gardez cette carte pour vous.

## 4. La démonstration publique, avec une box simulée

- **Adresse proposée** : /installer/demonstration/
- **Liens d’accès** : « Essayer l’assistant en démonstration » (en-tête du guide) et « Voir l’assistant en démonstration » (étape 7).
- **Note pour l’équipe** : même code d’interface que sur la box ; seule change la façon de parler à la box. La vraie box répond à ses propres requêtes, la box simulée tourne dans le navigateur. La démonstration ne fait aucune requête, et la politique de sécurité du site l’en empêcherait de toute façon. Les mots de passe d’exemple sont tirés dans le navigateur, avec la même liste de mots.

### Bandeau, en haut de chaque écran, toujours visible
- **Titre** : Démonstration
- **Texte** : Aucune box n’est reliée à cette page. Tout se passe sur votre appareil : rien n’est envoyé, rien n’est enregistré. Les mots de passe affichés sont des exemples.
- **Boutons** : Recommencer la démonstration · Revenir au guide

### Ce qui change par rapport à la vraie installation

| | Sur votre box | En démonstration |
|---|---|---|
| Adresse | http://hako.local, chez vous | cette page du site HAKO |
| Code d’installation | celui de votre carte | 1234 5678 9012 |
| Mots de passe | créés par votre box, uniques | des exemples, créés sur votre appareil |
| Préparation et création des comptes | [TODO: durées mesurées] | quelques secondes |
| Fiche de secours | votre vraie fiche | marquée « Exemple sans valeur » |
| Écran « C’est prêt ! » | ouvre vos photos et vos fichiers | explique ce que font les boutons |
| Page rechargée | l’installation reprend | la démonstration repart du début |

### Textes propres à la démonstration
- **Écran 2, sous le champ** : Code de démonstration : 1234 5678 9012. Bouton : Remplir le code de démonstration
- **Écran 2, repère** : Numéro de cette box : démonstration
- **Fiche** : filigrane « EXEMPLE SANS VALEUR » en travers de la page ; titre : Fiche de démonstration ; pied de page : Démonstration : ces mots de passe n’ouvrent aucune box.
- **Écran 8, bouton « Mes photos »** : Sur une vraie box, ce bouton ouvre vos photos, dans Immich.
- **Écran 8, bouton « Mes fichiers »** : Sur une vraie box, ce bouton ouvre vos fichiers, dans Nextcloud.
- **Panneau facultatif, pour présenter la démonstration** : Voir un autre écran : La box se prépare · Code faux · Trop d’essais · Connexion perdue · Création des comptes interrompue · Box déjà installée
- **Sans JavaScript** : La démonstration a besoin de JavaScript. Le guide d’installation, lui, se lit sans.

## 5. La carte d’installation, glissée dans le carton

Format : [TODO: format et impression de la carte, par exemple A6 recto verso]. Une carte par box : le code, le QR code 2 et le numéro sont propres à chaque box.

### Recto
- HAKO 箱
- **Titre** : Installer votre box
- **Étapes** :
  1. Reliez la box à votre box internet avec un câble réseau (Ethernet). Ce câble n’est pas fourni.
  2. Branchez son alimentation sur une prise électrique, puis patientez environ [TODO: durée du premier démarrage].
  3. Suivez le guide pas à pas : [TODO: adresse courte du guide], ou scannez le QR code 1.
- **Sous le QR code** : QR code 1 · Le guide d’installation
- **Pied** : Il vous faut aussi : un téléphone, une tablette ou un ordinateur relié au Wi-Fi de la maison, et si possible une imprimante.

### Verso
- **Titre** : Votre code d’installation
- {code}, en grand, par exemple : 4827 1593 0264
- **Sous le QR code** : QR code 2 · La page de votre box
- À scanner chez vous, à l’étape 6 du guide, avec un appareil relié au Wi-Fi de la maison.
- Adresse de votre box : http://hako.local
- Ce code ne sert que pour installer votre box. Ne le donnez à personne : HAKO ne vous le demandera jamais. [TODO: engagement à confirmer]
- Box n° {numero}
- Besoin d’aide ? [TODO: coordonnées du support]
- **Note pour l’équipe** : le QR code 2 contient l’adresse de la box et le code, pour éviter de le taper (proposition : http://hako.local/?code={code}). Le code reste alors dans l’historique du navigateur, ce qui ne pose plus de problème une fois l’installation terminée. [TODO: contenu du QR code 2 à valider]

## 6. Récapitulatif des [TODO]

| Ce qui manque | Texte provisoire | Où |
|---|---|---|
| Durées mesurées sur une box de série : installation complète, premier démarrage, assistant, création des comptes, délais avant de réessayer | [durée], [délai] | guide (en-tête, étapes 5 à 7), écrans 0, 1 et 7, démonstration, carte |
| Contenu du carton hors box, alimentation et carte (notice, fiche de secours vierge ?), emplacement de la carte | [à confirmer] | guide (étape 1), écran 5 |
| Modèle d’alimentation fourni | [à confirmer] | guide (étape 1) |
| Numéro de la box : format, étiquette sous la box | [numéro] | guide (étape 1), écran 2, fiche, carte |
| Emplacement des prises réseau et d’alimentation sur le boîtier | [emplacement] | guide (étapes 3 et 4) |
| Voyant et lumières de la prise réseau : visibles à travers le boîtier ? couleurs ? sens du rouge ? | [à confirmer] | guide (étape 4) |
| Reprise de la préparation après une coupure de courant | [à vérifier] | guide (étape 5), écran 0 |
| Libellés de l’iPhone pour l’accès au réseau local, messages « Non sécurisé » des navigateurs | [à vérifier] | guide (étape 6), écran 6 |
| Solution de secours quand hako.local ne s’ouvre pas (Android ancien) | [à définir] | guide (étape 6) |
| Logement sans box internet à soi (résidence, foyer) | [à définir] | guide (étape 3) |
| Coordonnées du support : company.email et company.phone | [adresse e-mail], [numéro de téléphone] | guide, assistant, fiche, carte |
| Adresse du guide et du site sur le nom de domaine définitif | [adresse du guide] | assistant, fiche, carte |
| Engagement « nous ne vous demanderons jamais vos mots de passe » | [à confirmer] | guide (étape 7), assistant, fiche, carte |
| Format du code d’installation, contenu du QR code 2 | [format du code] | écran 2, carte |
| Format des mots de passe et des identifiants | [à confirmer] | partie 0, écran 4 |
| Nombre maximum de personnes, longueur maximale d’un prénom | [nombre], [longueur] | écran 3 |
| Ajouter une personne après l’installation | [à définir] | écran 3 |
| Mot de passe oublié, fiche perdue | [à définir] | fiche, écran « Box déjà installée » |
| Adresses à taper dans les applications (2283 et 8080), nom du réglage de sauvegarde d’Immich, liens officiels des applications | [adresse], [nom du réglage], [lien] | écran 8, fiche |
| Format et impression de la carte | [format] | carte |
| Wi-Fi sans câble pour une box envoyée | [à définir] | partie 0 |
| Réglages d’Immich et de Nextcloud : première connexion, connexions vers internet | [à vérifier] | partie 0 |
