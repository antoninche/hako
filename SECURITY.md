# Politique de sécurité

Notre promesse repose sur un point : vos photos et vos fichiers restent chez vous. Si vous trouvez une faille dans ce dépôt, dans le site ou dans HakOS, le système de la box, merci de nous la signaler en privé.

## Ce qui est concerné

| Partie             | Dossier                | Version suivie                                                                                   |
| ------------------ | ---------------------- | ------------------------------------------------------------------------------------------------ |
| Le site            | [site/](site/)         | celle en ligne sur https://antoninche.github.io/hako/                                            |
| La page de la HAKO | [site/box/](site/box/) | celle copiée dans HakOS (`HAKO_SITE_COMMIT` de [hakos/versions.env](hakos/versions.env))         |
| HakOS              | [hakos/](hakos/)       | la dernière release, [HakOS 1.0.0](https://github.com/antoninche/hako/releases/tag/hakos-v1.0.0) |

Immich et Nextcloud, livrés dans la box, ont leurs propres politiques : une faille dans l'une de ces applications se signale à son projet.

## Comment faire

Le plus simple : le signalement privé de GitHub.

1. Ouvrez l'onglet **Security** du dépôt.
2. Cliquez sur **Report a vulnerability** (ou ouvrez directement https://github.com/antoninche/hako/security/advisories/new).
3. Décrivez ce que vous avez trouvé, comment le reproduire et ce qu'un attaquant pourrait en faire.

Vous pouvez aussi nous écrire à [antonin.chenavaz@etu.univ-amu.fr](mailto:antonin.chenavaz@etu.univ-amu.fr), avec « Sécurité » dans l'objet.

N'ouvrez pas d'issue publique pour une faille : elle serait visible de tous avant d'être corrigée. N'envoyez jamais de mot de passe, ni de fiche d'installation, ni de photo d'une famille.

## Ce que nous faisons ensuite

Nous accusons réception, nous vérifions le problème, puis nous vous disons comment et quand nous le corrigeons. Si vous le souhaitez, nous vous citons dans les notes de la correction.
