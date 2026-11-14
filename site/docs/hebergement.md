# Hébergement

Le site est entièrement statique : `npm run build` produit le dossier `dist/`, fait de pages HTML, de feuilles de style, de scripts, d’images et de polices. Il n’a besoin ni de PHP ni de base de données, et n’importe quel hébergement qui sert des fichiers convient. L’hébergeur n’est pas encore choisi ; ce document prépare une mise en ligne chez un hébergeur mutualisé français sous Apache, le cas le plus courant, avec le fichier d’exemple [`docs/exemples/htaccess`](exemples/htaccess).

## Essayer le site comme en production

```sh
npm run build
npm run serve:prod
```

Le site s’ouvre sur http://localhost:8080/. `scripts/serve-prod.mjs` sert `dist/` avec les mêmes règles que l’exemple Apache : en-têtes de sécurité, durées de cache, compression, page 404 avec son code, redirection de `/offres` vers `/offres/`. Il accepte un autre dossier et quelques options :

```sh
npm run serve:prod -- .tmp/dist --port 4600   # autre dossier, autre port
npm run serve:prod -- --host 0.0.0.0          # ouvrir le site depuis un téléphone du même réseau
npm run serve:prod -- --cert cert.pem --key cle.pem   # en HTTPS, avec un certificat local
```

Deux contrôles s’appuient sur ce serveur. `npm run test:csp` ouvre chaque page à 390 et 1440 px et échoue à la moindre violation de la politique de sécurité, erreur dans la console ou requête en échec (`tests/csp.spec.ts`). Il vérifie le site que Playwright vient de construire, comme les autres tests. Si un serveur tourne déjà sur le port des tests (4321, celui de `npm run dev`), Playwright le réutilise sans reconstruire le site, et `test:csp` s’arrête avec un message : arrêter ce serveur, ou lancer `PW_PORT=4330 npm run test:csp`. `npm run lighthouse` mesure chaque page avec Lighthouse (voir la dernière partie).

## Ce qu’il faut envoyer

1. Activer HTTPS chez l’hébergeur (le certificat, souvent gratuit, s’active depuis l’espace client) et attendre que `https://exemple.fr/` et `https://www.exemple.fr/` s’ouvrent sans alerte de certificat ; `curl -sI https://exemple.fr/` doit répondre sans erreur. Avant cela, le `.htaccess` rendrait le site injoignable : il redirige toute adresse `http://` vers `https://`, les navigateurs retiennent cette redirection permanente, et sa politique de sécurité fait charger chaque fichier de la page en `https://`.
2. Inscrire l’adresse définitive dans le fichier `.env`, avec le vrai domaine : `SITE_URL=https://exemple.fr`. Chaque page indexable déclare alors son adresse complète (lien canonique) ; sans elle, les pages n’en déclarent aucune. Écrite dans `.env`, elle vaut pour chaque construction, y compris celle que lance `npm test` ; donnée devant une commande (`SITE_URL=https://exemple.fr npm run build`), elle ne vaut que pour celle-ci.
3. Vérifier le site : `npm test`.
4. Construire en dernier la version à envoyer : `npm run build`, puis `npm run check:dist`. `grep 'rel="canonical"' dist/index.html` doit afficher l’adresse définitive ; s’il n’affiche rien, l’adresse n’a pas été prise en compte. Un dernier coup d’œil avec `npm run serve:prod`, qui indique au démarrage l’adresse pour laquelle les pages ont été construites, ou prévient qu’elles n’en ont pas.
5. Envoyer le contenu de `dist/` (les fichiers qu’il contient, pas le dossier lui-même) dans le dossier public de l’hébergement, souvent nommé `www/` ou `public_html/`, par SFTP.
6. Placer à côté le fichier `.htaccess`, copie de `docs/exemples/htaccess`.

Rien d’autre ne part en ligne : ni `src/`, ni `node_modules/`, ni fichier `.env`. Une fois l’hébergeur choisi, le plus simple est de copier l’exemple dans `public/.htaccess` : Astro le recopie alors dans `dist/` à chaque construction, et il part avec le reste. Une fois ce fichier en place, le dossier en ligne peut être synchronisé avec `dist/` (fonction « synchroniser » du client SFTP, ou `rsync -av --delete dist/ compte@serveur:www/`), ce qui retire aussi les anciens fichiers de `_astro/`.

