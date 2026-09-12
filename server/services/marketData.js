import WebSocket from 'ws';
import { fetchJson } from './httpClient.js';
import { getFredMacro, refreshFredMacro } from './fredMacro.js';
import { getKeyLevels, refreshKeyLevels } from './keyLevels.js';
import { getCorrelationMonitor, refreshCorrelationMonitor } from './correlationMonitor.js';
import { getVolatilityRegime, refreshVolatilityRegime } from './volatilityRegime.js';
import { getMarketState } from './marketState.js';

const ASSETS = {
  GOLD: { symbol: 'OANDA:XAUUSD', name: 'Gold Spot', display: 'XAU/USD', category: 'metal', yahoo: 'GC=F', digits: 2 },
  SILVER: { symbol: 'TVC:SILVER', name: 'Silver Spot', display: 'XAG/USD', category: 'metal', yahoo: 'SI=F', digits: 3 },
  CRUDE_OIL: { symbol: 'TVC:USOIL', name: 'WTI Crude Oil', display: 'USOIL', category: 'energy', yahoo: 'CL=F', digits: 2 },
  COPPER: { symbol: 'COMEX:HG1!', name: 'Copper Futures', display: 'HG', category: 'metal', yahoo: 'HG=F', digits: 3 },
  PLATINUM: { symbol: 'TVC:PLATINUM', name: 'Platinum', display: 'XPT/USD', category: 'metal', yahoo: 'PL=F', digits: 2 },
  DXY: { symbol: 'TVC:DXY', name: 'US Dollar Index', display: 'DXY', category: 'currency', yahoo: 'DX-Y.NYB', digits: 3 },
  US10Y: { symbol: '^TNX', name: 'US 10Y Yield', display: 'US10Y', category: 'rate', yahoo: '^TNX', digits: 3 },
  US02Y: { symbol: '2YY=F', name: 'US 2Y Yield', display: 'US02Y', category: 'rate', yahoo: '2YY=F', digits: 3 },
  VIX: { symbol: 'TVC:VIX', name: 'CBOE Volatility', display: 'VIX', category: 'volatility', yahoo: '^VIX', digits: 2 },
  USDJPY: { symbol: 'FX:USDJPY', name: 'USD/JPY', display: 'USDJPY', category: 'currency', yahoo: 'JPY=X', digits: 3 },
  SPX: { symbol: 'TVC:SPX', name: 'S&P 500', display: 'SPX', category: 'equity', yahoo: '^GSPC', digits: 2 },
  TLT: { symbol: 'TLT', name: '20Y+ Treasury ETF', display: 'TLT', category: 'rate', yahoo: 'TLT', digits: 2 }
};

const TV_SYMBOL_MAP = {
  'OANDA:XAUUSD': 'GOLD',
  'TVC:SILVER': 'SILVER',
  'TVC:USOIL': 'CRUDE_OIL',
  'TVC:PLATINUM': 'PLATINUM',
  'TVC:DXY': 'DXY',
  'TVC:VIX': 'VIX',
  'FX:USDJPY': 'USDJPY',
  'TVC:SPX': 'SPX',
  'COMEX:HG1!': 'COPPER'
};

let cachedMarketData = null;
const quotes = {};
const priceHistory = {};
const returnHistory = {};
for (const key of Object.keys(ASSETS)) {
  priceHistory[key] = [];
  returnHistory[key] = [];
}

// Time-based correlation window: 15 minutes of intraday ticks (~900 samples @1s).
// 80 ticks (~1.3 min) was far too noisy for meaningful gold-vs-driver correlation.
const CORR_WINDOW_MS = 15 * 60 * 1000;
const CORR_MAX_SAMPLES = 1800;

function pruneHistory(key, ts) {
  while (priceHistory[key].length > 0 && ts - priceHistory[key][0].ts > CORR_WINDOW_MS) {
    priceHistory[key].shift();
    returnHistory[key].shift();
  }
  if (priceHistory[key].length > CORR_MAX_SAMPLES) {
    const drop = priceHistory[key].length - CORR_MAX_SAMPLES;
    priceHistory[key].splice(0, drop);
    returnHistory[key].splice(0, drop);
  }
}

