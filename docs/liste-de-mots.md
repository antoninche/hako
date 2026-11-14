# Provenance de mots.txt

- Source : liste française du paquet diceware, celle que Tails utilise pour suggérer la phrase de passe du stockage persistant (dépôt tails/tails, branche stable, `tps_frontend/views/passphrase_view.py`, entrée `"fr": "fr"`, commit bf1147a5 du 8 mai 2025, ticket #20729).
- Fichier : https://raw.githubusercontent.com/ulif/diceware/8069e00d986b77823cde2394f7f5aba03aa850f4/diceware/wordlists/wordlist_fr.txt (commit 8069e00d du 26 novembre 2024, liste de Tango, inchangée sur master au 14 novembre 2026). Téléchargé le 14 novembre 2026. SHA-256 : 48014d49bbe0691fc82f0b6121f5e50db74b49501403571f80bd7b6e9fbbe022
- Licence : CC0 1.0, déclarée dans le fichier COPYRIGHT du même commit : « Files: diceware/wordlists/wordlist_fr.txt » puis « License: CC0-1.0 ». La liste réduite peut donc être diffusée sous CC0 1.0.
- Contenu réel de la source : 7 776 mots (et non 8 192), de 4 à 8 lettres, sans accent, aucun mot commençant par « s ». La variante à 8 192 mots n'est pas dans Tails et n'a pas été utilisée.
- Outil de filtrage seulement : Lexique 3.83 (CC BY-SA 4.0), https://www.lexique.org/databases/Lexique383/Lexique383.tsv, SHA-256 637ba37a767a66679c48371d673ece50cbf541b49a4e40e598963d4f3fbce52b. Ses fréquences, catégories et transcriptions ont servi au tri ; aucune donnée de Lexique n'est reprise dans mots.txt.

## Étapes (mots restants)
1. Liste source : 7 776
2. Format `^[a-z]{4,8}$`, sans doublon (retire « Internet ») : 7 775
3. Retrait de « exemple » : 7 774
4. Graphie présente dans Lexique (retire mots rares, techniques ou désaccentués) : 7 398
5. Nom, adjectif, adverbe, infinitif ou participe ; autres formes conjuguées retirées (abonna, aime) : 6 594
6. Sans homophone gênant à l'oral (vert/verre, aller/allée, joli/jolie) : 5 901
7. Sans lecture accentuée plus fréquente (foret/forêt, tache/tâche) : 5 888
8. Graphie simple, sans allure étrangère (ph, th, rh, y = i, k, w, oe, mn, um, p muet, ch = k) : 5 570
9. Relecture des thèmes, 986 retraits (violence ou sexualité 181, médical 158, triste ou morbide 154, religion ou politique 116, nom propre, marque ou nationalité 112, graphie difficile 90, insulte ou vulgarité 58, allure étrangère 57, homophone ou variante repéré à la main 31, mot grammatical 28, nom d'outil 1) : 4 584
10. Les 4 096 plus fréquents (moyenne films et livres de Lexique, seuil 0,23 occurrence par million) : 4 096

## Règles
- Les mots accentués ne sont jamais désaccentués : un mot dont la bonne orthographe porte un accent est retiré.
- Homophone gênant : autre graphie de même prononciation, d'un autre lemme, à au moins 1 occurrence par million et au moins 1/20 de la fréquence du mot (toujours gênante dès 5 par million). La forme de citation (chat, joli, chanter) est considérée comme la graphie spontanée face à ses propres flexions. É/è et o ouvert/fermé sont confondus hors dernière syllabe, ainsi que un/in.

## Résultat
- mots.txt : 4 096 lignes, un mot par ligne, UTF-8 (ASCII), fin de ligne LF, tri croissant, sans en-tête.
- SHA-256 de mots.txt : e8f7f22d02ec9e1d5b0cdd113898e804e6e1f9072daab976cbfcfe845b4df7ee
- Avec 4 mots et un nombre de 10 à 99 : 4 × 12 bits + log2(90) ≈ 54,5 bits.
- Un mot proche du nom d'un outil logiciel a été retiré et remplacé par le suivant (« embuer »), pour éviter toute confusion.
- Reste à faire : relecture humaine complète de la liste par deux personnes (non faite à ce jour).
