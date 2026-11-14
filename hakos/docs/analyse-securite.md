# Protocole de première installation HAKO : rapport sécurité

**Périmètre.** Ce rapport concerne le profil de production, sans SSH. Côté box, rien n'existe encore : seul le Lot 0 est fait, et l'image Lite n'a jamais démarré sur le Pi. Tout ce qui touche la box est donc une conception, à réaliser aux lots 2 et 3. Les faits techniques ont été vérifiés le 13 novembre 2026 dans le code ou la documentation officielle (sources à la fin).

Je n'ai rien écrit nulle part.

## 0. Décisions en bref

1. **Deux surfaces.**
   - Le guide public : gestes physiques et démonstration. Il ne manipule aucun secret et n'envoie aucune requête à la box.
   - L'assistant servi par la box, à http://hako.local. C'est le seul endroit où circulent le code et les mots de passe. Le site public ne demande jamais de secret.
2. **Code d'installation.**
   - 12 symboles tirés d'un alphabet de 24, soit 55 bits.
   - Tiré sur le Mac à la préparation de chaque box ; la box ne reçoit que son empreinte scrypt.
   - L'équipe n'en garde aucune copie.
   - Au plus 20 essais faux par démarrage. Le code est détruit à la fin de l'installation.
3. **Mots de passe.**
   - 4 mots français pris dans une liste libre de 2 048 mots, suivis d'un nombre de 10 à 99 : environ 50,5 bits.
   - Tirés sur la box.
   - Remis dans une seule réponse HTTP, jamais écrits sur le disque.
   - Régénérés si la remise n'a pas été confirmée.
4. **Verrouillage.**
   - Immich et Nextcloud ne sont publiés que sur 127.0.0.1.
   - Nextcloud 32 ou plus récent est installé au premier démarrage sans aucun compte administrateur.
   - Seul nginx écoute le réseau : en IPv4, et seulement pour des adresses sources privées.
   - Les ports des photos et des fichiers ne s'ouvrent qu'après la confirmation.
5. **HTTP en clair sur le réseau local.** Sur un réseau partagé, le risque est réel, et la v1 ne le résout pas. On le dit au client et on déconseille ce type de réseau.
6. **À régler avant de dire « zéro accès »** :
   - IPv6 : le pare-feu IPv6 de la Freebox est désactivé par défaut ;
   - les requêtes par défaut d'Immich et de Nextcloud vers des tiers ;
   - la FAQ qui dit « vous choisissez vos mots de passe » ;
   - la « maintenance » de Hako Pro.

## 1. Modèle de menace

