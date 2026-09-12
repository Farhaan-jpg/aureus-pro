import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMarketState, isMarketClosed } from '../server/services/marketState.js';

const u = (y, m, d, h) => new Date(Date.UTC(y, m - 1, d, h, 0, 0, 0));

test('open during a normal Thursday session', () => {
  const s = getMarketState(u(2026, 9, 10, 10));
  assert.equal(s.open, true);
  assert.equal(s.reason, 'OPEN');
  assert.ok(s.nextCloseUtc < s.nextOpenUtc); // close Friday, reopen Sunday
});

test('Friday before close is open, next close is that evening', () => {
  const s = getMarketState(u(2026, 9, 11, 14));
  assert.equal(s.open, true);
  assert.ok(s.nextCloseUtc.startsWith('2026-09-11T21:'));
});

test('Friday evening is weekend-closed', () => {
  const s = getMarketState(u(2026, 9, 11, 22));
  assert.equal(s.open, false);
  assert.equal(s.reason, 'WEEKEND');
});

test('Saturday is closed and reopens Sunday 21:00 UTC', () => {
  const s = getMarketState(u(2026, 9, 12, 10));
  assert.equal(s.open, false);
  assert.equal(s.nextOpenUtc, '2026-09-13T21:00:00.000Z');
});

test('Sunday before 21:00 is closed but reopens same day 21:00 UTC', () => {
  const s = getMarketState(u(2026, 9, 13, 20, 59));
  assert.equal(s.open, false);
  assert.equal(s.nextOpenUtc, '2026-09-13T21:00:00.000Z');
});

test('Sunday after 21:00 is open', () => {
  const s = getMarketState(u(2026, 9, 13, 21));
  assert.equal(s.open, true);
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