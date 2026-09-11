import { fetchJson, fetchText, lastNumericFromFredCsv } from './httpClient.js';

const FRED_API_KEY = process.env.FRED_API_KEY || '';
const FRED_API_BASE = 'https://api.stlouisfed.org/fred/series/observations';

const SERIES = {
  DGS10: { id: 'DGS10', csvUrl: 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10' },
  T10YIE: { id: 'T10YIE', csvUrl: 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=T10YIE' },
  DGS2: { id: 'DGS2', csvUrl: 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS2' },
  DFII10: { id: 'DFII10', csvUrl: 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DFII10' }
};

let cache = {
  realYield10Y: null,
  breakeven10Y: null,
  nominal10Y: null,
  yield2Y: null,
  asOf: {},
  live: false,
  source: 'none',
  lastUpdated: null
};
let lastFetch = 0;

async function fetchFromFredApi(seriesId) {
  if (!FRED_API_KEY) return null;
  try {
    const url = `${FRED_API_BASE}?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=10`;
    const data = await fetchJson(url, {}, 12000);
    const obs = data?.observations;
    if (!obs?.length) return null;
    for (const o of obs) {
      if (o.value !== '.' && o.value !== '' && Number.isFinite(Number(o.value))) {
        return { date: o.date, value: Number(o.value) };
      }
    }
    return null;
  } catch (err) {
    console.warn(`[FRED API] ${seriesId} fetch failed:`, err.message);
    return null;
  }
}

async function fetchFromCsv(seriesUrl) {
  try {
    const csv = await fetchText(seriesUrl, {}, 12000);
    return lastNumericFromFredCsv(csv);
  } catch {
    return null;
  }
}

async function fetchSeries(seriesDef) {
  // Primary: FRED JSON API (reliable, proper error codes)
  const fromApi = await fetchFromFredApi(seriesDef.id);
  if (fromApi) return { ...fromApi, source: 'api' };

  // Fallback: FRED CSV scraping (works on cloud, flaky locally)
  const fromCsv = await fetchFromCsv(seriesDef.csvUrl);
  if (fromCsv) return { ...fromCsv, source: 'csv' };

  return null;
}

export async function refreshFredMacro(force = false) {
  const now = Date.now();
  if (!force && lastFetch && now - lastFetch < 15 * 60 * 1000 && cache.live) {
    return cache;
  }
  lastFetch = now;

  try {
    const [nominal, breakeven, y2, directReal] = await Promise.all([
      fetchSeries(SERIES.DGS10),
      fetchSeries(SERIES.T10YIE),
      fetchSeries(SERIES.DGS2),
      fetchSeries(SERIES.DFII10)
    ]);

    // Compute real yield: DGS10 - T10YIE (the standard formula)
    let realYield10Y = null;
    if (nominal?.value != null && breakeven?.value != null) {
      realYield10Y = Number((nominal.value - breakeven.value).toFixed(3));
    } else if (directReal?.value != null) {
      // Fallback: use DFII10 directly (TIPS yield = real yield)
      realYield10Y = directReal.value;
    }

    // Determine best source label
    const sources = [nominal?.source, breakeven?.source, y2?.source].filter(Boolean);
    const sourceLabel = FRED_API_KEY
      ? `fred-api`
      : sources.includes('csv') ? 'fred-csv' : 'none';

    cache = {
      realYield10Y,
      breakeven10Y: breakeven?.value ?? null,
      nominal10Y: nominal?.value ?? null,
      yield2Y: y2?.value ?? null,
      asOf: {
        realYield10Y: nominal?.date || directReal?.date || null,
        breakeven10Y: breakeven?.date || null,
        yield2Y: y2?.date || null
      },
      live: Boolean(nominal || breakeven || directReal),
      source: sourceLabel,
      lastUpdated: new Date().toISOString()
    };

    if (cache.live) {
      console.log(`[FRED] Refresh OK (${sourceLabel}): real=${realYield10Y}% breakeven=${cache.breakeven10Y}% 10Y=${cache.nominal10Y}% 2Y=${cache.yield2Y}%`);
    }
  } catch (err) {
    console.warn('[FRED] Refresh failed:', err.message);
  }

  return cache;
}

export function getFredMacro() {
  return cache;
}