| Menace | Ce qui se passe sans parade | Parade retenue | Risque restant |
|---|---|---|---|
| **Voisin sur un réseau partagé** (résidence, Wi-Fi d'immeuble) | Il voit hako.local par mDNS, ouvre l'assistant avant le client et devient administrateur. Il lit le trafic HTTP : Wi-Fi ouvert, ou WPA2-Personal dont la clé est commune à l'immeuble. Il peut aussi usurper hako.local pour récupérer le code. | Code de la carte obligatoire (55 bits, 20 essais par démarrage). Numéro de box à vérifier sur le premier écran. Consigne : pas d'installation sur un réseau partagé. | Une écoute ou une usurpation pendant l'installation expose les mots de passe. L'usage quotidien en HTTP est exposé de la même façon. Sur un réseau qui isole les appareils, fréquent en résidence, la box est injoignable et l'installation impossible. |
| **Appareil infecté de la maison** | Force brute du code, usurpation ARP ou mDNS, écoute, attaque des services internes. | Limitation globale des essais, et non par adresse IP. Bases de données et Valkey jamais exposées. Assistant fermé après usage. Pare-feu sur la box. | Un appareil familial compromis (enregistreur de frappe, vol de session) n'est pas couvert, comme pour tout service. |
| **Page web malveillante** ouverte dans un navigateur de la famille | Requêtes forgées vers l'API de l'assistant (CSRF), détournement d'un nom de domaine vers l'IP de la box (rebinding DNS). | Jeton dans l'en-tête Authorization, sans cookie. JSON obligatoire. Liste blanche des en-têtes Host et Origin. Aucun en-tête CORS. | Faible. |
| **Internet, par IPv6** | Le pare-feu IPv6 de la Freebox est désactivé par défaut (à revérifier sur FreeboxOS actuel). Docker publie `-p 2283:2283` à la fois sur 0.0.0.0 et sur [::]. Immich, Nextcloud et l'assistant seraient alors joignables depuis internet. | Services en IPv4 seulement. avahi sans IPv6. Pare-feu de la box qui n'accepte que des sources privées. | Tant que ce n'est pas en place, la phrase du site « Aucun port n'est ouvert vers internet » est fausse chez une partie des clients. |
| **Vol de la box ou du colis avant l'installation** | Le voleur a la box et la carte. Il peut l'installer pour lui. | Aucune donnée client sur la box : ni nom d'hôte ni prénom écrits à la préparation. Scellé adhésif témoin en option. | Un colis intercepté, regravé avec une image piégée et accompagné d'une nouvelle carte n'est pas couvert : le Pi n'a pas de démarrage sécurisé. |
| **Immich ou Nextcloud ouverts avant l'assistant** | Immich accepte la création du premier administrateur (`POST /api/auth/admin-sign-up`, route publique tant qu'aucun administrateur n'existe). Nextcloud non installé affiche son installateur web. | Voir la section 4 : liaison à 127.0.0.1, Nextcloud installé sans administrateur, ports fermés au réseau. | Nul si les tests de la section 4 passent. |
| **L'équipe HAKO** | Elle connaît le code (elle imprime la carte). Elle fabrique l'image. Elle a la box en main en cas de réparation. Hako Pro promet une « maintenance ». | Le code ne sert que depuis le réseau du client, une seule fois, et nous n'en gardons aucune copie. En production : ni SSH, ni compte utilisable, ni accès à distance (rpi-connect purgé), ni activation en ligne. | Il faut faire confiance à l'image : construction non reproductible, recette pas encore publiée. Avoir la box en main donne accès aux données, car le disque n'est pas chiffré. |
| **Site public compromis** (compte GitHub) | Un faux guide demande le code ou les mots de passe. | Le site ne demande jamais de secret. La carte, qui est physique, le rappelle. Le code est inutile hors du réseau du client. La box ne charge rien depuis le site. Double authentification et commits signés sur le dépôt. | Note : GitHub Pages n'envoie pas les en-têtes décrits dans docs/hebergement.md, et le dépôt ne contient aucune balise meta CSP. La politique de sécurité n'est donc pas active sur l'aperçu en ligne. |
| **Démonstration** | Le client recopie des mots de passe d'exemple, ou tape son vrai code dans la démo. Fuite si la démo envoyait quelque chose. | Voir la section 6. | Faible. |
| **Deux box HAKO sur le même réseau** | Conflit mDNS : avahi renomme la seconde box en hako-2.local. Le client tape son code dans la box du voisin, où l'échec compte. | Numéro de box affiché, à comparer avec la carte. En v2 : nom unique hako-<numéro>.local, repris par le QR code. | Confusion possible, mais aucune fuite. |

## 2. Le code d'installation

**Alphabet.** 24 symboles : `BCDFGHJKMPQRTVWXY2346789`, l'alphabet des clés de produit Windows.
- Aucune voyelle, donc aucun mot formé par hasard.
- Ni 0/O, ni 1/I/L, ni 5/S, ni Z, ni N.
- La saisie ignore la casse, les espaces et les tirets.
- La carte doit être imprimée dans une police où B et 8, G et 6 se distinguent nettement.

**Longueur.** 12 symboles, affichés `XXXX-XXXX-XXXX`, soit 12 × log2(24) = **55,0 bits**. C'est au-dessus du seuil du cas n° 2 de la CNIL : au moins 50 bits quand l'accès est restreint après des échecs.

**Contenu de la carte :**
- le numéro de box : 4 symboles du même alphabet (331 776 valeurs), unique grâce au registre ;
- l'adresse http://hako.local ;
- la phrase « HAKO ne vous demandera jamais ce code ni vos mots de passe. Ne le tapez que sur la page de votre box. » ;
- au dos : des lignes pour recopier les mots de passe faute d'imprimante, et un cadre « Code de secours » (v2).

**Génération : à la préparation, sur le Mac, juste après la gravure du SSD.** Il faut un nouveau script, par exemple scripts/preparer-box.sh.
- Pas à la construction de l'image : elle est commune à toutes les box.
- Pas sur la box : elle n'a pas d'écran. Un « mode fabrication » qui afficherait le code serait une porte ouverte s'il se déclenchait chez un client.
- Le tirage se fait avec `secrets.choice` de Python.
- Piège vérifié : le `/usr/bin/python3` d'Apple (3.9.6, LibreSSL) n'a pas `hashlib.scrypt`. Celui de Homebrew (OpenSSL) l'a. Le script doit le vérifier et s'arrêter sinon.

**Stockage sur la box : l'empreinte seulement.**
- Le script écrit sur bootfs un fichier `hako/preparation.json` qui contient :
  - le numéro de box ;
  - les paramètres scrypt : N = 2^15, r = 8, p = 1, soit 32 Mio de mémoire ;
  - un sel de 16 octets et une empreinte de 32 octets.
- Durée d'un calcul : mesurée à 111 ms sur le Mac de construction ; attendue entre 0,3 et 0,5 s sur le Pi 5, à mesurer.
- Le premier démarrage déplace ce fichier dans `/var/lib/hako/installation/code.json` (root, mode 600) et l'efface de bootfs.
- **bootfs n'est lu qu'une fois**, au premier démarrage (`ConditionPathExists=!/opt/box/.initialized`). Un fichier posé plus tard sur bootfs ne doit jamais pouvoir relancer l'installation : c'est le même risque que cloud-init, déjà signalé au Lot 0.
- Si le fichier manque, l'assistant reste bloqué sur « box non préparée ». Il ne génère jamais de code à la volée.

**Rien n'est gardé côté équipe.**
- Ni le code, ni la carte en PDF : elle est générée dans un dossier temporaire, imprimée, puis effacée.
- Le registre contient le numéro, la date, l'empreinte SHA-256 de l'image et le profil. Aucun secret.

**Usage unique = une seule installation.** Le code peut ouvrir des sessions jusqu'à la confirmation finale, pour survivre à une coupure ou à un changement d'appareil. Il est ensuite détruit.

**Limitation des essais, globale à la box.** Elle ne se fait pas par adresse IP, car un voisin en change à volonté.
- Erreur de format (longueur, caractère hors alphabet) : refusée, sans compter comme un essai.
- Échecs 1 à 5 : réponse immédiate.
- Échecs 6 à 20 : un essai par minute au plus (code 429 et `Retry-After: 60`).
- Au-delà de 20 : verrouillage jusqu'au prochain démarrage, c'est-à-dire débrancher puis rebrancher la box.
- Les compteurs sont liés à `/proc/sys/kernel/random/boot_id` et écrits sur le disque. Redémarrer le service ne les remet pas à zéro ; un vrai redémarrage, si. Le propriétaire est sur place ; un attaquant à distance ne peut pas débrancher la box.
- Une seule vérification scrypt à la fois : les requêtes concurrentes reçoivent 429. Un succès remet le compteur à zéro.

**Chiffres.**
- En ligne : 20 essais par démarrage, soit 1 chance sur 1,8 × 10^15.
- Hors ligne, il faut avoir la box en main : 2^55 calculs scrypt, soit plus de 100 000 ans à 10 000 calculs par seconde.

**Après l'installation.**
- `code.json` est effacé et toute tentative reçoit 410.
- La carte ne sert plus à rien ; elle peut recevoir le code de secours écrit à la main.
- Une box réinitialisée en atelier reçoit un nouveau code et une nouvelle carte.

**Carte perdue avant l'installation.** Nous n'avons aucune copie. Il faut réinitialiser la box, en atelier ou à domicile dans la zone. Rien n'est perdu : la box est encore vide.

**QR code (optionnel).**
- Il pointe vers `http://hako.local/#XXXXXXXXXXXX`. Le fragment après # n'est jamais envoyé au serveur.
- La page lit le fragment, préremplit le champ, puis l'efface de l'adresse avec `history.replaceState`.
- Le code reste dans l'historique du navigateur, sans risque puisqu'il meurt à la fin de l'installation.
- Résolution des noms .local : inégale sous Android 12 ; correcte sous Android 13 et plus, iOS, Windows 10/11 et macOS.

## 3. Les mots de passe

**Source d'aléa.**
- Les mots de passe sont tirés sur la box uniquement, par le service de l'assistant, avec `secrets` de Python.
- `secrets` s'appuie sur `getrandom()` du noyau, qui attend que le générateur soit initialisé. Le Pi 5 a un générateur matériel.
- Jamais `$RANDOM` ni `shuf`.
- L'image ne contient aucune graine aléatoire (random-seed absent, vérifié au Lot 0).
- Règle associée : Nextcloud et Postgres sont initialisés sur la box, jamais dans l'image. Nextcloud y tire son `secret`, son `passwordsalt` et son `instanceid`.

**Format.**
- 4 mots et un nombre de 10 à 99, en minuscules, séparés par des tirets. Exemple, et seulement un exemple : `tulipe-carton-melon-givre-58`.
- Environ 28 caractères, sans accent ni majuscule : facile à taper sur un téléphone.
- Le même mot de passe sert pour Immich et pour Nextcloud (choix 4). Si la personne le change dans une application, elle doit le changer aussi dans l'autre : à dire dans les tutoriels.

**Liste de mots.**
- 2 048 noms communs, soit 11 bits par mot.
- Lettres a à z seulement, 4 à 8 lettres.
- Ni homophones, ni mots choquants ou tristes, ni « exemple » (réservé à la démo).
- Relue par deux personnes.

**Licence de la liste.**
- À dériver de **Lexique 3.83, sous licence CC BY-SA 4.0**. La liste devient alors CC BY-SA 4.0, avec une attribution dans les licences de la box.
- Ne pas reprendre telles quelles les listes du dépôt mbelivo/diceware-wordlists-fr. Leur générateur est sous MIT, mais elles viennent d'une ancienne version de Lexique en CC BY-NC-SA, dont la clause non commerciale gêne. On peut relancer ce générateur sur Lexique 3.83.
- La liste Diceware de Weber n'a pas de licence connue.
- La démonstration n'a pas besoin de cette liste : ses mots de passe d'exemple sont fixes.

**Entropie visée : 4 × 11 + log2(90) = 50,5 bits.**
- La CNIL (délibération 2022-100) demande 80 bits pour un mot de passe seul, et 50 bits avec une restriction d'accès : temporisation ou blocage.
- Nextcloud a une protection contre la force brute : jusqu'à 25 s de délai par essai.
- **Immich n'en a aucune** : pas de dépendance ni de code de limitation dans la version 3.4.0-rc.0, et une demande de fonctionnalité est restée ouverte.
- Décision : garder 4 mots et ajouter une limitation devant la connexion Immich (section 4). Passer à 7 mots (environ 84 bits) serait trop long pour le public visé.
- Option à trancher : 5 mots (61,5 bits) pour la personne responsable.

**Ordres de grandeur.**
- En ligne contre Immich : bcrypt de coût 10, vérification synchrone, environ 15 essais par seconde sur le Pi 5 (à mesurer). Il faudrait en moyenne 1,7 million d'années.
- Hors ligne sur l'empreinte bcrypt : environ 6 000 essais par seconde sur une carte graphique haut de gamme (estimation), soit de l'ordre de 4 000 ans par mot de passe.
- Nextcloud stocke ses empreintes en Argon2id (64 Mio), bien plus lent à attaquer.

**Pièges vérifiés dans le code.**
- **Immich crée tout compte avec `shouldChangePassword = true` par défaut** (valeur par défaut de la table). Sans correction, la personne responsable devrait changer son mot de passe à la première connexion, et la fiche serait fausse. L'assistant doit envoyer `shouldChangePassword: false` à la création des comptes, et corriger l'administrateur juste après son inscription.
- **Nextcloud** (application password_policy) impose 10 caractères au minimum et refuse les mots de passe courants : nos mots de passe passent.
- Il interroge aussi **haveibeenpwned** pour chaque mot de passe : requête vers api.pwnedpasswords.com, avec les 5 premiers caractères de l'empreinte SHA-1. C'est actif par défaut, sauf si `has_internet_connection` vaut `false`. À mettre à `false` : c'est une sortie vers un tiers, et derrière un portail captif elle provoque un délai ou un échec.

**Remise unique.**
- Les mots de passe n'existent en clair que dans la mémoire du service, le temps de la requête `POST /comptes`, et dans sa réponse.
- Aucune route ne permet de les relire.
- Rechargement de page, coupure ou réponse perdue : la box en génère de nouveaux, et l'écran dit que l'ancienne fiche ne vaut plus rien.

**Fiche de secours.**
- Générée par la page et imprimée sur papier, avec une feuille de style d'impression.
- Contenu : numéro de box, date, adresses ; pour chaque personne, prénom, identifiant, mot de passe et mention « responsable ».
- Consigne imprimée : « Rangez cette fiche avec vos papiers importants. Ne la photographiez pas : votre téléphone l'enverrait peut-être sur internet. HAKO ne vous demandera jamais ces mots de passe. »
- Pas de fichier à télécharger : le dossier Téléchargements est souvent synchronisé avec un cloud.

**Confirmation.** Le client retape le mot de passe de la personne responsable. La box le vérifie en se connectant à Immich (`POST /api/auth/login`, puis déconnexion), sans l'avoir gardé.

**Ce que la box garde ou efface :**

| Élément | Pendant l'installation | Après |
|---|---|---|
| Empreinte du code | code.json, mode 600 | effacée |
| État et prénoms | etat.json, mode 600, sans secret | prénoms effacés ; marqueur « installée le … » |
| Mots de passe en clair | mémoire du service seulement (`MemorySwapMax=0`) | jamais écrits |
| Empreintes des mots de passe | Immich (bcrypt), Nextcloud (Argon2id) | gardées (nécessaires) |
| Clé API technique d'Immich | fichier 600 | révoquée (`DELETE /api/api-keys/{id}`), puis effacée |
| Secrets Postgres et Valkey | .env, mode 600, root | gardés ; ne quittent jamais la box |
| Jeton de session | empreinte en mémoire | perdu à l'arrêt du service |

- `/root/fiche-installation.txt`, prévue au cahier des charges, devient une fiche technique sans aucun secret : numéro, date, versions, adresses.
- Effacer un fichier sur un SSD n'efface pas forcément les données physiques. C'est sans conséquence ici : le code ne sert plus, et aucun mot de passe n'a touché le disque.

**HTTP sur le réseau local.**
- **Le risque est réel.** Sur un Wi-Fi ouvert, ou en WPA2-Personal avec une clé commune à tout un immeuble, un voisin équipé peut lire les échanges. Sur n'importe quel réseau, un appareil peut usurper hako.local (mDNS) ou détourner le trafic (ARP). Il verrait le code, puis les mots de passe. Ce n'est pas propre à l'installation : Immich et Nextcloud seront aussi en HTTP au quotidien.
- **Mesures en v1 :**
  - le guide demande, avant de commencer, si l'on est bien sur le réseau privé de la maison ;
  - les mots de passe ne sont transmis qu'une fois ;
  - `Cache-Control: no-store` ;
  - la box ne répond qu'aux adresses privées ;
  - Immich et Nextcloud restent fermés au réseau jusqu'à la confirmation ;
  - en cas de doute, la personne responsable peut changer les mots de passe.
- **Ce qui ne marche pas :**
  - un certificat auto-signé : l'alerte effraie le client, et elle ne protège rien si le client passe outre ;
  - chiffrer en JavaScript : la page elle-même arrive en clair et peut être modifiée.
- **Pistes pour une v2 :**
  - un Wi-Fi d'installation WPA3 propre à chaque box, avec sa clé sur la carte, qui chiffre le lien pendant l'installation ;
  - du HTTPS sur le réseau local, avec un nom public par box et un certificat obtenu automatiquement. Cela fait entrer HAKO dans la boucle : à étudier.
- **Navigateurs.**
  - Chrome 154 demande l'accord de l'utilisateur avant d'ouvrir une page en HTTP. Il ne le fait pas pour les noms non uniques comme les .local, ni pour les adresses IP locales, sauf si l'utilisateur a choisi le mode strict.
  - La box ne doit pas écouter le port 443 : les navigateurs qui essaient d'abord HTTPS retombent alors sur HTTP.
  - La page de la box n'est pas un contexte sécurisé : ni `navigator.clipboard`, ni `crypto.subtle`, ni `crypto.randomUUID`.
- **Ce que l'on dit au client** (vouvoiement) : « Pendant l'installation, votre ordinateur et votre box échangent sans chiffrement, sur le réseau de votre maison. Chez vous, derrière votre box internet, seuls vos appareils y ont accès. N'installez pas la box sur un réseau partagé avec d'autres foyers (résidence, Wi-Fi d'immeuble ou public) : une personne sur ce réseau pourrait voir passer vos mots de passe. »
- Ligne à ajouter dans « Les limites, en toute franchise » sur la page La box : « Les échanges entre vos appareils et la box ne sont pas chiffrés. Ils ne quittent pas votre maison, mais la box ne convient pas à un réseau partagé. »

## 4. Verrouillage avant l'installation

**Architecture recommandée pour les lots 2 et 3 : un seul point d'entrée réseau.**

| Service | Écoute | Avant l'installation | Après |
|---|---|---|---|
| nginx (conteneur figé, réseau hôte) | 0.0.0.0, IPv4 seulement | :80 = assistant | :80 = accueil ; :2283 vers Immich ; :8080 vers Nextcloud |
| Immich | 127.0.0.1:12283 (publication Docker) | local seulement | local seulement |
| Nextcloud | 127.0.0.1:18080 | local seulement | local seulement |
| Postgres, Valkey | aucun port publié | – | – |
| Assistant | socket Unix /run/hako/assistant.sock, derrière `/api/installation/` | actif | arrêté et masqué |
| SSH (production) | aucun | fermé | fermé |
| avahi | 5353/udp, `use-ipv6=no`, `publish-aaaa-on-ipv4=no` | – | – |

Les ports internes 12283 et 18080 sont différents de 2283 et 8080 parce que Linux refuse d'ouvrir 0.0.0.0:2283 si 127.0.0.1:2283 est déjà pris.

**Pourquoi ce choix.**
1. L'exposition au réseau se règle à un seul endroit.
2. nginx est en réseau hôte : le pare-feu de la box s'applique à lui normalement, par la chaîne input. Les ports publiés par Docker, eux, passent par la chaîne forward et échappent à la chaîne input.
3. On peut limiter les essais devant Immich : `limit_req` sur `/api/auth/login`, par exemple 10 par minute par adresse et 60 par minute au total. C'est ce qui justifie les 50 bits selon la CNIL.
4. Nextcloud derrière ce relais doit connaître l'adresse réelle du client (`trusted_proxies`, `forwarded_for_headers`). Sinon, sa protection contre la force brute voit tout le monde avec la même adresse. Attention : la connexion arrive par docker-proxy, donc avec l'adresse de la passerelle Docker. À vérifier dans le journal de Nextcloud.
5. Pour Immich derrière nginx, reprendre l'exemple de configuration de sa documentation : websockets, gros envois, délais longs.

**Repli minimal si le temps manque.**
- Ports publiés par Docker avec `${HAKO_ECOUTE:-127.0.0.1}:2283:2283` : par défaut, la valeur sûre.
- La finalisation les passe à `0.0.0.0` : toujours écrire l'adresse explicitement, sans quoi Docker publie aussi en IPv6.
- Filtre nftables dans le crochet prerouting, priorité -300, c'est-à-dire avant la traduction d'adresse de Docker.
- Inconvénient : aucune limitation des essais devant Immich.

**Pare-feu de la box (nftables, table `inet hako`).**
- Chaîne input :
  - politique par défaut : drop ;
  - accepter : lo, connexions établies, ICMP et ICMPv6 nécessaires, DHCP, mDNS (5353/udp) ;
  - TCP 80 accepté, plus 2283 et 8080 après l'installation (ensemble mis à jour selon l'état), et seulement depuis 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 100.64.0.0/10 et 169.254.0.0/16 ;
  - aucune connexion TCP entrante en IPv6.
- Chaîne forward : refuser toute nouvelle connexion qui va de eth0 ou wlan0 vers un pont Docker. Cette protection ne dépend pas de la version de Docker.
- Docker 28.3.3 ou plus récent :
  - la 28.0 empêche les machines du même segment réseau d'atteindre les ports publiés sur 127.0.0.1 ;
  - les versions 28.2.0 à 28.3.2 avaient une régression sur ce point.
- Ce pare-feu règle aussi le cas IPv6 sans pare-feu (Freebox) et celui d'une box mise en DMZ par le client.
- Limite : un réseau qui donne des adresses publiques aux appareils, comme certains campus, n'est pas pris en charge.

**Ordre du premier démarrage** (hako-firstboot.service) :
1. Les secrets internes sont tirés et écrits dans les .env (mode 600).
2. `docker load` charge nginx en premier. nginx démarre aussitôt en mode installation, et la page affiche « Votre box se prépare ». Les autres images sont chargées ensuite.
3. Postgres, Valkey, Immich et Nextcloud démarrent, liés à 127.0.0.1.
4. Nextcloud est installé par `occ maintenance:install --disable-admin-user`. Cette option existe depuis Nextcloud 32 (vérifié dans le code) ; le groupe admin est créé, mais vide. Il n'existe donc **aucun installateur web à réclamer**. Les paramètres de la base passent en argument : seuls les processus root de la box les voient, le temps de l'installation. Variante : les variables `_FILE` de l'image.
5. Rien à faire pour Immich. L'inscription de l'administrateur reste ouverte, mais seulement sur 127.0.0.1.
6. `.initialized` est créé. hako-assistant.service, ordonné après firstboot, passe l'état à « neuve ».

Aux démarrages suivants, nginx et le pare-feu lisent leur mode dans le fichier d'état. Si ce fichier est illisible, ils restent en mode installation : on échoue du côté fermé.

**Création des comptes (`POST /comptes`), rejouable sans risque.**
- **Immich :**
  - Si `GET /api/server/config` renvoie `isInitialized=false` : inscription de la personne responsable (`POST /api/auth/admin-sign-up`), connexion, puis création d'une clé API technique limitée à adminUser.create, adminUser.read, adminUser.update et apiKey.delete, écrite en mode 600.
  - Sinon, l'assistant reprend avec cette clé.
  - Si la coupure tombe entre l'inscription et l'écriture de la clé : `immich-admin reset-admin-password` dans le conteneur. Son fonctionnement sans terminal est à tester.
  - Pour chaque personne : `POST /api/admin/users` (adresse `prenom@hako.local`, acceptée par le motif d'adresse de l'API ; `isAdmin` pour la personne responsable ; `shouldChangePassword: false`). Si le compte existe déjà : `PUT /api/admin/users/{id}` avec le nouveau mot de passe.
- **Nextcloud :**
  - `docker exec -e OC_PASS …`, sans valeur sur la ligne de commande : la valeur vient de l'environnement du service.
  - Puis `occ user:add --password-from-env --display-name … --group admin` pour la personne responsable, ou `occ user:resetpassword --password-from-env` si le compte existe.
  - Aligner l'identifiant sur celui d'Immich (adresse `prenom@hako.local`) : à vérifier.
- **Jamais de shell.**
  - Les arguments sont passés sous forme de liste.
  - Prénoms : lettres, espace, tiret et apostrophe, de 1 à 30 caractères.
  - Identifiants : a-z, 0-9 et tiret, 20 caractères au plus ; les doublons reçoivent un suffixe 2, 3…
  - Noms réservés refusés : admin, root, hako…

**Fermeture définitive après succès.** Elle est faite par hako-finalisation.service et peut être rejouée sans risque :
1. L'état « terminee » est écrit avant de répondre au client : fichier temporaire, fsync, rename, puis fsync du dossier.
2. `code.json` est effacé.
3. La clé API d'Immich est révoquée, puis effacée.
4. Le pare-feu ouvre 2283 et 8080. nginx sert l'accueil sur :80 et les relais sur :2283 et :8080. `/api/installation/etat` est servi en fichier statique (`{"etat":"terminee"}`) ; tout le reste de `/api/installation/` répond 410.
5. `systemctl mask --now hako-assistant.service`.
6. Le marqueur « finalisee » est écrit.

Rouvrir l'assistant demande une réinitialisation complète : nouvelle gravure, nouveau code. Même relancé par erreur, le service lirait « terminee » et n'aurait plus aucun code à vérifier.

**Reprise après une coupure de courant :**

| Moment de la coupure | Au redémarrage |
|---|---|
| Pendant le premier démarrage | Il est rejoué (idempotent). La page affiche « préparation ». |
| Code saisi, foyer pas encore enregistré | Retaper le code : la session était en mémoire seulement. |
| Foyer enregistré | Retaper le code ; les prénoms sont préremplis depuis etat.json. |
| Pendant la création des comptes | Retaper le code. `POST /comptes` complète les comptes et tire de nouveaux mots de passe. |
| Mots de passe affichés, pas encore confirmés | Retaper le code. De nouveaux mots de passe sont tirés et l'écran dit que l'ancienne fiche ne vaut plus. |
| Après la confirmation, pendant la finalisation | hako-finalisation.service la rejoue tant que « finalisee » n'existe pas. |

Un SSD sans protection contre les coupures peut perdre la dernière écriture. La box recule alors d'une étape : au pire, une nouvelle fiche à imprimer. C'est rare, et l'écran l'explique.

**Fiche perdue, sans porte dérobée pour l'équipe.**
- **Une personne perd son mot de passe** : la personne responsable lui en redonne un, depuis Immich (Administration, Utilisateurs) et depuis Nextcloud (Comptes). À dire aussi au client : la personne responsable peut donc techniquement entrer dans le compte d'un autre membre, qui s'en apercevrait car son mot de passe ne marcherait plus.
- **La personne responsable perd le sien** : l'assistant propose dès le départ un second responsable quand le foyer compte deux adultes.
- **Code de secours (v2)** :
  - 16 symboles, soit 73 bits, tirés par la box pendant l'installation : l'équipe ne le connaît donc pas ;
  - affiché une fois, recopié à la main au dos de la carte et rangé ailleurs que la fiche ;
  - la box n'en garde que l'empreinte scrypt ;
  - il sert sur la page http://hako.local/secours, avec la même limitation des essais ;
  - il redonne un mot de passe à la personne responsable : la box exécute elle-même `immich-admin reset-admin-password` et `occ user:resetpassword` ;
  - il est remplacé à chaque usage.
- **Tout est perdu** : rien n'est possible à distance, par conception. Avec la box en main et l'accord écrit du client, l'équipe peut réinitialiser les comptes. C'est possible parce que le disque n'est pas chiffré, pour nous comme pour toute personne qui a la box en main. À dire tel quel.

## 5. Contrat d'API entre la page et la box

**Règles communes.**
- Adresse de base : `http://hako.local/api/installation/`, relayée par nginx vers le socket Unix.
- JSON en UTF-8. Corps de 16 Kio au plus (sinon 413). Content-Type `application/json` obligatoire pour POST et PUT (sinon 415).
- En-tête Host accepté : `hako.local`, `hako-<numéro>.local` ou une adresse IPv4 de la box. Sinon 403 `hote_refuse` : c'est la protection contre le rebinding DNS.
- En-tête Origin, s'il est présent : il doit valoir `http://` suivi d'un de ces hôtes. Sinon 403 `origine_refusee`.
- Ni en-tête CORS, ni cookie.
- **Jeton de session** :
  - `Authorization: Bearer <43 caractères base64url>`, soit 256 bits (`secrets.token_urlsafe(32)`) ;
  - côté box : seulement son empreinte SHA-256, en mémoire, comparée en temps constant ;
  - côté page : dans le sessionStorage de l'onglet, jamais en démonstration ;
  - expiration : 30 min d'inactivité, 2 h au plus ;
  - une seule session à la fois. En ouvrir une nouvelle révoque l'ancienne, qui reçoit 401 `session_remplacee` avec le message : « L'installation a été reprise sur un autre appareil. Si ce n'est pas vous, débranchez la box. »
- Erreurs : `{"erreur": "<code stable>", …}`. Les textes en français sont dans la page, communs à la démonstration et à la box.

**Routes :**

| Route | Corps | Succès | Erreurs |
|---|---|---|---|
| `GET /etat` (sans jeton) | – | 200 `{etat, box:{numero, version}, essais_restants}`. etat vaut preparation, neuve, en_cours, comptes_crees, terminee ou en_panne. | – |
| `POST /session` | `{code}` | 201 `{jeton, inactivite_s:1800, expire_le, etat}` | 422 `code_mal_forme` (ne compte pas) ; 401 `code_incorrect {essais_restants}` ; 429 `trop_rapide` + Retry-After ; 423 `verrouillee {redemarrage_requis}` ; 410 `deja_installee` ; 503 `box_en_preparation` + Retry-After: 30 |
| `PUT /foyer` | `{personnes:[{prenom}], responsables:[0]}`, de 1 à 10 personnes | 200 `{personnes:[{prenom, identifiant, responsable}]}` | 422 `foyer_invalide {index, raison}` ; 409 `etat_incompatible` (comptes déjà créés) |
| `POST /comptes` | `{}` | 201 `{personnes:[{prenom, identifiant, mot_de_passe, responsable}], adresses:{accueil, photos, fichiers}}` | 409 `foyer_manquant` ; 503 `service_indisponible` + Retry-After ; 500 `erreur_interne {incident}` |
| `POST /confirmation` | `{verification}` : mot de passe de la personne responsable | 200 `{etat:"terminee", adresses}` ; finalisation lancée, 60 s au plus | 422 `verification_incorrecte` (10 par session au plus, puis 423) ; 409 `comptes_manquants` |
| `DELETE /session` | – | 204 | – |

Toutes les routes avec jeton peuvent aussi répondre 401 (`session_absente`, `session_expiree`, `session_remplacee`) ou 410 (`deja_installee`).

**Délais.**
- Vérification du code : 0,3 à 0,5 s (scrypt, une à la fois).
- `POST /comptes` : 180 s au plus côté box, pour 1 à 10 comptes (Nextcloud est déjà installé). Côté nginx, `proxy_read_timeout 200s`.
- `GET /etat` : interrogé toutes les 5 s pendant la préparation (état « en_panne » au bout de 20 min) et après la confirmation.

**Idempotence.**
- `GET /etat` : sans effet.
- `PUT /foyer` : idempotent. Refusé après la création des comptes : on ajoute ensuite une personne depuis les applications.
- `POST /comptes` : convergent. Chaque appel crée ou met à jour les comptes et tire de nouveaux mots de passe. Le rejouer après une réponse perdue est sans danger, mais invalide les mots de passe précédents ; la page le dit avant de relancer.
- `POST /confirmation` : rejoué après une réponse perdue, il reçoit 410 `deja_installee`, que la page traite comme un succès.
- `POST /session` : pas idempotent. Chaque succès crée une nouvelle session et révoque l'ancienne.

**Journal (journald, sur la box).**
- Événements journalisés :
  - `session_ouverte` ;
  - `code_refuse` : essais restants et adresse source ;
  - `verrou` ;
  - `foyer_enregistre` : nombre de personnes ;
  - `comptes_crees` : nombre et durée ;
  - `confirmation_refusee` ;
  - `terminee` ;
  - `finalisation` : étape et résultat.
- **Jamais** : le code, les mots de passe, le jeton, le code de secours, les prénoms, les identifiants, les corps de requête.
- **Aucun secret dans une ligne de commande.** Sinon, l'exception `CalledProcessError` de Python recopie la commande dans le journal. Les erreurs de commandes sont journalisées par nom d'étape seulement.
- `access_log off` dans nginx pour `/api/installation/`.
- Le journal ne quitte jamais la box.

**Service de l'assistant.**
- Durcissement systemd :
  - `NoNewPrivileges=yes`, `ProtectSystem=strict` ;
  - `ReadWritePaths=/var/lib/hako /run/hako` ;
  - `PrivateTmp=yes`, `ProtectHome=yes` ;
  - `IPAddressDeny=any` et `IPAddressAllow=localhost` ;
  - `MemoryMax=128M`, `MemorySwapMax=0`.
- Le service fait partie du groupe docker, donc il a de fait les droits de root. Ce durcissement limite les dégâts accidentels et les fuites vers l'extérieur, pas un attaquant déterminé.
- Il n'est jamais exposé directement : nginx est toujours devant.

**En-têtes de toutes les réponses de l'assistant.**
- `Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'`. Pas de `upgrade-insecure-requests` : la box est en HTTP.
- `Cache-Control: no-store` pour le HTML et l'API.
- `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`.
- `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`.
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), usb=(), bluetooth=()`.

**Règles pour la page.**
- Affichage par `textContent`, jamais par `innerHTML`.
- Aucune ressource extérieure : la page est embarquée dans l'image et figée par l'empreinte de son commit dans versions.env.
- Aucune API réservée aux contextes sécurisés.
- Après la confirmation : vider les mots de passe de la page, puis `location.replace` vers l'accueil.

**Interface commune à la démonstration et à la box :**

```ts
interface AccesBox {
  etat(): Promise<Etat>;
  ouvrirSession(code: string): Promise<Session>;
  enregistrerFoyer(personnes: Personne[]): Promise<Foyer>;
  creerComptes(): Promise<Remise>;      // seul endroit où passent les mots de passe
  confirmer(verification: string): Promise<Fin>;
  fermerSession(): Promise<void>;
}
```

`BoxReelle`, qui utilise fetch, n'existe que dans le paquet servi par la box. `BoxSimulee`, qui travaille en mémoire, n'existe que dans celui du site.

## 6. La démonstration sur le site public

1. **Deux points d'entrée de construction.** Le paquet du site ne contient que `BoxSimulee`. Un test vérifie que le JavaScript construit de la page de démonstration ne contient ni `fetch`, ni `XMLHttpRequest`, ni `WebSocket`, ni `sendBeacon`, ni `/api/`.
2. **Politique de sécurité propre à la page.** `<meta http-equiv="Content-Security-Policy" content="connect-src 'none'; form-action 'none'">`. Le navigateur bloque alors toute requête de script et tout envoi de formulaire, y compris sur GitHub Pages, qui n'envoie pas d'en-têtes. En production, cette règle se cumule avec l'en-tête : la plus stricte s'applique.
3. **Test du parcours complet**, à 390 et à 1440 px :
   - aucune requête autre que les fichiers statiques, du début à la fin. Le test actuel, privacy.spec.ts, ne contrôle que le chargement de la page ;
   - ni cookie, ni localStorage, ni sessionStorage, ni IndexedDB ;
   - ajouter la page à tests/routes.ts.
4. **Données impossibles à confondre avec les vraies.**
   - Code de démonstration `DEMO-DEMO-DEMO` : E et O ne sont pas dans l'alphabet, ce ne peut donc jamais être un vrai code.
   - Mots de passe d'exemple fixes, qui contiennent « exemple » et finissent par 00, par exemple `exemple-tulipe-melon-00`. Les vrais finissent par un nombre de 10 à 99, et « exemple » est exclu de la liste.
   - Numéro de box « DEMO ».
5. **Marquage permanent.**
   - Un bandeau à chaque étape : « Démonstration : rien n'est envoyé, aucune box n'est configurée ».
   - Le titre de la page : « Démonstration de l'installation ».
   - Un filigrane « EXEMPLE » sur la fiche, à l'écran comme à l'impression.
6. **Tout autre code est refusé**, sans être gardé ni envoyé : « Ceci est une démonstration. Votre code ne se tape que sur la page de votre box, à l'adresse http://hako.local. » Le champ est vidé et porte `autocomplete="off"`.
7. **Aucune requête vers hako.local** depuis le site, ni tentative de détecter la box. Elle serait de toute façon bloquée : contenu mixte et `connect-src`.
8. **Erreurs simulées** (code faux, pause) pour pouvoir les montrer au jury.

## 7. « Zéro accès » : ce que l'on peut dire au jury

**Affirmable aujourd'hui, et vérifiable :**
- L'image de base ne contient ni mot de passe en clair, ni clé d'hôte SSH, ni identifiant de machine, ni graine aléatoire. Ces éléments sont tirés au premier démarrage et sont propres à chaque box : l'inspection du Lot 0 l'a montré, mais l'image n'a pas encore démarré sur le Pi.
- Le site ne piste pas : zéro cookie, zéro requête vers un autre site, vérifié par des tests sur chaque page.
- La démonstration de l'installation ne contacte aucune box et n'envoie rien, une fois les points 1 à 3 de la section 6 en place.
- Le protocole est conçu pour que l'équipe ne détienne aucun secret durable. Elle n'a qu'un code à usage unique, utilisable seulement depuis le réseau du client.

**Affirmable seulement après les lots 2 et 3, et si les tests passent :**
- Chaque box a des secrets uniques, tirés sur la box. Deux box issues de la même image ne partagent ni mot de passe Postgres, ni `secret`, `passwordsalt` ou `instanceid` de Nextcloud.
- En production : ni SSH, ni compte utilisable, ni accès à distance, ni activation en ligne, ni UPnP.
- Aucun port ouvert vers internet, IPv6 compris.
- Les mots de passe sont créés chez le client et jamais transmis à HAKO. Le code d'installation est détruit après usage.

**À ne pas affirmer :**
- **Que tout cela existe.** Immich, Nextcloud, l'assistant et le pare-feu ne sont pas dans l'image. Le profil de production n'est pas construit. Au jury : la démonstration simulée et ce protocole.
- **Que les données sont protégées si quelqu'un emporte la box.** Le disque n'est pas chiffré : c'est vrai pour un voleur comme pour une réparation sous garantie chez nous.
- **Que les échanges sont chiffrés.** Le réseau local est en HTTP.
- **« Aucune donnée ne sort de la maison ».** Par défaut, Immich vérifie l'arrivée de nouvelles versions sur GitHub et charge ses fonds de carte depuis tiles.immich.cloud. Nextcloud contacte son magasin d'applications, son serveur de mises à jour et haveibeenpwned.
  - À couper : côté Immich, `newVersionCheck` et `map` ; côté Nextcloud, `has_internet_connection=false`, `appstoreenabled=false`, `updatechecker=false`. Sinon, il faut l'annoncer.
  - Les mises à jour de sécurité contactent les dépôts Debian et Raspberry Pi, et c'est nécessaire.
- **Que l'équipe ne pourrait pas tricher.** Il faut faire confiance à l'image. La formulation juste est « nous ne gardons aucun moyen d'accès », pas « nous ne pourrions pas ».
- **« Vous choisissez vos mots de passe »** (FAQ « Avez-vous accès à mes photos ? »). Avec ce protocole, c'est la box qui les crée, chez le client. Le client peut ensuite les changer dans chaque application.

**Points à trancher ou à corriger :**
- **La « maintenance de la box » de Hako Pro** doit se faire sans accès à distance : sur place, avec le client. Sinon, elle contredit « zéro accès ».
- **Installation à domicile par l'équipe** : c'est le client qui tape le code et imprime la fiche, et l'installateur ne regarde pas l'écran pendant la remise des mots de passe.
- **Textes du site** (à transmettre à la session qui travaille sur le site) :
  - remplacer mabox.local par hako.local : la-box.ts, faits.ts, FAQ « branchement », tutoriels ;
  - la FAQ sur les mots de passe, voir plus haut ;
  - la FAQ « branchement » dit « le Wi-Fi est aussi possible » : sans SSH, rien ne permet de configurer le Wi-Fi d'une box envoyée. En v1, le câble réseau est obligatoire, et il n'est pas fourni ;
  - « Aucun port n'est ouvert vers internet » n'est vrai qu'avec le pare-feu IPv6 de la box.
- **Phrase proposée pour le jury** : « Zéro accès, par conception : nous ne gardons ni mot de passe, ni clé, ni accès à distance. Chaque box crée ses secrets chez le client, et le code d'installation ne sert qu'une fois. Nos limites : le disque n'est pas encore chiffré, ni le réseau de la maison ; nous le disons à nos clients. »

## Contrôles à ajouter au test sur la box (Lot 4)

- Depuis une autre machine du réseau, **avant l'installation** :
  - seul le port 80/tcp est ouvert (`nmap -p-` en IPv4) ;
  - rien d'ouvert sur l'adresse IPv6 globale ;
  - `curl` vers hako.local:2283 et :8080 est refusé.
- **Après l'installation** :
  - seuls 80, 2283 et 8080 sont ouverts ; jamais 5432 ni 6379 ;
  - `ss -tlnp` sur la box montre Immich et Nextcloud liés à 127.0.0.1.
- Avec une route vers le réseau Docker qui passe par la box (`ip route add 172.16.0.0/12 via <box>`) : aucune réponse.
- **Assistant** :
  - Host falsifié : 403. Origin étranger : 403 ;
  - 21e code faux : 423 avec `redemarrage_requis` ; après un redémarrage, compteur remis à zéro.
- **Fuites** : un mot de passe témoin ne doit apparaître ni dans `journalctl`, ni dans `docker logs`, ni dans les journaux nginx, ni sur le disque (`grep`).
- **Après la finalisation** :
  - `/session` répond 410 ;
  - le service est masqué et code.json absent ;
  - la clé technique a disparu de `GET /api/api-keys`.
- **Deux box** : empreintes de code, secrets de Nextcloud et mots de passe Postgres tous différents.

## Priorités avant midi

1. **Site** : la page /installer/ (le guide) et la démonstration avec les garanties de la section 6.
2. **Textes** : les corrections de la section 7 et la limite HTTP de la section 3.
3. **Box** : présenter ce protocole comme une conception, sans dire qu'il tourne.

## Sources (consultées le 13 novembre 2026)

- **Docker** :
  - Docker Engine 28 : https://www.docker.com/blog/docker-engine-28-hardening-container-networking-by-default/
  - Publication des ports : https://docs.docker.com/engine/network/port-publishing/
  - Régression 28.2.0 à 28.3.2 : https://www.tenable.com/plugins/nessus/243284
- **Chrome**, « Ask-before-HTTP » : https://chromium.googlesource.com/chromium/src/+/main/docs/security/ask-before-http/ask-before-http-adoption-guide.md
- **Immich** :
  - Spécification OpenAPI, branche principale en 3.4.0-rc.0 : https://raw.githubusercontent.com/immich-app/immich/main/open-api/immich-openapi-specs.json
  - Code source, dans https://github.com/immich-app/immich (dossier server/src) :
    - middleware/auth.guard.ts : route ouverte seulement avant le premier administrateur ;
    - schema/tables/user.table.ts : `shouldChangePassword` vaut true par défaut ;
    - constants.ts : `SALT_ROUNDS = 10` ;
    - dtos/config.dto.ts : `map` et `newVersionCheck` actifs par défaut.
  - Commandes d'administration : https://docs.immich.app/administration/server-commands
  - Demande de limitation des connexions : https://github.com/immich-app/immich/discussions/21165
- **Nextcloud** :
  - Image Docker : https://github.com/nextcloud/docker/blob/master/README.md
  - Commandes occ sur les comptes : https://docs.nextcloud.com/server/stable/admin_manual/occ_users.html
  - Installation sans administrateur, dans https://github.com/nextcloud/server (branche stable32) : core/Command/Maintenance/Install.php et lib/private/Setup.php
  - Politique de mots de passe : https://github.com/nextcloud/password_policy/blob/master/lib/PasswordPolicyConfig.php
  - Protection contre la force brute : https://docs.nextcloud.com/server/stable/admin_manual/configuration_server/bruteforce_configuration.html
- **CNIL**, délibération 2022-100 : https://cnil.fr/sites/cnil/files/atoms/files/deliberation-2022-100-du-21-juillet-2022_recommandation-aux-mots-de-passe.pdf. Je n'ai pas lu ce PDF moi-même : les seuils de 80, 50 et 13 bits viennent de pages qui le résument.
- **Listes de mots** :
  - Lexique sous CC BY-SA 4.0 : https://github.com/chrplr/openlexicon
  - Listes mbelivo : https://github.com/mbelivo/diceware-wordlists-fr
- **Android**, résolution des noms .local : https://source.android.com/docs/core/ota/modular-system/dns-resolver
- **Freebox**, pare-feu IPv6 désactivé par défaut, d'après un ticket et des forums de 2019 et 2020 : https://dev.freebox.fr/bugs/task/27268
- **Dépôts locaux, lus sans rien modifier** :
  - ~/Code/mabox-os/docs/lot0-faisabilite.md
  - ~/Code/hako-site/docs/hebergement.md
  - ~/Code/hako-site/tests/privacy.spec.ts
  - ~/Code/hako-site/src/content/faq/acces-a-mes-photos.mdx
  - ~/Code/hako-site/src/content/faq/branchement.mdx
  - ~/Code/hako-site/.github/workflows/apercu.yml
