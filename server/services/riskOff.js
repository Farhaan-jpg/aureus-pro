// Risk-off regime advisory: a multi-factor safety layer. When enough plumbing
// cracks at once (VIX stress, dollar shock, real-yield spiking, GOLD/DXY
// correlation break, 10Y shock) the engine labels the tape CAUTION/ADVISORY so
// calls and pushes can be re-weighted defensively. Transitions fire once via
// the canEscape() watched-state API used by cronWorker.
import { snapshot as pulseSnapshot } from './seriesEngine.js';

const LEVELS = { NONE: 0, CAUTION: 1, ADVISORY: 2 };

let state = { level: 'NONE', drivers: [], since: null, asOf: null };

function levelName(n) {
  return Object.keys(LEVELS).find((k) => LEVELS[k] === n) || 'NONE';
}

export function getRiskOff() {
  return state;
}

// Watchdog helper: returns true once per escalation into CAUTION/ADVISORY so
// the caller pushes exactly once. Reset whenever the tape cools back to NONE.
let firedFor = 'NONE';
export function canEscape() {
  const lvl = state.level;
  if (lvl === 'NONE') {
    firedFor = 'NONE';
    return false;
  }
  if (lvl !== 'CAUTION' && lvl !== 'ADVISORY') return false;
  if (firedFor !== lvl) {
    firedFor = lvl;
    return true;
  }
  return false;
}
export function resetWatchdog() { firedFor = 'NONE'; }

export function evaluateRiskOff(md, pulse = null) {
  if (!md) return state; // caller (cronWorker) always supplies live market data
  const assets = md?.assets || {};
  const pulseNow = pulse || pulseSnapshot();
  const now = Date.now();
  const drivers = [];

  const vix = assets.VIX?.price;
  const vixChg = assets.VIX?.changePercent || 0;
  if (vix != null && (vix >= 25 || (vix >= 20 && vixChg >= 8))) {
    drivers.push(`VIX ${vix}${vixChg >= 0 ? ' +' : ''}${vixChg}% stress`);
  }

  const dxy = assets.DXY?.changePercent;
  if (dxy != null && Math.abs(dxy) >= 0.6) {
    drivers.push(`DXY ${dxy >= 0 ? '+' : ''}${dxy}% move`);
  }

  const realYield = md?.realYield10Y;
  if (realYield != null && realYield >= 2.5) {
    drivers.push(`real yield ${realYield}% elevated`);
  }

  const us10y = assets.US10Y?.changePercent;
  if (us10y != null && Math.abs(us10y) >= 0.8) {
    drivers.push(`10Y ${us10y >= 0 ? '+' : ''}${us10y}% shock`);
  }

  if (pulseNow?.live && pulseNow.corr?.broken) {
    drivers.push('GOLD/DXY 5m correlation broken');
  }

  if (pulseNow?.live && pulseNow.volState === 'EXPANSION' && pulseNow.atr14Percentile >= 90) {
    drivers.push(`vol blow-off (ATR pct ${Math.round(pulseNow.atr14Percentile)})`);
  }

  const n = drivers.length;
  const level = levelName(n >= 3 ? 2 : n >= 1 ? 1 : 0);
  const escalated = level !== 'NONE' && state.level === 'NONE';
  const cooled = level === 'NONE' && state.level !== 'NONE';
  if (cooled) firedFor = 'NONE'; // re-arm the watchdog as the tape cools

  state = {
    level,
    drivers,
    since: escalated ? new Date(now).toISOString() : state.since,
    asOf: new Date(now).toISOString(),
    cooledAt: cooled ? new Date(now).toISOString() : null
  };
  return state;
}