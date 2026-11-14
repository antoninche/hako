# Lot 0 : faisabilité

MaBox est une box maison sur Raspberry Pi 5 qui démarre sur SSD. Son système est une image construite avec pi-gen, l'outil officiel de Raspberry Pi : branche arm64, révision c0d2c9f2cffc08bc56850b0a3eb23178f4226e8a, Debian 13 (trixie).

Le Lot 0 répond à une question : pouvons-nous construire cette image sur nos Mac Apple Silicon, sans machine Linux ? Cette note donne la réponse, les pièges rencontrés, la façon de graver et de tester l'image, et les décisions à prendre au Lot 1. Elle décrit l'état au 12 novembre 2026.

L'image de ce lot est une image de test. Elle contient le compte mabox, protégé par un mot de passe console connu de l'équipe, et la clé SSH de l'équipe. Elle ne doit jamais être installée chez un client.

## Réponse

Oui. Le build Docker officiel de pi-gen (`build-docker.sh`) fonctionne sur un Mac Apple Silicon avec le moteur Docker de Colima. Nous n'avons rien modifié dans pi-gen.

Nous avons construit l'image deux fois le 12 novembre. La première construction (16 h 43) a validé la méthode. La seconde (18 h 33), lancée avec la version finale de construire-stock.sh, produit l'image livrée. Les deux images ont exactement les mêmes paquets, aux mêmes versions. Conditions :

- Mac Apple Silicon sous macOS 27, 16 Gio de mémoire ;
- Colima 0.10.3 : VM vz aarch64 sous Ubuntu 24.04, 4 CPU, 6 Gio de mémoire, disque de données de 30 Gio (plus 20 Gio pour le système de la VM) ; moteur Docker 29.5.2, client 29.8.0 ;
- construction native arm64 (`arch-test` répond « arm64: ok »), sans qemu ;
- durée totale 6 min 15 s pour la première construction, 5 min 33 s pour la seconde (stage0 1 min 42, stage1 8 s, stage2 1 min 14, export 2 min 26) ;
- la VM est restée saine : pression mémoire quasi nulle, aucun périphérique loop resté attaché, 2,4 Gio utilisés sur le disque de données après la construction.

Image livrée (seconde construction) :

```text
deploy/image_2026-11-12-mabox-stock-lite.img.xz
  taille    610611600 octets (582 Mio)
  SHA-256   358896aba1230b16fdbf448e08142d32b98e94ca229ff3e63f61058cb399f60c
image décompressée
  taille    3095396352 octets (2,9 Gio)
  SHA-256   f02084923dbcfbfe43a67ee8477cdd59c58e077fd388df4221e6eb3104bf4fff
noyau 6.18.60 (variantes rpi-2712 pour le Pi 5 et rpi-v8), Debian 13 (trixie)
```

deploy/ contient aussi SHA256SUMS, le .info (liste des paquets), le .os.json (tailles et empreintes), release_notes.txt, build.log, build-docker.log et nos journaux lot0-construction-*.log, un par construction. Il n'y a ni .bmap ni SBOM : bmaptool et syft ne sont pas dans l'image Docker de pi-gen, qui s'en passe dans ce cas.

La configuration est config/stock.conf : nom d'hôte mabox-test, compte mabox, SSH par clé seulement avec la clé ~/.ssh/mabox-dev, langue fr_FR.UTF-8, clavier fr, fuseau Europe/Paris. Le mot de passe console du compte est tiré au hasard et rangé dans local/mot-de-passe-dev. Il n'y a pas encore d'étape maison.

Il reste une réserve : le démarrage sur le Pi est à prouver (procédure plus bas).

## Docker Desktop chez un coéquipier

Docker Desktop n'est pas installé sur le Mac de construction : nous avons donc construit avec Colima, et Docker Desktop n'a pas été testé. D'après nos recherches, il devrait convenir, avec ces précautions :

- Docker Desktop construit avec BuildKit, dont le cache garde le contexte de construction, c'est-à-dire tout le dossier pi-gen. Ce contexte ne contient plus aucun secret depuis que la config reste dans local/ (voir les pièges de la construction), et construire-stock.sh refuse de démarrer si un fichier pi-gen/config existe.
- Dans un conteneur Docker Desktop, les partitions loop (loop0p1…) n'apparaissent pas seules. pi-gen crée les nœuds lui-même depuis sa PR #741, présente dans notre révision. Ce contournement n'a pas été éprouvé ici.
- Une construction interrompue pendant l'export laisse des périphériques loop attachés, et le correctif (PR #936) n'est pas dans notre révision : redémarrer Docker Desktop avant de relancer.
- Hors Colima, verifier-hote.sh ne contrôle ni la place dans la VM ni les périphériques loop, et construire-stock.sh ne lance pas de fstrim. Docker Desktop range tout dans un seul fichier disque. La place se récupère avec `docker run --privileged --pid=host docker/desktop-reclaim-space`. Réduire la taille maximale de ce disque efface tous les conteneurs et toutes les images.
- Prévoir une limite disque suffisante. Laisser désactivée l'isolation renforcée des conteneurs (ECI, option de Docker Business) : son effet sur les périphériques loop n'est pas documenté.
- La licence est gratuite pour un usage personnel, l'éducation et les petites entreprises (moins de 250 salariés et moins de 10 M$ de chiffre d'affaires).

OrbStack ne documente rien sur les périphériques loop et devient payant en usage commercial. Nous ne l'utilisons pas pour le rendu.

## Plan de repli avec Lima

Si le build Docker devenait inutilisable, par exemple après le retrait de l'ancien constructeur Docker, pi-gen peut tourner en natif, en root, dans une VM Debian 13 arm64 créée avec Lima (modèle debian-13 de Lima 2.2). Ce plan est documenté ; il n'a pas servi, et aucune VM n'a été créée.

