# HakOS 2026.11.1 : socle du Pi 5, noms des applications, page d'état

14 novembre 2026. Sans Raspberry Pi : tout est essayé dans la VM Colima (arm64) et par les contrôles statiques de l'image construite. Ce qui demande le vrai Pi 5 est listé à la fin.

## 1. Disque : inchangé

Deux partitions, comme depuis le Lot 0 : `bootfs` (FAT32) et `rootfs` (ext4, agrandie à tout le SSD au premier démarrage). Les données sont sous `/opt/box`. Les partitions système A et B sont reportées avec le mécanisme de mises à jour (P13). Rappel de la décision 1 des mises à jour : les réserver après la première box vendue demandera d'effacer le SSD du client.

## 2. Garde-fous du Pi 5

| Risque | Garde-fou | Où |
|---|---|---|
| Noyau à pages de 16 Kio (`kernel_2712.img`) : la base d'Immich plante (jemalloc) | `kernel=kernel8.img` dans la section `[pi5]` de `config.txt`, `kernel8.img` et `initramfs8` sur bootfs | `stage-box/00-systeme`, `make verifier-image` |
| Idem, si l'image ou le SSD a été modifié | Premier démarrage, étape 1 : `getconf PAGESIZE` doit valoir 4096, sinon **arrêt** | `lib/premier-demarrage.sh` (`verifier_materiel`) |
| Fichiers du Pi 5 absents de bootfs | `bcm2712-rpi-5-b.dtb`, `bcm2712d0-rpi-5-b.dtb`, `overlays/` | `make verifier-image` |
| EEPROM trop ancien pour démarrer sur NVMe | `rpi-eeprom` installé avec les images du BCM2712, `rpi-eeprom-update.service` activé (il installe au démarrage une version livrée plus récente) ; version de l'EEPROM dans le journal du premier démarrage, avertissement avant juin 2024 | `make verifier-image`, `journalctl -u hakos-premier-demarrage` |

**Arrêt du premier démarrage** : marqueur `/var/lib/hakos/arret` (raison : `pages`), pare-feu fermé (2283 et 8080), seul le nginx de l'accueil démarre et sert sur `http://hako.local` la page `home/site/arret.html` (« Votre HAKO ne peut pas démarrer », que faire, détail pour l'équipe) ; `/api/…` répond 503. Immich et Nextcloud ne démarrent pas, l'unité est en échec. À chaque démarrage, le premier démarrage recommence : si les pages font 4 Kio, il lève l'arrêt, recharge nginx et continue normalement. Essai : `HAKOS_PAGE_OCTETS=16384`.

## 3. Noms des applications

| Nom | Mène à | Avant l'installation |
|---|---|---|
| `http://hako.local` | page d'état (accueil) | page de la HAKO (assistant) |
| `http://hako-photos.local` | Immich, par nginx (port 80), frein des mots de passe | page de la HAKO, jamais Immich |
| `http://hako-fichiers.local` | Nextcloud, par nginx (port 80) | page de la HAKO, jamais Nextcloud |
| `http://hako.local:2283`, `http://<IP>:2283` | Immich (secours) | fermé par le pare-feu |
| `http://hako.local:8080`, `http://<IP>:8080` | Nextcloud (secours) | fermé par le pare-feu |

