// Integration self-check: boots the real server on an ephemeral port and asserts
// the end-to-end wiring (health, market state, bias shape, tape). Not a full
// functional test — it validates the observable contract so regressions in the
// boot path surface as a single exit code. Network feeds may still be warming;
// only structural invariants fail the gate.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PORT = 14332;
const base = `http://127.0.0.1:${PORT}`;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, '..', 'server', 'index.js');

// Compute the offline expectation for RIGHT NOW so the gate holds whenever it runs.
async function expectedMarketState() {
  const { getMarketState } = await import('../server/services/marketState.js');
  return getMarketState();
}

async function waitUntil(url, timeoutMs = 40000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return r;
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`server did not become ready at ${url}`);
}

const child = spawn(process.execPath, [serverPath], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'ignore'
});

let failures = 0;
function check(label, ok, detail = '') {
  console.log(`${ok ? 'ok' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}

try {
  await waitUntil(`${base}/healthz`);

  const health = await (await fetch(`${base}/api/health`)).json();
  check('api/health returns a status', ['HEALTHY', 'DEGRADED'].includes(health?.status), `status=${health?.status}`);
  check('api/health reports SSE count', typeof health?.sseClients === 'number');

  const msActual = health?.marketState?.label;
  const msExpected = (await expectedMarketState()).label;
  check('marketState label matches offline expectation', msActual === msExpected, `${msActual} vs expected ${msExpected}`);

  const md = await (await fetch(`${base}/api/market-data`)).json();
  // A live print is a structural invariant ONLY while the market is open; over a
  // weekend close the tape has no live source and the cached quote may be empty
  // on a cold boot (network warming). When open, null price is a real failure.
  const marketClosed = md?.marketState?.open === false;
  const hasGoldPrint = typeof md?.goldSpot?.price === 'number' && Number.isFinite(md?.goldSpot?.price);
  check('market-data has a gold print', marketClosed || hasGoldPrint, `price=${md?.goldSpot?.price}${marketClosed ? ' (market CLOSED — tolerated)' : ''}`);
  check('market-data exposes a session', typeof md?.session === 'string' && md.session.length > 0, `session=${md.session}`);
  check('market-data carries marketState', typeof md?.marketState?.open === 'boolean');
  check('market-data carries the real-yield field (largest-weight channel wiring)', 'realYield10Y' in md, md?.realYield10Y == null ? 'present, unfilled (network/boot warm-up)' : `real=${md.realYield10Y}`);

  const bias = await (await fetch(`${base}/api/composite-bias`)).json();
  check('bias has numeric score', typeof bias?.score === 'number' && Number.isFinite(bias.score), `score=${bias.score}`);
  check('bias exposes all 12 channels', bias?.breakdown && Object.keys(bias.breakdown).length === 12, `channels=${bias?.breakdown ? Object.keys(bias.breakdown).length : 'none'}`);
  check('bias carries actionable flag', typeof bias?.actionable === 'boolean', `actionable=${bias?.actionable}`);

  const news = await (await fetch(`${base}/api/news`)).json();
  check('news endpoint returns an array', Array.isArray(news?.news ?? news), `type=${Array.isArray(news?.news ?? news) ? 'array' : typeof news}`);

  const accuracy = await (await fetch(`${base}/api/bias-accuracy?horizonMinutes=60`)).json();
  check('bias-accuracy reports overall stats', accuracy?.overall && typeof accuracy.overall.resolved === 'number', `resolved=${accuracy?.overall?.resolved}`);
  check('bias-accuracy carries snapshots count', typeof accuracy?.snapshots === 'number' && accuracy.snapshots >= 0, `snapshots=${accuracy?.snapshots}`);

  // Realtime-accuracy surface — structural invariants of the new modules.
  const rp = await (await fetch(`${base}/api/realtime-pulse`)).json();
  check('realtime-pulse responds', rp && typeof rp === 'object', `live=${rp?.live ?? 'false'} bars=${rp?.bars ?? 0}`);

  const na = await (await fetch(`${base}/api/news-accuracy`)).json();
  check('news-accuracy responds', na && Array.isArray(na?.sources), `sources=${na?.sources?.length ?? 0}`);

  const sla = await (await fetch(`${base}/api/feed-sla`)).json();
  check('feed-sla responds', sla && typeof sla === 'object', `breaches=${sla?.breaches?.length ?? 0} tickDeltaMs=${sla?.tickDeltaMs ?? '?'}`);

  const sirens = await (await fetch(`${base}/api/sirens`)).json();
  check('sirens endpoint responds', sirens && Array.isArray(sirens?.history), `history=${sirens?.history?.length ?? 0} active=${Object.keys(sirens?.active || {}).length}`);

  const nc = await (await fetch(`${base}/api/nowcast`)).json();
  check('nowcast responds with a thesis', nc && typeof nc.headline === 'string', `stance=${nc?.stance?.label ?? '—'}`);

  const ro = await (await fetch(`${base}/api/risk-off`)).json();
  check('risk-off responds with a level', ['NONE', 'CAUTION', 'ADVISORY'].includes(ro?.level), `level=${ro?.level} drivers=${ro?.drivers?.length ?? 0}`);

  const nl = await (await fetch(`${base}/api/news-lockout`)).json();
  check('news-lockout responds with active flag', typeof nl?.active === 'boolean', `active=${nl?.active} event=${nl?.event?.title ?? '—'}`);

  const la = await (await fetch(`${base}/api/level-alerts`)).json();
  check('level-alerts responds with alert list', Array.isArray(la?.alerts), `alerts=${la?.alerts?.length ?? 0}`);
} catch (err) {
  console.log(`FAIL  ${err.message}`);
  failures++;
} finally {
  child.kill();
}

if (failures > 0) {
  console.log(`\nselfcheck: ${failures} failure(s)`);
  process.exit(1);
}
console.log('\nselfcheck: all gates passed');
process.exit(0);