```sh
colima stop    # deux VM de 6 Gio à la fois chargent trop un Mac de 16 Gio
limactl create --name=pigen --vm-type=vz --arch=aarch64 --cpus=4 --memory=6 --disk=40 --mount-none --tty=false template:debian-13
limactl start pigen
limactl shell pigen -- sudo apt-get update
limactl shell pigen -- sudo apt-get install -y coreutils quilt parted qemu-user-binfmt debootstrap zerofree zip dosfstools e2fsprogs libcap2-bin grep rsync xz-utils file git curl bc gpg pigz xxd arch-test bmap-tools kmod
```

Ensuite, dans la VM : cloner pi-gen (branche arm64, révision c0d2c9f) sur le disque de la VM, y copier la config avec `limactl copy`, puis lancer `sudo ./build.sh`. Un dossier partagé avec le Mac échouerait probablement (nœuds de périphériques, droits root ; non testé). Pour finir, rapatrier l'image et supprimer la VM :

```sh
limactl copy pigen:/home/$USER.linux/pi-gen/deploy/NOM_IMAGE.img.xz ~/Code/mabox-os/deploy/
limactl delete pigen
```

build.sh exige qemu-user-binfmt même en arm64, et le chemin de pi-gen ne doit contenir aucun espace. Le chargement du module loop dans la VM n'a pas été vérifié.

## Pièges de la construction