Si le site affiche une erreur 500 juste après l’envoi du `.htaccess`, l’hébergeur refuse l’une de ses directives ; son journal d’erreurs indique laquelle.

## Les en-têtes envoyés

Chaque réponse du site, erreurs et redirections comprises, porte les en-têtes ci-dessous. Ils sont identiques dans `scripts/serve-prod.mjs` et dans l’exemple Apache, et un test vérifie qu’ils le restent.

La politique de sécurité du contenu, ou CSP (Content-Security-Policy), dit au navigateur d’où une page a le droit de charger ses ressources. En production :

```text
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'; media-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
```

`'self'` désigne le site lui-même : scripts, styles, images, polices, requêtes des scripts (le modèle 3D), manifeste et médias ne peuvent venir que de lui. Une ressource venue d’un autre site serait bloquée par le navigateur, ce qui rend vérifiable la promesse « zéro requête vers un autre site ». La politique ne contient ni `'unsafe-inline'` ni `'unsafe-eval'` : aucun code écrit dans la page (balise `<script>` sans fichier, attribut `onclick`, attribut `style`) ni fabriqué à partir de texte (`eval`) ne s’exécute, ce qui protège de l’injection de code dans les pages (attaque dite XSS).

Les autres directives complètent la protection. `object-src 'none'` interdit les modules externes (`<object>`, `<embed>`). `base-uri 'self'` empêche une balise `<base>` de détourner les adresses relatives. `form-action 'self'` limite l’envoi des formulaires au site. `frame-ancestors 'none'` interdit à tout autre site d’afficher le nôtre dans un cadre, protection contre le « clickjacking » (un site piégé qui fait cliquer sur nos boutons à l’insu du visiteur). `upgrade-insecure-requests` fait charger en HTTPS une adresse restée en `http://` ; `serve-prod.mjs` ne l’envoie qu’en HTTPS, car sur `http://localhost` elle empêcherait le chargement des fichiers.

Le site n’a besoin ni d’empreintes (hashes) ni de jetons (nonces) dans la politique, parce qu’Astro ne met aucun script ni style dans les pages. Deux réglages de `astro.config.mjs` le garantissent et ne doivent jamais être retirés : `build.inlineStylesheets: 'never'`, qui garde les styles dans des fichiers, et `vite.build.assetsInlineLimit: 0`. Sans ce second réglage, Astro 7 recopierait dans la page tout script de moins de 4 Ko qui n’importe aucun autre module, comme celui du menu mobile (vérifié dans `node_modules/astro/dist/core/build/plugins/plugin-scripts.js`), et la politique le bloquerait. La fonction CSP intégrée à Astro (`security.csp`, qui écrit une politique avec empreintes dans une balise `<meta>`) reste désactivée : l’en-tête HTTP va plus loin, puisqu’une balise `<meta>` ne peut pas porter `frame-ancestors`.

`Permissions-Policy` coupe les fonctions du navigateur que le site n’utilise jamais : capteurs (accéléromètre, gyroscope, magnétomètre), caméra, micro, position, paiement, périphériques (USB, Bluetooth, port série, HID, MIDI, manettes), lecture du presse-papiers, identifiants et clés d’accès, lecture automatique des médias, centres d’intérêt publicitaires (`browsing-topics`), etc. Un nom de fonction inconnu du navigateur produit un avertissement dans la console : la liste ne garde que des noms reconnus par Chrome 157 et Chromium 158 (vérifié le 12 novembre 2026). `ambient-light-sensor`, `battery` et `document-domain`, inconnus des deux, et `web-share`, inconnu de Chromium, en sont absents. Si un espace client utilise un jour des clés d’accès (passkeys), il faudra retirer `publickey-credentials-create` et `publickey-credentials-get`.

