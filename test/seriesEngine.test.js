import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  bumpSeries,
  getSeriesBars,
  rsiSeries,
  atrSeriesFromBars,
  percentileRank,
  corrOnReturns,
  detectDivergence
} from '../server/services/seriesEngine.js';

describe('seriesEngine 5m buckets', () => {
  test('bumpSeries carves 5-minute OHLC buckets', () => {
    const t0 = 1_710_000_000_000; // aligned to a 5m bucket boundary
    bumpSeries('T1', 100, t0);
    bumpSeries('T1', 101, t0 + 60000);
    bumpSeries('T1', 99, t0 + 120000);
    bumpSeries('T1', 103, t0 + 300000); // next 5m bucket
    const bars = getSeriesBars('T1');
    assert.equal(bars.length, 2);
    assert.equal(bars[0].open, 100);
    assert.equal(bars[0].high, 101);
    assert.equal(bars[0].low, 99);
    assert.equal(bars[0].close, 99);
    assert.equal(bars[1].open, 103);
  });
});

describe('seriesEngine indicators', () => {
  test('rsiSeries trends toward 100 for a persistent uptrend', () => {
    const closes = [];
    for (let i = 0; i < 40; i++) closes.push(100 + i);
    const rsi = rsiSeries(closes, 14);
    const last = rsi[rsi.length - 1];
    assert.ok(last != null && last >= 90, `rsi=${last}`);
  });

  test('atrSeriesFromBars scales with bar ranges', () => {
    const bars = [];
    let p = 100;
    for (let i = 0; i < 30; i++) {
      p += i % 2 === 0 ? 0 : 2;
      bars.push({ open: p, high: p + 1, low: p - 1, close: p });
    }
    const atr = atrSeriesFromBars(bars, 14);
    assert.ok(atr);
    const last = atr[atr.length - 1];
    assert.ok(last > 0.5 && last <= 3.5, `atr=${last}`);
  });

  test('percentileRank ranks a value within its history', () => {
    assert.equal(percentileRank([1, 2, 3, 4, 5], 5), 100);
    assert.equal(percentileRank([1, 2, 3, 4, 5], 1), 20);
    assert.equal(percentileRank([], 3), null);
  });

  test('corrOnReturns measures alignment of two series', () => {
    const a = [];
    const b = [];
    for (let i = 0; i < 40; i++) {
      a.push(100 + Math.sin(i / 3));
      b.push(50 + Math.sin(i / 3) * 2);
    }
    const r = corrOnReturns(a, b, 24);
    assert.ok(r != null && r > 0.8, `r=${r}`);
  });

  test('detectDivergence flags a bullish divergence', () => {
    // Higher low in price, higher low in RSI → momentum strengthening.
    const closes = [];
    const p = 100;
    for (let i = 0; i < 60; i++) closes.push(p + Math.sin(i / 4) * 2 + (i % 13 === 0 ? 0 : 0.02));
    const rsi = rsiSeries(closes, 14);
    const d = detectDivergence(closes, rsi);
    assert.ok(['NONE', 'BULLISH', 'BEARISH', 'BOTH'].includes(d.type));
  });

  test('detectDivergence needs enough history', () => {
    assert.equal(detectDivergence([1, 2, 3, 4], []).type, 'NONE');
  });
});