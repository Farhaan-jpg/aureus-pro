import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { note, clear, reset, evaluate, getSirenHistory, getActiveFactors } from '../server/services/confluenceSirens.js';

describe('confluenceSirens', () => {
  test('fires only when ≥3 factors align with a core reversal signal', () => {
    reset();
    assert.equal(evaluate(100), null);
    note('sweep', 'BEARISH', 4410);
    assert.equal(evaluate(4410), null); // only 1 factor
    note('divergence', 'BEARISH', 4410);
    assert.equal(evaluate(4410), null); // 2 factors
    note('retailExtreme', 'LONG-heavy', 4410);
    const siren = evaluate(4410);
    assert.ok(siren);
    assert.equal(siren.direction, 'BEARISH');
    assert.equal(siren.factorCount, 3);
    assert.ok(siren.factors.some((f) => f.factor === 'sweep'));
  });

  test('non-core factors alone can never fire', () => {
    clear('sweep'); clear('divergence'); clear('retailExtreme');
    note('corrBreak', 'BREAK', 99);
    note('volExpansion', 'blow-off', 99);
    assert.equal(evaluate(99), null);
  });

  test('cooldown suppresses an identical factor set', () => {
    reset();
    note('sweep', 'BULLISH', 100);
    note('divergence', 'BULLISH', 100);
    note('retailExtreme', 'SHORT-heavy', 100);
    const first = evaluate(100);
    const second = evaluate(100);
    assert.ok(first);
    assert.equal(second, null);
    assert.ok(getSirenHistory().length >= 1);
    assert.ok(Object.keys(getActiveFactors()).length >= 3);
  });
});