`Referrer-Policy: same-origin` : quand un visiteur suit un lien vers un autre site, ce site ne reçoit pas l’adresse de la page d’où il vient. La même règle est aussi écrite dans chaque page (`<meta name="referrer" content="same-origin">`, dans `src/layouts/BaseLayout.astro`) : elle s’applique donc aussi chez un hébergeur qui n’envoie pas d’en-têtes, comme GitHub Pages pour l’aperçu. Avec `no-referrer`, plus strict, les envois de formulaire vers le site lui-même partiraient avec un en-tête `Origin` à `null`, ce qui ferait échouer les contrôles anti-falsification d’un futur serveur de commande.

`X-Content-Type-Options: nosniff` : le navigateur s’en tient au type de fichier annoncé et ne « devine » pas qu’un fichier est un script. `X-Frame-Options: DENY` produit le même effet que `frame-ancestors 'none'` pour les navigateurs anciens. `Cross-Origin-Opener-Policy: same-origin` : une page d’un autre site ouverte depuis le nôtre, ou qui ouvre le nôtre, ne peut pas agir sur sa fenêtre. `Cross-Origin-Resource-Policy: same-origin` : un autre site ne peut pas intégrer nos fichiers dans ses pages ; les aperçus de partage ne sont pas concernés, les réseaux sociaux récupèrent l’image depuis leurs serveurs.

Les fichiers de `/_astro/` portent une empreinte dans leur nom, qui change à chaque modification, et ceux de `/fonts/` ont des noms versionnés : le navigateur les garde un an sans redemander (`public, max-age=31536000, immutable`). Les pages sont gardées mais revérifiées à chaque visite (`no-cache`), pour que chacun voie la nouvelle version dès sa mise en ligne. Le manifeste, `robots.txt` et le plan du site sont gardés une heure, les autres fichiers (images, icônes, modèle 3D) un jour. Les fichiers texte sont compressés en brotli si l’hébergeur le propose, sinon en gzip ; les images et les polices WOFF2 le sont déjà.

L’exemple Apache désactive les ETag (`FileETag None`) : avec la compression, Apache 2.4 ajoute « -gzip » ou « -br » à l’ETag, ce qui empêche les réponses 304 (« pas modifié »), et ce réglage n’est pas modifiable depuis un `.htaccess` (documentation de `DeflateAlterETag`). La date de modification suffit à revalider les pages ; `serve-prod.mjs` fait de même.

## Ce qui casserait la politique

`npm run test:csp` le signale aussitôt, mais autant l’éviter en écrivant le code. Sont bloqués (vérifié dans Chrome 157 et Chromium 158) :

- un script écrit dans la page : `<script is:inline>`, `define:vars`, un attribut `onclick="…"`, du HTML inséré par `innerHTML` qui en contient ;
- un style écrit dans la page : attribut `style="…"`, balise `<style>` restée dans le HTML final, `element.setAttribute('style', …)`, balise `<style>` ajoutée par un script ; modifier `element.style.width` depuis un script reste permis ;
- un bloc de code dans une page Markdown ou MDX (entre trois accents graves) : la coloration syntaxique d’Astro, active par défaut (Shiki), écrit des attributs `style` dans la page. `markdown: { syntaxHighlight: false }` dans `astro.config.mjs` la coupe, MDX compris ; `syntaxHighlight: 'prism'` colore avec des classes, et demande alors une feuille de style dans `src/styles/`. Le composant `<Code />` d’Astro écrit toujours des attributs `style` (vérifié avec Astro 7.4.11) ;
- un SVG inséré dans la page (`set:html` ou composant SVG) qui contient des attributs `style` ou une balise `<style>` : utiliser les attributs `fill`, `stroke`, etc. ;
- une adresse `data:` (image, police, `url(data:…)` dans une feuille de style) ;
- `eval`, `new Function` et les bibliothèques qui s’en servent ;
- le composant `<Font />` d’Astro, qui écrit une balise `<style>` dans la page (les polices passent par `src/styles/fonts.css`) ;
- une intégration de framework (React, Preact, Svelte, Vue…) avec des composants `client:*`, pour laquelle Astro écrit un script et un style dans la page, ou le routeur `<ClientRouter />`, qui recrée les scripts de la page à chaque navigation ;
- toute ressource venue d’un autre site.

## La scène 3D

