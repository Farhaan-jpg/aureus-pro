import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMarketState, isMarketClosed, usDaylightTime } from '../server/services/marketState.js';

const u = (y, m, d, h = 0, min = 0) => new Date(Date.UTC(y, m - 1, d, h, min, 0, 0));

// NOTE: Sep 2026 = US DST/summer (close 21Z Fri, reopen 22Z Sun);
//       Nov 2026 = US standard time (close 22Z Fri, reopen 23Z Sun).

test('open during a normal Thursday session', () => {
  const s = getMarketState(u(2026, 9, 10, 10));
  assert.equal(s.open, true);
  assert.equal(s.reason, 'OPEN');
  assert.ok(s.nextCloseUtc < s.nextOpenUtc); // close Friday, reopen Sunday
});

test('Friday before close is open, next close is that evening (DST hours)', () => {
  const s = getMarketState(u(2026, 9, 11, 14));
  assert.equal(s.open, true);
  assert.ok(s.nextCloseUtc.startsWith('2026-09-11T21:'));
});

test('Friday evening is weekend-closed', () => {
  const s = getMarketState(u(2026, 9, 11, 22));
  assert.equal(s.open, false);
  assert.equal(s.reason, 'WEEKEND');
});

test('summer: Saturday closed, reopens Sunday 22:00 UTC', () => {
  const s = getMarketState(u(2026, 9, 12, 10));
  assert.equal(s.open, false);
  assert.equal(s.nextOpenUtc, '2026-09-13T22:00:00.000Z');
});

test('summer: Sunday before 22:00 is closed but reopens same day 22:00 UTC', () => {
  const s = getMarketState(u(2026, 9, 13, 21, 59));
  assert.equal(s.open, false);
  assert.equal(s.nextOpenUtc, '2026-09-13T22:00:00.000Z');
});

test('summer: Sunday after 22:00 is open', () => {
  const s = getMarketState(u(2026, 9, 13, 22, 30));
  assert.equal(s.open, true);
});

test('winter: Friday 21:00 still open, closes at 22:00 UTC', () => {
  const friday = getMarketState(u(2026, 11, 6, 21));
  assert.equal(friday.open, true);
  assert.ok(friday.nextCloseUtc.startsWith('2026-11-06T22:'));
  const closed = getMarketState(u(2026, 11, 6, 22, 30));
  assert.equal(closed.open, false);
});

test('winter: Saturday closed, reopens Sunday 23:00 UTC', () => {
  const s = getMarketState(u(2026, 11, 7, 10));
  assert.equal(s.open, false);
  assert.equal(s.nextOpenUtc, '2026-11-08T23:00:00.000Z');
});

test('winter: Sunday 22:30 closed, 23:30 open', () => {
  assert.equal(getMarketState(u(2026, 11, 8, 22, 30)).open, false);
  assert.equal(getMarketState(u(2026, 11, 8, 23, 30)).open, true);
});

test('DST boundary flips across the Sunday morning UTC', () => {
  // Second Sunday of March 2026 is Mar 8. Boundary check is on the UTC day,
  // so Mar 7 (Sat) is standard time and Mar 8 (Sun) is daylight time; the
  // fall-back similarly lands on the first Sunday of November (Nov 1, 2026).
  assert.equal(usDaylightTime(u(2026, 3, 7)), false);
  assert.equal(usDaylightTime(u(2026, 3, 8)), true);
  assert.equal(usDaylightTime(u(2026, 11, 1)), false);
  assert.equal(usDaylightTime(u(2026, 11, 8)), false);
  assert.equal(usDaylightTime(u(2026, 9, 13)), true); // summer sample
});

test('holiday list closes the market', () => {
  const s = getMarketState(u(2026, 12, 25, 12));
  assert.equal(s.open, false);
  assert.equal(s.reason, 'HOLIDAY');
});

test('isMarketClosed distinguishes weekdays', () => {
  assert.equal(isMarketClosed(u(2026, 9, 10, 10)), null);
  assert.equal(isMarketClosed(u(2026, 9, 12, 10)), 'WEEKEND');
});