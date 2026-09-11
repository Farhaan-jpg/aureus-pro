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

let isRunning = false;
let lastTickBroadcast = 0;
let pendingBroadcastTimer = null;

// Telegram Alert Throttle State
let lastSentBiasLabel = null;
let lastRetailTrapAlertTime = 0;
const alertedEventIds = new Set();

async function broadcastTick() {
  try {
    const marketData = await getMarketData();
    const currentNews = getCachedNews();
    const classifiedNews = classifyAllNews(currentNews);
    const retail = getRetailSentiment(marketData.goldSpot.price);
    const bias = calculateCompositeBias(marketData, classifiedNews, retail);

    broadcastToAll('TICK_UPDATE', {
      marketData,
      bias,
      retail
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

  console.log('[Aureus Worker] Background institutional data engine initialized.');

  // 1. Initial Data Fetch
  refreshAndBroadcast();

  // 2. Hook real-time TradingView WebSocket ticks directly into SSE bus
  onMarketTick((key) => {
    if (key === 'GOLD' || key === 'DXY' || key === 'SILVER') {
      scheduleTickBroadcast();
    }
  });

  // 3. Fallback High-Frequency Market Poller (every 1.0s)
  setInterval(() => {
    scheduleTickBroadcast();
  }, config.marketRefreshMs);

  // 3. News & Sentiment Poller (every 3 minutes)
  setInterval(async () => {
    try {
      const rawNews = await aggregateAllNews();
      const classifiedNews = classifyAllNews(rawNews);
      broadcastToAll('NEWS_UPDATE', { news: classifiedNews });
    } catch (err) {
      console.error('[Worker News Loop Error]:', err.message);
    }
  }, config.newsRefreshMs);

  // 4. Floor Strategist Periodic AI Refresh (every 10 minutes)
  setInterval(async () => {
    try {
      const marketData = await getMarketData();
      const rawNews = await aggregateAllNews();
      const classifiedNews = classifyAllNews(rawNews);
      const retail = getRetailSentiment(marketData.goldSpot.price);
      const bias = calculateCompositeBias(marketData, classifiedNews, retail);

      const commentary = await generateFloorAnalysis(marketData, classifiedNews, bias.score);
      broadcastToAll('STRATEGIST_UPDATE', { commentary });
    } catch (err) {
      console.error('[Worker AI Loop Error]:', err.message);
    }
  }, config.aiRefreshMs);

  // 5. Automated Telegram Event & Trap Monitor (runs every 30 seconds)
  setInterval(async () => {
    try {
      const marketData = await getMarketData();
      const rawNews = getCachedNews();
      const classifiedNews = classifyAllNews(rawNews);
      const retail = getRetailSentiment(marketData.goldSpot.price);
      const bias = calculateCompositeBias(marketData, classifiedNews, retail);
      await checkTelegramTriggers(marketData, bias, retail);
    } catch (e) {}
  }, 30000);
}

// Background Telegram triggers evaluation
async function checkTelegramTriggers(marketData, bias, retail) {
  try {
    const goldPrice = marketData?.goldSpot?.price;
    if (!goldPrice) return;

    // 1. Check Economic Calendar for imminent red folder events (< 5 min)
    const calendar = await getEconomicCalendar();
    if (calendar?.events) {
      const now = Date.now();
      for (const ev of calendar.events) {
        if (ev.impact === 'HIGH' || ev.title.includes('CPI') || ev.title.includes('NFP') || ev.title.includes('FOMC')) {
          const diffMs = new Date(ev.date).getTime() - now;
          const diffMins = Math.round(diffMs / 60000);
          if (diffMins > 0 && diffMins <= 5 && !alertedEventIds.has(ev.id)) {
            alertedEventIds.add(ev.id);
            await sendRedFolderTelegramAlert(ev, diffMins, goldPrice);
          }
        }
      }
    }

    // 2. Check Retail Trap (>80% Long or Short) with 30-minute cooldown
    const now = Date.now();
    if ((retail.longPercentage >= 80 || retail.shortPercentage >= 80) && (now - lastRetailTrapAlertTime > 30 * 60 * 1000)) {
      lastRetailTrapAlertTime = now;
      await sendRetailTrapTelegramAlert(retail, goldPrice);
    }

    // 3. Check Bias Flip
    if (lastSentBiasLabel && lastSentBiasLabel !== bias.label) {
      await sendBiasFlipTelegramAlert(bias.label, bias.score, goldPrice);
    }
    lastSentBiasLabel = bias.label;
  } catch (err) {
    // Non-blocking
  }
}

export async function refreshAndBroadcast() {
  try {
    const marketData = await getMarketData();
    const rawNews = await aggregateAllNews();
    const classifiedNews = classifyAllNews(rawNews);
    const retail = getRetailSentiment(marketData.goldSpot.price);
    const bias = calculateCompositeBias(marketData, classifiedNews, retail);
    const commentary = await generateFloorAnalysis(marketData, classifiedNews, bias.score);

    // Run trigger checks
    checkTelegramTriggers(marketData, bias, retail);

    const payload = {
      marketData,
      news: classifiedNews,
      retail,
      bias,
      commentary,
      timestamp: new Date().toISOString()
    };

    broadcastToAll('FULL_SYNC', payload);
    return payload;
  } catch (err) {
    console.error('[Worker Full Sync Error]:', err.message);
    return null;
  }
}
