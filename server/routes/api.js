import { Router } from 'express';
import { getMarketData, getCachedMarketData } from '../services/marketData.js';
import { aggregateAllNews, getCachedNews } from '../services/rssNews.js';
import { classifyAllNews } from '../services/sentimentEngine.js';
import { generateFloorAnalysis, getCachedFloorAnalysis } from '../services/aiStrategist.js';
import { calculateCompositeBias } from '../services/compositeBias.js';
import { getRetailSentiment } from '../services/retailSentiment.js';
import { getEconomicCalendar } from '../services/economicCalendar.js';
import { refreshAndBroadcast } from '../services/cronWorker.js';

const router = Router();

// GET /api/market-data
router.get('/market-data', async (req, res) => {
  try {
    const data = await getMarketData();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message, fallback: getCachedMarketData() });
  }
});

// GET /api/news
router.get('/news', async (req, res) => {
  try {
    const rawNews = await aggregateAllNews();
    const classified = classifyAllNews(rawNews);
    res.json({ news: classified, count: classified.length });
  } catch (err) {
    res.status(500).json({ error: err.message, fallback: getCachedNews() });
  }
});

// GET /api/composite-bias
router.get('/composite-bias', async (req, res) => {
  try {
    const marketData = await getMarketData();
    const rawNews = await aggregateAllNews();
    const classifiedNews = classifyAllNews(rawNews);
    const retail = getRetailSentiment(marketData.goldSpot.price);
    const bias = calculateCompositeBias(marketData, classifiedNews, retail);
    res.json(bias);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/economic-calendar
router.get('/economic-calendar', (req, res) => {
  res.json(getEconomicCalendar());
});

// GET /api/orderbook-sentiment
router.get('/orderbook-sentiment', async (req, res) => {
  try {
    const market = await getMarketData();
    const retail = getRetailSentiment(market.goldSpot.price);
    res.json(retail);
  } catch (err) {
    res.json(getRetailSentiment(2685));
  }
});

// GET /api/strategist
router.get('/strategist', async (req, res) => {
  try {
    let cached = getCachedFloorAnalysis();
    if (!cached) {
      const marketData = await getMarketData();
      const rawNews = await aggregateAllNews();
      const classifiedNews = classifyAllNews(rawNews);
      const retail = getRetailSentiment(marketData.goldSpot.price);
      const bias = calculateCompositeBias(marketData, classifiedNews, retail);
      cached = await generateFloorAnalysis(marketData, classifiedNews, bias.score);
    }
    res.json(cached);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/strategist/generate - Force fresh LLM floor analysis
router.post('/strategist/generate', async (req, res) => {
  try {
    const marketData = await getMarketData();
    const rawNews = await aggregateAllNews();
    const classifiedNews = classifyAllNews(rawNews);
    const retail = getRetailSentiment(marketData.goldSpot.price);
    const bias = calculateCompositeBias(marketData, classifiedNews, retail);
    const analysis = await generateFloorAnalysis(marketData, classifiedNews, bias.score);
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/refresh - Trigger manual full sync
router.post('/refresh', async (req, res) => {
  try {
    const result = await refreshAndBroadcast();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
