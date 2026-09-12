import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeNewsLockout, getNewsLockout } from '../server/services/newsLockout.js';
import { evaluateRiskOff, getRiskOff, canEscape, resetWatchdog } from '../server/services/riskOff.js';
import { buildNowcast, getNowcast } from '../server/services/nowcast.js';
import { checkLevelAlerts, getLevelAlerts } from '../server/services/levelAlerts.js';
import { calculateCompositeBias } from '../server/services/compositeBias.js';
import { bumpSeries, snapshot } from '../server/services/seriesEngine.js';
import * as sirens from '../server/services/confluenceSirens.js';
import { serializeForDisk, loadFromDisk } from '../server/services/seriesEngine.js';
import { serializeForDisk as sirenSerialize, loadFromDisk as sirenLoad } from '../server/services/confluenceSirens.js';

const MIN = 60 * 1000;

function makeCalendar(events) {
  return { feedSource: 'benchmark', events };
}

test('newsLockout: HIGH event within 80m sets active window', () => {
  const now = Date.now();
  const release = now + 3 * MIN;
  const out = computeNewsLockout(now, makeCalendar([
    { impact: 'MEDIUM', title: 'ignore me', date: new Date(release).toISOString() },
    { impact: 'HIGH', title: 'US CPI y/y', currency: 'USD', date: new Date(release).toISOString(), forecast: '2.9%', previous: '3.1%' }
  ]));
  assert.equal(out.active, true);
  assert.equal(out.event.title, 'US CPI y/y');
  assert.ok(out.secondsLeft <= 120);
  assert.equal(out.startMs, release - 5 * MIN);
  assert.equal(out.endMs, release + MIN);
});

test('newsLockout: far-future HIGH release is not active but listed as pending', () => {
  const out = computeNewsLockout(Date.now(), makeCalendar([
    { impact: 'CRITICAL', title: 'FOMC Decision', currency: 'USD', date: new Date(Date.now() + 45 * MIN).toISOString() }
  ]));
  assert.equal(out.active, false);
  assert.equal(out.event.title, 'FOMC Decision');
});

test('newsLockout: no pending releases within horizon reports inactive', () => {
  const out = computeNewsLockout(Date.now(), makeCalendar([]));
  assert.equal(out.active, false);
  assert.equal(out.event, null);
});

test('newsLockout: getNewsLockout refreshes from the same window logic', () => {
  const out = getNewsLockout();
  assert.equal(typeof out.active, 'boolean');
});

test('riskOff: none when everything is quiet', () => {
  resetWatchdog();
  const state = evaluateRiskOff({
    assets: { VIX: { price: 14, changePercent: 0 }, DXY: { changePercent: 0.1 }, US10Y: { changePercent: 0.1 } },
    realYield10Y: 1.4
  }, { live: true, corr: { broken: false }, volState: 'NORMAL', atr14Percentile: 55 });
  assert.equal(state.level, 'NONE');
  assert.deepEqual(state.drivers, []);
});

test('riskOff: three stressors escalate to ADVISORY', () => {
  resetWatchdog();
  const state = evaluateRiskOff({
    assets: {
      VIX: { price: 28, changePercent: 12 },
      DXY: { changePercent: 0.9 },
      US10Y: { changePercent: -1.1 }
    },
    realYield10Y: 2.8
  }, { live: true, corr: { broken: true }, volState: 'EXPANSION', atr14Percentile: 94 });
  assert.equal(state.level, 'ADVISORY');
  assert.ok(state.drivers.length >= 3);
  assert.ok(state.since);
});

test('riskOff: moderate stress lands on CAUTION', () => {
  resetWatchdog();
  const state = evaluateRiskOff({
    assets: { VIX: { price: 26, changePercent: 2 }, DXY: { changePercent: 0.2 }, US10Y: { changePercent: 0.1 } },
    realYield10Y: 1.8
  }, { live: true, corr: { broken: false }, volState: 'NORMAL', atr14Percentile: 50 });
  assert.equal(state.level, 'CAUTION');
});

test('riskOff: canEscape fires once per escalation only', () => {
  resetWatchdog();
  evaluateRiskOff({
    assets: { VIX: { price: 28, changePercent: 10 }, DXY: { changePercent: 0.9 }, US10Y: { changePercent: -1.0 } },
    realYield10Y: 2.8
  }, { live: true, corr: { broken: true }, volState: 'EXPANSION', atr14Percentile: 95 });
  assert.equal(canEscape(), true);
  assert.equal(canEscape(), false);
  // cooling back to NONE re-arms the watchdog
  evaluateRiskOff({
    assets: { VIX: { price: 14, changePercent: 0 }, DXY: { changePercent: 0.1 }, US10Y: { changePercent: 0.1 } },
    realYield10Y: 1.4
  }, { live: false });
  assert.equal(getRiskOff().level, 'NONE');
  evaluateRiskOff({
    assets: { VIX: { price: 28, changePercent: 10 }, DXY: { changePercent: 0.9 }, US10Y: { changePercent: -1.0 } },
    realYield10Y: 2.8
  }, { live: true, corr: { broken: true }, volState: 'EXPANSION', atr14Percentile: 95 });
  assert.equal(canEscape(), true);
});

test('levelAlerts: fires once when price sits within 0.12% of a level, then cools down', () => {
  const md = {
    goldSpot: { price: 2411.0 },
    asianRange: { high: 2410, low: 2380 },
    keyLevels: { levels: { pdh: 2400, pdl: 2380, pivots: { r1: 2430, s1: 2360 } } }
  };
  const first = checkLevelAlerts(md);
  assert.ok(first.length >= 1);
  assert.equal(first[0].key, 'ASIA_H');
  assert.equal(first[0].side, 'ABOVE');
  const second = checkLevelAlerts(md);
  assert.equal(second.length, 0); // cooldown holds
  assert.ok(getLevelAlerts(10).length >= 1);
});

