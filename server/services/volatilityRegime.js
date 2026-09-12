import { fetchJson } from './httpClient.js';

const SYMBOL = 'GC=F';

let cache = {
  live: false,
  lastUpdated: null,
  atr14: null,
  atr14Percentile: null,
  realizedVol30: null,
  realizedVolPercentile: null,
  regime: 'UNKNOWN',
  recommendation: null
};
let lastFetch = 0;

function trueRange(prevClose, bar) {
  const a = bar.high - bar.low;
  const b = prevClose != null ? Math.abs(bar.high - prevClose) : 0;
  const c = prevClose != null ? Math.abs(bar.low - prevClose) : 0;
  return Math.max(a, b, c);
}

// Wilder ATR series across the full history
function atrSeries(bars, period = 14) {
  if (bars.length < period + 1) return [];
  const trs = [];
  for (let i = 1; i < bars.length; i++) {
    trs.push(trueRange(bars[i - 1].close, bars[i]));
  }
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const out = [atr];
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    out.push(atr);
  }
  return out;
}

function percentileRank(sortedAsc, value) {
  if (!sortedAsc.length) return null;
  let count = 0;
  for (const v of sortedAsc) if (v <= value) count++;
  return Number(((count / sortedAsc.length) * 100).toFixed(1));
}

function realizedVol(closes, window = 30, annualize = true) {
  if (closes.length < window + 1) return null;
  const slice = closes.slice(-(window + 1));
  const returns = [];
  for (let i = 1; i < slice.length; i++) {
    returns.push(Math.log(slice[i] / slice[i - 1]));
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (returns.length - 1);
  const sd = Math.sqrt(variance);
  return Number((sd * (annualize ? Math.sqrt(252) : 1) * 100).toFixed(2));
}

export async function refreshVolatilityRegime(force = false) {
  const now = Date.now();
  if (!force && lastFetch && now - lastFetch < 5 * 60 * 1000 && cache.live) {
    return cache;
  }
  lastFetch = now;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${SYMBOL}?range=2y&interval=1d`;
    const json = await fetchJson(url, {}, 8000);
    const q = json?.chart?.result?.[0]?.indicators?.quote?.[0];
    if (!q) throw new Error('no bars');

    const bars = [];
    for (let i = 0; i < (q.close || []).length; i++) {
      const c = q.close[i];
      if (c == null || c === 0) continue;
      bars.push({
        high: q.high[i] ?? c,
        low: q.low[i] ?? c,
        close: Number(c)
      });
    }
    if (bars.length < 45) throw new Error('insufficient bars');

    const closes = bars.map((b) => b.close);
    const atrs = atrSeries(bars, 14);
    const currentAtr = atrs.length ? atrs[atrs.length - 1] : null;

    // Realized-vol history: rolling 30d windows across the full sample
    const rvHistory = [];
    for (let i = 30; i < closes.length; i++) {
      const rv = realizedVol(closes.slice(0, i + 1), 30);
      if (rv != null) rvHistory.push(rv);
    }
    const currentRv = realizedVol(closes, 30);

    const atrPct = atrs.length ? percentileRank([...atrs].sort((a, b) => a - b), atrs[atrs.length - 1]) : null;
    const rvPct = rvHistory.length ? percentileRank([...rvHistory].sort((a, b) => a - b), currentRv) : null;

    const compositePct = atrPct != null && rvPct != null ? (atrPct + rvPct) / 2 : (atrPct ?? rvPct);
    let regime = 'UNKNOWN';
    let recommendation = null;
    if (compositePct != null) {
      if (compositePct >= 75) {
        regime = 'HIGH';
        recommendation = 'Elevated regime — scale exposure, use institutional-sized stops 2.5-3x ATR.';
      } else if (compositePct >= 50) {
        regime = 'ELEVATED';
        recommendation = 'Moderate regime — mean-reversion edges work but keep position sizes normal.';
      } else if (compositePct >= 25) {
        regime = 'MODERATE';
        recommendation = 'Normalized volatility — standard technical ranges intact.';
      } else {
        regime = 'LOW';
        recommendation = 'Low-volatility squeeze phase — expansion typically follows, hold partial positions through triggers.';
      }
    }

    cache = {
      live: compositePct != null && currentAtr != null,
      lastUpdated: new Date().toISOString(),
      atr14: currentAtr != null ? Number(currentAtr.toFixed(2)) : null,
      atr14Percentile: atrPct,
      realizedVol30: currentRv,
      realizedVolPercentile: rvPct,
      compositePercentile: compositePct,
      regime,
      recommendation
    };
  } catch (err) {
    console.warn('[VolatilityRegime] Refresh failed:', err.message);
  }

  return cache;
}

export function getVolatilityRegime() {
  return cache;
}