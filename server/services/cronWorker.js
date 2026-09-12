import { getMarketData, getCachedMarketData, onMarketTick } from './marketData.js';
import { aggregateAllNews, getCachedNews } from './rssNews.js';
import { classifyAllNews } from './sentimentEngine.js';
import { getRetailSentiment } from './retailSentiment.js';
import { calculateCompositeBias } from './compositeBias.js';
import { broadcastToAll } from '../routes/sse.js';
import { getEconomicCalendar } from './economicCalendar.js';
import { config } from '../config.js';
import { fetchCotReport, getCotData } from './cotData.js';
import { refreshGoldEtfFlows, getGoldEtfFlows } from './goldEtfFlows.js';
import { refreshGeoRisk, getGeoRisk } from './geoRisk.js';
import { refreshTimeframeMatrix, getTimeframeMatrix } from './timeframeMatrix.js';
import { refreshFredMacro } from './fredMacro.js';
import { refreshKeyLevels } from './keyLevels.js';
import { refreshVolatilityRegime } from './volatilityRegime.js';
import { refreshCorrelationMonitor } from './correlationMonitor.js';
import { sendRedFolderTelegramAlert,
  sendRetailTrapTelegramAlert,
  sendBiasFlipTelegramAlert,
  sendFeedHealthTelegramAlert,
  sendDailyBriefingTelegramAlert
} from './telegramBot.js';
import { getMarketState } from './marketState.js';
import { recordError } from './errorLog.js';
import { recordBiasSnapshot, getBiasAccuracy, getCalibratedWeights } from './biasHistory.js';
import { refreshCentralBankWatch } from './centralBank.js';
import { sendPush } from './webPush.js';
import { buildSessionRecap } from './sessionRecap.js';
import { bumpSeries, snapshot as pulseSnapshot, consumeDivergenceChange, getSeriesBars } from './seriesEngine.js';
import { recordHeadline, resolveDueHeadlines, getNewsCredibility, getNewsAccuracy } from './newsFeedback.js';
import { evaluateReleasedEvent } from './eventOutcomes.js';
import { getFeedSla, noteTickBroadcast } from './feedSla.js';
import * as sirens from './confluenceSirens.js';

let isRunning = false;
let lastTickBroadcast = 0;
let pendingBroadcastTimer = null;
let lastSentBiasLabel = null;
let lastRetailTrapAlertTime = 0;
const alertedEventIds = new Set();
const releasedEventIds = new Set();
const pushedNewsTitles = new Set();
const handledSweepHandles = new Set();

// Feed-health transition detection: only alert when a source DEGRADES (once per
// transition), so repeated fallback pings never spam the channel.
const degradedAlerts = new Set();

let briefSentForDate = null;
let broadcastInFlight = false;

function currentBias(marketData, classifiedNews, retail) {
  const centralBank = refreshCentralBankWatch(classifiedNews);
  const pulse = pulseSnapshot();
  return calculateCompositeBias(marketData, classifiedNews, retail, {
    cot: getCotData(),
    etf: getGoldEtfFlows(),
    geo: getGeoRisk(),
    timeframes: getTimeframeMatrix(),
    centralBank,
    calibratedWeights: getCalibratedWeights(marketData.session),
    realtimePulse: pulse,
    newsCredibility: getNewsCredibility()
  });
}

async function broadcastTick() {
  if (broadcastInFlight) return; // no overlapping tick broadcasts
  broadcastInFlight = true;
  try {
    const marketData = await getMarketData();
    const classifiedNews = classifyAllNews(getCachedNews());
    const retail = getRetailSentiment(marketData.goldSpot.price);
    const bias = currentBias(marketData, classifiedNews, retail);

    broadcastToAll('TICK_UPDATE', {
      marketData,
      bias,
      retail,
      timeframes: getTimeframeMatrix(),
      realtimePulse: pulseSnapshot()
    });
    noteTickBroadcast();
  } catch (err) {
    recordError('tickBroadcast', err?.message);
  } finally {
    broadcastInFlight = false;
  }
}

function scheduleTickBroadcast() {
  const now = Date.now();
  if (now - lastTickBroadcast < 300) {
    if (!pendingBroadcastTimer) {
      pendingBroadcastTimer = setTimeout(() => {
        pendingBroadcastTimer = null;
        lastTickBroadcast = Date.now();
        broadcastTick();
      }, 300);
    }
    return;
  }
  lastTickBroadcast = now;
  broadcastTick();
}

