// Server-Sent Events (SSE) Bus
// Broadcasts low-latency market ticks, sentiment shifts, and AI updates to connected institutional clients.
import { getCachedMarketData } from '../services/marketData.js';
import { getCachedNews } from '../services/rssNews.js';
import { classifyAllNews } from '../services/sentimentEngine.js';
import { getRetailSentiment } from '../services/retailSentiment.js';
import { calculateCompositeBias } from '../services/compositeBias.js';

const sseClients = new Set();

export function sseHandler(req, res) {
  // Set required headers for SSE with zero proxy buffering
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

  // Send initial connection packet with event name
  res.write(`event: CONNECTED\ndata: ${JSON.stringify({ status: 'CONNECTED', timestamp: Date.now() })}\n\n`);

  // Instantly send current market data to new client with 0 delay
  const cached = getCachedMarketData();
  if (cached) {
    try {
      const currentNews = getCachedNews();
      const classifiedNews = classifyAllNews(currentNews);
      const retail = getRetailSentiment(cached.goldSpot?.price || 4385);
      const bias = calculateCompositeBias(cached, classifiedNews, retail);

      res.write(`event: TICK_UPDATE\ndata: ${JSON.stringify({
        marketData: cached,
        bias,
        retail
      })}\n\n`);
    } catch (err) {}
  }

  sseClients.add(res);

  // Heartbeat ping every 25 seconds to keep SSE connection alive through reverse proxies/Render
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
