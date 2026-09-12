// Realtime series engine: builds true 5-minute OHLC buckets for the gold tape
// (plus DXY and SILVER) from the live tick stream, then derives the intraday
// indicators the newer realtime features share: RSI(14), Wilder ATR(14),
// volatility squeeze/expansion state, 5m-return correlations, and RSI price
// divergence. Pure functions are exported for tests; the module keeps a
// bounded in-memory series (5 days of 5m buckets).
const BUCKET_MS = 5 * 60 * 1000;
const MAX_BUCKETS = 1440; // 5 days

const buckets = {}; // key -> [{ t, open, high, low, close }]

export function bumpSeries(key, price, ts = Date.now()) {
  if (!key || price == null || !Number.isFinite(price)) return;
  let arr = buckets[key];
  if (!arr) arr = buckets[key] = [];
  const bStart = ts - (ts % BUCKET_MS);
  const cur = arr.at(-1);
  if (!cur || cur.t !== bStart) {
    arr.push({ t: bStart, open: price, high: price, low: price, close: price });
  } else {
    cur.high = Math.max(cur.high, price);
    cur.low = Math.min(cur.low, price);
    cur.close = price;
  }
  if (arr.length > MAX_BUCKETS) arr.splice(0, arr.length - MAX_BUCKETS);
}

export function getSeriesBars(key) {
  return buckets[key] || [];
}

export function getSeriesCloses(key) {
  return getSeriesBars(key).map((b) => b.close);
}

// ── Pure indicator helpers ──────────────────────────────────────────────

