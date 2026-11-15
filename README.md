# 箱 HAKO 

[![Aperçu en ligne](https://github.com/antoninche/hako/actions/workflows/apercu.yml/badge.svg)](https://github.com/antoninche/hako/actions/workflows/apercu.yml)
[![HakOS](https://github.com/antoninche/hako/actions/workflows/hakos.yml/badge.svg)](https://github.com/antoninche/hako/actions/workflows/hakos.yml)
[![Release](https://img.shields.io/github/v/release/antoninche/hako?filter=HakOS%2A&display_name=release&label=HakOS)](https://github.com/antoninche/hako/releases/latest)
[![Licence : GPL-3.0-or-later](https://img.shields.io/badge/licence-GPL--3.0--or--later-blue)](LICENSE)
[![Site](https://img.shields.io/website?url=https%3A%2F%2Fantoninche.github.io%2Fhako%2F&label=site)](https://antoninche.github.io/hako/)


![Page d'accueil du site de HAKO : vos souvenirs restent à la maison](.github/assets/accueil.png)

HAKO est une box qui garde les photos et les fichiers de la famille à la maison : un Raspberry Pi 5 avec un SSD, chez vous, et non chez Google ou chez Apple. Hako (箱) veut dire « boîte » en japonais.
Elle fait tourner HakOS, notre système, avec deux logiciels libres déjà installés : Immich pour les photos, Nextcloud pour les fichiers.
Aucun port n'est ouvert vers internet, et le système installé chez vous ne laisse aucun accès à l'équipe.

HAKO est le projet de trois étudiants d'Aix-Marseille : Antonin Chenavaz, Maxime Pollaud et Martin Dugail.

Tout le reste est sur le site : [antoninche.github.io/hako](https://antoninche.github.io/hako/).

## Installer HakOS

Il vous faut :

- un Raspberry Pi 5 ;
- un SSD NVMe, sur une carte M.2 pour Raspberry Pi 5 ;
- l'alimentation officielle de 27 W ;
- un câble Ethernet relié au réseau de la maison ;
- un ordinateur pour graver le SSD.

1. Téléchargez l'image `.img.xz` et le fichier `SHA256SUMS` de la [dernière release](https://github.com/antoninche/hako/releases/latest).
2. Vérifiez le téléchargement, dans le dossier des deux fichiers : `shasum -a 256 -c SHA256SUMS`.
3. Gravez le `.img.xz` sur le SSD avec Raspberry Pi Imager, « Utiliser image personnalisée », sans aucune personnalisation, ou sur un Mac avec [hakos/scripts/flasher-ssd.sh](hakos/scripts/flasher-ssd.sh).
4. Démarrez la box sur le SSD, sans carte microSD : câble Ethernet d'abord, alimentation ensuite.
5. Ouvrez http://hako.local depuis un appareil du réseau de la maison et suivez la page de première installation.

HakOS a été testé dans des machines virtuelles seulement, jamais sur un vrai Raspberry Pi 5. Le détail de chaque étape et les limites sont dans [hakos/README.md](hakos/README.md#installer).


## Licence

Le code de ce dépôt, celui du site ([site/](site/)) comme celui de HakOS ([hakos/](hakos/)), est sous licence GNU GPL version 3 ou ultérieure : voir [LICENSE](LICENSE). Le nom HAKO, le logo, la marque en kanji 箱, les textes, les photos, les portraits et les dessins restent réservés : voir [NOTICE](NOTICE). Les polices gardent leur licence (SIL Open Font License 1.1), Immich et Nextcloud la leur (GNU AGPL v3).
