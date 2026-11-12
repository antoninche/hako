// Vérification des positions des villes (option --verifier) : on interroge
// la source officielle, l'API Découpage administratif (geo.api.gouv.fr), et
// une source indépendante, Wikidata (propriété P625, coordonnées), puis on
// mesure les écarts avec les valeurs de src/data/zone.ts.

const EARTH_RADIUS_M = 6371008.8;
const RAD = Math.PI / 180;

/** Distance en mètres entre deux points [longitude, latitude] (formule de haversine). */
export function distanceM([lon1, lat1], [lon2, lat2]) {
  const dLat = (lat2 - lat1) * RAD;
  const dLon = (lon2 - lon1) * RAD;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// Les services publics demandent un nom de client lisible ; il reste générique.
const HEADERS = { 'User-Agent': 'zone-map-check/1.0', Accept: 'application/json' };

async function getJson(url, init = {}) {
  const response = await fetch(url, { ...init, headers: { ...HEADERS, ...init.headers } });
  if (!response.ok) throw new Error(`Réponse ${response.status} pour ${url}`);
  return response.json();
}

async function officialPositions(cities) {
  const result = new Map();
  for (const city of cities) {
    const data = await getJson(
      `https://geo.api.gouv.fr/communes/${city.inseeCode}?fields=nom,centre,mairie`,
    );
    result.set(city.inseeCode, {
      name: data.nom,
      centre: data.centre.coordinates,
      mairie: data.mairie?.coordinates,
    });
  }
  return result;
}

async function wikidataPositions(cities) {
  const codes = cities.map((c) => `"${c.inseeCode}"`).join(' ');
  const query = `SELECT ?item ?insee ?coord WHERE { VALUES ?insee { ${codes} } ?item wdt:P374 ?insee ; wdt:P625 ?coord . }`;
  const data = await getJson(
    `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}`,
    { headers: { Accept: 'application/sparql-results+json' } },
  );
  const result = new Map();
  for (const row of data.results.bindings) {
    const match = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(row.coord.value);
    if (!match) continue;
    result.set(row.insee.value, {
      item: row.item.value.replace('http://www.wikidata.org/entity/', ''),
      point: [Number(match[1]), Number(match[2])],
    });
  }
  return result;
}

/**
 * Compare les positions de zone.ts aux deux sources et affiche un tableau.
 * @returns {Promise<boolean>} vrai si chaque ville est à moins de `toleranceM` de sa mairie officielle
 */
export async function verifyCities(cities, { toleranceM = 50, log = console.log } = {}) {
  const [official, wikidata] = await Promise.all([
    officialPositions(cities),
    wikidataPositions(cities),
  ]);
  let ok = true;
  const m = (value) => `${Math.round(value)} m`;
  const rows = [];
  for (const city of cities) {
    const used = [city.longitude, city.latitude];
    const o = official.get(city.inseeCode);
    const w = wikidata.get(city.inseeCode);
    const toMairie = o?.mairie ? distanceM(used, o.mairie) : NaN;
    if (!(toMairie <= toleranceM)) ok = false;
    rows.push({
      ville: city.name,
      'zone.ts': `${city.latitude}, ${city.longitude}`,
      'mairie (API)': o?.mairie ? `${o.mairie[1]}, ${o.mairie[0]}` : 'absente',
      'écart mairie': m(toMairie),
      'centre (API)': `${o.centre[1]}, ${o.centre[0]}`,
      'écart centre': m(distanceM(used, o.centre)),
      Wikidata: w ? `${w.item} ${w.point[1].toFixed(5)}, ${w.point[0].toFixed(5)}` : 'absente',
      'écart Wikidata': w ? m(distanceM(used, w.point)) : '—',
    });
  }
  log('Positions (latitude, longitude) et écarts avec src/data/zone.ts :');
  console.table(rows);
  return ok;
}
