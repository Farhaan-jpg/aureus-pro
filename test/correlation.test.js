import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pearson, regimeLabel } from '../server/services/correlationMonitor.js';

test('pearson returns 1.00 for perfectly correlated series', () => {
  const a = Array.from({ length: 60 }, (_, i) => i + 1);
  const b = a.map((v) => v * 2 + 5);
  assert.equal(pearson(a, b), 1);
});

test('pearson returns -1.00 for perfectly anti-correlated series', () => {
  const a = Array.from({ length: 60 }, (_, i) => i + 1);
  const b = a.map((v) => -v);
  assert.equal(pearson(a, b), -1);
});

test('pearson aligns shorter series to the tail (slicing parity)', () => {
  const a = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
  const b = a.slice(-60); // only 60 samples, an exact copy of a's tail
  assert.equal(pearson(a, b), 1);
});

test('pearson returns null below minimum window', () => {
  const a = [1, 2, 3];
  const b = [3, 2, 1];
  assert.equal(pearson(a, b), null);
});

test('pearson tolerates flat (zero-variance) series', () => {
  const flat = Array.from({ length: 60 }, () => 5);
  const other = Array.from({ length: 60 }, (_, i) => i);
  assert.equal(pearson(flat, other), null);
});

test('regimeLabel buckets correlation regimes', () => {
  assert.equal(regimeLabel(-0.55), 'HEALTHY INVERSE');
  assert.equal(regimeLabel(-0.2), 'WEAK INVERSE');
  assert.equal(regimeLabel(0.3), 'BROKEN DIRECT');
  assert.equal(regimeLabel(null), 'UNKNOWN');
});