- **Annonce** : `hakos-noms.service` (`noms/noms.py`, Python, bibliothèque standard, root durci) lit le nom qu'avahi a pris (D-Bus, `GetHostName` : `hako`, ou `hako-2` pour une deuxième box) et l'adresse IPv4 de la route par défaut, puis lance `avahi-publish -a -R <nom>-photos.local <IP>` et de même pour `fichiers` : de simples enregistrements A, sans enregistrement inverse (celui de l'adresse reste à `hako.local`). Toutes les 10 s, il suit les changements de nom et d'adresse et relance `avahi-publish` s'il s'arrête (conflit de nom, avahi redémarré). Paquet `avahi-utils` ajouté.
- **nginx** (`home/nginx`) : `noms.conf`, inclus par `accueil.conf` seulement, sert les deux noms (expressions `hako(-N)?-photos` et `hako(-N)?-fichiers`). Immich passe par `mandataire-immich.conf`, commun avec le port 2283 : un seul compteur de 10 essais par minute et par adresse. Nextcloud passe par `127.0.0.1:8080` avec `X-Forwarded-For`. `/photos` et `/fichiers` de la page d'état renvoient vers les noms (`hako-2.local/fichiers` vers `hako-2-fichiers.local`), ou vers les ports de secours quand la page est ouverte par l'adresse IP.
- **Nextcloud** : domaines de confiance `hako.local hako-2.local hako-fichiers.local hako-2-fichiers.local` (`env.modele`), plus l'adresse IPv4 de la box, à l'index 9, posée et tenue à jour par `hakos-noms`. Le premier démarrage déclare comme mandataire de confiance la seule passerelle du réseau Docker de Nextcloud (`trusted_proxies`), par où nginx arrive : le frein des mots de passe de Nextcloud voit l'adresse de chaque appareil ; un appareil du port 8080 garde la sienne et ne peut pas se faire passer pour un autre.
- **Fiche d'installation** : adresses par les noms, ports en secours.

## 4. Page d'état

`http://hako.local`, d'après la maquette validée le 14/11 (`home/site` : `index.html`, `style.css`, `accueil.js`, polices du site) : « Bonjour », les deux applications par leur nom, puis « État de votre HAKO » (espace utilisé et barre, photos et vidéos, allumée depuis, température et degré en °C, copie de secours « pas encore disponible ») et « Mises à jour » : « Bientôt. » jusqu'à P13. Pied de page : version de HakOS (`HAKOS_VERSION` de `versions.env`, ici 2026.11.1) et adresse de la page.

- **Données** : `GET /api/etat`, servi par nginx depuis `/run/hakos-etat/etat.json`, écrit chaque minute par `hakos-etat.service` (`etat/etat.py`, lancé par `hakos-etat.timer`, root durci, sans réseau). Champs : `version`, `verifie`, `disque` (octets), `photos` (comptés dans la base d'Immich par `psql` dans son conteneur : corbeille et ressources cachées exclues), `allumee_depuis`, `temperature` (`vcgencmd measure_temp`), `ralentissement` (`vcgencmd get_throttled` : chaleur, alimentation, maintenant et depuis le démarrage), `applications` (santé des conteneurs), `sauvegarde` (`null`). **Aucun secret** : aucun mot de passe n'est lu (psql par le socket local du conteneur), aucun nom de personne ni de fichier n'est écrit ; le test de la box vérifie qu'aucun secret des `.env` n'apparaît.
- **Messages** : « Tout va bien. » ; sinon, par ordre : application qui ne répond pas (avec quoi faire), plus de 90 % du disque (note de la maquette), trop chaud ou ralentie, alimentation trop faible, état pas vérifié depuis plus de 5 min. L'âge de la mesure se calcule avec l'heure de la box (en-tête `Date`).
- **Sécurité** : un seul script, le sien ; politique de contenu `script-src 'self'; connect-src 'self'`, `no-store`, `no-referrer`. Aucune requête ailleurs que sur la box (le lien d'aide mène au site HAKO).

## 5. Essais du 14 novembre (VM Colima, Ubuntu 24.04 arm64, 4 Go simulés)

| Essai | Résultat |
|---|---|
| `make lint` | vert : shellcheck (26 scripts), compose, secrets, 21 tests de l'assistant, 13 tests du socle |
| `make build-prod`, puis `make verifier-image` | image `image_2026-11-14-hakos-prod.img.xz` (2,0 Go) ; 32 contrôles sur 32, dont les fichiers du Pi 5 et rpi-eeprom |
| `essai-vm.sh installer` (dépôt), test de la box | premier démarrage en 66 s ; 35 contrôles sur 35 avant l'installation |
| Idem, `HAKOS_PAGE_OCTETS=16384` | arrêt à l'étape 1, page d'arrêt sur le port 80 (200), API 503, 2283 et 8080 fermés, seul nginx tourne ; relancé avec 4 Kio : arrêt levé, page de la HAKO, premier démarrage réussi |
| `essai-vm.sh installer <image prod>` (/opt/box, archives et unités tirés de l'image) | premier démarrage en 90 à 93 s, archives chargées ; 35 sur 35 avant l'installation |
| `test-sur-boitier.sh --assistant 8` sur l'image prod | essai de l'assistant 62 sur 62 (comptes créés en 11,4 s ; noms vus du voisin avant et après ; connexions par hako-photos.local et hako-fichiers.local ; frein d'Immich 10 × 401 puis 429), puis box installée 37 sur 37 |
| avahi dans la VM (nom forcé à `hako`) | `avahi-resolve-host-name` : hako-photos.local et hako-fichiers.local → adresse de la VM |
| Navigateur (Chromium, 1440 px) | page d'état sans erreur ni violation de CSP, liens vers les noms ; captures de la page d'état, d'Immich et de Nextcloud avec des données d'exemple |

Sur le Pi, `test-sur-boitier.sh` ajoute 9 contrôles du système (dont la version de l’EEPROM) aux 35 de l'essai.

## 6. Non vérifiable sans Pi 5

- Démarrage sur NVMe, version réelle de l'EEPROM et sa mise à jour par `rpi-eeprom-update`.
- Noyau `kernel8.img` chargé par le firmware du Pi 5 (pages de 4 Kio), et la page d'arrêt sur un vrai noyau à 16 Kio.
- `vcgencmd` : température et ralentissements réels (la VM reçoit des valeurs d'exemple), flux d'air du boîtier.
- Résolution de `hako-photos.local` et `hako-fichiers.local` par de vrais appareils (iPhone, Android, Mac, Windows avec et sans Bonjour), et d'une deuxième box `hako-2-…`.
- Durée réelle du premier démarrage et du comptage des photos sur une grosse photothèque.
