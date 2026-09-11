import { getMarketData, onMarketTick } from './marketData.js';
import { aggregateAllNews, getCachedNews } from './rssNews.js';
import { classifyAllNews } from './sentimentEngine.js';
import { getRetailSentiment } from './retailSentiment.js';
import { calculateCompositeBias } from './compositeBias.js';
import { generateFloorAnalysis } from './aiStrategist.js';
import { broadcastToAll } from '../routes/sse.js';
import { getEconomicCalendar } from './economicCalendar.js';
import {
  sendRedFolderTelegramAlert,
  sendRetailTrapTelegramAlert,
  sendBiasFlipTelegramAlert
} from './telegramBot.js';
import { config } from '../config.js';
import { fetchCotReport, getCotData } from './cotData.js';
import { refreshGoldEtfFlows, getGoldEtfFlows } from './goldEtfFlows.js';
import { refreshGeoRisk, getGeoRisk } from './geoRisk.js';
import { refreshTimeframeMatrix, getTimeframeMatrix } from './timeframeMatrix.js';
import { refreshFredMacro } from './fredMacro.js';

let isRunning = false;
let lastTickBroadcast = 0;
let pendingBroadcastTimer = null;
let lastSentBiasLabel = null;
let lastRetailTrapAlertTime = 0;
const alertedEventIds = new Set();

function currentBias(marketData, classifiedNews, retail) {
  return calculateCompositeBias(marketData, classifiedNews, retail, {
    cot: getCotData(),
    etf: getGoldEtfFlows(),
    geo: getGeoRisk()
  });
}

async function broadcastTick() {
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
  } catch (err) {}
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

  setInterval(async () => {
    try {
      const rawNews = await aggregateAllNews();
      const classifiedNews = classifyAllNews(rawNews);
      const geo = await refreshGeoRisk();
      broadcastToAll('NEWS_UPDATE', { news: classifiedNews, geo });
    } catch (err) {
      console.error('[Worker News Loop Error]:', err.message);
    }
  }, config.newsRefreshMs);

  setInterval(async () => {
    try {
      await Promise.all([
        fetchCotReport(),
        refreshGoldEtfFlows(),
        refreshTimeframeMatrix(),
        refreshFredMacro()
      ]);
      broadcastToAll('MACRO_UPDATE', {
        cot: getCotData(),
        etf: getGoldEtfFlows(),
        geo: getGeoRisk(),
        timeframes: getTimeframeMatrix()
      });
    } catch (err) {
      console.error('[Worker Macro Loop Error]:', err.message);
    }
  }, 5 * 60 * 1000);

  setInterval(async () => {
    try {
      const marketData = await getMarketData();
      const classifiedNews = classifyAllNews(getCachedNews());
      const retail = getRetailSentiment(marketData.goldSpot.price);
      const bias = currentBias(marketData, classifiedNews, retail);
      const commentary = await generateFloorAnalysis(marketData, classifiedNews, bias.score);
      broadcastToAll('STRATEGIST_UPDATE', { commentary });
    } catch (err) {
      console.error('[Worker AI Loop Error]:', err.message);
    }
  }, config.aiRefreshMs);

  setInterval(async () => {
    try {
      const marketData = await getMarketData();
      const classifiedNews = classifyAllNews(getCachedNews());
      const retail = getRetailSentiment(marketData.goldSpot.price);
      const bias = currentBias(marketData, classifiedNews, retail);
      await checkTelegramTriggers(marketData, bias, retail);
    } catch (e) {}
  }, 30000);
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
            await sendRedFolderTelegramAlert(ev, diffMins, goldPrice);
          }
        }
      }
    }

    const now = Date.now();
    if (retail.live && (retail.longPercentage >= 80 || retail.shortPercentage >= 80) && (now - lastRetailTrapAlertTime > 30 * 60 * 1000)) {
      lastRetailTrapAlertTime = now;
      await sendRetailTrapTelegramAlert(retail, goldPrice);
    }

    if (lastSentBiasLabel && lastSentBiasLabel !== bias.label) {
      await sendBiasFlipTelegramAlert(bias.label, bias.score, goldPrice);
    }
    lastSentBiasLabel = bias.label;
  } catch (err) {}
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
      refreshFredMacro()
    ]);

    const classifiedNews = classifyAllNews(rawNews);
    const retail = getRetailSentiment(marketData.goldSpot.price);
    const bias = currentBias(marketData, classifiedNews, retail);
    const commentary = await generateFloorAnalysis(marketData, classifiedNews, bias.score);
    checkTelegramTriggers(marketData, bias, retail);

    const payload = {
      marketData,
      news: classifiedNews,
      retail,
      bias,
      commentary,
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
    return null;
  }
}