export function startBackgroundWorker() {
  if (isRunning) return;
  isRunning = true;

  console.log('[Aureus Worker] Background data engine initialized.');

  refreshAndBroadcast();

  onMarketTick((key, quote) => {
    if (key === 'GOLD' || key === 'DXY' || key === 'SILVER') {
      bumpSeries(key, quote?.price);
      scheduleTickBroadcast();
    }
  });

  setInterval(() => {
    scheduleTickBroadcast();
  }, config.marketRefreshMs);

  // When the weekly close ends and the tap reopens, stale Friday pivots must
  // not steer the first minutes of Sunday — refresh levels immediately. On a
  // session close, push and broadcast the deterministic session recap.
  let wasMarketOpen = null;
  setInterval(async () => {
    try {
      const ms = getMarketState();
      if (ms.open && wasMarketOpen === false) {
        console.log('[Aureus Worker] Market reopened — refreshing key levels.');
        await refreshKeyLevels();
        scheduleTickBroadcast();
      }
      if (!ms.open && wasMarketOpen === true) {
        console.log('[Aureus Worker] Session closed — building recap.');
        const recap = buildSessionRecap();
        broadcastToAll('SESSION_RECAP', recap);
        if (recap && recap.summaryText) {
          sendPush({
            title: 'Session Recap — XAU/USD',
            body: recap.summaryText,
            tag: `recap-${recap.session}-${recap.asOf.slice(0, 13)}`,
            url: '/'
          }, { ttl: 3600, urgency: 'normal' });
        }
      }
      wasMarketOpen = ms.open;
    } catch (err) {
      recordError('reopenRefresh', err?.message);
    }
  }, 15000);

  setInterval(async () => {
    try {
      const rawNews = await aggregateAllNews();
      const classifiedNews = classifyAllNews(rawNews);
      const geo = await refreshGeoRisk();
      broadcastToAll('NEWS_UPDATE', { news: classifiedNews, geo });
      const tape = getCachedMarketData?.() ?? null;
      const tapePrice = tape?.goldSpot?.price ?? null;

      // Push high-impact new headlines (mirrors the client voice threshold).
      const latest = classifiedNews[0];
      if (latest && Math.abs(latest.score || 0) >= 30 && !pushedNewsTitles.has(latest.title)) {
        pushedNewsTitles.add(latest.title);
        if (pushedNewsTitles.size > 300) {
          pushedNewsTitles.delete(pushedNewsTitles.values().next().value);
        }
        if (tapePrice != null) recordHeadline(latest, tapePrice);
        sendPush({
          title: 'Breaking Gold News',
          body: latest.title.slice(0, 140),
          tag: `news-${latest.title.slice(0, 40)}`,
          url: '/'
        }, { ttl: 900 });
      }
      for (const item of classifiedNews.slice(0, 12)) {
        if (tapePrice != null) recordHeadline(item, tapePrice);
      }
    } catch (err) {
      console.error('[Worker News Loop Error]:', err.message);
      recordError('newsLoop', err.message);
    }
  }, config.newsRefreshMs);

  // Realtime-pulse SSE: divergence, correlation break, volatility state.
  setInterval(() => {
    try {
      const pulse = pulseSnapshot();
      const change = consumeDivergenceChange();
      broadcastToAll('REALTIME_PULSE', { pulse, divergenceChange: change });
      if (change && change.type !== 'NONE') {
        sirens.note('divergence', change.type, getCachedMarketData?.()?.goldSpot?.price ?? null);
        const goldPrice = getCachedMarketData?.()?.goldSpot?.price;
        if (goldPrice != null) {
          sendPush({
            title: `${change.type} divergence on the 5m tape`,
            body: `Momentum is not confirming the move near $${Number(goldPrice).toFixed(2)}.`,
            tag: `divergence-${change.type}-${Math.floor(Date.now() / 600000)}`,
            url: '/'
          }, { ttl: 300, urgency: 'high' });
        }
      }
      if (pulse.live) {
        if (pulse.corr?.broken) sirens.note('corrBreak', 'BREAK', getCachedMarketData?.()?.goldSpot?.price ?? null);
        else sirens.clear('corrBreak');
        if (pulse.volState === 'EXPANSION') sirens.note('volExpansion', pulse.corr?.brokenNote ? 'blow-off' : 'expansion', getCachedMarketData?.()?.goldSpot?.price ?? null);
        else sirens.clear('volExpansion');
      }
    } catch (err) {
      recordError('pulseLoop', err?.message);
    }
  }, 60000);

  setInterval(async () => {
    try {
      await Promise.all([
        fetchCotReport(),
        refreshGoldEtfFlows(),
        refreshTimeframeMatrix(),
        refreshFredMacro(),
        refreshKeyLevels(),
        refreshVolatilityRegime(),
        refreshCorrelationMonitor()
      ]);
      broadcastToAll('MACRO_UPDATE', {
        cot: getCotData(),
        etf: getGoldEtfFlows(),
        geo: getGeoRisk(),
        timeframes: getTimeframeMatrix()
      });
    } catch (err) {
      console.error('[Worker Macro Loop Error]:', err.message);
      recordError('macroLoop', err.message);
    }
  }, 5 * 60 * 1000);

  setInterval(async () => {
    try {
      const marketData = await getMarketData();
      const classifiedNews = classifyAllNews(getCachedNews());
      const retail = getRetailSentiment(marketData.goldSpot.price);
      const bias = currentBias(marketData, classifiedNews, retail);
      await checkTelegramTriggers(marketData, bias, retail);
      await runRealtimeCycle(marketData, bias, retail);
    } catch (e) {
      recordError('telegramTriggers', e?.message);
    }
  }, 30000);

  // Bias accuracy snapshot: capture the call + price every 5 min while open so
  // outcomes can be resolved against the forward print (see biasHistory.js).
  setInterval(async () => {
    try {
      const ms = getMarketState();
      if (!ms.open) return;
      const md = await getMarketData();
      const bias = currentBias(md, classifyAllNews(getCachedNews()), getRetailSentiment(md.goldSpot.price));
      recordBiasSnapshot({
        price: md.goldSpot.price,
        score: bias.score,
        label: bias.label,
        confidence: bias.confidence,
        actionable: bias.actionable,
        channels: bias.breakdown,
        session: md.session
      });
    } catch (err) {
      recordError('biasSnapshot', err?.message);
    }
  }, 5 * 60 * 1000);

  // Daily Telegram briefing — fires once per UTC date within the schedule minute
  setInterval(async () => {
    try {
      const now = new Date();
      const todayKey = now.toISOString().slice(0, 10);
      const marketState = getMarketState(now);
      if (
        marketState.open &&
        now.getUTCHours() === config.dailyBriefUtcHour &&
        now.getUTCMinutes() === config.dailyBriefUtcMinute &&
        now.getUTCSeconds() < 30 &&
        briefSentForDate !== todayKey
      ) {
        briefSentForDate = todayKey;
        const marketData = await getMarketData();
        const bias = currentBias(marketData, classifyAllNews(getCachedNews()), getRetailSentiment(marketData.goldSpot.price));
        await sendDailyBriefingTelegramAlert({
          marketData,
          bias,
          calendar: await getEconomicCalendar(),
          geo: getGeoRisk(),
          retail: getRetailSentiment(marketData.goldSpot.price),
          accuracy: getBiasAccuracy(60 * 60000)
        });
        console.log('[Aureus Worker] Daily Telegram briefing dispatched.');
      }
    } catch (e) {
      recordError('dailyBrief', e?.message);
    }
  }, 15000);
}

