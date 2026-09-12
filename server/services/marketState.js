// Gold market-hours state. XAUUSD trades ~23h/day Mon-Fri (COMEX-style).
// Closed window: Friday 21:00 UTC -> Sunday 21:00 UTC (covers the US-ET
// weekend close +/- DST), plus a static holiday list. Intentionally simple
// and deterministic: it only gates alerting & reporting, never trading logic.
const WEEKEND_CLOSE_UTC = 21; // hour when trading halts on Friday / resumes on Sunday

const HOLIDAYS = new Set([
  `${new Date().getUTCFullYear()}-01-01`, // New Year's Day
  `${new Date().getUTCFullYear()}-12-25`, // Christmas
  `${new Date().getUTCFullYear()}-12-26`  // Boxing Day (thinned flows)
]);

function pad(n) {
  return String(n).padStart(2, '0');
}

function dateKey(d) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function isMarketClosed(now = new Date()) {
  const day = now.getUTCDay(); // 0=Sun .. 6=Sat
  const hour = now.getUTCHours();
  if (day === 0 && hour < WEEKEND_CLOSE_UTC) return 'WEEKEND';
  if (day === 6) return 'WEEKEND';
  if (day === 5 && hour >= WEEKEND_CLOSE_UTC) return 'WEEKEND';
  if (HOLIDAYS.has(dateKey(now))) return 'HOLIDAY';
  return null;
}

function nextOccurrence(from, targetDay, targetHour) {
  const d = new Date(from.getTime());
  for (let i = 0; i <= 8; i++) {
    d.setUTCDate(from.getUTCDate() + i);
    d.setUTCHours(0, 0, 0, 0);
    if (d.getUTCDay() === targetDay) {
      d.setUTCHours(targetHour, 0, 0, 0);
      if (d > from) return d;
    }
  }
  return null;
}

export function getMarketState(now = new Date()) {
  const closedReason = isMarketClosed(now);
  const open = !closedReason;

  let nextOpenUtc = null;
  let nextCloseUtc = null;
  if (open) {
    nextCloseUtc = nextOccurrence(now, 5, WEEKEND_CLOSE_UTC)?.toISOString() || null;
    nextOpenUtc = nextOccurrence(now, 0, WEEKEND_CLOSE_UTC)?.toISOString() || null;
  } else {
    nextOpenUtc = nextOccurrence(now, 0, WEEKEND_CLOSE_UTC)?.toISOString() || null;
    nextCloseUtc = nextOccurrence(new Date(nextOpenUtc), 5, WEEKEND_CLOSE_UTC)?.toISOString() || null;
  }

  return {
    open,
    label: open ? 'OPEN' : closedReason === 'WEEKEND' ? 'CLOSED (WEEKEND)' : `CLOSED (${closedReason})`,
    reason: closedReason || 'OPEN',
    nextOpenUtc,
    nextCloseUtc
  };
}