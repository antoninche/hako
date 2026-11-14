<!--
  Une faille de sécurité ? N'ouvrez pas de demande de fusion publique :
  suivez la politique de sécurité (SECURITY.md), signalement privé ou e-mail.
-->

- Résout : # <!-- numéro de l'issue liée -->

## Résumé

<!-- Ce qui change, et pourquoi. -->

## Partie

- [ ] Site (`site/`)
- [ ] HakOS (`hakos/`)
- [ ] Racine du dépôt (`.github/`, licences, documentation)

## Vérifications

- [ ] Commits signés, messages en français
- [ ] Site : `npm run lint`, `npm run test:unit`, `npx playwright test`, `npm run build`, `npm run check:dist` (et `npm run build:box` si la page de la HAKO change)
- [ ] HakOS : `make -C hakos lint`
- [ ] Licences : `reuse lint`
- [ ] Captures avant et après, pour un changement visible
- [ ] Documentation et CHANGELOG (section « Non publié ») à jour
