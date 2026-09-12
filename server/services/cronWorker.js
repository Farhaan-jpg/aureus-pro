import { getMarketData, onMarketTick } from './marketData.js';
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
import { recordBiasSnapshot } from './biasHistory.js';

let isRunning = false;
let lastTickBroadcast = 0;
let pendingBroadcastTimer = null;
let lastSentBiasLabel = null;
let lastRetailTrapAlertTime = 0;
const alertedEventIds = new Set();

// Feed-health transition detection: only alert when a source DEGRADES (once per
// transition), so repeated fallback pings never spam the channel.
const degradedAlerts = new Set();

let briefSentForDate = null;
let broadcastInFlight = false;

function currentBias(marketData, classifiedNews, retail) {
  return calculateCompositeBias(marketData, classifiedNews, retail, {
    cot: getCotData(),
    etf: getGoldEtfFlows(),
    geo: getGeoRisk(),
    timeframes: getTimeframeMatrix()
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
      timeframes: getTimeframeMatrix()
    });
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

  onMarketTick((key) => {
    if (key === 'GOLD' || key === 'DXY' || key === 'SILVER') {
      scheduleTickBroadcast();
    }
  });

  setInterval(() => {
    scheduleTickBroadcast();
  }, config.marketRefreshMs);

  // When the weekly close ends and the tap reopens, stale Friday pivots must
  // not steer the first minutes of Sunday — refresh levels immediately.
  let wasMarketOpen = null;
  setInterval(async () => {
    try {
      const ms = getMarketState();
      if (ms.open && wasMarketOpen === false) {
        console.log('[Aureus Worker] Market reopened — refreshing key levels.');
        await refreshKeyLevels();
        scheduleTickBroadcast();
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
    } catch (err) {
      console.error('[Worker News Loop Error]:', err.message);
      recordError('newsLoop', err.message);
    }
  }, config.newsRefreshMs);

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
        actionable: bias.actionable
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
          retail: getRetailSentiment(marketData.goldSpot.price)
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
      }
      lastSentBiasLabel = bias.label;
    }

    await checkFeedHealth(marketData);
  } catch (err) {
    recordError('checkFeedHealth', err?.message);
  }
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