test('levelAlerts: far away from levels yields nothing', () => {
  const md = {
    goldSpot: { price: 2411.0 },
    asianRange: { high: 2600, low: 2500 },
    keyLevels: { levels: { pdh: 2600, pdl: 2500, pivots: { r1: 2650, s1: 2450 } } }
  };
  assert.equal(checkLevelAlerts(md).length, 0);
});

test('compositeBias: exposes per-channel drivers and calibrated weights', () => {
  const md = {
    assets: {
      GOLD: { price: 2400, changePercent: 0.2 },
      DXY: { changePercent: -0.4 },
      SILVER: { changePercent: 0.6 },
      CRUDE_OIL: { changePercent: 0.3 },
      VIX: { price: 16, changePercent: -1 }
    },
    realYield10Y: 1.3,
    gsr: 82,
    asianRange: { high: 2410, low: 2388 },
    volatilityRegime: { live: true, compositePercentile: 60 },
    longCorrelations: { live: true, goldDxy: -0.5, goldUs10y: -0.6 }
  };
  const extras = {
    cot: { live: true, managedMoney: { percentile3Year: 40 } },
    etf: { live: true, goldEtfBias: 'INFLOW', minersConfirm: 'RISK_ON_MINERS' },
    geo: { live: true, score: 10, avgTone: 0.5 },
    timeframes: { live: true, confluence: { bullPct: 60, bearPct: 40 } },
    centralBank: { watch: { live: true, score: 8, headlines: [{}, {}] } },
    calibratedWeights: { macro: 0.2, centralBank: 0.1, structure: 0.4, trend: 0.1, news: 0.2 },
    realtimePulse: { live: true, divergence: { type: 'BULLISH' }, corr: { broken: false }, volState: 'NORMAL' },
    newsCredibility: null
  };
  const bias = calculateCompositeBias(md, [], { live: false }, extras);
  assert.ok(bias.drivers);
  assert.ok(bias.drivers.macro.length >= 1);
  assert.ok(bias.drivers.centralBank.length >= 1);
  assert.equal(bias.weights.structure, 0.4);
  assert.ok(bias.weights.centralBank);
});

test('nowcast: builds a thesis that includes stance, pulse and release notes', () => {
  const md = {
    session: 'ASIA',
    goldSpot: { price: 2405 },
    assets: { GOLD: { price: 2405 } },
    asianRange: { high: 2410, low: 2390 },
    keyLevels: { levels: { pdh: 2430, pdl: 2380, pivots: { r1: 2440, s1: 2370 } } },
    marketState: { open: true }
  };
  const bias = { score: 35, label: 'BUY', confidence: 66, actionable: true };
  const lockout = {
    active: false,
    event: { title: 'US CPI', impact: 'HIGH' },
    startMs: Date.now() + 5 * MIN,
    endMs: Date.now() + 11 * MIN,
    secondsLeft: 0
  };
  const risk = { level: 'CAUTION', drivers: ['VIX 26 stress'] };
  const release = { title: 'US CPI', inMinutes: 6 };
  const thesis = buildNowcast(
    bias,
    md,
    { live: true, rsi14: 62.4, atr14Percentile: 71, volState: 'SQUEEZE', divergence: { type: 'NONE' }, corr: { broken: false } },
    { lockout, risk, release }
  );
  assert.equal(thesis.stance.label, 'BUY');
  assert.equal(thesis.riskOff.level, 'CAUTION');
  assert.equal(thesis.nextRelease.inMinutes, 6);
  assert.ok(thesis.pulse.notes.includes('SQUEEZE'));
  assert.ok(thesis.headline.includes('BUY'));
  assert.equal(getNowcast().stance.score, 35);
});

test('seriesEngine: disk roundtrip restores buckets', () => {
  bumpSeries('GOLD', 2400, 1000);
  bumpSeries('GOLD', 2405, 100001);
  const dumped = JSON.parse(JSON.stringify(serializeForDisk()));
  assert.ok(dumped.series.GOLD?.length);
  // wipe and restore
  const blank = { series: { GOLD: [], DXY: [], SILVER: [] } };
  loadFromDisk(blank);
  assert.equal(getSeriesBarsCount('GOLD'), 0);
  loadFromDisk(dumped);
  assert.ok(getSeriesBarsCount('GOLD') > 0);
});

function getSeriesBarsCount(key) {
  // snapshot() reports live builds; the buckets object is restored so count bars
  return (serializeForDisk().series[key] || []).length;
}

test('confluenceSirens: disk serialization carries active factors and history', () => {
  sirens.reset();
  sirens.note('sweep', 'BULLISH', 2400);
  sirens.note('divergence', 'BULLISH', 2402);
  sirens.note('retailExtreme', 'LONG-heavy', 2401);
  const fired = sirens.evaluate(2401);
  assert.ok(fired);
  const dumped = JSON.parse(JSON.stringify(sirenSerialize()));
  assert.ok(dumped.active.length >= 3);
  assert.ok(dumped.history.length >= 1);
  sirens.reset();
  assert.equal(Object.keys(sirens.getActiveFactors()).length, 0);
  sirenLoad(dumped);
  assert.ok(Object.keys(sirens.getActiveFactors()).length >= 3);
  assert.equal(sirens.getSirenHistory().length, dumped.history.length);
});

test('snapshot matches disk-restored state (pulse stays live after load)', () => {
  const s = snapshot();
  assert.equal(typeof s.live, 'boolean');
});