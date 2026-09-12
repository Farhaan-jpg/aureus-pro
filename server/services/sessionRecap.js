// Session recap: a structured close-of-session summary built from the same
// data that drove the day — gold tape, composite bias track record, the lead
// headline, and the central-bank watch. Deterministic (no LLM key needed),
// surfaced via SSE, push, and the dashboard panel.
import { getMarketData, getCachedMarketData } from './marketData.js';
import { getBiasAccuracy } from './biasHistory.js';
import { getCentralBankWatch } from './centralBank.js';
import { classifyAllNews } from './sentimentEngine.js';
import { getCachedNews } from './rssNews.js';

let latest = null;

export function buildSessionRecap() {
  const md = getCachedMarketData() || null;
  const gold = md?.goldSpot || {};
  const price = gold.price;
  const changePercent = gold.changePercent ?? 0;
  const prevClose = gold.previousClose;

  const acc = getBiasAccuracy(60 * 60000);
  const o = acc.overall || {};
  const accNote = o.resolved > 0
    ? `1H track record ${(o.hitRate * 100).toFixed(0)}% hit on ${o.resolved} calls${o.unresolved ? ` (${o.unresolved} unresolved)` : ''}${o.avgPnlPct == null ? '' : ` · avg ${o.avgPnlPct > 0 ? '+' : ''}${o.avgPnlPct.toFixed(2)}%/call`}`
    : '1H track record: still collecting (needs live sessions)';

  const topHeadlineObj = classifyAllNews(getCachedNews())[0] || null;
  const cbWatch = getCentralBankWatch()?.watch || { live: false };
  const cbNote = cbWatch.live && cbWatch.headlines?.length
    ? `Central-bank watch: ${cbWatch.headlines[0].slice(0, 110)}`
    : 'Central-bank watch: no fresh official-sector headlines';

  const dir = price != null && prevClose != null && prevClose > 0
    ? changePercent > 0.1 ? 'UP' : changePercent < -0.1 ? 'DOWN' : 'FLAT'
    : '—';

  const summaryText = [
    `XAU/USD ${dir === 'UP' ? 'up' : dir === 'DOWN' ? 'down' : 'flat'} ${Math.abs(changePercent).toFixed(2)}% ` +
      `from $${prevClose?.toFixed(2)} to $${price?.toFixed(2)}`,
    `Bias: ${accNote}`,
    topHeadlineObj ? `Lead headline: ${topHeadlineObj.title.slice(0, 130)}` : '',
    cbNote
  ].filter(Boolean).join(' · ');

  const recap = {
    asOf: new Date().toISOString(),
    session: md?.session || 'CLOSED',
    price: price ?? null,
    changePercent: Number(Number(changePercent).toFixed(2)),
    direction: dir,
    prevClose: prevClose ?? null,
    accuracy: o,
    topHeadline: topHeadlineObj ? { title: topHeadlineObj.title.slice(0, 130), sentiment: topHeadlineObj.sentiment } : null,
    centralBankNote: cbNote,
    summaryText
  };
  latest = recap;
  return recap;
}

export function getSessionRecap() {
  return latest;
}