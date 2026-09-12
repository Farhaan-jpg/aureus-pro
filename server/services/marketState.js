// Gold market-hours state. XAUUSD (spot/OTC) trades ~23h/day Mon-Fri.
// Closed window follows US Eastern time, which shifts with DST:
//   summer (EDT):  Fri 21:00 UTC -> Sun 22:00 UTC
//   winter (EST):  Fri 22:00 UTC -> Sun 23:00 UTC
// plus a static holiday list. Intentionally simple and deterministic: it only
// gates alerting & reporting, never trading logic.
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

// Second Sunday of March 00:00 UTC marks the start of US daylight saving
// (first Sunday in November 00:00 UTC). Day granularity is fine for market gates.
function secondSundayMarchUTC(year) {
  const first = new Date(Date.UTC(year, 2, 1));
  const daysUntilSunday = (7 - first.getUTCDay()) % 7;
  return new Date(Date.UTC(year, 2, 1 + daysUntilSunday + 7)).getTime();
}

function firstSundayNovemberUTC(year) {
  const first = new Date(Date.UTC(year, 10, 1));
  const daysUntilSunday = (7 - first.getUTCDay()) % 7;
  return new Date(Date.UTC(year, 10, 1 + daysUntilSunday)).getTime();
}

export function usDaylightTime(now = new Date()) {
  const y = now.getUTCFullYear();
  return now.getTime() >= secondSundayMarchUTC(y) && now.getTime() < firstSundayNovemberUTC(y);
}

// Close/reopen UTC hours for the weekend break, resolved per-date so a Friday in
// December isn't judged by a July schedule (and vice-versa).
function hoursFor(now) {
  return usDaylightTime(now) ? { close: 21, reopen: 22 } : { close: 22, reopen: 23 };
}

export function isMarketClosed(now = new Date()) {
  const h = hoursFor(now);
  const day = now.getUTCDay(); // 0=Sun .. 6=Sat
  const hour = now.getUTCHours();
  if (day === 0 && hour < h.reopen) return 'WEEKEND';
  if (day === 6) return 'WEEKEND';
  if (day === 5 && hour >= h.close) return 'WEEKEND';
  if (HOLIDAYS.has(dateKey(now))) return 'HOLIDAY';
  return null;
}

function nextOccurrence(from, targetDay, getHour) {
  const d = new Date(from.getTime());
  for (let i = 0; i <= 8; i++) {
    d.setUTCDate(from.getUTCDate() + i);
    d.setUTCHours(0, 0, 0, 0);
    if (d.getUTCDay() === targetDay) {
      d.setUTCHours(getHour(d), 0, 0, 0);
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
    nextCloseUtc = nextOccurrence(now, 5, (d) => hoursFor(d).close)?.toISOString() || null;
    nextOpenUtc = nextOccurrence(now, 0, (d) => hoursFor(d).reopen)?.toISOString() || null;
  } else {
    nextOpenUtc = nextOccurrence(now, 0, (d) => hoursFor(d).reopen)?.toISOString() || null;
    nextCloseUtc = nextOccurrence(new Date(nextOpenUtc), 5, (d) => hoursFor(d).close)?.toISOString() || null;
  }

  return {
    open,
    label: open ? 'OPEN' : closedReason === 'WEEKEND' ? 'CLOSED (WEEKEND)' : `CLOSED (${closedReason})`,
    reason: closedReason || 'OPEN',
    nextOpenUtc,
    nextCloseUtc
  };
}