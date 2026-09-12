// Feed SLA telemetry: compares every visible data source against a freshness
// threshold derived from its refresh cycle and surfaces only active breaches.
// Includes the internal SSE pipeline latency (approximated by how stale the
// last tick broadcast is). Voice/push are fired once per fresh degradation
// from cronWorker, which calls noteTickBroadcast on each send.
import { getCachedMarketData } from './marketData.js';
import { getGeoRisk } from './geoRisk.js';
import { getEconomicCalendar } from './economicCalendar.js';
import { getGoldEtfFlows } from './goldEtfFlows.js';
import { getTimeframeMatrix } from './timeframeMatrix.js';
import { getFredMacro } from './fredMacro.js';
import { getCachedNews } from './rssNews.js';
import { getMarketState } from './marketState.js';
import { getCentralBankWatch } from './centralBank.js';

// Each SLA entry: [thresholdMs, label, kind]. Threshold is how fresh we expect
// the source to be right after its normal refresh cadence + a safety margin.
const SLA = {
  gold:          [90000, 'Gold live tape', 'tape'],
  tvWs:          [120000, 'TradingView websocket', 'infra'],
  fred:          [6 * 3600000, 'FRED / real yields', 'macro'],
  news:          [4 * 3600000, 'News RSS feed', 'news'],
  calendar:      [4 * 3600000, 'Economic calendar', 'news'],
  geo:           [6 * 3600000, 'Geopolitical risk', 'macro'],
  etf:           [24 * 3600000, 'Gold ETF flows', 'macro'],
  timeframes:    [3600000, 'Multi-TF matrix', 'macro'],
  centralBank:   [6 * 3600000, 'Central-bank watch', 'macro']
};

function ageMs(iso) {
  return iso ? Date.now() - new Date(iso).getTime() : null;
}

let lastTickBroadcastAt = Date.now();
export function noteTickBroadcast() { lastTickBroadcastAt = Date.now(); }

export function getFeedSla() {
  const now = Date.now();
  const md = getCachedMarketData();
  const dh = md?.dataHealth || {};
  const marketOpen = getMarketState().open;
  const news = getCachedNews();
  const freshest = news?.[0]?.pubDate || null;
  const geo = getGeoRisk();
  const cal = getEconomicCalendar();
  const etf = getGoldEtfFlows();
  const tf = getTimeframeMatrix();
  const cbWatch = getCentralBankWatch();
  const sources = {
    gold: { ageMs: dh.goldAgeMs, lastUpdated: dh.goldAgeMs != null ? new Date(now - dh.goldAgeMs).toISOString() : null },
    tvWs: { ageMs: null, live: dh.tvWs, lastUpdated: null },
    fred: { lastUpdated: getFredMacro()?.lastUpdated, ageMs: ageMs(getFredMacro()?.lastUpdated) },
    news: { lastUpdated: freshest, ageMs: ageMs(freshest) },
    calendar: { lastUpdated: cal?.lastUpdated, ageMs: ageMs(cal?.lastUpdated) },
    geo: { lastUpdated: geo?.lastUpdated, ageMs: ageMs(geo?.lastUpdated) },
    etf: { lastUpdated: etf?.lastUpdated, ageMs: ageMs(etf?.lastUpdated) },
    timeframes: { lastUpdated: tf?.lastUpdated, ageMs: ageMs(tf?.lastUpdated) },
    centralBank: { lastUpdated: cbWatch?.refetchedAt, ageMs: ageMs(cbWatch?.refetchedAt) }
  };

  // tvWs only considered stale when the market is open and the ws indicator is off.
  const breaches = [];
  for (const [key, [threshold, label, kind]] of Object.entries(SLA)) {
    const s = sources[key];
    if (!s) continue;
    if (key === 'tvWs') {
      if (marketOpen && !dh.tvWs) {
        breaches.push({ key, label, kind, ageMs: null, thresholdMs: threshold, ageSec: null });
      }
      continue;
    }
    if (key === 'gold') {
      if (dh.goldAgeMs != null && dh.goldAgeMs > threshold) {
        breaches.push({ key, label, kind, ageMs: dh.goldAgeMs, thresholdMs: threshold, ageSec: Math.round(dh.goldAgeMs / 1000) });
      }
      continue;
    }
    if (s.ageMs != null && s.ageMs > threshold) {
      breaches.push({ key, label, kind, ageMs: s.ageMs, thresholdMs: threshold, ageSec: Math.round(s.ageMs / 1000) });
    }
  }

  const tickDelta = Date.now() - lastTickBroadcastAt;
  const healthy = !dh.stale && breaches.length === 0;
  return {
    asOf: new Date().toISOString(),
    healthy,
    breaches,
    tickDeltaMs: tickDelta,
    tickDeltaSec: Math.round(tickDelta / 1000),
    sseClients: null,
    goldSource: dh.goldSource || null
  };
}