import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiBase = String(process.env.TRAVELOS_DATA_API_URL || 'https://ai-test.kyuu2601.workers.dev/api').replace(/\/+$/, '');

const [manifestResponse, placesResponse] = await Promise.all([
  fetch(`${apiBase}/data-manifest`, { headers: { Accept: 'application/json' } }).catch(() => null),
  fetch(`${apiBase}/places?limit=5000`, { headers: { Accept: 'application/json' } })
]);

if (!placesResponse.ok) throw new Error(`Places snapshot failed: HTTP ${placesResponse.status}`);
const placesPayload = await placesResponse.json();
const places = Array.isArray(placesPayload) ? placesPayload : placesPayload.places;
if (!Array.isArray(places)) throw new Error('Places snapshot returned an invalid payload.');

let manifest = null;
if (manifestResponse?.ok) manifest = await manifestResponse.json().catch(() => null);
const newestUpdate = places.reduce((latest, place) => String(place.updated_at || '') > latest ? String(place.updated_at) : latest, '');
const version = String(manifest?.version || `${places.length}-${newestUpdate || 'bundled'}`);
const snapshot = { version, generatedAt: new Date().toISOString(), places };
const dataDir = path.join(root, 'data');

await mkdir(dataDir, { recursive: true });
await writeFile(path.join(dataDir, 'places.snapshot.json'), `${JSON.stringify(snapshot)}\n`);
console.log(`Saved ${places.length} places as snapshot version ${version}.`);

