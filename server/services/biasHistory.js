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

export function recordBiasSnapshot({ price, score, label, confidence, actionable, channels, session }) {
  if (price == null || score == null) return;
  snapshots.push({
    t: Date.now(),
    price: Number(price),
    score: Number(score),
    label: label || 'NEUTRAL',
    confidence: confidence ?? null,
    actionable: Boolean(actionable),
    channels: channels && typeof channels === 'object' ? channels : null,
    session: session || null
  });
  if (snapshots.length > MAX_SNAPSHOTS) snapshots.splice(0, snapshots.length - MAX_SNAPSHOTS);
  persist();
}

// Pure so it can be unit-tested with synthetic snapshots. Only judges calls we
// would have acted on (actionable, directional score) and resolves each against
// the first snapshot at/after the horizon. Calls whose forward print only
// exists after a market gap (>3x horizon) are UNRESOLVED: quoting a Friday
// evening call as "1H accuracy" against Monday's print would be a lie.
export function countUnresolved(snaps, horizonMs = 3600000) {
  let unresolved = 0;
  for (let i = 0; i < snaps.length; i++) {
    const s = snaps[i];
    if (s.actionable === false || Math.abs(s.score) < 10) continue;
    const goal = s.t + horizonMs;
    let fwd = null;
    for (let j = i + 1; j < snaps.length; j++) {
      if (snaps[j].t >= goal) { fwd = snaps[j]; break; }
    }
    if (fwd == null || fwd.t - goal > horizonMs * 3) unresolved++;
  }
  return unresolved;
}

export function resolveAccuracy(snaps, horizonMs = 3600000) {
  const resolved = [];
  for (let i = 0; i < snaps.length; i++) {
    const s = snaps[i];
    if (s.actionable === false) continue;
    if (Math.abs(s.score) < 10) continue;
    const goal = s.t + horizonMs;
    let fwd = null;
    for (let j = i + 1; j < snaps.length; j++) {
      if (snaps[j].t >= goal) { fwd = snaps[j]; break; }
    }
    if (!fwd || fwd.t - goal > horizonMs * 3) continue;
    if (fwd.price === s.price) continue;
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
  const unresolved = countUnresolved(snapshots, horizonMs);
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
    windowEnd: snapshots.length ? new Date(snapshots[snapshots.length - 1].t).toISOString() : null,
    unresolved,
    overall: { ...rate(rows), unresolved },
    byLabel,
    byConfidence
  };
}

export function getBiasSnapshotCount() {
  return snapshots.length;
}

// ── Channel-level calibration ───────────────────────────────────────────────
// Beyond judging the overall call, we credit each CHANNEL that actually cast a
// vote: a channel's vote direction (sign of its sub-score) is right when it
// matched the realized forward move. Enough resolved votes lets us dampen the
// channels that miss and amplify the ones that hit.
const CHANNEL_VOTE_MIN = 8;      // sub-score magnitude needed to count as a vote
const CAL_MIN_VOTES = 30;        // resolved votes required to trust a tuning
const CAL_SESSION_MIN = 24;      // resolved calls required to use session tuning

function normalizeSession(session) {
  const s = String(session || '').toLowerCase();
  if (s.includes('asia') || s.includes('tokyo')) return 'ASIA';
  if (s.includes('london')) return 'LONDON';
  if (s.includes('new york') || s.includes('ny') || s.includes('american')) return 'NEW YORK';
  return 'OTHER';
}

// Pure: score every channel's directional vote against the realized move.
export function resolveChannelAccuracy(snaps, horizonMs = 3600000) {
  const tally = new Map();
  const add = (key, hit) => {
    const cur = tally.get(key) || { votes: 0, hits: 0 };
    cur.votes += 1;
    if (hit) cur.hits += 1;
    tally.set(key, cur);
  };

  for (let i = 0; i < snaps.length; i++) {
    const s = snaps[i];
    if (s.actionable === false || Math.abs(s.score) < 10 || !s.channels) continue;
    const goal = s.t + horizonMs;
    let fwd = null;
    for (let j = i + 1; j < snaps.length; j++) {
      if (snaps[j].t >= goal) { fwd = snaps[j]; break; }
    }
    if (!fwd || fwd.t - goal > horizonMs * 3) continue;
    if (fwd.price === s.price) continue;
    const direction = Math.sign(fwd.price - s.price);
    for (const [key, val] of Object.entries(s.channels)) {
      const v = Number(val);
      if (!Number.isFinite(v) || Math.abs(v) < CHANNEL_VOTE_MIN) continue;
      const vote = Math.sign(v);
      if (vote === 0) continue;
      add(key, vote === direction);
    }
  }

  const channels = {};
  for (const [key, cur] of tally) {
    channels[key] = {
      votes: cur.votes,
      hits: cur.hits,
      hitRate: Number((cur.hits / cur.votes).toFixed(3))
    };
  }
  return channels;
}

