/*
 * Page d'état de la HAKO (http://hako.local) : liens des applications par leur nom, et état de la
 * box lu chaque minute dans /api/etat (JSON écrit par le service hakos-etat, sans aucun secret).
 * Ne parle qu'à la box (politique de contenu : connect-src 'self').
 */
'use strict';

const $ = (id) => document.getElementById(id);
const nombre = new Intl.NumberFormat('fr-FR');
const ESPACE = ' ';

// hako.local → hako-photos.local ; hako-2.local → hako-2-photos.local. Ouverte par l'adresse IP,
// la page garde /photos et /fichiers, que nginx renvoie vers les ports de secours.
function liensDesApplications() {
	const trouve = /^(hako(?:-[0-9]+)?)(?:\.local)?$/.exec(location.hostname);
	if (trouve) {
		$('lien-photos').href = `http://${trouve[1]}-photos.local/`;
		$('lien-fichiers').href = `http://${trouve[1]}-fichiers.local/`;
	}
}

// Octets en Go ou To décimaux, comme sur l'emballage des disques.
function taille(octets) {
	if (octets >= 1e12) {
		const to = octets / 1e12;
		return `${nombre.format(Math.round(to * 10) / 10)}${ESPACE}To`;
	}
	return `${nombre.format(Math.round(octets / 1e9))}${ESPACE}Go`;
}

function duree(secondes) {
	const jours = Math.floor(secondes / 86400);
	if (jours >= 1) return `${nombre.format(jours)}${ESPACE}jour${jours > 1 ? 's' : ''}`;
	const heures = Math.floor(secondes / 3600);
	if (heures >= 1) return `${heures}${ESPACE}heure${heures > 1 ? 's' : ''}`;
	const minutes = Math.max(1, Math.floor(secondes / 60));
	return `${minutes}${ESPACE}minute${minutes > 1 ? 's' : ''}`;
}

function quand(age) {
	if (age < 90) return 'Vérifié à l’instant.';
	return `Vérifié il y a ${duree(age)}.`;
}

function montrer(id, visible) {
	$(id).hidden = !visible;
}

function etatGeneral(niveau, texte) {
	$('etat-point').className = `dot${niveau === 'ok' ? '' : niveau === 'bad' ? ' bad' : niveau === 'attente' ? ' attente' : ' warn'}`;
	$('etat-texte').textContent = texte;
}

function afficher(etat, age) {
	const problemes = [];

	const disque = etat.disque;
	let presquePlein = false;
	if (disque && disque.total > 0) {
		const part = disque.utilise / disque.total;
		presquePlein = part >= 0.9;
		$('disque').textContent = `${taille(disque.utilise)} sur ${taille(disque.total)}`;
		$('disque-barre').style.width = `${Math.min(100, Math.round(part * 100))}%`;
		$('disque-barre').className = presquePlein ? 'warn' : '';
	} else {
		$('disque').textContent = '—';
	}
	montrer('note-disque', presquePlein);
	if (presquePlein) problemes.push(['warn', 'Presque plus de place.']);

	$('photos').textContent = Number.isInteger(etat.photos) ? nombre.format(etat.photos) : '—';
	$('allumee').textContent = Number.isInteger(etat.allumee_depuis) ? duree(etat.allumee_depuis) : '—';

	const t = etat.temperature;
	const r = etat.ralentissement || {};
	if (typeof t === 'number') {
		$('temperature').textContent = t >= 80 || r.chaleur ? 'Trop chaude' : t >= 70 ? 'Chaude' : 'Normale';
		$('temperature-detail').textContent = `${nombre.format(Math.round(t))}${ESPACE}°C`;
	} else {
		$('temperature').textContent = '—';
		$('temperature-detail').textContent = 'Pas de mesure';
	}
	montrer('note-chaleur', Boolean(r.chaleur_depuis_demarrage));
	montrer('note-alimentation', Boolean(r.alimentation_depuis_demarrage));
	if (r.chaleur || t >= 80) problemes.push(['warn', 'La HAKO a trop chaud.']);
	if (r.alimentation) problemes.push(['warn', 'L’alimentation est trop faible.']);

	const apps = etat.applications || {};
	const enPanne = [];
	if (apps.photos === 'panne') enPanne.push('les photos');
	if (apps.fichiers === 'panne') enPanne.push('les fichiers');
	const demarrage = apps.photos === 'demarrage' || apps.fichiers === 'demarrage';
	if (enPanne.length) {
		const quoi = enPanne.join(' et ');
		$('note-applications').textContent = `${quoi[0].toUpperCase()}${quoi.slice(1)} ne répond${enPanne.length > 1 ? 'ent' : ''} pas. Débranchez la HAKO, attendez 10${ESPACE}secondes et rebranchez-la. Si cela continue, écrivez-nous.`;
		problemes.unshift(['bad', `${quoi[0].toUpperCase()}${quoi.slice(1)} ne répond${enPanne.length > 1 ? 'ent' : ''} pas.`]);
	} else if (demarrage) {
		problemes.push(['warn', 'La HAKO démarre, encore un instant.']);
	}
	montrer('note-applications', enPanne.length > 0);

	if (age > 300) problemes.push(['warn', 'L’état n’a pas été vérifié récemment.']);

	if (problemes.length) etatGeneral(problemes[0][0], problemes[0][1]);
	else etatGeneral('ok', 'Tout va bien.');
	$('etat-quand').textContent = quand(Math.max(0, age));

	$('pied').textContent = `HakOS${etat.version ? ` ${etat.version}` : ''} · http://${location.host}`;
}

async function lire() {
	try {
		const reponse = await fetch('/api/etat', { cache: 'no-store', headers: { Accept: 'application/json' } });
		if (!reponse.ok) throw new Error(String(reponse.status));
		const etat = await reponse.json();
		// L'heure de la box (en-tête Date) plutôt que celle de l'appareil, qui peut être fausse.
		const maintenant = Date.parse(reponse.headers.get('Date') || '') || Date.now();
		afficher(etat, Math.round(maintenant / 1000 - etat.verifie));
	} catch {
		etatGeneral('warn', 'État illisible pour le moment.');
		$('etat-quand').textContent = 'La HAKO vient peut-être de démarrer. Nouvel essai dans une minute.';
	}
}

liensDesApplications();
$('pied').textContent = `HakOS · http://${location.host}`;
lire();
setInterval(lire, 60_000);
