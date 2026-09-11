import { getMarketData } from './marketData.js';
import { aggregateAllNews } from './rssNews.js';
import { classifyAllNews } from './sentimentEngine.js';
import { getRetailSentiment } from './retailSentiment.js';
import { calculateCompositeBias } from './compositeBias.js';
import { generateFloorAnalysis } from './aiStrategist.js';
import { broadcastToAll } from '../routes/sse.js';
import { config } from '../config.js';

let isRunning = false;

export function startBackgroundWorker() {
  if (isRunning) return;
  isRunning = true;

  console.log('[Aureus Worker] Background institutional data engine initialized.');

  // 1. Initial Data Fetch
  refreshAndBroadcast();

  // 2. High-Frequency Market Poller (every 15s)
  setInterval(async () => {
    try {
      const marketData = await getMarketData();
      const rawNews = await aggregateAllNews();
      const classifiedNews = classifyAllNews(rawNews);
      const retail = getRetailSentiment(marketData.goldSpot.price);
      const bias = calculateCompositeBias(marketData, classifiedNews, retail);

      // Broadcast market tick packet
      broadcastToAll('TICK_UPDATE', {
        marketData,
        bias,
        retail
      });
    } catch (err) {
      console.error('[Worker Market Loop Error]:', err.message);
    }
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
}

export async function refreshAndBroadcast() {
  try {
    const marketData = await getMarketData();
    const rawNews = await aggregateAllNews();
    const classifiedNews = classifyAllNews(rawNews);
    const retail = getRetailSentiment(marketData.goldSpot.price);
    const bias = calculateCompositeBias(marketData, classifiedNews, retail);
    const commentary = await generateFloorAnalysis(marketData, classifiedNews, bias.score);

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
