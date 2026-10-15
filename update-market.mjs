// Saves a snapshot of PoE2 market prices from poe.ninja.
//   npm run update-market                 (into public/data/market: the copy shipped with the app)
//   node update-market.mjs --out <dir>    (used by the hourly job in the exile-planner-market repo)
// poe.ninja doesn't allow apps to call it straight from the browser and asks apps to cache through their own
// backend, so a scheduled GitHub job runs this hourly and publishes the result on GitHub Pages; the app reads
// that (Refresh prices) and falls back to the copy it ships with. The same file is used in both places.
// Prices are in Divine Orbs; `rates` converts to Exalted / Chaos Orbs.
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://poe.ninja/poe2/api/economy';
// poe.ninja asks for a User-Agent that names the app and a contact.
const UA = process.env.MARKET_USER_AGENT || 'ExilePlanner/0.1 (contact: sherazproductions@gmail.com)';
const outArg = process.argv.indexOf('--out');
const OUT = path.resolve(outArg > 0 ? process.argv[outArg + 1] : 'public/data/market');
const EXCHANGE = ['Currency', 'Fragments', 'Abyss', 'UncutGems', 'LineageSupportGems', 'Essences', 'SoulCores', 'Idols', 'Runes', 'Ritual', 'Expedition', 'Delirium', 'Breach', 'Verisium'];
const STASH = ['UniqueWeapons', 'UniqueArmours', 'UniqueAccessories', 'UniqueFlasks', 'UniqueCharms', 'UniqueJewels', 'UniqueTablets'];
const LABELS = { UncutGems: 'Uncut Gems', LineageSupportGems: 'Lineage Gems', SoulCores: 'Soul Cores', UniqueWeapons: 'Unique Weapons', UniqueArmours: 'Unique Armour', UniqueAccessories: 'Unique Accessories', UniqueFlasks: 'Unique Flasks', UniqueCharms: 'Unique Charms', UniqueJewels: 'Unique Jewels', UniqueTablets: 'Unique Tablets' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const img = (u) => (!u ? undefined : u.startsWith('http') ? u : `https://web.poecdn.com${u}`);
const round = (v) => (v == null ? undefined : Number(v.toPrecision(4)));

async function get(url) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return res.json();
    if (attempt >= 3) throw new Error(`HTTP ${res.status} ${url}`);
    await sleep(Number(res.headers.get('retry-after') ?? 5) * 1000);
  }
}

const leagues = await get(`${BASE}/leagues`);
fs.mkdirSync(OUT, { recursive: true });
const index = { updatedAt: new Date().toISOString(), source: 'https://poe.ninja/poe2/economy', leagues: [] };
for (const league of leagues) {
  const q = encodeURIComponent(league.id);
  const groups = [];
  let rates;
  for (const type of EXCHANGE) {
    const d = await get(`${BASE}/exchange/current/overview?league=${q}&type=${type}`);
    rates ??= d.core?.rates;
    const meta = new Map((d.items ?? []).map((i) => [i.id, i]));
    const items = (d.lines ?? [])
      .filter((l) => meta.get(l.id) && l.primaryValue > 0)
      .map((l) => ({ n: meta.get(l.id).name, i: img(meta.get(l.id).image), v: round(l.primaryValue), c: round(l.sparkline?.totalChange), vol: round(l.volumePrimaryValue), s: l.sparkline?.data?.map(round) }));
    if (items.length) groups.push({ id: type, label: LABELS[type] ?? type, kind: 'exchange', items });
    await sleep(400);
  }
  for (const type of STASH) {
    const d = await get(`${BASE}/stash/current/item/overview?league=${q}&type=${type}`);
    const items = (d.lines ?? [])
      .filter((l) => l.primaryValue > 0)
      .map((l) => ({ n: l.name, b: l.baseType, i: img(l.icon), v: round(l.primaryValue), c: round(l.sparkLine?.totalChange), list: l.listingCount, ...(l.corrupted ? { cor: 1 } : {}) }));
    if (items.length) groups.push({ id: type, label: LABELS[type] ?? type, kind: 'unique', items });
    await sleep(400);
  }
  const file = `${league.id.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
  fs.writeFileSync(path.join(OUT, file), JSON.stringify({ league: league.name, updatedAt: index.updatedAt, rates, groups }));
  index.leagues.push({ id: league.id, name: league.name, file, items: groups.reduce((n, g) => n + g.items.length, 0) });
  console.log(`• ${league.name}: ${groups.length} groups, ${index.leagues.at(-1).items} items`);
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 2));
console.log(`✓ Market snapshot saved for ${index.leagues.length} leagues`);