let asianRange = { sessionDate: null, high: null, low: null, complete: false };

const tickListeners = new Set();
export function onMarketTick(fn) {
  tickListeners.add(fn);
  return () => tickListeners.delete(fn);
}

function notifyTickListeners(key, quote) {
  for (const fn of tickListeners) {
    try { fn(key, quote); } catch (e) {}
  }
}

function utcSessionDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function updateAsianRange(price, ts = Date.now()) {
  const d = new Date(ts);
  const dateKey = utcSessionDate(d);
  const hour = d.getUTCHours();
  if (asianRange.sessionDate !== dateKey) {
    asianRange = { sessionDate: dateKey, high: hour < 7 ? price : null, low: hour < 7 ? price : null, complete: hour >= 7 };
  }
  if (hour < 7 && price != null) {
    asianRange.high = asianRange.high == null ? price : Math.max(asianRange.high, price);
    asianRange.low = asianRange.low == null ? price : Math.min(asianRange.low, price);
    asianRange.complete = false;
  } else if (hour >= 7) {
    asianRange.complete = true;
  }
}

function pushHistory(key, price, ts = Date.now()) {
  const hist = priceHistory[key];
  const last = hist.at(-1);
  hist.push({ price, ts });
  if (last && last.price !== 0) {
    returnHistory[key].push({ r: (price - last.price) / last.price, ts });
  }
  pruneHistory(key, ts);
}

function applyQuote(key, partial, source) {
  const def = ASSETS[key];
  const existing = quotes[key] || {};
  const price = partial.price != null ? partial.price : existing.price;
  if (price == null) return;

  const digits = def.digits;
  const prevClose = partial.previousClose != null ? partial.previousClose : (existing.previousClose ?? price);
  const change = partial.change != null ? partial.change : price - prevClose;
  const changePercent = partial.changePercent != null
    ? partial.changePercent
    : (prevClose ? (change / prevClose) * 100 : 0);

  quotes[key] = {
    price: Number(price.toFixed(digits)),
    previousClose: Number(Number(prevClose).toFixed(digits)),
    change: Number(Number(change).toFixed(digits)),
    changePercent: Number(Number(changePercent).toFixed(2)),
    high: Number(Number(partial.high ?? existing.high ?? price).toFixed(digits)),
    low: Number(Number(partial.low ?? existing.low ?? price).toFixed(digits)),
    bid: partial.bid != null ? Number(Number(partial.bid).toFixed(digits)) : existing.bid,
    ask: partial.ask != null ? Number(Number(partial.ask).toFixed(digits)) : existing.ask,
    spread: partial.spread != null ? partial.spread : existing.spread,
    source,
    lastUpdate: Date.now()
  };

  if (existing.price !== quotes[key].price) {
    pushHistory(key, quotes[key].price);
  }
  if (key === 'GOLD') updateAsianRange(quotes[key].price, quotes[key].lastUpdate);
  notifyTickListeners(key, quotes[key]);
}

let tvWebSocket = null;
let isTvWsConnected = false;
let tvReconnectTimer = null;
let tvReconnectAttempt = 0;
let tvLastActivityAt = Date.now();

const TV_RECONNECT_BASE_MS = 2500;
const TV_RECONNECT_MAX_MS = 30000;
const TV_WATCHDOG_STALE_MS = 60000;

function scheduleTvReconnect() {
  const delay = Math.min(TV_RECONNECT_BASE_MS * 2 ** tvReconnectAttempt, TV_RECONNECT_MAX_MS);
  tvReconnectAttempt++;
  if (tvReconnectTimer) clearTimeout(tvReconnectTimer);
  tvReconnectTimer = setTimeout(() => {
    tvReconnectTimer = null;
    initTradingViewStream();
  }, delay);
}

