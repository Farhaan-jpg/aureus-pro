import { fetchJson } from './httpClient.js';

const SYMBOL = 'GC=F';

let cache = {
  live: false,
  lastUpdated: null,
  current: null,
  previousDay: null,
  previousWeek: null,
  levels: {
    pdh: null, pdl: null,
    pwh: null, pwl: null,
    pivots: null,
    weekPivots: null,
    swingHighs: [],
    swingLows: []
  }
};
let lastFetch = 0;

function parseBars(json) {
  const result = json?.chart?.result?.[0];
  if (!result) return [];
  const timestamps = result.timestamp || [];
  const q = result.indicators?.quote?.[0] || {};
  const bars = [];
  for (let i = 0; i < timestamps.length; i++) {
    const o = q.open?.[i];
    const h = q.high?.[i];
    const l = q.low?.[i];
    const c = q.close?.[i];
    if (c == null || c === 0) continue;
    bars.push({
      time: new Date(timestamps[i] * 1000),
      open: o != null ? Number(o) : Number(c),
      high: h != null ? Number(h) : Number(c),
      low: l != null ? Number(l) : Number(c),
      close: Number(c)
    });
  }
  return bars;
}

// ISO week key (Mon..Sun via UTC) so weekly bars are derived deterministically
// from daily closes — avoids Yahoo's in-progress weekly candle duplicates.
function weekKey(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (t.getUTCDay() + 6) % 7; // Mon=0
  t.setUTCDate(t.getUTCDate() - day);
  return t.toISOString().slice(0, 10);
}

function aggregateWeekly(dailyBars) {
  const groups = new Map();
  for (const bar of dailyBars) {
    const key = weekKey(bar.time);
    const g = groups.get(key);
    if (!g) {
      groups.set(key, { time: bar.time, open: bar.open, high: bar.high, low: bar.low, close: bar.close });
    } else {
      g.high = Math.max(g.high, bar.high);
      g.low = Math.min(g.low, bar.low);
      g.close = bar.close;
    }
  }
  return [...groups.values()].sort((a, b) => a.time - b.time);
}

function floorPivots(bar) {
  if (!bar) return null;
  const { high, low, close } = bar;
  const p = (high + low + close) / 3;
  return {
    p: Number(p.toFixed(2)),
    r1: Number((2 * p - low).toFixed(2)),
    s1: Number((2 * p - high).toFixed(2)),
    r2: Number((p + (high - low)).toFixed(2)),
    s2: Number((p - (high - low)).toFixed(2))
  };
}

function swingPoints(bars, window = 3, maxPoints = 5) {
  const highs = [];
  const lows = [];
  const n = bars.length;
  const start = Math.max(0, n - 130);
  for (let i = start; i < n; i++) {
    const c = bars[i].close;
    if (c == null) continue;
    let isHigh = true;
    let isLow = true;
    for (let j = Math.max(0, i - window); j <= Math.min(n - 1, i + window); j++) {
      if (bars[j].close == null) continue;
      if (bars[j].close > c) isHigh = false;
      if (bars[j].close < c) isLow = false;
    }
    if (isHigh) highs.push({ price: c, time: bars[i].time });
    if (isLow) lows.push({ price: c, time: bars[i].time });
  }
  return {
    swingHighs: highs.slice(-maxPoints),
    swingLows: lows.slice(-maxPoints)
  };
}

export async function refreshKeyLevels(force = false) {
  const now = Date.now();
  if (!force && lastFetch && now - lastFetch < 5 * 60 * 1000 && cache.live) {
    return cache;
  }
  lastFetch = now;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${SYMBOL}?range=2y&interval=1d`;
    const dailyJson = await fetchJson(url, {}, 8000);
    const daily = parseBars(dailyJson);
    if (daily.length < 3) throw new Error('insufficient daily bars');

    const weekly = aggregateWeekly(daily);

    // Last daily bar = current partial session; prev completed day = len-2
    const current = daily[daily.length - 1];
    const previousDay = daily[daily.length - 2];

    // Last weekly group = current (in-progress) week; prev completed = len-2
    const currentWeek = weekly[weekly.length - 1];
    const previousWeek = weekly.length >= 2 ? weekly[weekly.length - 2] : null;

    const pivots = floorPivots(previousDay);
    const weekPivots = previousWeek ? floorPivots(previousWeek) : null;

    const swing = swingPoints(daily);

    cache = {
      live: current != null,
      lastUpdated: new Date().toISOString(),
      current: {
        open: current?.open ?? null,
        high: current?.high ?? null,
        low: current?.low ?? null,
        asOf: current?.time?.toISOString() ?? null
      },
      previousDay: previousDay ? { date: previousDay.time.toISOString(), open: previousDay.open, high: previousDay.high, low: previousDay.low, close: previousDay.close } : null,
      previousWeek: currentWeek ? { date: currentWeek.time.toISOString(), open: currentWeek.open, high: currentWeek.high, low: currentWeek.low, close: currentWeek.close } : null,
      levels: {
        pdh: previousDay?.high ?? null,
        pdl: previousDay?.low ?? null,
        pcOpen: previousDay?.open ?? null,
        pcClose: previousDay?.close ?? null,
        pwh: previousWeek?.high ?? null,
        pwl: previousWeek?.low ?? null,
        pivots,
        weekPivots,
        swingHighs: swing.swingHighs,
        swingLows: swing.swingLows
      }
    };

    // Keep the CURRENT (in-progress) week range for display context
    cache.currentWeek = currentWeek
      ? { date: currentWeek.time.toISOString(), high: currentWeek.high, low: currentWeek.low, open: currentWeek.open, close: currentWeek.close }
      : null;
  } catch (err) {
    console.warn('[KeyLevels] Refresh failed:', err.message);
  }

  return cache;
}

export function getKeyLevels() {
  return cache;
}