import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getMarketData, getCachedMarketData } from '../services/marketData.js';
import { aggregateAllNews, getCachedNews } from '../services/rssNews.js';
import { classifyAllNews } from '../services/sentimentEngine.js';
import { generateFloorAnalysis, getCachedFloorAnalysis } from '../services/aiStrategist.js';
import { calculateCompositeBias } from '../services/compositeBias.js';
import { getRetailSentiment } from '../services/retailSentiment.js';
import { getEconomicCalendar } from '../services/economicCalendar.js';
import { refreshAndBroadcast } from '../services/cronWorker.js';
import { getTelegramConfig, updateTelegramConfig, sendTestTelegramAlert } from '../services/telegramBot.js';
import { getCotData, fetchCotReport } from '../services/cotData.js';
import { config } from '../config.js';

const router = Router();

const __api_dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_FILE_PATH = path.join(__api_dirname, '../data/terminal_settings.json');

// Initialize runtime keys from terminal_settings.json if present
try {
  if (fs.existsSync(SETTINGS_FILE_PATH)) {
    const saved = JSON.parse(fs.readFileSync(SETTINGS_FILE_PATH, 'utf-8'));
    if (saved.geminiApiKey) config.geminiApiKey = saved.geminiApiKey;
    if (saved.openRouterApiKey) config.openRouterApiKey = saved.openRouterApiKey;
  }
} catch (e) {}

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
router.get('/economic-calendar', async (req, res) => {
  try {
    const calendar = await getEconomicCalendar();
    res.json(calendar);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orderbook-sentiment
router.get('/orderbook-sentiment', async (req, res) => {
  try {
    const market = await getMarketData();
    const retail = getRetailSentiment(market.goldSpot.price);
    res.json(retail);
  } catch (err) {
    const cached = getCachedMarketData();
    res.json(getRetailSentiment(cached?.goldSpot?.price || 4385));
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

// GET /api/cot-data - CFTC Gold Commitment of Traders report
router.get('/cot-data', async (req, res) => {
  try {
    const cot = await fetchCotReport();
    res.json(cot);
  } catch (err) {
    res.status(500).json({ error: err.message, fallback: getCotData() });
  }
});

// GET /api/settings
router.get('/settings', (req, res) => {
  try {
    const telegram = getTelegramConfig();
    res.json({
      ai: {
        hasGeminiKey: Boolean(config.geminiApiKey),
        geminiKeyMasked: config.geminiApiKey ? `${config.geminiApiKey.slice(0, 6)}...${config.geminiApiKey.slice(-4)}` : '',
        hasOpenRouterKey: Boolean(config.openRouterApiKey),
        openRouterKeyMasked: config.openRouterApiKey ? `${config.openRouterApiKey.slice(0, 6)}...${config.openRouterApiKey.slice(-4)}` : ''
      },
      telegram
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings
router.post('/settings', (req, res) => {
  try {
    const { geminiApiKey, openRouterApiKey, telegram } = req.body;
    let saved = {};

    try {
      if (fs.existsSync(SETTINGS_FILE_PATH)) {
        saved = JSON.parse(fs.readFileSync(SETTINGS_FILE_PATH, 'utf-8'));
      }
    } catch (e) {}

    if (geminiApiKey !== undefined && geminiApiKey.trim() !== '') {
      config.geminiApiKey = geminiApiKey.trim();
      saved.geminiApiKey = geminiApiKey.trim();
    }
    if (openRouterApiKey !== undefined && openRouterApiKey.trim() !== '') {
      config.openRouterApiKey = openRouterApiKey.trim();
      saved.openRouterApiKey = openRouterApiKey.trim();
    }

    if (telegram) {
      updateTelegramConfig(telegram);
    }

    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(saved, null, 2), 'utf-8');

    res.json({
      success: true,
      message: 'Terminal settings updated successfully.',
      ai: {
        hasGeminiKey: Boolean(config.geminiApiKey),
        hasOpenRouterKey: Boolean(config.openRouterApiKey)
      },
      telegram: getTelegramConfig()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings/telegram/test
router.post('/settings/telegram/test', async (req, res) => {
  try {
    const { botToken, chatId } = req.body;
    const result = await sendTestTelegramAlert(botToken, chatId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
