// NowCast thesis: a live one-paragraph "read" regenerated every trigger cycle
// from the same inputs that drive the bias — stance, pulse, nearest level,
// next release, drift since the previous frame. A deterministic signature
// guards broadcasting/pushing: only when the stance, headline, lockout, or
// risk-off state changes do consumers fire.
import { snapshot as pulseSnapshot } from './seriesEngine.js';
import { getNewsLockout } from './newsLockout.js';
import { getRiskOff } from './riskOff.js';
import { getCachedCalendar } from './economicCalendar.js';

let latest = null;
let lastSignature = '';

function nearestLevel(marketData, price) {
  const levels = marketData?.keyLevels?.levels || {};
  const ar = marketData?.asianRange || {};
  const cands = [
    ['PDH', levels.pdh], ['PDL', levels.pdl],
    ['R1', levels.pivots?.r1], ['S1', levels.pivots?.s1],
    ['R2', levels.pivots?.r2], ['S2', levels.pivots?.s2],
    ['PWH', levels.pwh], ['PWL', levels.pwl],
    ['Asian High', ar.high], ['Asian Low', ar.low]
  ].filter(([, v]) => v != null && Number.isFinite(v));
  if (!cands.length || price == null) return null;
  let best = null;
  let bestDist = Infinity;
  for (const [name, v] of cands) {
    const d = Math.abs(v - price) / price;
    if (d < bestDist) { bestDist = d; best = { name, price: v, distancePct: Number((d * 100).toFixed(2)), side: price >= v ? 'ABOVE' : 'BELOW' }; }
  }
  return best;
}

function nextRelease() {
  const cal = getCachedCalendar();
  const now = Date.now();
  const upcoming = (cal?.events || [])
    .filter((e) => e.date && (e.impact === 'HIGH' || e.impact === 'CRITICAL'))
    .map((e) => ({ e, t: new Date(e.date).getTime() }))
    .filter((x) => x.t > now && x.t < now + 8 * 3600000)
    .sort((a, b) => a.t - b.t)[0];
  if (!upcoming) return null;
  return {
    title: upcoming.e.title,
    currency: upcoming.e.currency,
    impact: upcoming.e.impact,
    date: upcoming.e.date,
    inMinutes: Math.round((upcoming.t - now) / 60000),
    forecast: upcoming.e.forecast,
    previous: upcoming.e.previous
  };
}

export function buildNowcast(bias, marketData, pulse = null, overrides = null) {
  const price = marketData?.goldSpot?.price ?? null;
  const p = pulse || pulseSnapshot();
  const lockout = overrides?.lockout ?? getNewsLockout();
  const risk = overrides?.risk ?? getRiskOff();
  const level = nearestLevel(marketData, price);
  const release = overrides?.release ?? nextRelease();

  const divergenceTxt = p?.live && p.divergence?.type && p.divergence.type !== 'NONE'
    ? `${p.divergence.type} 5m divergence`
    : null;
  const pulseNotes = [
    p?.live ? `${Number(p.rsi14).toFixed(1)} RSI` : null,
    p?.atr14Percentile != null && p.live ? `ATR pct ${Math.round(p.atr14Percentile)}` : null,
    p?.live && p.volState !== 'NORMAL' ? p.volState : null,
    divergenceTxt,
    p?.corr?.broken ? 'GOLD/DXY corr broken' : null
  ].filter(Boolean).slice(0, 4);

  const riskNote = risk.level !== 'NONE' ? `Risk-off: ${risk.level} (${risk.drivers.slice(0, 2).join('; ')})` : null;
  const lockoutNote = lockout.active ? `LOCKED OUT — ${lockout.event.title} releases ${release?.inMinutes ?? 'now'}m` : null;

  const stanceNote = !bias?.actionable ? 'tape not actionable' : `${bias.label} @ ${bias.score}/100 · conf ${bias.confidence}%`;
  const levelNote = level ? `nearest level ${level.name} $${Number(level.price).toFixed(0)} (${level.side.toLowerCase()}, ${level.distancePct}%)` : 'no key levels yet';
  const releaseNote = release ? `next release ${release.title} in ${release.inMinutes}m` : 'no red-folder within 8h';

  const headline = [
    `Gold $${price != null ? Number(price).toFixed(2) : '—'}: ${stanceNote}`,
    riskNote,
    lockoutNote,
    levelNote,
    pulseNotes.length ? `pulse ${pulseNotes.join(', ')}` : 'pulse warming up',
    releaseNote
  ].filter(Boolean).join(' · ');

  const thesis = {
    asOf: new Date().toISOString(),
    session: marketData?.session || '—',
    price,
    stance: bias?.actionable ? { label: bias.label, score: bias.score, confidence: bias.confidence } : { label: 'HOLD — CLOSED', score: bias?.score ?? 0, confidence: bias?.confidence ?? 0 },
    actionable: Boolean(bias?.actionable),
    headline,
    pulse: { live: Boolean(p?.live), notes: pulseNotes },
    nearestLevel: level,
    nextRelease: release,
    riskOff: { level: risk.level, drivers: risk.drivers },
    newsLockout: lockout.active
  };
  latest = thesis;
  return thesis;
}

export function getSignature() {
  if (!latest) return null;
  return [
    latest.stance.label,
    String(latest.stance.score),
    String(latest.newsLockout),
    latest.riskOff.level,
    String(latest.nextRelease?.inMinutes !== undefined && latest.nextRelease?.inMinutes <= 10),
    latest.pulse?.live && latest.pulse.notes.join('|')
  ].join('|');
}

export function changedSinceLastBroadcast() {
  const sig = getSignature();
  if (!sig || sig === lastSignature) return false;
  lastSignature = sig;
  return true;
}

export function getNowcast() {
  return latest;
}
export function setNowcast(d) {
  latest = d;
  lastSignature = getSignature() || lastSignature;
}