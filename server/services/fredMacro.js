import { fetchText, lastNumericFromFredCsv } from './httpClient.js';

const SERIES = {
  DFII10: 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DFII10',
  T10YIE: 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=T10YIE',
  DGS2: 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS2'
};

let cache = {
  realYield10Y: null,
  breakeven10Y: null,
  yield2Y: null,
  asOf: {},
  live: false,
  lastUpdated: null
};
let lastFetch = 0;

export async function refreshFredMacro(force = false) {
  const now = Date.now();
  if (!force && lastFetch && now - lastFetch < 30 * 60 * 1000 && cache.live) {
    return cache;
  }
  lastFetch = now;

  try {
    const [realCsv, beiCsv, y2Csv] = await Promise.all([
      fetchText(SERIES.DFII10, {}, 10000).catch(() => ''),
      fetchText(SERIES.T10YIE, {}, 10000).catch(() => ''),
      fetchText(SERIES.DGS2, {}, 10000).catch(() => '')
    ]);

    const real = lastNumericFromFredCsv(realCsv);
    const bei = lastNumericFromFredCsv(beiCsv);
    const y2 = lastNumericFromFredCsv(y2Csv);

    cache = {
      realYield10Y: real?.value ?? null,
      breakeven10Y: bei?.value ?? null,
      yield2Y: y2?.value ?? null,
      asOf: {
        realYield10Y: real?.date || null,
        breakeven10Y: bei?.date || null,
        yield2Y: y2?.date || null
      },
      live: Boolean(real || bei || y2),
      lastUpdated: new Date().toISOString()
    };
  } catch (err) {
    console.warn('[FRED] Refresh failed:', err.message);
  }

  return cache;
}

export function getFredMacro() {
  return cache;
}
