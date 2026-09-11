import { getCachedMarketData } from '../services/marketData.js';
import { getCachedNews } from '../services/rssNews.js';
import { classifyAllNews } from '../services/sentimentEngine.js';
import { getRetailSentiment } from '../services/retailSentiment.js';
import { calculateCompositeBias } from '../services/compositeBias.js';
import { getCotData } from '../services/cotData.js';
import { getGoldEtfFlows } from '../services/goldEtfFlows.js';
import { getGeoRisk } from '../services/geoRisk.js';
import { getTimeframeMatrix } from '../services/timeframeMatrix.js';

const sseClients = new Set();

export function sseHandler(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no'
  });

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  res.write(`event: CONNECTED\ndata: ${JSON.stringify({ status: 'CONNECTED', timestamp: Date.now() })}\n\n`);

  const cached = getCachedMarketData();
  if (cached) {
    try {
      const classifiedNews = classifyAllNews(getCachedNews());
      const retail = getRetailSentiment(cached.goldSpot?.price || null);
      const bias = calculateCompositeBias(cached, classifiedNews, retail, {
        cot: getCotData(),
        etf: getGoldEtfFlows(),
        geo: getGeoRisk()
      });

      res.write(`event: TICK_UPDATE\ndata: ${JSON.stringify({
        marketData: cached,
        bias,
        retail,
        timeframes: getTimeframeMatrix()
      })}\n\n`);
    } catch (err) {}
  }

  sseClients.add(res);

  const heartbeatTimer = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch (e) {
      clearInterval(heartbeatTimer);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeatTimer);
    sseClients.delete(res);
  });
}

export function broadcastToAll(eventType, payload) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

export function getClientCount() {
  return sseClients.size;
}
