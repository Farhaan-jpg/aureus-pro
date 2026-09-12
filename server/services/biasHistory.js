// Bias outcome tracker: snapshots the composite bias against the live gold
// print on a fixed cadence, then resolves each directional call against the
// price N minutes later. This is the only feedback loop that can actually
// measure whether the bias is right (and whether confidence is calibrated).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { recordError } from './errorLog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'bias_history.json');
const MAX_SNAPSHOTS = 3000;

function load() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

const snapshots = load();

function persist() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(snapshots));
  } catch (err) {
    recordError('biasHistoryPersist', err?.message);
  }
}

export function recordBiasSnapshot({ price, score, label, confidence, actionable }) {
  if (price == null || score == null) return;
  snapshots.push({
    t: Date.now(),
    price: Number(price),
    score: Number(score),
    label: label || 'NEUTRAL',
    confidence: confidence ?? null,
    actionable: Boolean(actionable)
  });
  if (snapshots.length > MAX_SNAPSHOTS) snapshots.splice(0, snapshots.length - MAX_SNAPSHOTS);
  persist();
}

// Pure so it can be unit-tested with synthetic snapshots. Only judges calls we
// would have acted on (actionable, directional score) and resolves each against
// the first snapshot at/after the horizon.
export function resolveAccuracy(snaps, horizonMs = 3600000) {
  const resolved = [];
  for (let i = 0; i < snaps.length; i++) {
    const s = snaps[i];
    if (s.actionable === false) continue;
    if (Math.abs(s.score) < 10) continue;
    let fwd = null;
    for (let j = i + 1; j < snaps.length; j++) {
      if (snaps[j].t >= s.t + horizonMs) { fwd = snaps[j]; break; }
    }
    if (!fwd || fwd.price === s.price) continue;
    const moved = Math.sign(fwd.price - s.price);
    const called = Math.sign(s.score);
    resolved.push({
      t: s.t,
      label: s.label,
      confidence: s.confidence,
      hit: moved === called,
      pnlPct: ((fwd.price - s.price) / s.price) * called * 100
    });
  }
  return resolved;
}

function rate(rows) {
  if (!rows.length) return { resolved: 0, hits: 0, hitRate: null, avgPnlPct: null };
  const hits = rows.filter((r) => r.hit).length;
  return {
    resolved: rows.length,
    hits,
    hitRate: Number((hits / rows.length).toFixed(3)),
    avgPnlPct: Number((rows.reduce((a, r) => a + r.pnlPct, 0) / rows.length).toFixed(3))
  };
}

export function getBiasAccuracy(horizonMs = 3600000) {
  const rows = resolveAccuracy(snapshots, horizonMs);
  const byLabel = {};
  for (const lbl of ['STRONG BUY', 'BUY', 'SELL', 'STRONG SELL']) {
    const sub = rows.filter((r) => r.label === lbl);
    if (sub.length) byLabel[lbl] = rate(sub);
  }
  const buckets = { '<50': [], '50-69': [], '70-89': [], '90+': [] };
  for (const r of rows) {
    const c = r.confidence ?? 0;
    const key = c >= 90 ? '90+' : c >= 70 ? '70-89' : c >= 50 ? '50-69' : '<50';
    buckets[key].push(r);
  }
  const byConfidence = {};
  for (const [k, v] of Object.entries(buckets)) if (v.length) byConfidence[k] = rate(v);

  return {
    horizonMinutes: Math.round(horizonMs / 60000),
    snapshots: snapshots.length,
    windowStart: snapshots.length ? new Date(snapshots[0].t).toISOString() : null,
    overall: rate(rows),
    byLabel,
    byConfidence
  };
}

export function getBiasSnapshotCount() {
  return snapshots.length;
}