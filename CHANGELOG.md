# Journal des modifications

Les versions de MaBox OS suivent les lots du projet.

## [Lot 0] - 2026-11-12

### Ajouté

- versions.env : pi-gen figé sur la branche arm64, révision c0d2c9f2cffc08bc56850b0a3eb23178f4226e8a.
- config/stock.conf : configuration de l'image Lite de référence, sans étape maison (nom d'hôte mabox-test, compte mabox, SSH par clé seulement, fr_FR.UTF-8, clavier fr, fuseau Europe/Paris).
- scripts/verifier-hote.sh : vérification en lecture seule de la machine de construction (architecture, place libre sur le Mac et dans la VM Colima, outils, moteur Docker, périphériques loop, conteneur pigen_work restant, accès réseau).
- scripts/recuperer-pigen.sh : récupération de pi-gen à la révision figée, sans toucher à une copie modifiée à la main.
- scripts/construire-stock.sh : construction par le build Docker officiel de pi-gen ; config et secrets gardés dans local/ et montés en lecture seule, sans jamais entrer dans l'image Docker pi-gen ; SHA256SUMS et journal dans deploy/ ; fstrim dans la VM Colima.
- scripts/flasher-ssd.sh : gravure d'un SSD depuis le Mac : contrôle de l'empreinte et du disque (externe, physique, sans partition Apple, distinct du disque du Mac), confirmation au clavier, table de partitions écrite en dernier, relecture de toute l'image, éjection, mode `--simulation`.
- .gitignore : pi-gen/, deploy/, images, archives et secrets (local/, clés) tenus hors du dépôt.
- README.md et docs/lot0-faisabilite.md : mode d'emploi, résultats du Lot 0, procédure de test sur le Pi, décisions pour le Lot 1.
- Image de test, hors dépôt : image_2026-11-12-mabox-stock-lite.img.xz (610611600 octets, SHA-256 358896aba1230b16fdbf448e08142d32b98e94ca229ff3e63f61058cb399f60c), construite en 5 min 33 s sur un Mac Apple Silicon avec Colima.

### Problèmes connus

- Le démarrage de l'image sur le Pi 5 n'est pas encore testé.
- scripts/flasher-ssd.sh n'a pas encore gravé de vrai SSD (testé en simulation et vers un fichier).