setInterval(() => {
  // Heartbeat watchdog: if the socket is "connected" but silent for too long,
  // force a reconnect cycle so the LIVE tape stays honest.
  if (isTvWsConnected && Date.now() - tvLastActivityAt > TV_WATCHDOG_STALE_MS) {
    console.warn('[MarketData] TV websocket silent — forcing reconnect.');
    try { tvWebSocket?.terminate(); } catch (e) {}
  }
}, 15000);

function initTradingViewStream() {
  if (tvWebSocket) {
    try { tvWebSocket.terminate(); } catch (e) {}
  }

  try {
    const ws = new WebSocket('wss://data.tradingview.com/socket.io/websocket', {
      origin: 'https://www.tradingview.com',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Origin: 'https://www.tradingview.com'
      }
    });

    const pack = (msg) => `~m~${msg.length}~m~${msg}`;
    const send = (m, p) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(pack(JSON.stringify({ m, p })));
    };
    const sessionId = 'qs_' + Math.random().toString(36).substring(2, 10);

    ws.on('open', () => {
      isTvWsConnected = true;
      tvReconnectAttempt = 0;
      tvLastActivityAt = Date.now();
      console.log('[MarketData] TradingView websocket connected.');
      send('set_auth_token', ['unauthorized_user_token']);
      send('quote_create_session', [sessionId]);
      send('quote_set_fields', [sessionId, 'lp', 'ch', 'chp', 'high_price', 'low_price', 'open_price', 'prev_close_price', 'bid', 'ask']);
      send('quote_add_symbols', [sessionId, ...Object.keys(TV_SYMBOL_MAP)]);
    });

    ws.on('message', (buf) => {
      tvLastActivityAt = Date.now();
      const raw = buf.toString();
      const parts = raw.split(/~m~\d+~m~/).filter(Boolean);
      for (const part of parts) {
        if (part.startsWith('~h~')) {
          if (ws.readyState === WebSocket.OPEN) ws.send(pack(part));
          continue;
        }
        try {
          const json = JSON.parse(part);
          if (json.m !== 'qsd') continue;
          const sym = json.p[1]?.n;
          const v = json.p[1]?.v;
          const key = TV_SYMBOL_MAP[sym];
          if (!key || !v) continue;
          const existing = quotes[key] || {};
          const price = v.lp !== undefined ? v.lp : existing.price;
          if (price === undefined) continue;
          const prevClose = v.prev_close_price !== undefined
            ? v.prev_close_price
            : (existing.previousClose || (price - (v.ch || 0)));
          const change = v.ch !== undefined ? v.ch : price - prevClose;
          const changePercent = v.chp !== undefined ? v.chp : (prevClose ? (change / prevClose) * 100 : 0);
          const bid = v.bid;
          const ask = v.ask;
          const spread = (bid != null && ask != null && ask >= bid) ? Number((ask - bid).toFixed(ASSETS[key].digits)) : existing.spread;
          applyQuote(key, {
            price,
            previousClose: prevClose,
            change,
            changePercent,
            high: v.high_price,
            low: v.low_price,
            bid,
            ask,
            spread
          }, 'tradingview-ws');
        } catch (err) {}
      }
    });

    ws.on('error', (err) => {
      console.warn('[MarketData] TV websocket error:', err?.message || err);
    });

    ws.on('close', () => {
      isTvWsConnected = false;
      if (tvReconnectTimer) clearTimeout(tvReconnectTimer);
      scheduleTvReconnect();
    });

    tvWebSocket = ws;
  } catch (err) {
    console.warn('[MarketData] TV websocket failed:', err.message);
    scheduleTvReconnect();
  }
}

initTradingViewStream();

