// Key-level auto-alerts: watches PDH/PDL, Pivot R1/S1, and Asian-range bounds
// against the live tape. Fires when price comes within ~0.12% of a level,
// once per level per 45-minute cooldown, and keeps a bounded recent-alert list
// for the dashboard + Telegram queries.
const PROXIMITY = 0.0012; // 0.12%
const COOLDOWN_MS = 45 * 60 * 1000;
const MAX_ALERTS = 12;

const recent = [];
const lastFiredAt = new Map(); // levelKey -> ts

function levelCandidate(key, label, price) {
  if (price == null || !Number.isFinite(price) || price <= 0) return null;
  return { key, label, price };
}

export function collectLevelCandidates(marketData) {
  const levels = marketData?.keyLevels?.levels || {};
  const ar = marketData?.asianRange || {};
  return [
    levelCandidate('PDH', 'Prev Day High', levels.pdh),
    levelCandidate('PDL', 'Prev Day Low', levels.pdl),
    levelCandidate('R1', 'Pivot R1', levels.pivots?.r1),
    levelCandidate('S1', 'Pivot S1', levels.pivots?.s1),
    levelCandidate('ASIA_H', 'Asian High', ar.high),
    levelCandidate('ASIA_L', 'Asian Low', ar.low)
  ].filter(Boolean);
}

export function checkLevelAlerts(marketData) {
  const currentPrice = marketData?.goldSpot?.price;
  if (currentPrice == null || !Number.isFinite(currentPrice)) return [];
  const hits = [];
  for (const c of collectLevelCandidates(marketData)) {
    const dist = Math.abs(currentPrice - c.price) / currentPrice;
    if (dist <= PROXIMITY) {
      const now = Date.now();
      if ((lastFiredAt.get(c.key) || 0) + COOLDOWN_MS > now) continue;
      lastFiredAt.set(c.key, now);
      const dir = currentPrice >= c.price ? 'ABOVE' : 'BELOW';
      const alert = {
        key: c.key,
        label: c.label,
        level: c.price,
        current: currentPrice,
        distancePct: Number((dist * 100).toFixed(2)),
        side: dir,
        firedAt: new Date(now).toISOString()
      };
      hits.push(alert);
      recent.unshift(alert);
    }
  }
  if (recent.length > MAX_ALERTS) recent.length = MAX_ALERTS;
  if (lastFiredAt.size > 200) lastFiredAt.clear();
  return hits;
}

export function getLevelAlerts(limit = 12) {
  return recent.slice(0, limit);
}