// Wilder RSI. Returns an array aligned so rsi[i] corresponds to closes[i].
export function rsiSeries(closes, period = 14) {
  if (!closes || closes.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  const out = new Array(closes.length).fill(null);
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

function trueRange(prevClose, bar) {
  const a = bar.high - bar.low;
  const b = prevClose != null ? Math.abs(bar.high - prevClose) : 0;
  const c = prevClose != null ? Math.abs(bar.low - prevClose) : 0;
  return Math.max(a, b, c);
}

// Wilder ATR across a 5m OHLC bar array. Aligned so atr[i] uses bars through i.
export function atrSeriesFromBars(bars, period = 14) {
  if (!bars || bars.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < bars.length; i++) {
    trs.push(trueRange(bars[i - 1].close, bars[i]));
  }
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const out = new Array(bars.length).fill(null);
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    out[i + 1] = atr;
  }
  return out;
}

export function percentileRank(sortedAsc, value) {
  if (!sortedAsc.length || value == null) return null;
  let count = 0;
  for (const v of sortedAsc) if (v <= value) count++;
  return Number(((count / sortedAsc.length) * 100).toFixed(1));
}

export function returnsSeries(closes) {
  const out = [];
  for (let i = 1; i < closes.length; i++) {
    out.push(closes[i] / closes[i - 1] - 1);
  }
  return out;
}

// Pearson on last `window` samples of two return series (5m closes).
export function corrOnReturns(a, b, window = 24) {
  if (!a || !b || a.length < window || b.length < window) return null;
  const n = Math.min(window, a.length, b.length);
  const x = a.slice(-n);
  const y = b.slice(-n);
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let num = 0; let dx = 0; let dy = 0;
  for (let i = 0; i < n; i++) {
    const u = x[i] - mx;
    const v = y[i] - my;
    num += u * v;
    dx += u * u;
    dy += v * v;
  }
  const denom = Math.sqrt(dx * dy);
  if (denom === 0) return null;
  return Number((num / denom).toFixed(2));
}

function swingHighs(closes, lookback = 2) {
  const out = [];
  for (let i = lookback; i < closes.length - lookback; i++) {
    let isHigh = true;
    for (let j = -lookback; j <= lookback; j++) {
      if (j === 0) continue;
      if (!(closes[i] > closes[i + j])) { isHigh = false; break; }
    }
    if (isHigh) out.push({ index: i, price: closes[i] });
  }
  return out;
}

function swingLows(closes, lookback = 2) {
  const out = [];
  for (let i = lookback; i < closes.length - lookback; i++) {
    let isLow = true;
    for (let j = -lookback; j <= lookback; j++) {
      if (j === 0) continue;
      if (!(closes[i] < closes[i + j])) { isLow = false; break; }
    }
    if (isLow) out.push({ index: i, price: closes[i] });
  }
  return out;
}

// Classic RSI divergence: price prints a higher high (lower low) while RSI
// prints a lower high (higher low) → momentum is not confirming the move.
export function detectDivergence(closes, rsi) {
  if (!closes || !rsi || closes.length < 40) return { type: 'NONE', detail: 'needs 40 5m closes' };
  const highs = swingHighs(closes);
  const lows = swingLows(closes);
  let bear = null;
  let bull = null;
  if (highs.length >= 2) {
    const a = highs[highs.length - 2];
    const b = highs[highs.length - 1];
    if (b.price > a.price && rsi[b.index] != null && rsi[a.index] != null && rsi[b.index] < rsi[a.index]) {
      bear = { fromPrice: a.price, atPrice: b.price, rsiFrom: rsi[a.index], rsiAt: rsi[b.index] };
    }
  }
  if (lows.length >= 2) {
    const a = lows[lows.length - 2];
    const b = lows[lows.length - 1];
    if (b.price < a.price && rsi[b.index] != null && rsi[a.index] != null && rsi[b.index] > rsi[a.index]) {
      bull = { fromPrice: a.price, atPrice: b.price, rsiFrom: rsi[a.index], rsiAt: rsi[b.index] };
    }
  }
  if (bull && bear) return { type: 'BOTH', bull, bear };
  if (bear) return { type: 'BEARISH', bear };
  if (bull) return { type: 'BULLISH', bull };
  return { type: 'NONE', details: `swings h=${highs.length} l=${lows.length}` };
}

// ── Emitted-event tracking (so consumers fire once per new state) ───────
let lastEmittedDivergence = 'NONE';

export function consumeDivergenceChange() {
  const d = snapshot();
  const t = d.divergence?.type || 'NONE';
  if (t !== lastEmittedDivergence) {
    lastEmittedDivergence = t;
    return d.divergence;
  }
  return null;
}

// ── Combined realtime pulse snapshot ────────────────────────────────────
export function snapshot() {
  const goldCloses = getSeriesCloses('GOLD');
  const goldBars = getSeriesBars('GOLD');
  const rsi = rsiSeries(goldCloses);
  const atrs = atrSeriesFromBars(goldBars);

  const curAtr = atrs ? atrs.at(-1) : null;
  const atrWindow = atrs ? atrs.filter(Boolean).slice(-72) : [];
  const atrPct = percentileRank([...atrWindow].sort((a, b) => a - b), curAtr);
  let volState = 'NORMAL';
  if (atrPct != null) {
    if (atrPct >= 75) volState = 'EXPANSION';
    else if (atrPct <= 25) volState = 'SQUEEZE';
  }

  const dxyCloses = getSeriesCloses('DXY');
  const silverCloses = getSeriesCloses('SILVER');
  const goldRet = returnsSeries(goldCloses);
  const dxyRet = returnsSeries(dxyCloses);
  const silverRet = returnsSeries(silverCloses);

  const goldDxy20 = corrOnReturns(goldRet, dxyRet, 20);
  const goldDxy90 = corrOnReturns(goldRet, dxyRet, 90);
  const goldSilver20 = corrOnReturns(goldRet, silverRet, 20);
  const goldSilver90 = corrOnReturns(goldRet, silverRet, 90);

  const corrBreak = (goldDxy20 != null && goldDxy90 != null && Math.abs(goldDxy20 - goldDxy90) > 0.6)
    || (goldDxy20 != null && goldDxy20 > 0.15);

  const divergence = rsi ? detectDivergence(goldCloses, rsi) : { type: 'NONE', detail: 'building 5m series' };

  return {
    live: goldCloses.length >= 20,
    builds: { GOLD: goldCloses.length, DXY: dxyCloses.length, SILVER: silverCloses.length },
    rsi14: rsi ? Number(rsi.at(-1)?.toFixed(1)) : null,
    atr14: curAtr != null ? Number(curAtr.toFixed(2)) : null,
    atr14Percentile: atrPct,
    volState,
    corr: {
      goldDxy20,
      goldDxy90,
      goldSilver20,
      goldSilver90,
      broken: Boolean(corrBreak),
      brokenNote: corrBreak
        ? (goldDxy20 > 0.15 ? 'gold + DXY moving together (risk regime crack)' : '20m corr diverged sharply from trend')
        : null
    },
    divergence,
    updatedAt: goldBars.length ? new Date(goldBars.at(-1).t + BUCKET_MS).toISOString() : null
  };
}