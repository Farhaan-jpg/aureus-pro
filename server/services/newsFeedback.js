// News → price feedback loop: records each classified headline with the gold
// print at publish, then resolves the realized move a short window later and
// credits the headline only when the tape actually agreed with its sentiment.
// Per-source credibility emerges from those outcomes and is fed back into the
// composite bias so unreliable sources can't bias the news channel forever.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { recordError } from './errorLog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

const RESOLVE_MS = 30 * 60 * 1000;      // measure 30m after publish
const MIN_MOVE_PCT = 0.05;              // ignore flat tape
const MAX_PENDING = 400;
const MIN_CALLS = 8;                    // credibility needs this many calls

let pending = [];                        // { id, source, sentiment, price, score, t }
let stats = {};                          // source -> { calls, hits, scoreSum }
let settledIds = new Set();
let loaded = false;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'news_feedback.json'), 'utf8'));
    if (raw && typeof raw.stats === 'object') stats = raw.stats;
    if (Array.isArray(raw?.pending)) pending = raw.pending;
  } catch (err) {}
}

function persist() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(DATA_DIR, 'news_feedback.json'),
      JSON.stringify({ stats, pending }, null, 2), 'utf8');
  } catch (err) {
    recordError('newsFeedbackPersist', err?.message);
  }
}

export function recordHeadline(item, price) {
  if (!item?.title || price == null || item.sentiment === 'NEUTRAL') return;
  load();
  const id = item.id != null ? String(item.id) : item.title.slice(0, 64);
  if (pending.some((p) => p.id === id) || settledIds.has(id)) return;
  pending.push({
    id,
    source: item.source || 'unknown',
    sentiment: item.sentiment,
    score: item.score || 0,
    price: Number(price),
    t: Date.now()
  });
  if (pending.length > MAX_PENDING) pending.shift();
  persist();
}

// Called each trigger cycle with the current gold print; settles due headlines.
export function resolveDueHeadlines(price) {
  load();
  if (!pending.length || price == null) return { resolved: 0, due: 0 };
  const now = Date.now();
  const due = [];
  const keep = [];
  for (const p of pending) {
    if (now - p.t >= RESOLVE_MS) due.push(p);
    else keep.push(p);
  }
  pending = keep.slice(0, MAX_PENDING);
  applyResolutions(due, price);
  persist();
  return { resolved: due.length, due: due.length };
}

// Settle an explicit due list (public so tests can advance time cleanly).
export function applyResolutions(list, forwardPrice) {
  let resolved = 0;
  for (const p of list || []) {
    const done = settle(p, forwardPrice);
    if (done) resolved++;
  }
  return resolved;
}

function settle(p, forwardPrice) {
  if (forwardPrice == null || forwardPrice === 0) return false;
  const movePct = ((forwardPrice - p.price) / p.price) * 100;
  if (Math.abs(movePct) < MIN_MOVE_PCT) return false; // only settle on real moves
  const movedUp = movePct > 0;
  const calledUp = p.sentiment === 'BULLISH';
  const hit = movedUp === calledUp;
  const s = stats[p.source] || { calls: 0, hits: 0, scoreSum: 0 };
  s.calls += 1;
  if (hit) s.hits += 1;
  s.scoreSum += p.score || 0;
  stats[p.source] = s;
  settledIds.add(p.id);
  if (settledIds.size > 500) {
    settledIds.delete(settledIds.values().next().value);
  }
  return true;
}

// Credibility multiplier per source: 1.0 neutral, >1 amplify, <1 dampen.
export function getNewsCredibility() {
  load();
  const out = {};
  for (const [source, s] of Object.entries(stats)) {
    out[source] = s.calls >= MIN_CALLS
      ? Number((Math.min(1.5, Math.max(0.6, (s.hits / s.calls) * 1.8))).toFixed(2))
      : 1;
  }
  return out;
}

export function getNewsAccuracy() {
  load();
  const entries = Object.entries(stats).map(([source, s]) => ({
    source,
    calls: s.calls,
    hits: s.hits,
    hitRate: s.calls ? Number((s.hits / s.calls).toFixed(3)) : null,
    credibility: getNewsCredibility()[source]
  })).sort((a, b) => b.calls - a.calls);
  return {
    live: entries.some((e) => e.calls >= MIN_CALLS),
    resolveWindowMinutes: RESOLVE_MS / 60000,
    minCalls: MIN_CALLS,
    pending: pending.length,
    sources: entries
  };
}

export function getNewsFeedbackState() {
  return { pending: pending.length, stats };
}