L'option `-c` de build-docker.sh se comporte mal avec le sed de macOS. Le script réécrit « -c chemin » en « -c /config » avec `sed -E 's@\-c\s?([^ ]+)@-c /config@'`. Le sed de macOS ne connaît pas `\s` : il laisse « -c chemin » intact, mais il réécrit le premier « -c » suivi d'un caractère qu'il trouve plus loin, même au milieu d'un nom de fichier (issue pi-gen #830, fermée sans correctif). Un de nos essais l'a montré : avec une config nommée pigen-config, build.sh a reçu le chemin tronqué « …/local/pigen-c ».

Notre première parade, écrire la config dans pi-gen/config que pi-gen lit par défaut, a fait entrer le mot de passe de test dans l'image Docker pi-gen : le Dockerfile fait `COPY . /pi-gen/`, et .dockerignore n'exclut pas config. Nous avons supprimé cette image à la main, puis changé de méthode. construire-stock.sh écrit maintenant la config complète dans local/pigen.conf (mode 600), la passe avec `-c` et la monte en lecture seule dans le conteneur, au même chemin, par PIGEN_DOCKER_OPTS. Sur Mac, le sed laisse ce chemin intact et il existe aussi dans le conteneur ; sous Linux, le sed le remplace par /config, que build-docker.sh monte de son côté. Le script refuse un chemin qui contient « -c » ou une espace, ainsi qu'un fichier pi-gen/config existant. Il efface local/pigen.conf à la fin, même en cas d'échec, et vérifie que l'image Docker pi-gen ne contient aucun fichier config. La seconde construction a validé cette méthode : config effacée, image Docker sans config, aucune trace du mot de passe dans deploy/.

Après un échec, build-docker.sh s'arrête avant `docker rm -v` : le conteneur pigen_work reste pour le diagnostic (`docker logs pigen_work`). Le supprimer avant de relancer :

```sh
docker rm -v pigen_work
```

La place disque se gère avec fstrim. Les deux disques de la VM Colima sont des fichiers creux sur le Mac : 20 Gio pour le système et 30 Gio pour les données Docker, soit 50 Gio apparents, plus que la place libre du Mac. Ils grossissent pendant la construction. La place libérée dans la VM ne revient au Mac qu'après un fstrim, car le disque des données Docker est monté sans discard.

Nos mesures : après la construction et l'inspection de l'image (faite dans la VM), ~/.colima occupait environ 12 Gio. Un fstrim dans la VM l'a ramené à 3,9 Gio, soit environ 9 Gio rendus au Mac. Le Mac avait 37 Gio libres au début de la construction (16 h 42) et 30 Gio à 17 h 03 ; il en avait 33 après le fstrim, puis 31 à 32 vers 18 h. Le swap de macOS grossit sur le même volume quand la VM tourne (3,2 Gio utilisés sur 4 pendant nos mesures).

verifier-hote.sh refuse de construire sous 20 Gio libres sur le Mac (pic mesuré : environ 12 Gio) ou sous 15 Gio libres dans la VM. construire-stock.sh lance fstrim après une construction réussie. Après un échec, le lancer à la main, une fois pigen_work supprimé :

```sh
colima ssh -- sudo fstrim -a
```

Le disque Colima peut seulement être agrandi, VM arrêtée. Pour le réduire, il faut `colima delete --data`, qui efface toutes les images et tous les volumes.

Le constructeur Docker utilisé est l'ancien, déprécié. Le client Docker du Mac n'a pas le greffon buildx : docker build retombe sur l'ancien constructeur et affiche « DEPRECATED: The legacy builder is deprecated and will be removed in a future release ». La construction réussit quand même. Docker le déclare déprécié depuis la version 23.0, sans date de retrait : une mise à jour Homebrew du client docker peut casser build-docker.sh. Ne jamais exporter `DOCKER_BUILDKIT=1` sans buildx : docker build échouerait. Parade, après le rendu du Lot 0 : installer buildx (sur ce Mac, `cliPluginsExtraDirs` est déjà réglé dans ~/.docker/config.json), vérifier, puis refaire une construction de contrôle.

```sh
brew install docker-buildx
docker buildx version
```

Une construction ratée laisse le conteneur pigen_work et ses volumes. verifier-hote.sh le signale, et `docker rm -v pigen_work` le supprime. Une construction interrompue pendant l'export peut laisser des périphériques loop attachés dans la VM ; l'export suivant échoue alors avec « losetup failed » (correctif PR #936 absent de notre révision). verifier-hote.sh le détecte avec `losetup -a` dans la VM. Parade : `colima restart`, une fois toute construction terminée.

## Inspection de l'image

Après la première construction, nous avons inspecté l'image en lecture seule, dans la VM Colima. Elle est conforme. L'image livrée, issue de la seconde construction avec les mêmes paquets, a été vérifiée à nouveau sur les points essentiels : empreinte, partitions, cmdline.txt, nom d'hôte, machine-id « uninitialized », aucune clé d'hôte SSH, comptes et sudo, clé autorisée, SSH par clé seulement, langue, aucune trace du mot de passe. Points vérifiés sur la première image :

- Le .xz a l'empreinte de SHA256SUMS. L'image décompressée a l'empreinte et la taille annoncées dans le .os.json.
- La table MBR (ID disque 0xad56cf5a ; il change à chaque construction et vaut 0xb8feab30 pour l'image livrée) porte bootfs (FAT32, 512 Mio, à partir du secteur 16384) et rootfs (ext4, 2432 Mio, à partir du secteur 1064960). cmdline.txt et fstab désignent les mêmes PARTUUID.
- Les fichiers de démarrage du Pi 5 sont présents : kernel_2712.img, initramfs_2712 (avec auto_initramfs=1), bcm2712-rpi-5-b.dtb, bcm2712d0-rpi-5-b.dtb et les overlays. config.txt ne désactive ni le Wi-Fi ni le Bluetooth, et ne contient rien pour le démarrage USB ou NVMe. cmdline.txt se termine par « rootwait resize ».
- Au premier démarrage, la racine s'agrandit en trois temps, sans redémarrage. L'initramfs agrandit la partition 2 avec parted, jusqu'à la fin du disque (plafond de 2 Tio). set_partuuid tire un nouvel ID disque dans /dev/hwrng, met à jour fstab et cmdline.txt et retire « resize ». rpi-resize.service agrandit enfin l'ext4 (systemd-growfs-root) puis lance fstrim.
- /etc/hostname vaut mabox-test et /etc/machine-id vaut « uninitialized ». L'image ne contient aucune clé d'hôte SSH : regenerate_ssh_host_keys.service et sshd-keygen.service les créent au premier démarrage. random-seed, credential.secret et le secret_key de NetworkManager sont absents.
- SSH est activé avec PasswordAuthentication no et KbdInteractiveAuthentication no ; sshd_config.d est vide. Le fichier authorized_keys de mabox contient une seule clé ED25519, dont l'empreinte correspond à la clé de l'équipe, en mode 600 dans un dossier en 700.
- root n'a aucun mot de passe valide. mabox a un mot de passe (haché en yescrypt), que sudo demande : il n'y a aucune règle NOPASSWD. Seuls root et mabox ont un shell, et il n'y a pas de compte pi. Le renommage du compte au premier démarrage (userconf-pi) est désactivé, et bootfs ne porte aucun fichier déclencheur (userconf.txt, ssh, firstrun.sh).
- Les fichiers cloud-init de bootfs (user-data, network-config, meta-data) n'ont aucune ligne active. Nom d'hôte, comptes, clés d'hôte et réseau restent donc inchangés au premier démarrage.
- NetworkManager et avahi sont actifs. Le Wi-Fi est bloqué deux fois : rfkill démarre bloqué (default_state=0) sans état wlan enregistré, et NetworkManager.state contient WirelessEnabled=false. Le Bluetooth est actif.
- Langue fr_FR.UTF-8, clavier fr (XKBLAYOUT=fr, variante vide), fuseau Europe/Paris.
- Le mot de passe de test et la chaîne FIRST_USER_PASS n'apparaissent dans aucun fichier de bootfs, de rootfs ni de deploy/ (recherche validée par un témoin positif et un témoin négatif). L'image n'a ni /etc/shadow- ni /etc/gshadow-, passwords.dat de debconf est vide, et il n'y a ni .bash_history ni journal rempli dans /var/log.
- rootfs fait 2326 Mio, dont 293 Mio libres avant agrandissement. L'image compte 633 paquets.

Deux anomalies mineures viennent des paquets Raspberry Pi. meta-data écrit « instance_id » avec un tiret bas, alors que cloud-init lit « instance-id » : l'instance-id effectif est donc « nocloud ». Et cloud.cfg appelle le module netplan_nm_patch, absent du paquet cloud-init. Ce module manquant fait répondre « degraded done » (code 2) à `cloud-init status`, ce qui est attendu à l'étape 9 du test.

Clés d'hôte SSH, machine-id et ID disque (donc PARTUUID) sont tirés au premier démarrage : ils sont propres à chaque box. D'autres identifiants restent communs à toutes les boxes gravées avec une même image : l'UUID ext4 et le numéro de volume FAT (tirés à chaque construction), le nom mabox-test, l'instance-id cloud-init « nocloud » et, comme voulu au Lot 0, le hachage du mot de passe de mabox et la clé publique de l'équipe. fstab et cmdline.txt utilisent le PARTUUID : ces doublons sont sans effet au Lot 0. En revanche, deux SSD de cette image branchés ensemble entrent en collision dans /dev/disk/by-uuid. L'unicité ne vaut que pour une image fraîchement gravée, à condition de garder « resize » dans cmdline.txt : un SSD déjà démarré puis cloné copie tout. Le PARTUUID ne compte que 32 bits aléatoires.

## Gravure du SSD

Deux méthodes, toutes deux depuis le Mac. Dans les deux cas, le SSD est entièrement effacé. Avant de commencer, débrancher du Mac tout autre disque externe, disque de sauvegarde Time Machine compris.

La première méthode est scripts/flasher-ssd.sh. Le script vérifie l'empreinte de l'image dans SHA256SUMS et sa table MBR. Il vérifie ensuite le disque : disque entier, externe et physique, secteurs de 512 octets, assez grand, sans partition Apple (APFS ou HFS+, donc ni disque de Mac ni sauvegarde Time Machine) et distinct des disques physiques qui portent le système du Mac. Il affiche le modèle, la taille et la liaison du disque, puis demande de retaper son identifiant au clavier. Juste avant d'écrire, il revérifie que c'est toujours le même disque. Il écrit l'image avec son premier Mio à zéro : sans table de partitions, macOS ne monte rien pendant l'écriture. Il relit alors toute l'image, partition de démarrage comprise, et la compare. Il écrit et relit le premier Mio (la table de partitions) en dernier, comme Raspberry Pi Imager, puis éjecte le SSD. L'option `--simulation` fait toutes les vérifications sans rien écrire.

```sh
diskutil list external physical    # SSD débranché
diskutil list external physical    # SSD branché : le nouveau diskN est le SSD
cd ~/Code/mabox-os
scripts/flasher-ssd.sh --simulation deploy/image_2026-11-12-mabox-stock-lite.img.xz diskN
scripts/flasher-ssd.sh deploy/image_2026-11-12-mabox-stock-lite.img.xz diskN
```

macOS demande le mot de passe administrateur pour dd. La fin attendue est une ligne qui commence par « Relecture conforme », puis « Terminé ». En cas de « Operation not permitted », autoriser Terminal à accéder aux volumes amovibles (Réglages Système, Confidentialité et sécurité, Fichiers et dossiers). Si macOS affiche « disque illisible » ou propose d'« Initialiser » le disque, cliquer sur « Ignorer ».

Une relecture critique de la première version du script a relevé trois défauts importants, corrigés depuis : la partition de démarrage n'était pas relue, un disque Time Machine en USB passait les contrôles, et le contrôle du disque système du Mac ne pouvait jamais se déclencher. Les défauts mineurs relevés à la même occasion sont aussi corrigés : revérification du disque avant l'écriture, appel de /bin/dd (le dd GNU refuse `bs=4m`), confirmation lue au clavier et non sur l'entrée standard, messages d'erreur après l'écriture, relecture accélérée (`dd skip` au lieu de `tail -c +N`). La version corrigée passe shellcheck. Elle a écrit l'image réelle dans un fichier, copie identique au bit près en 18 s, et refuse en `--simulation` le disque du Mac, son conteneur APFS, un disque absent et un identifiant de partition. Elle n'a pas encore gravé de vrai SSD. Un boîtier NVMe Thunderbolt pourrait être vu par macOS comme un disque interne, donc refusé (non vérifié) : utiliser un boîtier USB.

La seconde méthode est Raspberry Pi Imager 2.x, qui n'est pas installé sur le Mac de construction. Il accepte le .img.xz et vérifie lui-même l'écriture. Parcours : appareil « Raspberry Pi 5 », puis « Utiliser image personnalisée » et le fichier .img.xz, puis le stockage (laisser « Exclure les disques système » coché), puis « Je comprends, effacer et écrire ». Pour une image personnalisée, Imager 2.x ne propose aucune personnalisation. Si un écran de personnalisation apparaît malgré tout, choisir « Sauter la personnalisation ».

Aucune personnalisation ne doit être ajoutée : ni Imager 1.x, ni manifeste local (create_local_json.py), ni les options `--cloudinit-userdata`, `--cloudinit-networkconfig` ou `--first-run-script` de `rpi-imager --cli`. La personnalisation réécrit user-data, network-config et meta-data sur bootfs et modifie cmdline.txt. cloud-init, présent dans notre image, l'appliquerait au premier démarrage : comptes, mots de passe, SSH par mot de passe, Wi-Fi, voire liaison à Raspberry Pi Connect. Le test ne porterait plus sur notre image, et des accès imprévus seraient installés.

Après la gravure, quelle que soit la méthode : ne rien ajouter ni modifier sur bootfs (user-data, ssh, userconf.txt, config.txt, cmdline.txt), et éjecter le SSD avant de le débrancher.

## Conditions côté Pi

Côté image, rien ne manque pour démarrer un Pi 5 sur SSD. Les pilotes nvme, usb-storage, uas, xhci, pcie-brcmstb et rp1 sont compilés dans le noyau 6.18.60+rpt-rpi-2712, et cmdline.txt désigne la racine par son PARTUUID. pi-gen ne règle rien dans l'EEPROM du Pi. Un démarrage sans réglage suppose donc :

- un bootloader du 2023-12-06 ou plus récent, pour que le M.2 HAT+ soit détecté. La version 2026-10-30 est conseillée : elle inclut la correction de la lecture NVMe des fichiers de plus de 32 Mo (2025-06-09) et corrige un défaut de usb_max_current_enable de la version du 2026-09-25 ;
- un BOOT_ORDER qui contient 6 (NVMe) ou 4 (USB). La valeur d'usine est 0xf461 : microSD, puis NVMe, puis USB. Une mise à jour du bootloader garde la config en place, et un BOOT_ORDER absent vaut 0xf41 (sans NVMe) : il faut lire la valeur sur le Pi (étape 10) ;
- avec une carte M.2 autre que le HAT+ officiel, PCIE_PROBE=1 dans l'EEPROM. dtparam=pciex1 sert seulement à voir le SSD quand le Pi a démarré sur un autre support ;
- l'alimentation officielle 27 W (5 V, 5 A). Avec une alimentation 3 A, l'USB est limité à 600 mA au total et le démarrage USB est désactivé ;
- aucune microSD dans le Pi : avec 0xf461, elle passe avant le SSD ;
- un câble Ethernet, le Wi-Fi étant bloqué dans l'image.

Avec le matériel prévu (M.2 HAT+ officiel, alimentation 27 W, Pi récent, aucune microSD), le démarrage devrait se faire sans réglage. Seul le test sur le Pi le prouvera.

Sans système sur le Pi, la version du bootloader s'affiche sur l'écran de diagnostic : Pi allumé sans support de démarrage, écran HDMI branché. Si elle est trop ancienne, dans Imager : « Raspberry Pi 5 », puis « Misc utility images », « Bootloader (Pi 5 family) » et « NVMe/USB Boot », sur une microSD de secours. Pi éteint, insérer la carte, brancher l'alimentation et attendre au moins 10 s : une LED verte qui clignote vite, ou un écran vert, signale la réussite. Débrancher, puis retirer la carte. Cette image remet la config du bootloader à zéro avec BOOT_ORDER=0xf146 (NVMe, puis USB, puis microSD). C'est un réglage du Pi, fait avant le test et à part.

## Test sur le Pi

Cette procédure n'utilise jamais sudo et ne touche ni à l'EEPROM ni à config.txt. Le seul geste destructif est la gravure, faite avant, et il ne concerne que le SSD. Elle suppose un SSD en NVMe dans le M.2 HAT+ ; avec un SSD en USB, les étapes sont les mêmes et l'étape 4 donne les valeurs USB. L'étape 12 compare un second SSD : elle est facultative. Les étapes 4 à 10 se font sur le Pi, dans la même session SSH. Nous gardons les sorties dans le compte rendu du lot, sans aucun mot de passe.

Étape 1, sur le Mac : l'image est intègre et le SSD est gravé.

```sh
cd ~/Code/mabox-os/deploy && shasum -a 256 -c SHA256SUMS
```

Sortie attendue :

```text
image_2026-11-12-mabox-stock-lite.img.xz: OK
```

Le SSD a été écrit avec scripts/flasher-ssd.sh, qui a fini par « Relecture conforme », ou avec Imager. Rien n'a été modifié ensuite sur bootfs.

Étape 2 : montage et premier démarrage. Pi débranché : aucune microSD, le SSD dans le M.2 HAT+ (ou sur un port USB 3 bleu), aucun autre SSD branché, câble Ethernet vers le même réseau que le Mac, alimentation officielle 27 W. Brancher l'alimentation, puis lancer sur le Mac, toutes les 30 s :

```sh
ping -c 3 mabox-test.local
```

Sortie attendue au bout de 1 à 3 min :

```text
3 packets transmitted, 3 packets received, 0.0% packet loss
```

Au-delà de 5 min : regarder la LED, le bail DHCP du routeur, ou brancher un écran. Ne pas couper le courant pendant ce premier démarrage.

Étape 3 : connexion depuis le Mac, dans Terminal.app.

```sh
ssh-keygen -R mabox-test.local; ssh -i ~/.ssh/mabox-dev -o IdentitiesOnly=yes mabox@mabox-test.local
```

ssh annonce une clé inconnue (« ED25519 key fingerprint is SHA256:… ») : noter l'empreinte et répondre yes. L'invite `mabox@mabox-test:~ $` s'affiche sans demande de mot de passe. Un avertissement de wifi-check.sh sur le Wi-Fi bloqué peut s'afficher : c'est normal au Lot 0.

Étape 4, sur le Pi : preuve du démarrage sur le SSD. `export LC_ALL=C` passe la session en anglais pour que les sorties se comparent ; il vaut pour les étapes 4 à 10.

```sh
export LC_ALL=C; printf '%d\n' "0x$(od /proc/device-tree/chosen/bootloader/boot-mode -v -An -t x1 | tr -d ' ')"; findmnt -no SOURCE /; findmnt -no SOURCE /boot/firmware; ls /dev/mmcblk* 2>/dev/null | wc -l
```

Sortie attendue en NVMe :

```text
6
/dev/nvme0n1p2
/dev/nvme0n1p1
0
```

En USB : 4, /dev/sda2, /dev/sda1, 0. Un 1 (microSD), un autre disque ou un compte mmcblk non nul rendent le test invalide.

Étape 5 : système attendu (révision pi-gen, Debian 13, noyau du Pi 5).

```sh
sed -n 2p /etc/rpi-issue; grep '^PRETTY_NAME' /etc/os-release; cat /etc/debian_version; uname -r; getconf PAGESIZE; tr -d '\0' </proc/device-tree/model; echo
```

Sortie attendue (le dernier chiffre de la révision de la carte peut varier) :

```text
Generated using pi-gen, https://github.com/RPi-Distro/pi-gen, c0d2c9f2cffc08bc56850b0a3eb23178f4226e8a, stage2
PRETTY_NAME="Debian GNU/Linux 13 (trixie)"
13.7
6.18.60+rpt-rpi-2712
16384
Raspberry Pi 5 Model B Rev 1.x
```

Étape 6 : identité propre à ce SSD. Noter les valeurs des lignes 1, 2 et 4 pour l'étape 12.

```sh
cat /etc/machine-id; ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub; ls /etc/ssh/ssh_host_*_key | wc -l; lsblk -no UUID,PARTUUID "$(findmnt -no SOURCE /)"; grep -o 'root=[^ ]*\| resize' /boot/firmware/cmdline.txt
```

Sortie attendue, ligne par ligne :

1. 32 caractères hexadécimaux ; « uninitialized » serait un échec.
2. `256 SHA256:… root@mabox-test (ED25519)`, avec la même empreinte qu'à l'étape 3.
3. `3` (clés RSA, ECDSA et ED25519).
4. L'UUID ext4 de l'image, puis `XXXXXXXX-02`, où XXXXXXXX diffère de b8feab30, l'ID disque de l'image livrée. L'UUID ext4 est le même sur toutes les boxes gravées avec cette image : c'est attendu.
5. Une seule ligne `root=PARTUUID=XXXXXXXX-02`, sans « resize ».

Étape 7, depuis un deuxième terminal du Mac : SSH n'accepte que la clé.

```sh
ssh -o BatchMode=yes -o PubkeyAuthentication=no mabox@mabox-test.local true; echo "code=$?"
```

Sortie attendue :

```text
mabox@mabox-test.local: Permission denied (publickey).
code=255
```

Si la liste entre parenthèses contient password ou keyboard-interactive, le mot de passe est accepté : échec.

Étape 8, sur le Pi : Wi-Fi bloqué et Bluetooth actif, comme prévu au Lot 0.

```sh
for r in /sys/class/rfkill/rfkill*; do echo "$(cat $r/type) soft=$(cat $r/soft) hard=$(cat $r/hard)"; done; nmcli radio wifi; systemctl is-active bluetooth; ls /sys/class/bluetooth
```

Sortie attendue : les lignes `wlan soft=1 hard=0` et `bluetooth soft=0 hard=0`, dans un ordre quelconque, puis :

```text
disabled
active
hci0
```

La boucle lit sysfs directement, car rfkill est rangé dans /usr/sbin, absent du PATH d'une commande SSH non interactive.

Étape 9 : aucune unité en échec, cloud-init sans effet.

```sh
systemctl is-system-running --wait; systemctl --failed --no-legend --plain; cloud-init status --long; echo "code=$?"; ls /var/lib/cloud/instances; ls -A /etc/netplan /etc/ssh/sshd_config.d; getent passwd 1000 pi | cut -d: -f1; hostname
```

Sortie attendue, dans l'ordre :

- `running`, puis rien pour `--failed` ;
- `status: done`, `extended_status: degraded done` et `errors: []`, avec une seule erreur récupérable : « Could not find module named cc_netplan_nm_patch … » ;
- `code=2` (ce sera 0 le jour où ce module sera fourni) ;
- `nocloud` ;
- les en-têtes `/etc/netplan:` et `/etc/ssh/sshd_config.d:`, sans aucun fichier dessous ;
- `mabox`, sur une seule ligne : il n'y a pas de compte pi ;
- `mabox-test`.

Étape 10 : EEPROM et alimentation, en lecture seule.

```sh
vcgencmd bootloader_version | head -1; vcgencmd bootloader_config | grep -E '^(BOOT_ORDER|PCIE_PROBE|PSU_MAX_CURRENT)='; journalctl -b -u rpi-eeprom-update -o cat | grep -E 'BOOTLOADER:|Skipping|UPDATING'; vcgencmd get_throttled; printf '%d\n' "0x$(od /proc/device-tree/chosen/power/max_current -v -An -t x1 | tr -d ' ')"
```

Sortie attendue :

1. Une date AAAA/MM/JJ du 2023/12/06 ou plus récente. Si elle est antérieure au 2025/05/08, l'image a pu réécrire l'EEPROM pendant ce démarrage.
2. En général `BOOT_ORDER=0xf461`. La valeur doit contenir 6 pour le NVMe et 4 pour l'USB. `PCIE_PROBE=1` n'apparaît qu'avec une carte M.2 autre que le HAT+.
3. `BOOTLOADER: up to date`, parfois précédé de « Skipping automatic bootloader upgrade… », et aucune ligne « UPDATING bootloader ». Sinon, l'image a réécrit l'EEPROM : le noter.
4. `throttled=0x0`.
5. `5000` ; 3000 signale une alimentation 3 A.

Étape 11 : second démarrage, sans sudo, pour vérifier que tout persiste. Appui bref sur le bouton d'alimentation du Pi (arrêt propre en Lite), attendre la LED rouge, puis nouvel appui pour redémarrer. Ensuite, sur le Mac :

```sh
ssh -i ~/.ssh/mabox-dev -o IdentitiesOnly=yes mabox@mabox-test.local 'cat /etc/machine-id; grep -c " resize" /boot/firmware/cmdline.txt; systemctl is-system-running --wait'
```

Sortie attendue : la connexion se fait sans aucun avertissement de clé d'hôte, puis viennent le même machine-id qu'à l'étape 6, `0` et `running`.

Étape 12, facultative, avec un second SSD gravé avec la même image : mêmes preuves en USB, identifiants différents. Appui sur le bouton, attendre la LED rouge, débrancher l'alimentation. Retirer le premier SSD du HAT+, brancher le second sur un port USB 3 (bleu), rebrancher l'alimentation 27 W. Puis, sur le Mac : `ssh-keygen -R mabox-test.local`, le ping de l'étape 2, et les étapes 3 à 10.

Sortie attendue :

- étape 4 : 4, /dev/sda2, /dev/sda1, 0 ;
- étape 6 : machine-id, empreinte ED25519 et PARTUUID tous différents de ceux du premier SSD ; seul l'UUID ext4 est commun. Le Pi étant le même, ces écarts montrent que ces identifiants sont tirés au premier démarrage, sans lien avec le matériel ;
- toutes les autres sorties identiques à celles du premier SSD.

Avec une alimentation 3 A, le Pi refuse de démarrer en USB : nous notons ce résultat et laissons config.txt tel quel. Pour finir, un appui sur le bouton, puis attendre la LED rouge avant de débrancher.

## Pièges pendant le test

- Sur un réseau d'école ou de résidence, mDNS peut être filtré, les clients isolés, l'accès soumis à un portail captif ou le DHCP réservé aux appareils enregistrés. mabox-test.local ne répond alors pas, même si le Pi tourne. Le Wi-Fi étant bloqué dans l'image, l'Ethernet est obligatoire : tester derrière un petit routeur ou un switch de l'équipe. À défaut, lire le bail DHCP du routeur, ou brancher écran et clavier, se connecter en mabox sur la console avec le mot de passe console et lancer `hostname -I`.
- Le terminal intégré d'un éditeur (VS Code…) peut se voir refuser l'accès au réseau local par macOS tant que l'éditeur n'a pas l'autorisation « Réseau local » : ping et ssh échouent. Terminal.app en est exempté, d'où son choix pour le test.
- Une microSD oubliée, y compris la carte de mise à jour du bootloader, passe avant le SSD avec 0xf461. Si elle porte la même image, le PARTUUID est le même et la racine peut venir du mauvais support. Retirer la carte Pi éteint ; l'étape 4 détecte ce cas.
- Deux SSD fraîchement gravés avec la même image ont le même PARTUUID tant qu'aucun n'a démarré, et le NVMe passe avant l'USB. Un seul SSD à la fois, branché ou retiré Pi hors tension.
- L'empreinte SSH change à chaque gravure. Lancer `ssh-keygen -R mabox-test.local` avant de se connecter à un SSD neuf, noter l'empreinte, et ne jamais désactiver StrictHostKeyChecking. Un « REMOTE HOST IDENTIFICATION HAS CHANGED » sans nouvelle gravure signale qu'une autre machine répond au même nom. Exemple : deux boxes mabox-test sur le réseau, avahi renomme alors la seconde en mabox-test-2.local.
- Avec une alimentation 3 A, l'USB est limité à 600 mA, le démarrage USB est refusé (le forcer fausserait le test) et le NVMe risque des sous-tensions. L'étape 10 le contrôle : throttled=0x0 et max_current=5000.
- Au premier démarrage, ne pas couper le courant pendant 2 à 3 min. L'initramfs agrandit la partition et change l'ID disque. Si le bootloader date d'avant le 2025-05-08, l'image réécrit aussi l'EEPROM (`rpi-eeprom-update -s -a`). La procédure laisse l'EEPROM intacte ; l'image, elle, peut la réécrire, et l'étape 10 le vérifie dans le journal.
- Avec un bootloader trop ancien (avant le 2023-12-06) ou un BOOT_ORDER sans 6, le NVMe n'est jamais essayé. Lire la version sur l'écran de diagnostic HDMI, ou démarrer d'abord sur le SSD USB. Changer BOOT_ORDER est un réglage, à faire hors procédure.
- Les sorties arrivent en français : la session reçoit LANG=fr_FR.UTF-8, par la locale de l'image et par le `AcceptEnv LANG LC_*` du Pi, et nmcli répond alors en français. D'où le `export LC_ALL=C` de l'étape 4. Des avertissements setlocale sans gravité peuvent apparaître si le Mac envoie une locale absente du Pi.
- Dans une commande passée en une ligne (`ssh hôte 'commande'`), le PATH ne contient pas /usr/sbin : rfkill et blkid sont introuvables. Utiliser le chemin complet ou une session interactive.
- `cloud-init status` rend le code 2 (« degraded done ») à cause du module netplan_nm_patch absent : c'est normal au Lot 0. Tout autre avertissement ou erreur compte comme un échec.
- Sans DHCP qui répond, NetworkManager-wait-online passe en échec et fausse l'étape 9. Le Pi n'a pas de pile RTC : si le NTP est filtré, l'heure est fausse et le journal mal daté, sans gravité pour ce test.
- Après la gravure, macOS monte bootfs, peut y déposer des fichiers cachés et proposer « Initialiser » : cliquer sur « Ignorer ». Ne rien modifier sur bootfs, surtout le mot « resize » de cmdline.txt : sans lui, ni nouvel ID disque ni agrandissement.
- Ne jamais fabriquer une box en clonant un SSD déjà démarré : clés SSH, machine-id et PARTUUID seraient copiés. Toujours graver le .img.xz. L'UUID ext4 et le numéro FAT restent de toute façon communs : désigner les disques par PARTUUID.
- Les boîtiers USB-SATA ou USB-NVMe en mode UAS sont parfois instables. Utiliser un port USB 3 bleu, et changer de boîtier en cas d'erreurs d'entrée-sortie dans `journalctl -k`.
- Ce test se fait uniquement sur le Pi 5 prototype de l'équipe, avec ses propres SSD. Aucun Pi déjà en service ne doit y servir.

## Décisions pour le Lot 1

- cloud-init tourne à chaque démarrage, même avec ENABLE_CLOUD_INIT=0. Cette option saute seulement la copie de user-data, meta-data et network-config sur bootfs ; les paquets restent installés. Des fichiers déposés sur bootfs, partition FAT modifiable depuis n'importe quel ordinateur, peuvent alors renommer mabox, changer son mot de passe, ajouter des clés ou lancer des commandes en root. En octobre 2025, un mainteneur de pi-gen ne le déclarait pas encore pris en charge. Proposition : purger cloud-init et rpi-cloud-init-mods dans l'étape maison (netplan.io reste, NetworkManager en dépend), ou au minimum créer /etc/cloud/cloud-init.disabled, puis vérifier que l'Ethernet monte toujours en DHCP. Si nous le gardons, écrire la clé instance-id avec un tiret. Attention aussi à la clé users: : elle renomme le compte UID 1000 via userconf-pi. Avec `users: [default]`, mabox deviendrait pi, avec sudo sans mot de passe.
- Le Wi-Fi est bloqué deux fois sans WPA_COUNTRY. S'il doit servir, WPA_COUNTRY=FR fixe la réglementation radio et évite WirelessEnabled=false ; le déblocage repose alors sur NetworkManager (plausible ; à vérifier sur une box). Sinon, l'éteindre proprement : dtoverlay=disable-wifi-pi5 dans config.txt et wpa_supplicant désactivé.
- Le Bluetooth est actif par défaut (bluetooth.service, radio débloquée). S'il ne sert pas : dtoverlay=disable-bt-pi5 dans config.txt et bluetooth.service désactivé.
- Le durcissement SSH reste à faire. Proposition : mettre nos réglages dans un fichier de /etc/ssh/sshd_config.d/, dossier lu en premier, où la première valeur lue l'emporte. pi-gen, lui, modifie sshd_config directement, ce qui peut gêner les mises à jour d'openssh. X11Forwarding vaut yes : à couper. Deux points à trancher : sshswitch, qui rallume SSH si un fichier « ssh » apparaît sur bootfs, et avahi, qui annonce la machine sur le réseau local (publish-workstation=yes).
- sudo demande le mot de passe, alors que SSH n'accepte que les clés. Administrer la box à distance demande donc le mot de passe console. À décider : le garder, ou écrire un fichier sudoers.d restreint.
- rpi-connect-lite (2.15.0), l'accès à distance de Raspberry Pi, est installé, inactif pour l'instant. Proposition : le purger dans l'étape maison.
- L'EEPROM se met à jour seule. rpi-eeprom-update.service lance `rpi-eeprom-update -s -a` à chaque démarrage : un bootloader d'avant le 2025-05-08 est réécrit tout de suite, en gardant sa config, dont BOOT_ORDER. Les timers apt-daily et apt-daily-upgrade sont actifs ; unattended-upgrades n'est pas installé. La politique de mise à jour reste à fixer, pour le bootloader comme pour les paquets.
- Les caches apt (/var/lib/apt/lists/* et /var/cache/apt/*.bin) pèsent environ 282 Mio, pour 293 Mio libres dans rootfs avant agrandissement. Les supprimer à l'export. Évaluer aussi le retrait de firmware-atheros et firmware-mediatek (environ 180 Mio, pour des clés Wi-Fi USB) et de gcc-14 et linux-headers (environ 110 Mio).
- L'étape maison doit être visible dans le conteneur. Rangée hors de pi-gen/, elle n'y existe pas : build.sh cherche le chemin du Mac et s'arrête. La solution à tester est de la monter au même chemin, en lecture seule, avec PIGEN_DOCKER_OPTS. build-docker.sh passe cette variable sans guillemets à docker run : le chemin ne doit contenir aucun espace.

  ```sh
  export PIGEN_DOCKER_OPTS="--volume $RACINE/stage-box:$RACINE/stage-box:ro"
  STAGE_LIST="stage0 stage1 stage2 $RACINE/stage-box"    # dans la config pi-gen
  ```

  Les fichiers copiés par l'étape vont sous stage-box/NN-xxx/files/. Vus à travers virtiofs, ils gardent probablement l'UID du Mac (501) : les copier avec `install -o root -g root`. Un NN-run.sh non exécutable est ignoré avec un simple message. Un fichier SKIP_IMAGES dans pi-gen/stage2 et un EXPORT_IMAGE avec IMG_SUFFIX dans stage-box font exporter la seule image finale. Les gros fichiers, comme les .tar d'images Docker, restent hors de pi-gen/ : `COPY . /pi-gen/` les recopierait dans l'image Docker à chaque construction. En repli, copier l'étape dans pi-gen/ avec `rsync --delete` juste avant la construction ; elle est alors figée dans l'image Docker.
- Les secrets sont sortis de pi-gen/config dès ce lot (voir les pièges de la construction). La même méthode, un montage en lecture seule au même chemin, servira pour l'étape maison et pour les .tar d'images Docker.
- Un profil de production distinct, config/prod.conf, doit livrer une box sans SSH ni mot de passe connu de nous. Pistes : ENABLE_SSH=0, PUBKEY_ONLY_SSH=0 et aucune PUBKEY_SSH_FIRST_USER ; un FIRST_USER_PASS aléatoire jeté après la construction, puis `usermod -L mabox` dans l'étape maison ; ssh.service, ssh.socket, sshswitch.service et userconfig.service masqués (un masque résiste au fichier « ssh » sur bootfs), ou openssh-server purgé ; un fichier sshd avec PasswordAuthentication no en plus. Aucun secret propre à une box ne passe par la config : clé TLS et mots de passe de Postgres, Immich et Nextcloud sont générés au premier démarrage, sur la box.
- Le nom mabox-test est le même sur toutes les boxes. Deux boxes sur un même réseau entrent en collision mDNS, et avahi renomme la seconde. Prévoir un nom par box, fixé au premier démarrage. La variable PI_GEN_RELEASE permet aussi de remplacer « Raspberry Pi reference » dans /etc/rpi-issue.
- La table MBR plafonne l'agrandissement à 2 Tio (4 294 967 295 secteurs). Sur un SSD de plus de 2 To, le reste serait perdu. Prévoir une table GPT ou une partition de données séparée, et garder les photos hors de rootfs.
- Immich aura besoin du cgroup memory. Sur Raspberry Pi OS Lite trixie (Pi 4, noyau 6.12), ce contrôleur manque et `docker run --memory` est ignoré sans `cgroup_enable=memory cgroup_memory=1` dans cmdline.txt (issue pi-gen #917). Ce point n'est pas vérifié sur Pi 5 avec le noyau 6.18 : lire /sys/fs/cgroup/cgroup.controllers sur la box. Même prudence pour les pages mémoire de 16 Kio du noyau Pi 5 avec Immich et Nextcloud (repli possible avec kernel=kernel8.img ; à vérifier).
- Au Lot 1, avec une étape légère, la place tient : il faut compter une copie du rootfs (environ 2 Go) et, si stage2 garde son export, un second .img de 3,1 Go et son .xz. La marge du Mac reste mince : libérer 10 à 15 Gio avant le Lot 1, et lancer fstrim aussi après un échec.
- La place disque doit être réglée avant le Lot 2. Les images Docker changeront l'échelle : les 7 images arm64 visées (trois pour Immich, puis Valkey, Nextcloud, Postgres et nginx) pèsent environ 1,5 Go compressées, soit 5 à 8,5 Go une fois tirées, et le pic estimé dans la VM va de 18 à 46 Go. 30 Gio de VM et une trentaine de Gio libres sur le Mac ne suffisent que dans un scénario sobre : images supprimées après `docker save`, .tar hors de pi-gen/, ménage et fstrim après chaque construction. Avant le Lot 2 : mesurer un vrai `docker save`, viser au moins 60 Gio libres sur le Mac ou déplacer deploy/ et les .tar sur un SSD externe, et seulement ensuite agrandir le disque Colima (`colima stop`, puis `colima start --disk 50`, irréversible sauf `colima delete --data`). Le moteur Docker ne tourne pas dans le chroot de pi-gen : il faudra des archives préchargées ou un téléchargement au premier démarrage.

## Reste à vérifier

- Nous n'avons pas encore déroulé la procédure de test sur le Pi 5, ni en NVMe ni en USB.
- scripts/flasher-ssd.sh n'a tourné que sur un banc sans disque et en `--simulation` : aucun vrai SSD n'a encore été gravé.
- Docker Desktop et le plan de repli avec Lima n'ont pas été testés.
- La durée du premier démarrage (1 à 3 min selon notre estimation) reste à mesurer avec `systemd-analyze`.
- Les presets systemd du premier démarrage devraient rester sans effet, la racine étant encore en lecture seule à ce moment-là. L'issue pi-gen #913 signale pourtant un renommage proposé malgré DISABLE_FIRST_BOOT_USER_RENAME=1. Contrôle sur la box : `systemctl is-enabled userconfig` doit répondre disabled.
- Le déblocage du Wi-Fi par NetworkManager avec WPA_COUNTRY et la présence du cgroup memory sur Pi 5 restent à vérifier.
- macOS présente peut-être les boîtiers NVMe Thunderbolt comme des disques internes ; le script de gravure les refuserait alors.
