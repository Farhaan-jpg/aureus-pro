import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateCompositeBias } from '../server/services/compositeBias.js';
import { scoreCentralBankWatch } from '../server/services/centralBank.js';

function freshMarket(overrides = {}) {
  return {
    assets: {
      GOLD: { price: 4350, change: 2, changePercent: 0.05, ageMs: 8000 },
      SILVER: { price: 65, changePercent: 0 },
      CRUDE_OIL: { changePercent: 0 },
      DXY: { changePercent: 0 },
      VIX: { price: 16 },
      USDJPY: { price: 149 },
      US02Y: { price: 3.9 },
      US10Y: { price: 4.1 }
    },
    realYield10Y: 1.9,
    yieldCurveSpread: 0.2,
    gsr: 67,
    goldSpot: { price: 4350 },
    marketState: { open: true },
    volatilityRegime: { live: true, compositePercentile: 55 },
    longCorrelations: { live: true, goldDxy: -0.4, goldUs10y: -0.5 },
    keyLevels: {
      levels: { pivots: { p: 4350, r1: 4360, r2: 4370, s1: 4340, s2: 4330 }, pdh: 4370, pdl: 4330, pwh: 4400, pwl: 4310 }
    },
    asianRange: { high: 4355, low: 4345 },
    ...overrides
  };
}

test('empty dataset returns non-actionable neutral', () => {
  const out = calculateCompositeBias(null, [], null, {});
  assert.equal(out.actionable, false);
  assert.equal(out.label, 'NEUTRAL');
  assert.equal(out.score, 0);
});

test('fresh open-market data is actionable', () => {
  const out = calculateCompositeBias(freshMarket(), [], null, {});
  assert.equal(out.actionable, true);
});

test('closed market flips actionable to false', () => {
  const closed = freshMarket({ marketState: { open: false } });
  const out = calculateCompositeBias(closed, [], null, {});
  assert.equal(out.actionable, false);
});

test('stale tape flips actionable to false even while open', () => {
  const stale = freshMarket();
  stale.assets.GOLD.ageMs = 90000;
  stale.goldSpot.ageMs = 90000;
  const out = calculateCompositeBias(stale, [], null, {});
  assert.equal(out.actionable, false);
});

test('breakdown exposes all 12 channels including trend and central bank', () => {
  const out = calculateCompositeBias(
    freshMarket(),
    [],
    null,
    { timeframes: { live: true, confluence: { bullPct: 80, bearPct: 10 } } }
  );
  const keys = Object.keys(out.breakdown);
  assert.equal(keys.length, 12);
  assert.ok(keys.includes('trend'));
  assert.ok(keys.includes('structure'));
  assert.ok(keys.includes('macro'));
  assert.ok(keys.includes('centralBank'));
});

test('central bank watch steers the channel directionally', () => {
  const bull = calculateCompositeBias(freshMarket(), [], null, { centralBank: { watch: { score: 55 } } });
  const bear = calculateCompositeBias(freshMarket(), [], null, { centralBank: { watch: { score: -55 } } });
  assert.ok(bull.breakdown.centralBank > 0);
  assert.ok(bull.breakdown.centralBank > bear.breakdown.centralBank);
});

test('central bank watch decays headlines on the 14-day half-life', () => {
  const now = Date.now();
  const headline = 'PBOC adds gold to reserves as China continues bullion diversification';
  const fresh = scoreCentralBankWatch([
    { title: headline, sentiment: 'BULLISH', impact: 3, pubDate: new Date(now - 3600000).toISOString() }
  ]);
  const stale = scoreCentralBankWatch([
    { title: headline, sentiment: 'BULLISH', impact: 3, pubDate: new Date(now - 30 * 86400000).toISOString() }
  ]);
  assert.equal(fresh.live, true);
  assert.ok(fresh.score > 0);
  assert.ok(Math.abs(stale.score) < Math.abs(fresh.score), 'aged headline should carry less weight');
});

test('trend channel pushes score toward bullish alignment', () => {
  const bullish = calculateCompositeBias(
    freshMarket(),
    [],
    null,
    { timeframes: { live: true, confluence: { bullPct: 85, bearPct: 5 } } }
  );
  const neutral = calculateCompositeBias(
    freshMarket(),
    [],
    null,
    { timeframes: { live: true, confluence: { bullPct: 40, bearPct: 45 } } }
  );
  assert.ok(bullish.breakdown.trend >= 0);
  assert.ok(bullish.breakdown.trend > neutral.breakdown.trend);
});

test('bias is neutral when nothing moves', () => {
  const out = calculateCompositeBias(freshMarket(), [], null, {});
  assert.ok(out.score >= -20 && out.score <= 20);
  assert.equal(out.label, 'NEUTRAL');
});

test('news impact fades as headlines age (5.5h half-life)', () => {
  const now = Date.now();
  const freshNews = [{ title: 'CPI hot', sentiment: 'BEARISH', impact: 5, pubDate: new Date(now - 5 * 60000).toISOString() }];
  const oldNews = [{ title: 'CPI hot', sentiment: 'BEARISH', impact: 5, pubDate: new Date(now - 30 * 3600000).toISOString() }];
  const didAgeDecay = calculateCompositeBias(freshMarket(), freshNews, null, {}).breakdown.news;
  const aged = calculateCompositeBias(freshMarket(), oldNews, null, {}).breakdown.news;
  assert.ok(Math.abs(aged) < Math.abs(didAgeDecay), `aged=${aged} should be smaller than fresh=${didAgeDecay}`);
  assert.ok(didAgeDecay !== 0, 'fresh headline should move the news channel');
});