Three.js fonctionne avec cette politique : WebGL, le chargement du modèle `.glb` depuis le site, le dimensionnement du canevas par script et les modules chargés à la demande sont permis. Le modèle que produit `npm run model:optimize` (voir `docs/model-contract.md`) la garde telle quelle : sa géométrie est seulement quantifiée (`KHR_mesh_quantization`, que Three.js lit sans décodeur), le serveur compresse le fichier pendant le transfert, et le site lit les images intégrées au fichier sans adresse `blob:` (`src/scripts/scene-3d/glb.ts`). Vérifié avec Three.js 0.187 dans Chromium 158, sous la politique exacte de `serve-prod.mjs` : le vrai modèle s’affiche, sans violation ni message dans la console, et le décodeur n’est pas téléchargé.

Un seul cas demande d’élargir la politique : un modèle optimisé avec `npm run model:optimize -- --meshopt`, un peu plus léger. Sa géométrie compressée (extension `EXT_meshopt_compression`) se lit avec un décodeur en WebAssembly, que le site ne télécharge que pour un tel fichier, et que le navigateur ne compile qu’avec `'wasm-unsafe-eval'` dans `script-src`. Cette valeur autorise seulement la compilation de WebAssembly, jamais `eval` en JavaScript. Sans elle, le navigateur bloque le décodeur : le site affiche le modèle provisoire avec un avertissement dans la console, et `npm run test:csp` signale la violation. `npm run model:check` rappelle aussi ce besoin pour un tel fichier.

Si l’équipe choisit `--meshopt`, l’ajout se fait à l’identique à trois endroits, puis dans la liste du test :

1. `scripts/serve-prod.mjs`, dans la liste `CSP_DIRECTIVES` : `"script-src 'self' 'wasm-unsafe-eval'"` ;
2. `docs/exemples/htaccess`, dans la ligne `Header always set Content-Security-Policy` (et dans sa copie `public/.htaccess` si elle existe) : `script-src 'self' 'wasm-unsafe-eval';` ;
3. ce document, dans la politique citée plus haut (partie « Les en-têtes envoyés ») ;
4. `tests/csp.spec.ts`, dans la liste `ALLOWED_SOURCES` : `'script-src': ["'self'", "'wasm-unsafe-eval'"]`.

`npm run test:csp` vérifie que les trois premiers concordent ; la liste du test refuse toute autre source, pour que la politique ne puisse pas s’élargir par mégarde.

Le site n’utilise pas les autres décodeurs de Three.js. Draco (`DRACOLoader`) et les textures KTX2 (`KTX2Loader`) demanderaient aussi `'wasm-unsafe-eval'`, plus `worker-src 'self' blob:` pour leurs workers ; `npm run model:check` refuse un fichier qui les exige. Laissé à ses réglages par défaut, le chargeur de Three.js lirait les images intégrées par des adresses `blob:` (il faudrait `blob:` dans `connect-src` et `img-src`) : c’est pourquoi `glb.ts` les décode autrement. Un décodeur éventuel est servi par le site, jamais depuis l’adresse d’un CDN comme dans beaucoup d’exemples.

## Passer à notre nom de domaine

