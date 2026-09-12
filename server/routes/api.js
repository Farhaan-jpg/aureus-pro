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
import { getCachedCalendar } from '../services/economicCalendar.js';
import { getMarketState } from '../services/marketState.js';
import { getRecentErrors, clearErrors } from '../services/errorLog.js';
import { getClientCount } from './sse.js';
import { getBiasAccuracy, getCalibratedWeights, getChannelAccuracy } from '../services/biasHistory.js';
import { refreshCentralBankWatch } from '../services/centralBank.js';
import { getPushConfig, saveSubscription, removeSubscription, sendPush } from '../services/webPush.js';
import { getSessionRecap } from '../services/sessionRecap.js';

const router = Router();

// Minimal in-memory throttle so the open API can't be hammered/scraped.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 120;
const hits = new Map();
router.use((req, res, next) => {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const bucket = hits.get(ip);
  if (!bucket || now - bucket.start > RATE_WINDOW_MS) {
    hits.set(ip, { start: now, count: 1 });
    if (hits.size > 500) {
      for (const [k, v] of hits) {
        if (now - v.start > RATE_WINDOW_MS) hits.delete(k);
      }
    }
    next();
    return;
  }
  bucket.count++;
  if (bucket.count > RATE_MAX) {
    res.status(429).json({ error: 'Rate limit exceeded', retryInSec: Math.ceil((bucket.start + RATE_WINDOW_MS - now) / 1000) });
    return;
  }
  next();
});

const __api_dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_FILE_PATH = path.join(__api_dirname, '../data/terminal_settings.json');

function buildBias(marketData, classifiedNews, retail) {
  const centralBank = refreshCentralBankWatch(classifiedNews);
  return calculateCompositeBias(marketData, classifiedNews, retail, {
    cot: getCotData(),
    etf: getGoldEtfFlows(),
    geo: getGeoRisk(),
    timeframes: getTimeframeMatrix(),
    centralBank,
    calibratedWeights: getCalibratedWeights(marketData.session)
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

// Operator health surface: feed states + any errors swallowed by background loops
router.get('/health', (req, res) => {
  const md = getCachedMarketData();
  const geo = getGeoRisk();
  const errors = getRecentErrors(20);
  const goldAgeMs = md?.dataHealth?.goldAgeMs ?? null;
  const tvOk = md?.dataHealth?.tvWs !== false;
  const goldFresh = goldAgeMs == null || goldAgeMs < 60000;
  const feeds = {
    tvWs: md?.dataHealth?.tvWs ?? null,
    goldSource: md?.dataHealth?.goldSource ?? null,
    goldAgeMs,
    geo: geo?.source ?? null,
    geoLive: geo?.live ?? null,
    calendar: getCachedCalendar()?.feedSource ?? null,
    etfLive: Boolean(getGoldEtfFlows()?.live),
    fredLive: Boolean(getFredMacro()?.live),
    timeframesLive: Boolean(getTimeframeMatrix()?.live)
  };
  const degraded = Boolean(errors.length) || !tvOk || !goldFresh || feeds.calendar === 'offline';
  res.json({
    status: degraded ? 'DEGRADED' : 'HEALTHY',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    sseClients: getClientCount(),
    memory: {
      rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`
    },
    marketState: md?.marketState ?? getMarketState(),
    marketDataCached: Boolean(md),
    feeds,
    errors
  });
});

router.post('/health/errors/clear', (req, res) => {
  clearErrors();
  res.json({ cleared: true });
});

// Bias outcome feedback loop: hit-rate by label / confidence / horizon
router.get('/bias-accuracy', (req, res) => {
  const horizonMinutes = Math.min(24 * 60, Math.max(5, Number(req.query.horizonMinutes) || 60));
  res.json(getBiasAccuracy(horizonMinutes * 60000));
});

// Channel-level calibration: which composite channels actually cast correct
// votes, and the tuned weights the model now applies from that feedback.
router.get('/channel-accuracy', (req, res) => {
  const horizonMinutes = Math.min(24 * 60, Math.max(5, Number(req.query.horizonMinutes) || 60));
  res.json(getChannelAccuracy(horizonMinutes * 60000));
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
      geo: getGeoRisk(),
      centralBank: refreshCentralBankWatch(classifiedNews),
      calibratedWeights: getCalibratedWeights(marketData.session)
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

// ── Session Recap ────────────────────────────────────────────────────────
router.get('/session-recap', (req, res) => {
  const recap = getSessionRecap();
  res.json({ recap: recap || null, supported: true });
});

// ── Web Push Notifications ──────────────────────────────────────────────
router.get('/push/config', (req, res) => {
  res.json(getPushConfig());
});

router.post('/push/subscribe', (req, res) => {
  try {
    const result = saveSubscription(req.body?.subscription);
    res.json({ ...result, publicKey: getPushConfig().publicKey });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/push/unsubscribe', (req, res) => {
  const result = removeSubscription(req.body?.subscription?.endpoint || req.body?.endpoint);
  res.json(result);
});

router.post('/push/test', async (req, res) => {
  try {
    const result = await sendPush({
      title: 'Aureus Pro — Push Test',
      body: `Notifications are live. XAU/USD tracking ${new Date().toUTCString()}.`,
      tag: 'push-test',
      url: '/'
    }, { ttl: 300 });
    res.json({ success: result.sent > 0, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
