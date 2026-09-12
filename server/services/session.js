// Season-accurate trading sessions. London shifts with UK daylight time (BST:
// last Sunday of March -> last Sunday of October, +1h) and New York with US
// daylight time (second Sunday of March -> first Sunday of November). Asian
// hours and the London->NY overlap that spans noon UTC stay fixed.
import { usDaylightTime } from './marketState.js';

export { usDaylightTime };

function lastSundayOfMonthUTC(year, month) {
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const last = new Date(Date.UTC(year, month, daysInMonth));
  return new Date(Date.UTC(year, month, daysInMonth - last.getUTCDay())).getTime();
}

// UK daylight time (BST): starts on the last Sunday of March, ends on the
// last Sunday of October. Day-granularity is fine for session labels.
export function ukDaylightTime(now = new Date()) {
  const y = now.getUTCFullYear();
  return now.getTime() >= lastSundayOfMonthUTC(y, 2) && now.getTime() < lastSundayOfMonthUTC(y, 9);
}

// UTC session boundaries resolved per-date:
//   < londonOpen           -> ASIAN_PACIFIC
//   londonOpen .. noon     -> LONDON_OPEN
//   noon .. 16:00          -> NY_OVERLAP
//   16:00 .. afternoonEnd  -> NY_AFTERNOON
export function sessionFromUtc(date = new Date()) {
  const londonOpen = ukDaylightTime(date) ? 7 : 8;      // 08:00 London local -> 07:00Z (BST) / 08:00Z (GMT)
  const afternoonEnd = usDaylightTime(date) ? 20 : 21;  // 16:00 NY close -> 20:00Z (EDT) / 21:00Z (EST)
  const utcHour = date.getUTCHours();

  if (utcHour < londonOpen) return 'ASIAN_PACIFIC';
  if (utcHour < 12) return 'LONDON_OPEN';
  if (utcHour < 16) return 'NY_OVERLAP';
  if (utcHour < afternoonEnd) return 'NY_AFTERNOON';
  return 'ASIAN_PACIFIC';
}