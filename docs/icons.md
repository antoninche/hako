# Icônes des réseaux sociaux

Les cinq icônes du pied de page sont dans `src/assets/icons/social/` : `linkedin.svg`, `youtube.svg`, `facebook.svg`, `instagram.svg` et `peertube.svg`. Le composant `Icon` les insère dans la page. Chaque fichier a le même format : un `viewBox` de 24 × 24, un seul tracé rempli avec `fill="currentColor"` (l’icône prend la couleur du texte), pas de titre ni de dimensions. Le nom du réseau est toujours écrit à côté de l’icône, qui reste donc ignorée par les lecteurs d’écran.

Les tracés sont recopiés caractère pour caractère depuis leur source officielle et rangés dans `scripts/logo/social.mjs`. `npm run logo:build` réécrit les cinq fichiers à partir de ce script et vérifie que chaque fichier livré se rend exactement comme le tracé d’origine (rapport dans `qa/logo/report.json`, rubrique `social`).

Vérifications faites le 12 novembre 2026.

## Sources et licences

| Icône     | Source                                       | Licence                                             | Mention                                      |
| --------- | -------------------------------------------- | --------------------------------------------------- | -------------------------------------------- |
| YouTube   | Simple Icons 16.37.0, `icons/youtube.svg`    | aucune déclarée : logo de la marque (voir plus bas) | aucune demandée ; règles de la marque        |
| Facebook  | Simple Icons 16.37.0, `icons/facebook.svg`   | aucune déclarée : logo de la marque (voir plus bas) | aucune demandée ; règles de la marque        |
| Instagram | Simple Icons 16.37.0, `icons/instagram.svg`  | aucune déclarée : logo de la marque (voir plus bas) | aucune demandée ; règles de la marque        |
| PeerTube  | Simple Icons 16.37.0, `icons/peertube.svg`   | CC BY-SA 4.0, logo de Framasoft                     | obligatoire : faite dans les crédits du site |
| LinkedIn  | Bootstrap Icons 1.13.2, `icons/linkedin.svg` | MIT, © 2019-2024 The Bootstrap Authors              | notice MIT : servie par le site              |

Simple Icons : dépôt officiel https://github.com/simple-icons/simple-icons, étiquette `16.37.0` (publiée le 8 novembre 2026, commit `9e2437ce2d46aa8054d8a00ac63370a44cf5e71a`, objet d’étiquette `939b93c3b1cb6c8ee04834c03676d9c79afdfc08`). C’est la dernière version publiée sur npm le jour de la vérification (`npm view simple-icons dist-tags` : `latest` = 16.37.0). Le paquet a été téléchargé avec `npm pack simple-icons@16.37.0`, sans être installé (intégrité `sha512-8mCJIhpMYOL9g13GW59EiL3sVXJnTEKGCTZFaekl9UQ3Qo0SwVjnLaJ82QiaH8BKBdouEDzrHMXIWh8cBIy48A==`). Les quatre fichiers utilisés et le fichier `LICENSE.md` du paquet sont identiques à ceux du dépôt à l’étiquette 16.37.0.

