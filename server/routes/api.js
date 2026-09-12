import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getMarketData, getCachedMarketData } from '../services/marketData.js';
import { aggregateAllNews, getCachedNews } from '../services/rssNews.js';
import { classifyAllNews } from '../services/sentimentEngine.js';
import { calculateCompositeBias } from '../services/compositeBias.js';
import { getRetailSentiment } from '../services/retailSentiment.js';
import { getEconomicCalendar } from '../services/economicCalendar.js';
import { refreshAndBroadcast } from '../services/cronWorker.js';
import { getTelegramConfig, updateTelegramConfig, sendTestTelegramAlert, sendDailyBriefingTelegramAlert } from '../services/telegramBot.js';
import { getCotData, fetchCotReport } from '../services/cotData.js';
import { refreshGoldEtfFlows, getGoldEtfFlows } from '../services/goldEtfFlows.js';
import { refreshGeoRisk, getGeoRisk } from '../services/geoRisk.js';
import { refreshFredMacro, getFredMacro } from '../services/fredMacro.js';
import { refreshTimeframeMatrix, getTimeframeMatrix } from '../services/timeframeMatrix.js';

const router = Router();

const __api_dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_FILE_PATH = path.join(__api_dirname, '../data/terminal_settings.json');

function buildBias(marketData, classifiedNews, retail) {
  return calculateCompositeBias(marketData, classifiedNews, retail, {
    cot: getCotData(),
    etf: getGoldEtfFlows(),
    geo: getGeoRisk()
  });
}

router.get('/market-data', async (req, res) => {
  try {
    const data = await getMarketData();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message, fallback: getCachedMarketData() });
  }
});

router.get('/news', async (req, res) => {
  try {
    const rawNews = await aggregateAllNews();
    const classified = classifyAllNews(rawNews);
    res.json({ news: classified, count: classified.length });
  } catch (err) {
    res.status(500).json({ error: err.message, fallback: getCachedNews() });
  }
});

router.get('/composite-bias', async (req, res) => {
  try {
    const marketData = await getMarketData();
    const classifiedNews = classifyAllNews(getCachedNews());
    const retail = getRetailSentiment(marketData.goldSpot.price);
    res.json(buildBias(marketData, classifiedNews, retail));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/economic-calendar', async (req, res) => {
  try {
    const calendar = await getEconomicCalendar();
    res.json(calendar);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/orderbook-sentiment', async (req, res) => {
  try {
    const market = await getMarketData();
    res.json(getRetailSentiment(market.goldSpot.price));
  } catch (err) {
    const cached = getCachedMarketData();
    res.json(getRetailSentiment(cached?.goldSpot?.price || null));
  }
});

router.get('/strategist', async (req, res) => {
  res.status(410).json({ error: 'Floor Strategist endpoint has been removed.' });
});

router.post('/refresh', async (req, res) => {
  try {
    const result = await refreshAndBroadcast();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/cot-data', async (req, res) => {
  try {
    const cot = await fetchCotReport();
    res.json(cot);
  } catch (err) {
    res.status(500).json({ error: err.message, fallback: getCotData() });
  }
});

router.get('/etf-flows', async (req, res) => {
  try {
    const data = await refreshGoldEtfFlows();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message, fallback: getGoldEtfFlows() });
  }
});

router.get('/geo-risk', async (req, res) => {
  try {
    const data = await refreshGeoRisk();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message, fallback: getGeoRisk() });
  }
});

router.get('/fred-macro', async (req, res) => {
  try {
    const data = await refreshFredMacro();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message, fallback: getFredMacro() });
  }
});

router.get('/timeframes', async (req, res) => {
  try {
    const data = await refreshTimeframeMatrix();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message, fallback: getTimeframeMatrix() });
  }
});

router.get('/settings', (req, res) => {
  try {
    const telegram = getTelegramConfig();
    res.json({ telegram });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/settings', (req, res) => {
  try {
    const { telegram } = req.body;
    let saved = {};

    try {
      if (fs.existsSync(SETTINGS_FILE_PATH)) {
        saved = JSON.parse(fs.readFileSync(SETTINGS_FILE_PATH, 'utf-8'));
      }
    } catch (e) {}

    if (telegram) {
      updateTelegramConfig(telegram);
    }

    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(saved, null, 2), 'utf-8');

    res.json({
      success: true,
      message: 'Terminal settings updated successfully.',
      telegram: getTelegramConfig()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/settings/telegram/test', async (req, res) => {
  try {
    const { botToken, chatId } = req.body;
    const result = await sendTestTelegramAlert(botToken, chatId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Manual trigger: send the scheduled daily briefing digest now (for testing)
router.post('/telegram/daily-brief', async (req, res) => {
  try {
    const marketData = await getMarketData();
    const classifiedNews = classifyAllNews(getCachedNews());
    const retail = getRetailSentiment(marketData.goldSpot.price);
    const bias = calculateCompositeBias(marketData, classifiedNews, retail, {
      cot: getCotData(),
      etf: getGoldEtfFlows(),
      geo: getGeoRisk()
    });
    const result = await sendDailyBriefingTelegramAlert({
      marketData,
      bias,
      calendar: await getEconomicCalendar(),
      geo: getGeoRisk(),
      retail
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
