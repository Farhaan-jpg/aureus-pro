import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionFromUtc, ukDaylightTime, usDaylightTime } from '../server/services/session.js';

const u = (y, m, d, h = 0) => new Date(Date.UTC(y, m - 1, d, h, 0, 0, 0));

// Sep 2026: US + UK both on daylight time. Nov 2026: both standard time.

test('London open shifts with UK daylight time', () => {
  assert.equal(sessionFromUtc(u(2026, 9, 10, 8)), 'LONDON_OPEN');  // BST -> 07:00Z start, 08:00Z mid
  assert.equal(sessionFromUtc(u(2026, 9, 10, 6)), 'ASIAN_PACIFIC'); // before open
  assert.equal(sessionFromUtc(u(2026, 11, 10, 7)), 'ASIAN_PACIFIC'); // GMT -> opens 08:00Z
  assert.equal(sessionFromUtc(u(2026, 11, 10, 8)), 'LONDON_OPEN');
});

test('New York afternoon window extends to 21:00Z in winter', () => {
  assert.equal(sessionFromUtc(u(2026, 9, 10, 19)), 'NY_AFTERNOON'); // summer end 20:00Z
  assert.equal(sessionFromUtc(u(2026, 9, 10, 20, 5)), 'ASIAN_PACIFIC');
  assert.equal(sessionFromUtc(u(2026, 11, 10, 20)), 'NY_AFTERNOON'); // winter end 21:00Z
  assert.equal(sessionFromUtc(u(2026, 11, 10, 21, 5)), 'ASIAN_PACIFIC');
});

test('overlap band is stable across seasons', () => {
  assert.equal(sessionFromUtc(u(2026, 9, 10, 13)), 'NY_OVERLAP');
  assert.equal(sessionFromUtc(u(2026, 11, 10, 13)), 'NY_OVERLAP');
});

test('daylight-time helpers agree on the 2026 boundaries', () => {
  assert.equal(usDaylightTime(u(2026, 3, 8)), true);   // 2nd Sun Mar
  assert.equal(usDaylightTime(u(2026, 11, 1)), false); // 1st Sun Nov
  assert.equal(ukDaylightTime(u(2026, 3, 28)), false); // BST starts last Sun Mar (29th)
  assert.equal(ukDaylightTime(u(2026, 3, 29)), true);
  assert.equal(ukDaylightTime(u(2026, 10, 24)), true);  // last Sun Oct (25th)
  assert.equal(ukDaylightTime(u(2026, 10, 25)), false); // BST over
});