La licence du projet est CC0 1.0 Universal (https://github.com/simple-icons/simple-icons/blob/16.37.0/LICENSE.md). Cette licence couvre le projet, pas forcément chaque icône. Le fichier `DISCLAIMER.md` du même dépôt (https://github.com/simple-icons/simple-icons/blob/16.37.0/DISCLAIMER.md, relu le 12 novembre 2026) le dit : « Simple Icons is released under CC0 - though that doesn't mean to imply that all icons within the project are also CC0 », et « the absence of license data for a particular icon does not imply that the icon is not released under a license ». Pour YouTube, Facebook et Instagram, `data/simple-icons.json` ne donne aucune licence ; on ne peut donc pas conclure qu’elles sont sous CC0. Ces dessins sont les logos des marques eux-mêmes : on les utilise selon les règles publiées par chaque marque (voir « Marques » plus bas), dont `data/simple-icons.json` donne l’adresse : https://www.youtube.com/howyoutubeworks/resources/brand-resources/#logos-icons-and-colors pour YouTube, https://about.meta.com/brand/resources/facebook/logo pour Facebook, https://about.meta.com/brand/resources/instagram pour Instagram. Pour PeerTube, `data/simple-icons.json` indique `"license": { "type": "CC-BY-SA-4.0" }`, ce que confirme le dépôt de PeerTube (https://github.com/Chocobozzz/PeerTube#license) : « Logo : CC BY-SA 4.0, by Framasoft ». Le tracé de Simple Icons vient lui-même du fichier `client/src/assets/images/logo.svg` de PeerTube (demande d’intégration https://github.com/simple-icons/simple-icons/pull/4149).

LinkedIn n’est plus dans Simple Icons. Il a été retiré dans la version 14.0.0 (publiée le 22 décembre 2024, https://github.com/simple-icons/simple-icons/releases/tag/14.0.0, demande d’intégration #11380), à la suite du ticket https://github.com/simple-icons/simple-icons/issues/11372 : LinkedIn appartient à Microsoft, dont le service juridique avait déjà fait retirer les icônes de ses marques (ticket https://github.com/simple-icons/simple-icons/issues/11236), et les règles de la marque LinkedIn limitent l’usage de son logo. Les demandes d’ajout plus récentes sont refermées automatiquement avec un renvoi vers ces deux tickets.

L’icône LinkedIn vient donc de Bootstrap Icons : dépôt officiel https://github.com/twbs/icons, étiquette `v1.13.2` (publiée le 8 octobre 2026, commit `afbfcbcb9bea79ea9923fa9ef82ea03d7ee6c01f`), fichier https://github.com/twbs/icons/blob/v1.13.2/icons/linkedin.svg, licence MIT (https://github.com/twbs/icons/blob/v1.13.2/LICENSE). Son tracé est dessiné dans une grille de 16 × 16 : il est agrandi de 1,5 fois pour la grille de 24 × 24, sans autre changement (l’agrandissement est appliqué aux coordonnées par svgo, aucun attribut `transform` ne reste).

Modifications apportées à tous les fichiers : retrait du titre et des attributs `role`, `class`, `width` et `height`, couleur `currentColor`.

## Mentions à reproduire

Le logo PeerTube est sous licence CC BY-SA 4.0 : il faut citer son auteur, donner le lien de la licence et signaler les modifications. C’est fait dans la rubrique « Crédits » de la page des mentions légales (`/mentions-legales/`, textes dans `src/data/credits.ts`), liée depuis le pied de page de toutes les pages :

> Logo PeerTube : Framasoft, licence CC BY-SA 4.0 (lien vers https://creativecommons.org/licenses/by-sa/4.0/deed.fr). Modifications : version d’une seule couleur reprise de Simple Icons, couleur changée ; notre version reste sous la même licence.

Le fichier `src/assets/icons/social/peertube.svg` reste sous cette même licence CC BY-SA 4.0.

L’icône LinkedIn de Bootstrap Icons est sous licence MIT, qui demande de conserver la notice de copyright et le texte de la licence avec toute copie. Le fichier `LICENSE` du dépôt à l’étiquette v1.13.2 est servi tel quel par le site, à l’adresse `/licences/bootstrap-icons-LICENSE.txt` (fichier `public/licences/bootstrap-icons-LICENSE.txt`, identique octet pour octet à https://raw.githubusercontent.com/twbs/icons/v1.13.2/LICENSE, vérifié le 12 novembre 2026), et la rubrique « Crédits » des mentions légales y renvoie. Le voici :

```text
The MIT License (MIT)

Copyright (c) 2019-2024 The Bootstrap Authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

Sur le site, la rubrique « Crédits » écrit : « Icône LinkedIn : Bootstrap Icons, © 2019-2024 The Bootstrap Authors, licence MIT (lien vers le texte). Modifications : agrandie, couleur changée. »

Pour les icônes YouTube, Facebook et Instagram, aucune licence ne demande de mention ; la rubrique « Crédits » rappelle seulement que ces noms sont des marques de leurs propriétaires.

## Marques

Les licences ci-dessus portent sur le dessin des icônes, au titre du droit d’auteur. Elles ne donnent aucun droit sur les marques : la licence CC0 de Simple Icons le dit elle-même (article 4, alinéa 1 : aucun droit de marque n’est cédé). LinkedIn, YouTube, Facebook, Instagram et PeerTube restent les marques de leurs propriétaires.

Le site n’utilise ces logos que d’une façon : à côté du nom du réseau, comme simple lien vers le compte de HAKO sur ce réseau, sans laisser entendre un partenariat. Aucun script ni widget de ces réseaux n’est chargé.

Plusieurs marques encadrent la couleur de leur logo. Points relevés le 12 novembre 2026 sur leurs pages officielles :

- LinkedIn (https://brand.linkedin.com/in-logo et https://brand.linkedin.com/policies) autorise le logo [in] comme lien vers un profil ou une page d’entreprise, mais seulement en bleu, noir ou blanc, sans changer sa forme ni sa couleur, et seulement à partir des fichiers fournis sur son site ; pour une autre couleur, afin de l’accorder à une liste d’icônes sociales, il faut écrire à trademarkrequest@linkedin.com.
- Facebook (https://about.meta.com/brand/resources/facebook/logo/) demande de ne pas recolorer le logo aux couleurs d’une autre marque : bleu Facebook avec le « f » blanc, ou version blanche.
- Instagram (https://about.meta.com/brand/resources/instagram/instagram-brand/) admet qu’Instagram soit cité avec d’autres réseaux dans une liste du type « Suivez-nous sur ». La page lue sans JavaScript ne détaille pas les couleurs permises pour l’icône : point non vérifié.
- YouTube (https://www.youtube.com/howyoutubeworks/resources/brand-resources/) : la page ne s’affiche qu’avec JavaScript, ses règles n’ont pas pu être lues avec les outils utilisés ici. Point non vérifié.

Dans le pied de page chocolat, nos icônes ont la couleur du rôle `--text-muted`, soit lin #E6D5BF (`SocialLinks.astro`) ; sur la page `/charte/`, elles prennent la couleur du texte (chocolat). C’est l’usage courant pour une liste d’icônes sociales. Cela s’écarte toutefois des règles écrites de LinkedIn et de Facebook. Avant la mise en ligne, l’équipe choisit entre trois solutions : demander l’accord de LinkedIn pour la couleur, utiliser les fichiers officiels dans les couleurs permises (blanc sur le pied de page chocolat), ou n’afficher que le nom du réseau pour ces marques.

## Mettre à jour une icône

1. Récupérer le fichier sur le dépôt officiel, à une étiquette précise, et vérifier sa licence (pour Simple Icons, aussi l’entrée de l’icône dans `data/simple-icons.json`).
2. Recopier le tracé (attribut `d`) dans `scripts/logo/social.mjs`, avec la source et la version en commentaire.
3. Lancer `npm run logo:build` puis vérifier la rubrique `social` de `qa/logo/report.json` (`iouVsOriginalAt96px` doit valoir 1).
4. Mettre à jour le tableau de ce document et la date de vérification.
