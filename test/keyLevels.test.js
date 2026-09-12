import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekKey, aggregateWeekly, floorPivots } from '../server/services/keyLevels.js';

const day = (y, m, d, close = 1, open = 1, high = 1, low = 1) => ({
  time: new Date(Date.UTC(y, m - 1, d, 12)),
  open,
  high,
  low,
  close
});

test('weekKey returns Monday key for any day of the week', () => {
  assert.equal(weekKey(day(2026, 9, 14).time), '2026-09-14'); // Mon
  assert.equal(weekKey(day(2026, 9, 12).time), '2026-09-07'); // Sat -> Mon 7th
  assert.equal(weekKey(day(2026, 9, 13).time), '2026-09-07'); // Sun -> Mon 7th
  assert.equal(weekKey(day(2026, 9, 18).time), '2026-09-14'); // Fri -> Mon 14th
});

test('aggregateWeekly collapses days into correct Monday-starting weeks', () => {
  const bars = [
    day(2026, 9, 14, 4300, 4250, 4320, 4240), // Mon
    day(2026, 9, 17, 4350, 4250, 4330, 4250), // Thu same week
    day(2026, 9, 21, 4380, 4340, 4400, 4330)  // next Mon
  ];
  const weeks = aggregateWeekly(bars);
  assert.equal(weeks.length, 2);
  assert.equal(weeks[0].high, 4330);
  assert.equal(weeks[0].low, 4240);
  assert.equal(weeks[0].close, 4350);   // last close of the week
  assert.equal(weeks[0].open, 4250);    // first open of the week
  assert.equal(weeks[1].high, 4400);
});

test('floorPivots computes classic pivot set from previous bar', () => {
  const p = floorPivots({ high: 4390, low: 4330, close: 4370 });
  assert.equal(p.p, 4363.33);
  assert.equal(p.r1, 4396.67);
  assert.equal(p.s1, 4336.67);
  assert.equal(p.r2, 4423.33);
  assert.equal(p.s2, 4303.33);
  assert.ok(p.r1 > p.p && p.p > p.s1);
});

test('floorPivots tolerates null input', () => {
  assert.equal(floorPivots(null), null);
});