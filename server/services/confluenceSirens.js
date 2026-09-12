// Reversal confluence siren: collates signals from the realtime pulse engine,
// retail extremes, key-level proximity, and volatility/ correlation state to
// emit one unified HIGH-CONVICTION alert when multiple independent factors
// converge at roughly the same price and time. Designed so the worker calls
// siren.note(...) each time a new factor appears, then siren.evaluate() to
// check if the set now fires (≥3 active factors + a core reversal signal).
const WINDOW_MS = 12 * 60 * 1000; // factor active window 12m
const CORE_SET = new Set(['sweep', 'divergence', 'retailExtreme']); // need ≥1 of these
const COOLDOWN_MS = 20 * 60 * 1000;  // 20 min between identical factor sets

const active = new Map(); // factor -> { at, detail, price }
let lastFiredKey = null;
let lastFiredAt = 0;
const history = []; // last 10 sirens

export function note(factor, detail = '', price = null) {
  if (!factor) return;
  active.set(factor, { at: Date.now(), detail: String(detail).slice(0, 120), price });
}

export function clear(factor) {
  active.delete(factor);
}

export function reset() {
  active.clear();
  lastFiredKey = null;
  lastFiredAt = 0;
}

function prune() {
  const now = Date.now();
  for (const [k, v] of active) {
    if (now - v.at > WINDOW_MS) active.delete(k);
  }
}

export function evaluate(currentPrice = null) {
  prune();
  if (active.size < 3) return null;
  const factors = [...active.keys()];
  const hasCore = factors.some((f) => CORE_SET.has(f));
  if (!hasCore) return null;

  const key = [...factors].sort().join('|');
  const now = Date.now();
  if (key === lastFiredKey && now - lastFiredAt < COOLDOWN_MS) return null;
  const dir = active.get('divergence')?.detail === 'BEARISH'
    ? 'BEARISH'
    : active.get('divergence')?.detail === 'BULLISH'
      ? 'BULLISH'
      : active.get('sweep')?.detail || 'UNKNOWN';

  const siren = {
    id: `siren-${now}-${Math.random().toString(36).slice(2, 7)}`,
    firedAt: new Date(now).toISOString(),
    price: currentPrice ?? active.values().next().value?.price ?? null,
    direction: dir,
    factorCount: factors.length,
    factors: factors.map((f) => ({ factor: f, ...active.get(f) }))
  };
  lastFiredKey = key;
  lastFiredAt = now;
  history.push(siren);
  if (history.length > 10) history.shift();
  return siren;
}

export function getSirenHistory() {
  return history;
}

export function getActiveFactors() {
  prune();
  return Object.fromEntries(active.entries());
}