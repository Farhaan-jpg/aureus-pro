// Red-folder news lockout: computes the mute window around the next
// HIGH/CRITICAL economic release so the engine never signals or fires a siren
// straight into a reco-folder news spike. The window is [release −5m, +1m].
import { getCachedCalendar } from './economicCalendar.js';

const BEFORE_MS = 5 * 60 * 1000;
const AFTER_MS = 1 * 60 * 1000;
const LOOKAHEAD_MS = 80 * 60 * 1000;

let latest = { active: false, event: null, startMs: null, endMs: null, secondsLeft: 0, horizonMs: 0 };

export function computeNewsLockout(now = Date.now(), calendar = null) {
  const cal = calendar || getCachedCalendar();
  const events = (cal?.events || [])
    .filter((e) => (e.impact === 'HIGH' || e.impact === 'CRITICAL') && e.date)
    .map((e) => ({ e, t: new Date(e.date).getTime() }))
    .filter((x) => x.t > now - AFTER_MS && x.t < now + LOOKAHEAD_MS)
    .sort((a, b) => a.t - b.t);
  const next = events[0] || null;

  if (!next) {
    latest = { active: false, event: null, startMs: null, endMs: null, secondsLeft: 0, horizonMs: LOOKAHEAD_MS };
    return latest;
  }

  const startMs = next.t - BEFORE_MS;
  const endMs = next.t + AFTER_MS;
  latest = {
    active: now >= startMs && now < endMs,
    event: {
      title: next.e.title,
      currency: next.e.currency,
      impact: next.e.impact,
      date: next.e.date,
      forecast: next.e.forecast,
      previous: next.e.previous
    },
    startMs,
    endMs,
    secondsLeft: endMs > now ? Math.max(0, Math.round((startMs - now) / 1000)) : 0,
    horizonMs: LOOKAHEAD_MS
  };
  return latest;
}

export function getNewsLockout() {
  // Cheap refresh every call so countdowns derived from secondsLeft stay live.
  return computeNewsLockout();
}