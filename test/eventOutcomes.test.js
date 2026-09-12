import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseFigure, surpriseRule, evaluateReleasedEvent } from '../server/services/eventOutcomes.js';

describe('parseFigure', () => {
  test('parses numeric, percent, and comma-separated figures', () => {
    assert.equal(parseFigure('0.2%').value, 0.2);
    assert.equal(parseFigure('218K').value, 218);
    assert.equal(parseFigure('1,234.5').value, 1234.5);
    assert.equal(parseFigure('4.75%').value, 4.75);
  });

  test('rejects blanks and non-numbers', () => {
    assert.equal(parseFigure(''), null);
    assert.equal(parseFigure('N/A'), null);
    assert.equal(parseFigure('—'), null);
    assert.equal(parseFigure(undefined), null);
  });
});

describe('surpriseRule', () => {
  test('USD CPI miss → gold BULLISH', () => {
    const r = surpriseRule({ currency: 'USD', actual: '0.1%', forecast: '0.3%', impact: 'HIGH' });
    assert.ok(r);
    assert.equal(r.direction, 'BULLISH');
    assert.equal(r.mismatch, -0.2);
  });

  test('USD NFP beat → gold BEARISH', () => {
    const r = surpriseRule({ currency: 'USD', actual: '300K', forecast: '200K', impact: 'HIGH' });
    assert.ok(r);
    assert.equal(r.direction, 'BEARISH');
    assert.equal(r.magnitude, 'BIG');
  });

  test('EUR strong print → gold BULLISH (dollar headwind)', () => {
    const r = surpriseRule({ currency: 'EUR', actual: '1.2%', forecast: '0.8%', impact: 'HIGH' });
    assert.ok(r);
    assert.equal(r.direction, 'BULLISH');
  });

  test('big rate surprise scales with pp, not percent', () => {
    const r = surpriseRule({ currency: 'USD', actual: '4.50%', forecast: '4.75%', impact: 'CRITICAL' });
    assert.ok(r);
    assert.equal(r.direction, 'BULLISH');
    assert.equal(r.magnitude, 'BIG'); // 25bp
    assert.equal(r.mismatch, -0.25);
  });

  test('returns null without a forecast or actual', () => {
    assert.equal(surpriseRule({ currency: 'USD', actual: '', forecast: '0.2%' }), null);
    assert.equal(surpriseRule({ currency: 'USD', actual: '0.2%', forecast: '' }), null);
  });
});

describe('evaluateReleasedEvent', () => {
  test('ignores future or unsurmisable events', () => {
    const future = { id: 1, title: 'CPI', currency: 'USD', actual: '0.2%', forecast: '0.3%', date: new Date(Date.now() + 3600000).toISOString() };
    assert.equal(evaluateReleasedEvent(future), null);
    const noActual = { id: 2, title: 'CPI', currency: 'USD', actual: '', forecast: '0.3%', date: new Date(Date.now() - 60000).toISOString() };
    assert.equal(evaluateReleasedEvent(noActual), null);
  });

  test('flags a released surprise', () => {
    const ev = { id: 3, title: 'Nonfarm Payrolls', currency: 'USD', impact: 'HIGH', actual: '150K', forecast: '250K', date: new Date(Date.now() - 60000).toISOString() };
    const out = evaluateReleasedEvent(ev);
    assert.ok(out);
    assert.equal(out.type, 'SURPRISE');
    assert.equal(out.surprise.direction, 'BULLISH');
    assert.equal(out.surprise.magnitude, 'BIG');
  });
});