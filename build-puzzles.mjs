// Construit un sous-ensemble statique de la base Lichess pour l'app.
//
// Entrée  : lichess_db_puzzle.csv (6 M de lignes, 1,1 Go)
// Sortie  : ~/dev/echiquier/puzzles/index.json + band-<lo>.json
//
// On échantillonne par tranche de rating avec un réservoir (échantillon
// uniforme sans tout garder en mémoire), en privilégiant les puzzles bien
// joués et bien notés. Le tirage est déterministe : même CSV = même sortie.
import { createReadStream } from 'node:fs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const SRC = '/Users/sabrinalargot/dev/puzzle-data/lichess_db_puzzle.csv';
const OUT = '/Users/sabrinalargot/dev/echiquier/puzzles';

const BANDS = [
  [400, 799], [800, 999], [1000, 1199], [1200, 1399], [1400, 1599],
  [1600, 1799], [1800, 1999], [2000, 2199], [2200, 2399], [2400, 2599],
  [2600, 3400],
];
const PER_BAND = 12000;

// Un puzzle "de qualité" a été joué assez souvent et bien reçu (popularité
// Lichess = score de -100 à 100). Le filtre souple sert à compléter les
// tranches hautes, plus clairsemées.
const STRICT = (plays, pop) => plays >= 50 && pop >= 90;
const LOOSE = (plays, pop) => plays >= 10 && pop >= 70;

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const themeIds = new Map();
function themeIdx(name) {
  let i = themeIds.get(name);
  if (i === undefined) { i = themeIds.size; themeIds.set(name, i); }
  return i;
}

function bandOf(rating) {
  for (let i = 0; i < BANDS.length; i++) {
    if (rating >= BANDS[i][0] && rating <= BANDS[i][1]) return i;
  }
  return -1;
}

// Un réservoir par tranche et par niveau de filtre.
const strictRes = BANDS.map(() => ({ items: [], seen: 0, rng: null }));
const looseRes = BANDS.map(() => ({ items: [], seen: 0, rng: null }));
BANDS.forEach((_, i) => {
  strictRes[i].rng = mulberry32(0x51ed + i * 7919);
  looseRes[i].rng = mulberry32(0x9e37 + i * 6271);
});

function offer(res, row) {
  res.seen++;
  if (res.items.length < PER_BAND) { res.items.push(row); return; }
  const j = Math.floor(res.rng() * res.seen);
  if (j < PER_BAND) res.items[j] = row;
}

let total = 0, kept = 0, malformed = 0;

const rl = createInterface({
  input: createReadStream(SRC, { highWaterMark: 1 << 20 }),
  crlfDelay: Infinity,
});

let first = true;
for await (const line of rl) {
  if (first) { first = false; continue; }   // en-tête
  if (!line) continue;
  total++;

  // Aucune colonne du dump ne contient de virgule : split simple suffit.
  const c = line.split(',');
  if (c.length < 8) { malformed++; continue; }

  const rating = +c[3];
  const b = bandOf(rating);
  if (b < 0) continue;

  const plays = +c[6];
  const pop = +c[5];
  const strict = STRICT(plays, pop);
  if (!strict && !LOOSE(plays, pop)) continue;

  const moves = c[2];
  // Lichess donne d'abord le coup de l'adversaire qui amène à la position :
  // il en faut au moins deux (le coup d'amorce + la réponse du joueur).
  if (moves.split(' ').length < 2) { malformed++; continue; }

  const row = [c[0], c[1], moves, rating, c[7].split(' ').filter(Boolean).map(themeIdx)];
  offer(strict ? strictRes[b] : looseRes[b], row);
  kept++;
}

mkdirSync(OUT, { recursive: true });

const bands = [];
for (let i = 0; i < BANDS.length; i++) {
  const [lo, hi] = BANDS[i];
  let items = strictRes[i].items;
  if (items.length < PER_BAND) {
    // Tranche trop clairsemée avec le filtre strict : on complète avec le souple.
    const need = PER_BAND - items.length;
    items = items.concat(looseRes[i].items.slice(0, need));
  }
  items.sort((a, b2) => a[3] - b2[3] || (a[0] < b2[0] ? -1 : 1));

  const file = `band-${lo}.json`;
  writeFileSync(`${OUT}/${file}`, JSON.stringify({ lo, hi, puzzles: items }));
  bands.push({ lo, hi, file, count: items.length });
  console.log(`  ${lo}-${hi}: ${items.length} puzzles (strict ${strictRes[i].items.length}, vus ${strictRes[i].seen})`);
}

const themes = [...themeIds.keys()];
writeFileSync(`${OUT}/index.json`, JSON.stringify({
  source: 'lichess_db_puzzle (CC0)',
  built: new Date().toISOString().slice(0, 10),
  themes,
  bands,
}));

console.log(`\nlignes lues: ${total}, retenues: ${kept}, ignorées: ${malformed}`);
console.log(`thèmes: ${themes.length}`);
console.log(`total exporté: ${bands.reduce((s, b) => s + b.count, 0)}`);
