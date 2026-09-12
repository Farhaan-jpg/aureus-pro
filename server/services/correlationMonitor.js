import { fetchJson } from './httpClient.js';

const SYMBOLS = { gold: 'GC=F', dxy: 'DX-Y.NYB', us10y: '^TNX' };

let cache = {
  live: false,
  lastUpdated: null,
  goldDxy: null,
  goldUs10y: null,
  goldDxyRegime: 'UNKNOWN',
  goldUs10yRegime: 'UNKNOWN'
};
let lastFetch = 0;

async function fetchDailyCloses(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=6mo&interval=1d`;
  const json = await fetchJson(url, {}, 8000);
  const closes = (json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [])
    .filter((p) => p != null && p !== 0);
  return closes;
}

function returnsSeries(closes) {
  const out = [];
  for (let i = 1; i < closes.length; i++) {
    out.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  return out;
}

function pearson(a, b) {
  if (!a || !b) return null;
  const n = Math.min(a.length, b.length);
  if (n < 40) return null;
  const aa = a.slice(-n);
  const bb = b.slice(-n);
  const meanA = aa.reduce((s, v) => s + v, 0) / n;
  const meanB = bb.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i++) {
    const da = aa[i] - meanA;
    const db = bb[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const denom = Math.sqrt(denA * denB);
  if (denom === 0) return null;
  return Number((num / denom).toFixed(2));
}

// Inverse relationship expected for both. Positive corr = structural break.
function regimeLabel(r) {
  if (r == null) return 'UNKNOWN';
  if (r < -0.4) return 'HEALTHY INVERSE';
  if (r < 0) return 'WEAK INVERSE';
  return 'BROKEN DIRECT';
}

export async function refreshCorrelationMonitor(force = false) {
  const now = Date.now();
  if (!force && lastFetch && now - lastFetch < 5 * 60 * 1000 && cache.live) {
    return cache;
  }
  lastFetch = now;

  try {
    const [goldC, dxyC, yieldC] = await Promise.all([
      fetchDailyCloses(SYMBOLS.gold),
      fetchDailyCloses(SYMBOLS.dxy),
      fetchDailyCloses(SYMBOLS.us10y)
    ]);

    const rGold = returnsSeries(goldC);
    const rDxy = returnsSeries(dxyC);
    const rYield = returnsSeries(yieldC);

    const goldDxy = pearson(rGold, rDxy);
    const goldUs10y = pearson(rGold, rYield);

    cache = {
      live: goldDxy != null || goldUs10y != null,
      lastUpdated: new Date().toISOString(),
      goldDxy,
      goldUs10y,
      goldDxyRegime: regimeLabel(goldDxy),
      goldUs10yRegime: regimeLabel(goldUs10y)
    };
  } catch (err) {
    console.warn('[CorrelationMonitor] Refresh failed:', err.message);
  }

  return cache;
}

export function getCorrelationMonitor() {
  return cache;
}