#!/usr/bin/env node
/**
 * HakOS : la page de la HAKO dans un vrai navigateur (Chromium sans écran), contre une box NEUVE
 * (VM Colima après « scripts/essai-vm.sh installer », port 80 redirigé vers le Mac par Colima).
 * Elle crée les comptes de deux personnes d'essai.
 *
 *   node scripts/essai-page.mjs [http://127.0.0.1] [DOSSIER_DU_SITE]
 *
 * Playwright vient du dossier site/ de antoninche/hako (ses node_modules, après « npm ci ») ;
 * par défaut, ../../site à partir de ce script. Parcours :
 *  1. appareil A : prénoms, mots de passe affichés, puis page fermée avant la création ;
 *  2. appareil B : « installation en cours » ; « Recommencer » refusé tant que A n'a pas
 *     dépassé 2 minutes sans signe de vie, puis accepté : nouveaux mots de passe ;
 *  3. appareil C : la fiche (mot de passe de la responsable) lui donne la main ; signe de vie
 *     toutes les 30 s ; « Créer les comptes » jusqu'à « C'est prêt » ;
 *  4. la page rouverte est l'accueil ; la responsable se connecte à Immich (port 2283).
 * Ni violation de CSP, ni erreur, ni requête ailleurs que sur la box. Aucun mot de passe affiché.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.argv[2] ?? 'http://127.0.0.1';
const SITE =
  process.argv[3] ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'site');
const { chromium } = createRequire(path.join(SITE, 'package.json'))('playwright');

let reussis = 0;
let echecs = 0;
const verifier = (condition, libelle) => {
  if (condition) reussis += 1;
  else echecs += 1;
  console.log(`${condition ? 'OK    ' : 'ÉCHEC '} ${libelle}`);
  return condition;
};

const bouton = (page, nom) => page.getByRole('button', { name: nom, exact: true });
const titre = (page, slug) => page.locator(`#ecran-${slug}-titre`);
const visible = async (locator, delai = 15_000) => {
  try {
    await locator.waitFor({ state: 'visible', timeout: delai });
    return true;
  } catch {
    return false;
  }
};

/** Un appareil : son propre contexte (ni cookie ni mémoire partagés), ses problèmes notés. */
async function appareil(navigateur) {
  const contexte = await navigateur.newContext({ locale: 'fr-FR' });
  const page = await contexte.newPage();
  const problemes = [];
  const requetes = [];
  page.on('pageerror', (erreur) => problemes.push(erreur.message));
  page.on('console', (message) => {
    // Chromium note chaque réponse refusée (409 busy…) : ce sont des réponses prévues du contrat.
    const texte = message.text();
    if (message.type() === 'error' && !/^Failed to load resource: the server responded with a status of (401|409|423) /u.test(texte)) {
      problemes.push(texte);
    }
  });
  page.on('request', (requete) => requetes.push(requete));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      console.error(`CSP ${e.effectiveDirective} ${e.blockedURI}`);
    });
  });
  await page.goto(`${BASE}/`);
  return { contexte, page, problemes, requetes };
}

async function prenoms(page, liste) {
  await bouton(page, 'Commencer').click();
  for (const [rang, prenom] of liste.entries()) {
    if (rang > 0) await bouton(page, 'Ajouter une personne').click();
    await page.locator('[data-person-input]').nth(rang).fill(prenom);
  }
  await bouton(page, 'Continuer').click();
}

const motsAffiches = (page) => page.locator('[data-accounts] [data-password]').allTextContents();