async function checkTelegramTriggers(marketData, bias, retail) {
  try {
    const goldPrice = marketData?.goldSpot?.price;
    if (!goldPrice) return;

    const calendar = await getEconomicCalendar();
    if (calendar?.events) {
      const now = Date.now();
      for (const ev of calendar.events) {
        if (ev.impact === 'HIGH' || ev.impact === 'CRITICAL' || ev.title.includes('CPI') || ev.title.includes('NFP') || ev.title.includes('FOMC')) {
          const diffMs = new Date(ev.date).getTime() - now;
          const diffMins = Math.round(diffMs / 60000);
          if (diffMins > 0 && diffMins <= 5 && !alertedEventIds.has(ev.id)) {
            alertedEventIds.add(ev.id);
            if (alertedEventIds.size > 200) {
              alertedEventIds.delete(alertedEventIds.values().next().value); // keep dedupe bounded
            }
            await sendRedFolderTelegramAlert(ev, diffMins, goldPrice);
            sendPush({
              title: `HIGH-IMPACT RELEASE IN ${diffMins}M`,
              body: `${ev.title} (${ev.currency}) — ${ev.forecast || '---'} vs prior ${ev.previous || '---'} · Gold $${goldPrice.toFixed(2)}`,
              tag: `red-folder-${ev.id}`,
              url: '/'
            }, { ttl: 600, urgency: 'high' });
          }
        }
      }
    }

    const now = Date.now();
    const marketState = getMarketState();
    if (marketState.open) {
      if (retail.live && (retail.longPercentage >= 80 || retail.shortPercentage >= 80) && (now - lastRetailTrapAlertTime > 30 * 60 * 1000)) {
        lastRetailTrapAlertTime = now;
        await sendRetailTrapTelegramAlert(retail, goldPrice);
      }

      if (lastSentBiasLabel && lastSentBiasLabel !== bias.label) {
        await sendBiasFlipTelegramAlert(bias.label, bias.score, goldPrice);
        sendPush({
          title: `Bias flip → ${bias.label}`,
          body: `Composite ${bias.score > 0 ? '+' : ''}${bias.score}/100 · Gold $${goldPrice.toFixed(2)}`,
          tag: `bias-flip-${bias.label}-${Math.floor(Date.now() / 600000)}`,
          url: '/'
        }, { ttl: 300, urgency: 'high' });
      }
      lastSentBiasLabel = bias.label;
    }

    await checkFeedHealth(marketData);
  } catch (err) {
    recordError('checkFeedHealth', err?.message);
  }
}

