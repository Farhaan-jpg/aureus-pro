import { fetchJson } from './httpClient.js';

const SYMBOL = 'GC=F';

const TFS = [
  { tf: '5M', role: 'Intraday', range: '1d', interval: '5m', weight: 15 },
  { tf: '15M', role: 'Session', range: '5d', interval: '15m', weight: 20 },
  { tf: '1H', role: 'Intraday trend', range: '1mo', interval: '60m', weight: 25 },
  { tf: '4H', role: 'Swing', range: '3mo', interval: '60m', weight: 20, resample: 4 },
  { tf: '1D', role: 'Macro', range: '1y', interval: '1d', weight: 20 }
];

let cache = { live: false, timeframes: [], confluence: null, lastUpdated: null };
let lastFetch = 0;

function ema(values, period) {
  if (!values || values.length < period) return null;
  const k = 2 / (period + 1);
  let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    e = values[i] * k + e * (1 - k);
  }
  return e;
}

function rsi(values, period = 14) {
  if (!values || values.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(1));
}

function resample(closes, n) {
  const out = [];
  for (let i = n - 1; i < closes.length; i += n) {
    out.push(closes[i]);
  }
  return out;
}

async function fetchCloses(range, interval) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${SYMBOL}?range=${range}&interval=${interval}`;
  const json = await fetchJson(url, {}, 8000);
  const closes = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
  return closes.filter((p) => p != null);
}

export async function refreshTimeframeMatrix(force = false) {
  const now = Date.now();
  if (!force && lastFetch && now - lastFetch < 60 * 1000 && cache.live) {
    return cache;
  }
  lastFetch = now;

  try {
    const rows = [];
    for (const spec of TFS) {
      const raw = await fetchCloses(spec.range, spec.interval);
      const closes = spec.resample ? resample(raw, spec.resample) : raw;
      const last = closes.at(-1);
      const fast = ema(closes, 9);
      const slow = ema(closes, 21);
      const rsiVal = rsi(closes, 14);
      let trend = 'CHOP';
      if (fast != null && slow != null && last != null) {
        if (last > fast && fast > slow) trend = 'BULLISH';
        else if (last < fast && fast < slow) trend = 'BEARISH';
      }
      rows.push({
        tf: spec.tf,
        role: spec.role,
        trend,
        fastEma: fast != null ? Number(fast.toFixed(2)) : null,
        slowEma: slow != null ? Number(slow.toFixed(2)) : null,
        rsi: rsiVal,
        last: last != null ? Number(last.toFixed(2)) : null,
        weight: spec.weight
      });
    }

    let bull = 0;
    let bear = 0;
    let total = 0;
    for (const row of rows) {
      total += row.weight;
      if (row.trend === 'BULLISH') bull += row.weight;
      if (row.trend === 'BEARISH') bear += row.weight;
    }
    const bullPct = total ? Math.round((bull / total) * 100) : 0;
    const bearPct = total ? Math.round((bear / total) * 100) : 0;
    let stance = 'MIXED';
    if (bullPct >= 70) stance = 'BULLISH ALIGNMENT';
    else if (bearPct >= 70) stance = 'BEARISH ALIGNMENT';
    else if (bullPct > bearPct) stance = 'LEAN BULLISH';
    else if (bearPct > bullPct) stance = 'LEAN BEARISH';

    cache = {
      live: rows.some((r) => r.last != null),
      symbol: SYMBOL,
      timeframes: rows,
      confluence: { bullPct, bearPct, stance },
      lastUpdated: new Date().toISOString()
    };
  } catch (err) {
    console.warn('[MTF] Refresh failed:', err.message);
  }

  return cache;
}

export function getTimeframeMatrix() {
  return cache;
}