async function main() {
  const navigateur = await chromium.launch();
  const ailleurs = [];
  try {
    // 1. Appareil A, fermé avant la création.
    const a = await appareil(navigateur);
    verifier(
      await visible(a.page.locator('[data-assistant][data-ready="true"]')),
      'page de la HAKO chargée (A)',
    );
    await prenoms(a.page, ['Hélène', 'Marc']);
    await visible(titre(a.page, 'mots-de-passe'));
    const motsA = await motsAffiches(a.page);
    verifier(
      motsA.length === 2 && motsA.every((m) => /^[a-z]+(?:-[a-z]+){3}-[1-9][0-9]$/u.test(m)),
      'A : deux mots de passe affichés, au format de la box',
    );
    verifier(a.problemes.length === 0, `A : ni erreur ni violation de CSP (${a.problemes.length})`);
    ailleurs.push(...a.requetes.map((r) => r.url()).filter((u) => !u.startsWith(BASE)));
    await a.contexte.close();
    const fermeture = Date.now();

    // 2. Appareil B : en cours ailleurs ; « Recommencer » refusé, puis accepté après 2 minutes.
    const b = await appareil(navigateur);
    verifier(await visible(titre(b.page, 'installation-en-cours')), 'B : « installation en cours »');
    verifier((await motsAffiches(b.page)).length === 0, 'B : aucun mot de passe réaffiché');
    await b.page.locator('[data-resume-restart]').click();
    await b.page.locator('[data-person-input]').first().fill('Hélène');
    await bouton(b.page, 'Continuer').click();
    verifier(
      await visible(b.page.locator('[data-resume-refused]')),
      'B : « Recommencer » refusé tant que A a la main',
    );
    const attente = 125_000 - (Date.now() - fermeture);
    if (attente > 0) await new Promise((r) => setTimeout(r, attente));
    await b.page.locator('[data-resume-restart]').click();
    await b.page.locator('[data-person-input]').first().fill('Hélène');
    await bouton(b.page, 'Ajouter une personne').click();
    await b.page.locator('[data-person-input]').nth(1).fill('Marc');
    await bouton(b.page, 'Continuer').click();
    verifier(await visible(titre(b.page, 'mots-de-passe')), 'B : 2 minutes après la fermeture de A, recommencer est accepté');
    const motsB = await motsAffiches(b.page);
    verifier(
      motsB.length === 2 && !motsB.some((m) => motsA.includes(m)),
      'B : nouveaux mots de passe pour tout le monde',
    );

    // 3. Appareil C : la fiche donne la main ; signes de vie ; création.
    const c = await appareil(navigateur);
    verifier(await visible(titre(c.page, 'installation-en-cours')), 'C : « installation en cours »');
    await c.page.locator('[data-resume-input]').fill(motsA[0] ?? 'x');
    await c.page.locator('[data-resume-submit]').click();
    verifier(await visible(c.page.locator('[data-resume-error]')), 'C : l’ancienne fiche ne vaut plus');
    await c.page.locator('[data-resume-input]').fill(motsB[0] ?? 'x');
    await c.page.locator('[data-resume-submit]').click();
    verifier(await visible(c.page.locator('[data-resume-success]')), 'C : la fiche de la responsable donne la main');
    const avant = c.requetes.length;
    await new Promise((r) => setTimeout(r, 32_000));
    const signes = c.requetes
      .slice(avant)
      .filter((r) => r.url().endsWith('/api/installation/status') && r.headers()['x-hako-session']);
    verifier(signes.length >= 1, `C : signe de vie avec le jeton en 32 s (${signes.length} demande(s) d’état)`);
    const debut = Date.now();
    await c.page.locator('[data-resume-create]').click();
    verifier(await visible(titre(c.page, 'pret'), 120_000), `C : « C’est prêt » en ${((Date.now() - debut) / 1000).toFixed(1)} s`);
    verifier(
      c.problemes.length === 0 && b.problemes.length === 0,
      `B et C : ni erreur ni violation de CSP${[...b.problemes, ...c.problemes].map((t) => ` | ${t.slice(0, 120)}`).join('')}`,
    );
    for (const x of [b, c]) ailleurs.push(...x.requetes.map((r) => r.url()).filter((u) => !u.startsWith(BASE)));
    verifier(ailleurs.length === 0, `aucune requête ailleurs que sur la box (${ailleurs.length})`);

    // 4. Page rouverte : l'accueil ; connexion de la responsable à Immich.
    const d = await appareil(navigateur);
    verifier((await d.page.content()).includes('Mes photos'), 'page rouverte : l’accueil de la HAKO');
    const connexion = await fetch(`${BASE}:2283/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'helene@hako.local', password: motsB[0] }),
    });
    verifier(connexion.status === 201, `Immich : la responsable se connecte avec le mot de passe de sa fiche (${connexion.status})`);
    await Promise.all([b, c, d].map((x) => x.contexte.close()));
  } finally {
    await navigateur.close();
  }
  console.log(`Bilan : ${reussis} contrôles réussis, ${echecs} échec(s).`);
  process.exitCode = echecs ? 1 : 0;
}

await main();