// Realtime cycle (every 30s alongside TG triggers): settle headline feedback,
// catch released-event actuals (surprise re-pricer), detect handle sweeps on
// the 5m tape, maintain the confluence-siren factor set, and surface SLA.
async function runRealtimeCycle(marketData, bias, retail) {
  try {
    const goldPrice = marketData?.goldSpot?.price;
    resolveDueHeadlines(goldPrice);

    const calendar = await getEconomicCalendar();
    if (calendar?.events && goldPrice != null) {
      const now = Date.now();
      for (const ev of calendar.events) {
        if (releasedEventIds.has(ev.id)) continue;
        const outcome = evaluateReleasedEvent(ev, now);
        if (!outcome) continue;
        releasedEventIds.add(ev.id);
        if (releasedEventIds.size > 300) releasedEventIds.clear();
        broadcastToAll('EVENT_ACTUAL', { outcome, goldPrice });
        const s = outcome.surprise;
        sendPush({
          title: `${outcome.event.title} — ${s.magnitude} ${s.direction}`,
          body: `Gold direction: ${s.direction} (actual ${s.actual} vs forecast ${s.forecast}, ${s.mismatch > 0 ? '+' : ''}${s.mismatch}).`,
          tag: `actual-${outcome.event.id}`,
          url: '/'
        }, { ttl: 600, urgency: 'high' });
      }
    }

    for (const sw of detectHandleSweeps(goldPrice)) {
      const key = `h${sw.handle}`;
      if (!handledSweepHandles.has(key)) {
        handledSweepHandles.add(key);
        if (handledSweepHandles.size > 50) handledSweepHandles.clear();
        sirens.note('sweep', sw.direction, goldPrice);
      }
    }

    if (retail?.live && (retail.longPercentage >= 80 || retail.shortPercentage >= 80)) {
      sirens.note('retailExtreme', retail.longPercentage >= 80 ? 'LONG-heavy' : 'SHORT-heavy', goldPrice);
    } else {
      sirens.clear('retailExtreme');
    }

    const siren = sirens.evaluate(goldPrice);
    if (siren) {
      broadcastToAll('SIREN', siren);
      sendPush({
        title: `HIGH-CONVICTION${siren.direction !== 'UNKNOWN' ? ` — ${siren.direction}` : ''}`,
        body: `${siren.factorCount} aligned factors near $${Number(goldPrice || 0).toFixed(2)}: ${siren.factors.map((f) => f.factor).join(', ')}.`,
        tag: siren.id,
        url: '/'
      }, { ttl: 300, urgency: 'high' });
    }

    broadcastToAll('FEED_SLA', getFeedSla());
  } catch (err) {
    recordError('realtimeCycle', err?.message);
  }
}

