import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { applyResolutions, recordHeadline, getNewsCredibility, getNewsAccuracy } from '../server/services/newsFeedback.js';

describe('newsFeedback source credibility', () => {
  test('resolved BULLISH calls against a rising tape lift credibility', () => {
    const fake = { source: 'TestWire', title: 'headline a', sentiment: 'BULLISH', score: 5 };
    for (let i = 0; i < 8; i++) {
      recordHeadline({ ...fake, title: `headline ${i}`, id: `t${i}` }, 100);
    }
    const resolved = applyResolutions(
      Array.from({ length: 8 }, (_, i) => ({ id: `t${i}`, source: 'TestWire', sentiment: 'BULLISH', score: 5, price: 100, t: 0 })),
      101.5
    );
    assert.equal(resolved, 8);
    const acc = getNewsAccuracy();
    const row = acc.sources.find((s) => s.source === 'TestWire');
    assert.ok(row);
    assert.equal(row.hits, 8);
    assert.equal(row.calls, 8);
    assert.equal(row.hitRate, 1);
    assert.equal(row.credibility, 1.5); // capped
  });

  test('credibility stays 1 until enough calls are in', () => {
    const acc = getNewsAccuracy();
    const unknown = acc.sources.find((s) => s.source === 'NeverHeard');
    assert.equal(unknown, undefined);
  });

  test('report reveals the resolve window and min calls', () => {
    const acc = getNewsAccuracy();
    assert.equal(acc.resolveWindowMinutes, 30);
    assert.equal(acc.minCalls, 8);
    assert.ok(Number.isFinite(acc.pending));
  });
});