async function fetchYahooQuote(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=2m&range=1d`;
    const json = await fetchJson(url, {}, 5000);
    const meta = json?.chart?.result?.[0]?.meta;
    const closes = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
    if (!meta) return null;
    const currentPrice = meta.regularMarketPrice || (closes || []).filter(Boolean).at(-1);
    if (currentPrice == null) return null;
    const previousClose = meta.chartPreviousClose || meta.previousClose || currentPrice;
    const change = currentPrice - previousClose;
    return {
      price: currentPrice,
      previousClose,
      change,
      changePercent: previousClose ? (change / previousClose) * 100 : 0,
      high: meta.regularMarketDayHigh || currentPrice,
      low: meta.regularMarketDayLow || currentPrice,
      quotes: (closes || []).filter(Boolean)
    };
  } catch (err) {
    return null;
  }
}

async function fetchTradingViewQuotes(symbols) {
  if (!symbols?.length) return {};
  try {
    const json = await fetchJson('https://scanner.tradingview.com/cfd/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbols: { tickers: symbols },
        columns: ['close', 'change', 'change_abs', 'high', 'low', 'bid', 'ask']
      })
    }, 5000);
    const result = {};
    for (const item of json?.data || []) {
      const d = item.d;
      if (!d) continue;
      const close = d[0];
      const bid = d[5];
      const ask = d[6];
      result[item.s] = {
        price: close,
        previousClose: close - (d[2] || 0),
        change: d[2] || 0,
        changePercent: d[1] || 0,
        high: d[3] || close,
        low: d[4] || close,
        bid,
        ask,
        spread: (bid != null && ask != null && ask >= bid) ? Number((ask - bid).toFixed(2)) : null
      };
    }
    return result;
  } catch (err) {
    return {};
  }
}

// Time-aligned Pearson correlation over a 15-minute rolling window.
// Each asset ticks at a different rate (gold ~1s, yields ~15s, equities ~1s),
// so returns are bucketed into aligned 15s bins before correlating.
function pearson(a, b, windowMs = CORR_WINDOW_MS, buckets = 60) {
  if (!a || !b || a.length < buckets * 0.3 || b.length < buckets * 0.3) return null;
  const now = Date.now();
  const start = now - windowMs;
  const sumA = new Array(buckets).fill(0);
  const cntA = new Array(buckets).fill(0);
  const sumB = new Array(buckets).fill(0);
  const cntB = new Array(buckets).fill(0);

  function fill(sums, cnts, arr) {
    for (const s of arr) {
      if (s.ts < start) continue;
      let idx = Math.floor(((s.ts - start) / windowMs) * buckets);
      if (idx >= buckets) idx = buckets - 1;
      sums[idx] += s.r;
      cnts[idx]++;
    }
  }
  fill(sumA, cntA, a);
  fill(sumB, cntB, b);

  const x = [];
  const y = [];
  for (let i = 0; i < buckets; i++) {
    if (cntA[i] > 0 && cntB[i] > 0) {
      x.push(sumA[i] / cntA[i]);
      y.push(sumB[i] / cntB[i]);
    }
  }
  if (x.length < 10) return null;

  const n = x.length;
  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const denom = Math.sqrt(denX * denY);
  if (denom === 0) return null;
  return Number((num / denom).toFixed(2));
}

function sessionFromUtc(date = new Date()) {
  const utcHour = date.getUTCHours();
  if (utcHour >= 7 && utcHour < 12) return 'LONDON_OPEN';
  if (utcHour >= 12 && utcHour < 16) return 'NY_OVERLAP';
  if (utcHour >= 16 && utcHour < 21) return 'NY_AFTERNOON';
  return 'ASIAN_PACIFIC';
}

function quoteAge(q) {
  if (!q?.lastUpdate) return null;
  return Date.now() - q.lastUpdate;
}

let lastYahooFetch = 0;
let lastTvScan = 0;
let lastYahooGold = null; // raw GC=F futures print for cross-source median
let lastAltGold = null;   // goldprice.org spot print (3rd independent source)
refreshFredMacro().catch(() => {});

async function fetchAltGold() {
  // Third independent spot print. gold-api.com is reliable & unthrottled;
  // goldprice.org is kept as a fallback (it rate-limits aggressively).
  try {
    const json = await fetchJson('https://api.gold-api.com/price/XAU', {}, 5000);
    const price = json?.price;
    if (price != null) {
      lastAltGold = { price: Number(price), ts: Date.now(), source: 'gold-api.com' };
      return;
    }
  } catch (err) {}
  try {
    const json = await fetchJson('https://data-asg.goldprice.org/dbXRates/USD', {
      headers: { Referer: 'https://goldprice.org/', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' }
    }, 5000);
    const price = json?.items?.[0]?.xauPrice;
    if (price != null) {
      lastAltGold = { price: Number(price), ts: Date.now(), source: 'goldprice.org' };
    }
  } catch (err) {}
}

export async function getMarketData() {
  const now = Date.now();

  if (now - lastYahooFetch > 15000) {
    lastYahooFetch = now;
    Promise.all(
      Object.entries(ASSETS).map(async ([key, def]) => {
        const existing = quotes[key];
        const stale = !existing || quoteAge(existing) > 20000;
        // GOLD is always refreshed so the raw GC=F print stays live for the
        // 3-source median check; TV-connected SILVER/DXY skip the redundant fetch.
        if (!stale && key !== 'GOLD' && isTvWsConnected) return;
        const q = await fetchYahooQuote(def.yahoo);
        if (q) {
          if (key === 'GOLD') {
            // Raw GC=F print kept live for the 3-source median; never clobber a
            // fresher TradingView spot quote with a futures reading.
            lastYahooGold = { price: q.price, ts: Date.now() };
            if (existing && quoteAge(existing) <= 20000 && existing.source !== 'yahoo') return;
          }
          applyQuote(key, q, 'yahoo');
        }
      })
    ).catch(() => {});
    fetchAltGold();
    refreshFredMacro().catch(() => {});
  }

  if (now - lastTvScan > 30000) {
    lastTvScan = now;
    const tvTickers = Object.keys(TV_SYMBOL_MAP);
    fetchTradingViewQuotes(tvTickers).then((tvQuotes) => {
      for (const [sym, quote] of Object.entries(tvQuotes)) {
        const key = TV_SYMBOL_MAP[sym];
        if (!key) continue;
        const existing = quotes[key];
        if (!existing || quoteAge(existing) > 15000) {
          applyQuote(key, quote, 'tradingview-scan');
        }
      }
    }).catch(() => {});
  }

  const fred = getFredMacro();
  const results = {};
  for (const [key, def] of Object.entries(ASSETS)) {
    const quote = quotes[key];
    if (!quote) {
      results[key] = {
        id: key,
        symbol: def.symbol,
        display: def.display,
        name: def.name,
        category: def.category,
        price: null,
        live: false,
        source: 'unavailable',
        history: [],
        correlation: null,
        momentum: 'UNAVAILABLE'
      };
      continue;
    }
    const age = quoteAge(quote);
    results[key] = {
      id: key,
      symbol: def.symbol,
      display: def.display,
      name: def.name,
      category: def.category,
      price: quote.price,
      previousClose: quote.previousClose,
      change: quote.change,
      changePercent: quote.changePercent,
      high: quote.high,
      low: quote.low,
      bid: quote.bid,
      ask: quote.ask,
      spread: quote.spread,
      history: priceHistory[key].slice(-20).map((p) => p.price),
      live: age != null && age < 30000,
      source: quote.source,
      ageMs: age,
      momentum: quote.changePercent > 0.4 ? 'STRONG_UP'
        : quote.changePercent > 0.05 ? 'UP'
        : quote.changePercent < -0.4 ? 'STRONG_DOWN'
        : quote.changePercent < -0.05 ? 'DOWN'
        : 'NEUTRAL'
    };
  }

  const goldPrice = results.GOLD.price;
  const silverPrice = results.SILVER.price;
  const gsr = (goldPrice && silverPrice) ? Number((goldPrice / silverPrice).toFixed(2)) : null;

  // DGS10 (10Y nominal): live Yahoo ^TNX preferred, FRED DGS10 as fallback
  const nominal10Y = results.US10Y.price ?? fred.nominal10Y;
  const breakeven10Y = fred.breakeven10Y;   // T10YIE
  const fredReal = fred.realYield10Y;        // DGS10 - T10YIE (or DFII10)
  const liveRealYield = (nominal10Y != null && breakeven10Y != null)
    ? Number((nominal10Y - breakeven10Y).toFixed(2))
    : fredReal;

  if (results.US02Y.price == null && fred.yield2Y != null) {
    results.US02Y = {
      ...results.US02Y,
      price: fred.yield2Y,
      live: false,
      source: 'fred-dgs2',
      name: 'US 2Y Yield'
    };
  }

  const yield2Y = results.US02Y.price;
  const yieldCurveSpread = (nominal10Y != null && yield2Y != null)
    ? Number((nominal10Y - yield2Y).toFixed(2))
    : null;

  for (const key of Object.keys(results)) {
    results[key].correlation = key === 'GOLD' ? 1 : pearson(returnHistory.GOLD, returnHistory[key]);
  }

  const goldAge = quoteAge(quotes.GOLD);

  // ── Cross-source gold price verification ─────────────────────────────
  const priceSources = [];
  const goldQuote = quotes.GOLD;
  const goldQuoteAge = goldAge;
  if (goldQuote?.price && goldQuoteAge != null && goldQuoteAge < 30000) {
    priceSources.push({
      name: goldQuote.source === 'yahoo' ? 'Yahoo GC=F' : 'TradingView',
      price: goldQuote.price,
      ageMs: goldQuoteAge
    });
  }
  const yahooGoldAge = lastYahooGold ? Date.now() - lastYahooGold.ts : null;
  if (lastYahooGold && yahooGoldAge != null && yahooGoldAge < 60000 && !priceSources.some((s) => s.name === 'Yahoo GC=F')) {
    priceSources.push({ name: 'Yahoo GC=F', price: lastYahooGold.price, ageMs: yahooGoldAge });
  }
  const altGoldAge = lastAltGold ? Date.now() - lastAltGold.ts : null;
  if (lastAltGold && altGoldAge != null && altGoldAge < 60000) {
    priceSources.push({ name: lastAltGold.source || 'Alt spot', price: lastAltGold.price, ageMs: altGoldAge });
  }
  const nums = priceSources.map((s) => s.price).filter(Number.isFinite);
  let medianPrice = null;
  let priceSpread = null;
  let priceDiscrepancy = false;
  if (nums.length >= 2) {
    const sorted = [...nums].sort((a, b) => a - b);
    medianPrice = Number(sorted[Math.floor(sorted.length / 2)].toFixed(2));
    priceSpread = Number((sorted[sorted.length - 1] - sorted[0]).toFixed(2));
    priceDiscrepancy = priceSpread > 2.5;
  }
  const goldPriceCheck = {
    activeSources: priceSources.length,
    medianPrice,
    spread: priceSpread,
    discrepancy: priceDiscrepancy,
    sources: priceSources
  };

  const marketState = getMarketState();

  cachedMarketData = {
    timestamp: new Date().toISOString(),
    session: marketState.open ? sessionFromUtc() : 'CLOSED',
    marketState,
    spread: results.GOLD.spread ?? null,
    goldSpot: results.GOLD,
    gsr,
    realYield10Y: liveRealYield,
    breakeven10Y,
    fredRealYield10Y: fredReal,
    yieldCurveSpread,
    goldPriceCheck,
    keyLevels: getKeyLevels(),
    longCorrelations: getCorrelationMonitor(),
    volatilityRegime: getVolatilityRegime(),
    asianRange: {
      ...asianRange,
      high: asianRange.high != null ? Number(asianRange.high.toFixed(2)) : null,
      low: asianRange.low != null ? Number(asianRange.low.toFixed(2)) : null
    },
    dataHealth: {
      tvWs: isTvWsConnected,
      goldSource: results.GOLD.source || 'unavailable',
      goldAgeMs: goldAge,
      stale: goldAge == null || goldAge > 30000,
      priceCheck: {
        sources: priceSources.length,
        discrepancy: priceDiscrepancy,
        spread: priceSpread
      }
    },
    assets: results
  };

  return cachedMarketData;
}

export function getCachedMarketData() {
  return cachedMarketData;
}

export function getAsianRange() {
  return asianRange;
}