// Round-handle liquidity sweep detector on the last ~30 minutes of 5m tape:
// a bar whose extreme pokes through the handle but whose close reclaimed it.
function detectHandleSweeps(goldPrice) {
  if (goldPrice == null) return [];
  const bars = getSeriesBars('GOLD');
  const recent = bars.slice(-6);
  if (recent.length < 2) return [];
  const handle = Math.round(goldPrice / 10) * 10;
  const found = [];
  for (const bar of recent) {
    if (bar.close >= handle && bar.low < handle) found.push({ handle, direction: 'BULLISH' });
    if (bar.close <= handle && bar.high > handle) found.push({ handle, direction: 'BEARISH' });
  }
  return found;
}

// Detect fresh degradations only; clear flags when a feed recovers so a
// subsequent outage can alert again.
async function checkFeedHealth(marketData) {
  try {
    const dh = marketData?.dataHealth || {};
    const geo = getGeoRisk();
    const calendar = getEconomicCalendar();
    const marketOpen = getMarketState().open;
    const checks = [];

    // Tape-level checks are only meaningful while the market is open — a quiet
    // weekend would otherwise spam "feed degraded" for normal closure.
    if (marketOpen) {
      if (!dh.tvWs) checks.push({ key: 'tvWs', label: 'TradingView websocket', detail: 'disconnected — streaming to hot Yahoo/GoldPrice fallbacks' });
      if (dh.stale) checks.push({ key: 'goldStale', label: 'Gold tape', detail: `last print >30s stale (age ${Math.round((dh.goldAgeMs || 0) / 1000)}s)` });
      if (dh.goldSource === 'unavailable') checks.push({ key: 'goldUnavailable', label: 'Gold source', detail: 'no active quote source' });
      if (dh.priceCheck?.discrepancy) checks.push({ key: 'goldSpread', label: 'Gold price spread', detail: `cross-source spread $${dh.priceCheck.spread?.toFixed(2)} across ${dh.priceCheck.sources} sources` });
    }
    if (geo?.source === 'rss-fallback') checks.push({ key: 'geoFallback', label: 'Geopolitics', detail: 'GDELT unreachable — using BBC/Al Jazeera RSS' });
    if (calendar?.feedSource === 'benchmark') checks.push({ key: 'calFallback', label: 'Economic calendar', detail: 'ForexFactory unreachable — showing estimated schedule' });
    if (!getGoldEtfFlows()?.live) checks.push({ key: 'etfStale', label: 'Gold ETF flows', detail: 'GLD/IAU/GLDM/SGOL feed not live' });

    const freshIssues = checks.filter((c) => !degradedAlerts.has(c.key));
    for (const check of checks) degradedAlerts.add(check.key);
    const currentKeys = new Set(checks.map((c) => c.key));
    for (const key of [...degradedAlerts]) {
      if (!currentKeys.has(key)) degradedAlerts.delete(key); // recovered → can re-alert later
    }
    if (freshIssues.length) {
      await sendFeedHealthTelegramAlert(freshIssues);
      sendPush({
        title: 'Feed SLA breach',
        body: freshIssues.map((c) => `${c.label}: ${c.detail}`).join(' · ').slice(0, 240),
        tag: `sla-${freshIssues.map((c) => c.key).sort().join('-')}`,
        url: '/'
      }, { ttl: 600, urgency: 'high' });
    }
  } catch (err) {
    recordError('feedHealthInternal', err?.message);
  }
}

export async function refreshAndBroadcast() {
  try {
    const [marketData, rawNews] = await Promise.all([
      getMarketData(),
      aggregateAllNews()
    ]);
    await Promise.all([
      fetchCotReport(),
      refreshGoldEtfFlows(),
      refreshGeoRisk(),
      refreshTimeframeMatrix(),
      refreshFredMacro(),
      refreshKeyLevels(),
      refreshVolatilityRegime(),
      refreshCorrelationMonitor()
    ]);

    const classifiedNews = classifyAllNews(rawNews);
    const retail = getRetailSentiment(marketData.goldSpot.price);
    const bias = currentBias(marketData, classifiedNews, retail);
    checkTelegramTriggers(marketData, bias, retail);

    const payload = {
      marketData,
      news: classifiedNews,
      retail,
      bias,
      cot: getCotData(),
      etf: getGoldEtfFlows(),
      geo: getGeoRisk(),
      timeframes: getTimeframeMatrix(),
      timestamp: new Date().toISOString()
    };

    broadcastToAll('FULL_SYNC', payload);
    return payload;
  } catch (err) {
    console.error('[Worker Full Sync Error]:', err.message);
    recordError('fullSync', err.message);
    return null;
  }
}