Pour l’instant, le site est publié sur GitHub Pages, dans le sous-dossier `/hako/` (https://antoninche.github.io/hako/). Une fois le nom de domaine acheté :

1. Dans les réglages Pages du dépôt sur GitHub, indiquer le nom de domaine, puis créer chez le registraire les enregistrements DNS donnés par la documentation de GitHub ; activer HTTPS dès que le certificat est prêt.
2. Dans `.github/workflows/apercu.yml`, mettre `SITE_URL` à l’adresse du domaine (par exemple `https://exemple.fr`) et retirer l’étape `scripts/deploy/sous-dossier.mjs` : le site est alors servi à la racine, tel qu’il est construit, et `robots.txt` devient utile.
3. Dans `src/data/entreprise.ts`, renseigner le nom de domaine et l’adresse e-mail sur ce domaine.
4. Si l’hébergeur change, mettre à jour les mentions légales et la politique de confidentialité (`src/content/legal/`).
5. Refaire les contrôles de la partie suivante.

## Après la mise en ligne

Avec le vrai domaine à la place de `exemple.fr` :

```sh
# En-têtes de la page d'accueil : chacun une seule fois, avec les valeurs ci-dessus.
curl -sI https://exemple.fr/

# Une seule redirection, directement vers https://exemple.fr/offres/.
curl -sI http://exemple.fr/offres
curl -sI https://exemple.fr/offres

# Adresse inconnue : code 404 et page du site.
curl -sI https://exemple.fr/cette-page-n-existe-pas/

# Pages compressées ; fichiers de /_astro/ gardés un an (nom à relever dans la page).
curl -sI -H 'Accept-Encoding: br, gzip' https://exemple.fr/
curl -sI https://exemple.fr/_astro/NOM-DU-FICHIER.css

# Fichiers cachés inaccessibles (404 ou 403).
curl -sI https://exemple.fr/.htaccess
```

Un en-tête présent deux fois signifie que l’hébergeur l’ajoute déjà de son côté. Il faut alors n’en garder qu’un : le navigateur applique chacune des deux politiques de sécurité, et deux valeurs d’un autre en-tête peuvent le rendre invalide. Ensuite, `npm run lighthouse -- --url https://exemple.fr` mesure le site en ligne, et la console du navigateur (outils de développement) ne doit afficher aucun message de refus lié à la politique de sécurité. Un service en ligne d’analyse des en-têtes de sécurité permet un dernier contrôle ; tant que HSTS n’est pas activé, il le signale comme manquant.

## Activer HSTS, une fois HTTPS en place

HSTS (en-tête `Strict-Transport-Security`) demande au navigateur de n’utiliser que HTTPS pour le site pendant une durée donnée, même si l’on tape `http://`. Cette protection ne se retire pas facilement : si HTTPS tombe en panne (certificat expiré, changement d’hébergeur), les visiteurs déjà venus ne peuvent plus ouvrir le site jusqu’à la fin de cette durée. On l’active donc seulement quand HTTPS fonctionne sur toutes les adresses du site, avec et sans `www`, et que le certificat se renouvelle tout seul :

1. dans `.htaccess`, retirer le `#` devant la ligne `max-age=300` (cinq minutes), puis vérifier avec `curl -sI` pendant quelques jours ;
2. remplacer cette ligne par celle en `max-age=31536000` (un an).

`includeSubDomains` ne s’ajoute que si tous les sous-domaines sont en HTTPS, et l’inscription sur la liste de préchargement des navigateurs (`preload`) est presque définitive. `serve-prod.mjs` n’envoie jamais cet en-tête : sur `localhost`, il forcerait HTTPS pour tous les ports de la machine.

## Si un vrai serveur ou le paiement arrive

Le formulaire de commande est pour l’instant une démonstration qui n’envoie rien. Le plus simple est un serveur de commande sur le même domaine, par exemple sous `/api/` : la politique ne change pas, `form-action 'self'` et `connect-src 'self'` couvrent déjà les envois vers le site. Sur un sous-domaine (`api.exemple.fr`), il faut l’ajouter à `connect-src` pour les envois par script (`fetch`), et à `form-action` pour l’envoi classique d’un formulaire. Ce second cas demande aussi de passer `Referrer-Policy` à `strict-origin-when-cross-origin`, aux trois mêmes endroits : avec `same-origin`, un formulaire envoyé de façon classique vers une autre adresse part avec un en-tête `Origin` à `null`, comme avec `no-referrer`, et les contrôles anti-falsification d’un serveur qui vérifie cette origine échouent. `strict-origin-when-cross-origin` transmet aux autres sites l’adresse du site, sans le chemin de la page. Les envois par script gardent leur en-tête `Origin` avec l’une comme avec l’autre (vérifié dans Chromium 158).

Pour le paiement en ligne, la solution qui touche le moins au site envoie le visiteur sur la page de paiement du prestataire, puis le fait revenir : il suffit d’ajouter l’adresse du prestataire à `form-action` si un formulaire y est envoyé, un simple lien n’étant pas concerné. Si ce prestataire vérifie l’en-tête `Origin`, la remarque sur `Referrer-Policy` vaut aussi. Un formulaire de carte intégré à notre page demande au contraire d’autoriser les scripts, les cadres (`frame-src`) et les requêtes du prestataire, et `payment` dans `Permissions-Policy`. Ce sont des requêtes vers un autre site : il faudrait les limiter à la page de commande (dans `.htaccess`, une politique propre à cette page s’écrit avec la condition `"expr=%{REQUEST_URI} =~ m#^/commander/#"`), les mentionner sur la page de confidentialité et adapter `tests/privacy.spec.ts`. Un serveur qui dépose un cookie de session rendrait aussi inexacte la phrase « zéro cookie » du pied de page.

## Garder « zéro requête vers un autre site »

Tout ce que les pages chargent vient du site : polices, images, scripts, modèle 3D et décodeurs, rangés dans `public/` ou `src/`. Trois contrôles le vérifient à chaque modification : `npm run check:dist` refuse toute adresse extérieure dans les fichiers construits, `tests/privacy.spec.ts` relève chaque requête du navigateur sur chaque page, et la politique de sécurité bloque dans le navigateur tout ce qui viendrait d’ailleurs (`tests/csp.spec.ts`).

Les liens vers d’autres sites (`<a href="https://…">`) restent permis : ce ne sont pas des requêtes, le visiteur choisit de les suivre, et `Referrer-Policy` évite d’indiquer au site d’arrivée la page d’où il vient. Les pièges habituels : une vidéo YouTube ou PeerTube intégrée (mettre un lien à la place), une carte en ligne (utiliser une image ou un SVG du site), une police chargée chez Google, une bibliothèque chargée depuis un CDN, un bouton de partage, une mesure d’audience, un avatar Gravatar, une balise `preconnect` ou `dns-prefetch`, et les exemples de code qui pointent vers un CDN, comme les décodeurs Draco de Three.js.

## Mesurer avec Lighthouse

```sh
npm run build
npm run lighthouse                                # toutes les pages indexables de dist/, sur téléphone
npm run lighthouse -- --preset desktop            # les mêmes, sur ordinateur
npm run lighthouse -- --runs 3                    # trois mesures par page, la médiane est gardée
npm run lighthouse -- --routes /,/offres/         # quelques pages seulement
npm run lighthouse -- --not-found /cette-page-n-existe-pas/   # en plus, la page 404
npm run lighthouse -- --strict                    # échoue si une page passe sous un objectif
npm run lighthouse -- --url https://exemple.fr    # le site en ligne
```

Le script sert `dist/` avec `serve-prod.mjs`, lance Google Chrome sans interface (ou celui de la variable `CHROME_PATH`, à défaut le Chromium de Playwright) et mesure chaque page avec les réglages mobiles par défaut de Lighthouse : téléphone, réseau 4G lente et processeur ralenti simulés. Avec `--preset desktop`, il prend les réglages « ordinateur » de Lighthouse (grand écran, réseau rapide, processeur non ralenti). Une mesure d’échauffement, non comptée, passe d’abord : la toute première mesure d’un navigateur qui vient de démarrer est souvent faussée. Le tableau affiché donne pour chaque page les notes Performance, Accessibilité, Bonnes pratiques et SEO, le LCP (temps d’affichage du plus grand élément), le CLS (décalages de mise en page), le TBT (temps pendant lequel la page ne répond pas) et le poids des scripts reçus pendant la mesure, puis la médiane. Les rapports détaillés, en français, vont dans `qa/lighthouse/` (`qa/lighthouse/ordinateur/` avec `--preset desktop`) : `<page>.html`, `<page>.json`, et un résumé `resume.md`.

Les objectifs sont 85 en Performance, 95 en Accessibilité, 95 en Bonnes pratiques et 95 en SEO ; avec `--strict`, le script échoue si une seule page passe en dessous. Les pages marquées `noindex`, comme la charte graphique, sont écartées par défaut, car Lighthouse leur retire l’essentiel des points SEO ; on peut les mesurer en les nommant dans `--routes`. La page 404 se mesure à une adresse inconnue avec `--not-found`, qui fait accepter à Lighthouse le code 404 : elle perd elle aussi ses points SEO (`noindex`, code 404), et quatre points de Bonnes pratiques, car le navigateur inscrit ce code 404 dans la console. Les notes mesurées sur un poste dépendent de sa vitesse (le script affiche l’indice que calcule Lighthouse) ; les chiffres qui comptent sont ceux du site en ligne.
