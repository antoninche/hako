# Essais du lot 5 (phase 1)

Ces scripts prouvent, dans la VM Colima et avec les images figées, les opérations à risque de
l'assistant de première installation. Ce n'est pas du code de production : la conception et les
résultats sont dans `docs/lot5-assistant.md`.

| Fichier | Rôle |
|---|---|
| `preparer.sh` | Copie les services de la box (accueil, Immich, Nextcloud) dans `/opt/hakos-lot5-essai` de la VM, tire les secrets, lance `docker compose up -d --wait` ; `nettoyer` défait tout. |
| `essai.py` | Outils communs : mots de passe d'essai (4 mots et un nombre, liste d'essai de 32 mots), appels HTTP, bilan. |
| `a_immich.py` | Essai a : administratrice et deuxième personne créées par l'API d'Immich, inscription refermée ensuite. |
| `b_nextcloud.py` | Essai b : Nextcloud installé sans navigateur, `occ user:add --password-from-env`, compte technique supprimé. |
| `c-parefeu.sh`, `hakos-parefeu.nft`, `sonde.py` | Essai c : ports 2283 et 8080 fermés par nftables à un voisin simulé (IPv4 et IPv6) pendant que le port 80 répond, puis ouverts. |

Lancer depuis le Mac, Colima démarré, dans cet ordre :

```sh
S=~/Code/mabox-os-lot5/spikes
colima ssh -- sudo "$S/preparer.sh" demarrer
colima ssh -- python3 "$S/a_immich.py"
colima ssh -- sudo python3 "$S/b_nextcloud.py"
colima ssh -- sudo "$S/c-parefeu.sh"
colima ssh -- sudo "$S/preparer.sh" nettoyer
colima stop
```

Chaque essai finit par « Bilan : N contrôles réussis, 0 échec(s). ». Aucun mot de passe, jeton
ni secret n'est affiché ; les mots de passe ne vivent que dans la mémoire de l'essai.
