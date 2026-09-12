import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAccuracy, countUnresolved } from '../server/services/biasHistory.js';
import { titleTokens, isNearDuplicate } from '../server/services/rssNews.js';

const T0 = Date.UTC(2026, 8, 10, 12); // Thu Sep 10 2026 12:00Z
const snap = (minOffset, price, score, label, confidence = 80, actionable = true) => ({
  t: T0 + minOffset * 60000,
  price,
  score,
  label,
  confidence,
  actionable
});

test('resolveAccuracy judges calls against the forward print', () => {
  const snaps = [
    snap(0, 100, +20, 'BUY'),       // call up
    snap(70, 102, 0, 'NEUTRAL', 50), // +2 -> hit (1h horizon = 60min)
    snap(140, 99, 0, 'NEUTRAL', 50)
  ];
  // 70min >= 60min horizon: forward price 102 > 100, score +20 -> HIT
  const rows = resolveAccuracy(snaps, 60 * 60000);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].hit, true);
  assert.ok(rows[0].pnlPct > 0);
});

test('resolveAccuracy skips exits where the market never moved', () => {
  const snaps = [
    snap(0, 100, -20, 'SELL'),
    snap(70, 100, 0, 'NEUTRAL', 50)
  ];
  const rows = resolveAccuracy(snaps, 60 * 60000);
  assert.equal(rows.length, 0);
});

test('resolveAccuracy exempts calls whose forward print crosses the weekend', () => {
  // Friday 20:00Z call, 1H horizon; next snapshot is Monday 22:00Z (~50h later)
  const fri = Date.UTC(2026, 8, 11, 20, 0);
  const mon = Date.UTC(2026, 8, 14, 22, 0);
  const snaps = [
    { t: fri, price: 100, score: +20, label: 'BUY', confidence: 80, actionable: true },
    { t: fri + 10 * 60000, price: 101, score: 0, label: 'NEUTRAL', confidence: 50, actionable: true },
    { t: mon, price: 103, score: 0, label: 'NEUTRAL', confidence: 50, actionable: true }
  ];
  assert.equal(resolveAccuracy(snaps, 60 * 60000).length, 0);
  assert.equal(countUnresolved(snaps, 60 * 60000), 1);
});

test('resolveAccuracy ignores non-actionable and weak calls', () => {
  const snaps = [
    snap(0, 100, -20, 'SELL', 80, false),
    snap(0, 100, 5, 'NEUTRAL'),
    snap(70, 90, 0, 'NEUTRAL', 50)
  ];
  assert.equal(resolveAccuracy(snaps, 60 * 60000).length, 0);
});

test('titleTokens normalizes and drops stopwords', () => {
  const a = titleTokens('Gold rises on Fed cut bets');
  assert.ok(a.has('gold') && a.has('rises') && a.has('cut') && a.has('bets'));
  assert.ok(!a.has('on') && !a.has('the'));
});

test('isNearDuplicate collapses syndicated copies of one story', () => {
  const a = titleTokens('Gold rises on Fed cut bets, touches one-month high');
  const b = titleTokens('Gold rallies as Fed cut bets grow, touches high');
  const c = titleTokens('Chinese stocks climb after stimulus announcement');
  assert.equal(isNearDuplicate(a, b), true);
  assert.equal(isNearDuplicate(a, c), false);
});

test('isNearDuplicate does not conflate opposing stories', () => {
  const bull = titleTokens('Gold rises as dollar slips, hits record high');
  const bear = titleTokens('Gold falls sharply as dollar strengthens');
  assert.equal(isNearDuplicate(bull, bear), false);
});