function snapshotPool(session, snaps = snapshots) {
  if (!session) return snaps;
  const norm = normalizeSession(session);
  if (norm === 'OTHER') return snaps;
  const sub = snaps.filter((s) => normalizeSession(s.session) === norm);
  // Only use the session set once it has enough resolved calls to trust.
  return sub.length >= CAL_SESSION_MIN ? sub : snaps;
}

const DEFAULT_WEIGHTS = {
  macro: 0.13,
  commodity: 0.08,
  volatility: 0.09,
  ictSweeps: 0.08,
  cot: 0.08,
  retail: 0.06,
  news: 0.10,
  etf: 0.08,
  geo: 0.06,
  structure: 0.10,
  trend: 0.09,
  centralBank: 0.05
};

// hitRate 0.50 → ×1.0;  0.70 → ×1.50;  0.35 → ×0.70  (bounded).
function multiplierFor(hitRate) {
  const mult = 1 + (hitRate - 0.5) * 2.2;
  return Math.max(0.4, Math.min(1.7, mult));
}

function normalizeWeights(base, multipliers) {
  const out = {};
  let sum = 0;
  for (const [key, w] of Object.entries(base)) {
    const tuned = w * (multipliers[key]
      ? multiplierFor(multipliers[key].hitRate)
      : 1);
    out[key] = tuned;
    sum += tuned;
  }
  if (sum > 0) {
    for (const key of Object.keys(out)) out[key] = Number((out[key] / sum).toFixed(4));
  }
  return out;
}

let calibrationCache = { key: '', weights: DEFAULT_WEIGHTS, at: 0 };

// Weights blended toward deployed defaults until a channel has enough resolved
// votes. Session-aware: uses the per-session pool once it is statistically
// meaningful, otherwise the global pool — so London and NY can be tuned apart.
export function getCalibratedWeights(session = null, horizonMs = 3600000, snaps = null) {
  const pool = snaps || snapshotPool(session);
  const usesLiveModuleState = !snaps;
  const cacheKey = `${session || 'global'}|${horizonMs}|${snapshots.length}`;
  const now = Date.now();
  if (usesLiveModuleState && calibrationCache.key === cacheKey && now - calibrationCache.at < 10 * 60 * 1000) {
    return calibrationCache.weights;
  }

  const channels = resolveChannelAccuracy(pool, horizonMs);

  const trusted = {};
  for (const [key, cur] of Object.entries(channels)) {
    if (cur.votes >= CAL_MIN_VOTES) trusted[key] = cur;
  }

  const weights = normalizeWeights(DEFAULT_WEIGHTS, trusted);
  if (usesLiveModuleState) {
    calibrationCache = { key: cacheKey, weights, at: now };
  }
  return weights;
}

export function getChannelAccuracy(horizonMs = 3600000) {
  const poolAll = snapshotPool(null);
  const global = resolveChannelAccuracy(poolAll, horizonMs);
  const bySession = {};
  for (const sess of ['ASIA', 'LONDON', 'NEW YORK']) {
    const sub = snapshots.filter((s) => normalizeSession(s.session) === sess);
    if (sub.length >= CAL_SESSION_MIN) bySession[sess] = resolveChannelAccuracy(sub, horizonMs);
  }

  const channels = {};
  for (const [key, cur] of Object.entries(global)) {
    channels[key] = {
      ...cur,
      multiplier: cur.votes >= CAL_MIN_VOTES ? Number(multiplierFor(cur.hitRate).toFixed(2)) : 1,
      tuned: cur.votes >= CAL_MIN_VOTES
    };
  }

  return {
    horizonMinutes: Math.round(horizonMs / 60000),
    snapshotsWithChannels: snapshots.filter((s) => s.channels).length,
    snapshots: snapshots.length,
    windowStart: snapshots.length ? new Date(snapshots[0].t).toISOString() : null,
    windowEnd: snapshots.length ? new Date(snapshots[snapshots.length - 1].t).toISOString() : null,
    minVotes: CAL_MIN_VOTES,
    minSessionCalls: CAL_SESSION_MIN,
    live: snapshots.some((s) => s.channels),
    channels,
    bySession,
    weights: getCalibratedWeights(null, horizonMs)
  };
}