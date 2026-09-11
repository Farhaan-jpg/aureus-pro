// Market Data Engine for Aureus Pro
// Real-time tick engine streaming directly from TradingView WebSocket + Yahoo Finance macro feeds.

const ASSETS = {
  GOLD: { symbol: 'OANDA:XAUUSD', name: 'Gold Spot', display: 'XAU/USD', category: 'metal', basePrice: 4380.00 },
  SILVER: { symbol: 'TVC:SILVER', name: 'Silver Spot', display: 'XAG/USD', category: 'metal', basePrice: 65.00 },
  CRUDE_OIL: { symbol: 'TVC:USOIL', name: 'WTI Crude Oil', display: 'USOIL', category: 'energy', basePrice: 99.30 },
  COPPER: { symbol: 'HG=F', name: 'Copper Futures', display: 'HG/USD', category: 'metal', basePrice: 4.12 },
  PLATINUM: { symbol: 'TVC:PLATINUM', name: 'Platinum', display: 'XPT/USD', category: 'metal', basePrice: 1807.00 },
  DXY: { symbol: 'TVC:DXY', name: 'US Dollar Index', display: 'DXY', category: 'currency', basePrice: 99.06 },
  US10Y: { symbol: '^TNX', name: 'US 10Y Yield', display: 'US10Y', category: 'rate', basePrice: 4.42 },
  US02Y: { symbol: '^IRX', name: 'US 2Y Yield', display: 'US02Y', category: 'rate', basePrice: 4.28 },
  VIX: { symbol: 'TVC:VIX', name: 'CBOE Volatility', display: 'VIX', category: 'volatility', basePrice: 16.00 }
};

const TV_SYMBOL_MAP = {
  'OANDA:XAUUSD': 'GOLD',
  'TVC:SILVER': 'SILVER',
  'TVC:USOIL': 'CRUDE_OIL',
  'TVC:PLATINUM': 'PLATINUM',
  'TVC:DXY': 'DXY',
  'TVC:VIX': 'VIX'
};

let cachedMarketData = null;
const anchorQuotes = {};
const priceHistory = {
  GOLD: [],
  SILVER: [],
  CRUDE_OIL: [],
  COPPER: [],
  PLATINUM: [],
  DXY: [],
  US10Y: [],
  US02Y: [],
  VIX: []
};

// Seed initial history
for (const [key, def] of Object.entries(ASSETS)) {
  const base = def.basePrice;
  priceHistory[key] = Array(20).fill(base);
}

// Tick Event Listeners (SSE Broadcaster)
const tickListeners = new Set();
export function onMarketTick(fn) {
  tickListeners.add(fn);
  return () => tickListeners.delete(fn);
}

function notifyTickListeners(key, quote) {
  for (const fn of tickListeners) {
    try {
      fn(key, quote);
    } catch (e) {}
  }
}

// -------------------------------------------------------------
// 1. Direct TradingView Real-Time WebSocket Engine (0 Delay)
// -------------------------------------------------------------
let tvWebSocket = null;
let isTvWsConnected = false;
let tvReconnectTimer = null;

function initTradingViewStream() {
  if (typeof globalThis.WebSocket === 'undefined') return;

  if (tvWebSocket) {
    try { tvWebSocket.close(); } catch (e) {}
  }

  try {
    const ws = new WebSocket('wss://data.tradingview.com/socket.io/websocket', {
      headers: {
        'Origin': 'https://www.tradingview.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const pack = (msg) => `~m~${msg.length}~m~${msg}`;
    const send = (m, p) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(pack(JSON.stringify({ m, p })));
      }
    };

    const sessionId = 'qs_' + Math.random().toString(36).substring(2, 10);

    ws.onopen = () => {
      isTvWsConnected = true;
      console.log('[MarketData] Real-Time TradingView WebSocket Stream connected.');
      send('set_auth_token', ['unauthorized_user_token']);
      send('quote_create_session', [sessionId]);
      send('quote_set_fields', [sessionId, 'lp', 'ch', 'chp', 'high_price', 'low_price', 'open_price', 'prev_close_price', 'bid', 'ask']);
      send('quote_add_symbols', [sessionId, ...Object.keys(TV_SYMBOL_MAP)]);
    };

    ws.onmessage = (e) => {
      const raw = e.data;
      if (typeof raw !== 'string') return;
      const parts = raw.split(/~m~\d+~m~/).filter(Boolean);

      for (const part of parts) {
        if (part.startsWith('~h~')) {
          // Heartbeat keepalive
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(pack(part));
          }
          continue;
        }

        try {
          const json = JSON.parse(part);
          if (json.m === 'qsd') {
            const sym = json.p[1]?.n;
            const v = json.p[1]?.v;
            const key = TV_SYMBOL_MAP[sym];

            if (key && v) {
              const existing = anchorQuotes[key] || {};
              const price = v.lp !== undefined ? v.lp : existing.price;

              if (price !== undefined) {
                const prevClose = v.prev_close_price !== undefined 
                  ? v.prev_close_price 
                  : (existing.previousClose || (price - (v.ch || 0)));
                
                const change = v.ch !== undefined 
                  ? v.ch 
                  : Number((price - prevClose).toFixed(key.includes('DXY') ? 3 : 2));

                const changePercent = v.chp !== undefined 
                  ? v.chp 
                  : (prevClose ? Number(((change / prevClose) * 100).toFixed(2)) : 0);

                const high = v.high_price !== undefined ? v.high_price : Math.max(existing.high || price, price);
                const low = v.low_price !== undefined ? v.low_price : Math.min(existing.low || price, price);
                const bid = v.bid !== undefined ? v.bid : (existing.bid ?? (price - 0.20));
                const ask = v.ask !== undefined ? v.ask : (existing.ask ?? (price + 0.20));
                const spread = (bid != null && ask != null && ask >= bid) ? Number((ask - bid).toFixed(2)) : (existing.spread ?? 0.40);

                anchorQuotes[key] = {
                  price: Number(price.toFixed(key.includes('DXY') || key.includes('HG') ? 3 : 2)),
                  previousClose: Number(prevClose.toFixed(2)),
                  change: Number(change.toFixed(2)),
                  changePercent: Number(changePercent.toFixed(2)),
                  high: Number(high.toFixed(2)),
                  low: Number(low.toFixed(2)),
                  bid: Number(bid.toFixed(2)),
                  ask: Number(ask.toFixed(2)),
                  spread,
                  lastUpdate: Date.now()
                };

                priceHistory[key].push(price);
                if (priceHistory[key].length > 60) priceHistory[key].shift();

                notifyTickListeners(key, anchorQuotes[key]);
              }
            }
          }
        } catch (err) {}
      }
    };

    ws.onerror = (err) => {
      console.warn('[MarketData] TV WebSocket error:', err?.message || 'closed');
    };

    ws.onclose = () => {
      isTvWsConnected = false;
      console.log('[MarketData] TV WebSocket closed. Auto-reconnecting in 2s...');
      if (tvReconnectTimer) clearTimeout(tvReconnectTimer);
      tvReconnectTimer = setTimeout(initTradingViewStream, 2000);
    };

    tvWebSocket = ws;
  } catch (err) {
    console.warn('[MarketData] Could not start TV WS:', err.message);
    if (tvReconnectTimer) clearTimeout(tvReconnectTimer);
    tvReconnectTimer = setTimeout(initTradingViewStream, 3000);
  }
}

// Start TradingView real-time feed immediately
initTradingViewStream();

// -------------------------------------------------------------
// 2. HTTP Scanner & Yahoo Fallback Engine
// -------------------------------------------------------------
async function fetchYahooQuote(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=2m&range=1d`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    const quotes = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;

    if (!meta) return null;

    const currentPrice = meta.regularMarketPrice || quotes?.filter(Boolean).pop();
    const previousClose = meta.chartPreviousClose || meta.previousClose || currentPrice;
    const change = currentPrice - previousClose;
    const changePercent = previousClose ? (change / previousClose) * 100 : 0;
    const high = meta.regularMarketDayHigh || currentPrice * 1.004;
    const low = meta.regularMarketDayLow || currentPrice * 0.996;

    return {
      price: Number(currentPrice.toFixed(symbol.includes('^') || symbol.includes('HG') ? 3 : 2)),
      previousClose: Number(previousClose.toFixed(2)),
      change: Number(change.toFixed(2)),
      changePercent: Number(changePercent.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      quotes: quotes?.filter(Boolean) || []
    };
  } catch (err) {
    return null;
  }
}

async function fetchTradingViewQuotes(symbols) {
  if (!symbols || symbols.length === 0) return {};
  try {
    const url = 'https://scanner.tradingview.com/cfd/scan';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({
        symbols: { tickers: symbols },
        columns: ['close', 'change', 'change_abs', 'high', 'low', 'bid', 'ask']
      })
    });
    clearTimeout(timeout);

    if (!res.ok) return {};
    const json = await res.json();
    const result = {};
    if (Array.isArray(json?.data)) {
      for (const item of json.data) {
        const s = item.s;
        const d = item.d;
        if (!d) continue;
        const close = d[0];
        const changePercent = d[1] || 0;
        const changeAbs = d[2] || 0;
        const high = d[3] || close;
        const low = d[4] || close;
        const bid = d[5];
        const ask = d[6];
        const spread = (bid != null && ask != null && ask >= bid) ? Number((ask - bid).toFixed(2)) : 0.40;

        result[s] = {
          price: Number(close.toFixed(s.includes('DXY') || s.includes('HG') ? 3 : 2)),
          previousClose: Number((close - changeAbs).toFixed(2)),
          change: Number(changeAbs.toFixed(2)),
          changePercent: Number(changePercent.toFixed(2)),
          high: Number(high.toFixed(2)),
          low: Number(low.toFixed(2)),
          bid: Number((bid || close - 0.20).toFixed(2)),
          ask: Number((ask || close + 0.20).toFixed(2)),
          spread,
          quotes: [low, close, high]
        };
      }
    }
    return result;
  } catch (err) {
    return {};
  }
}

// Calculate Pearson Correlation Coefficient
function calculatePearson(arr1, arr2) {
  if (!arr1 || !arr2 || arr1.length < 5 || arr2.length < 5) return 0;
  const n = Math.min(arr1.length, arr2.length);
  const x = arr1.slice(-n);
  const y = arr2.slice(-n);

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

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
  if (denom === 0) return 0;
  return Number((num / denom).toFixed(2));
}

let lastFallbackScan = 0;
let lastYahooFetch = 0;

export async function getMarketData() {
  const now = Date.now();

  // Background refresh for Yahoo yields & copper every 20s
  if ((now - lastYahooFetch) > 20000) {
    lastYahooFetch = now;
    Promise.all([
      fetchYahooQuote('^TNX').then(q => { if (q) anchorQuotes.US10Y = q; }),
      fetchYahooQuote('^IRX').then(q => { if (q) anchorQuotes.US02Y = q; }),
      fetchYahooQuote('HG=F').then(q => { if (q) anchorQuotes.COPPER = q; }),
      fetchYahooQuote('CL=F').then(q => { if (q && !anchorQuotes.CRUDE_OIL) anchorQuotes.CRUDE_OIL = q; })
    ]).catch(() => {});
  }

  // If WebSocket hasn't delivered quotes yet or on cold boot, run REST scan fallback
  if (!anchorQuotes.GOLD || (now - lastFallbackScan) > 30000) {
    lastFallbackScan = now;
    const tvTickers = Object.values(ASSETS).filter(a => a.symbol.includes(':')).map(a => a.symbol);
    fetchTradingViewQuotes(tvTickers).then(tvQuotes => {
      for (const [sym, quote] of Object.entries(tvQuotes)) {
        const key = TV_SYMBOL_MAP[sym];
        if (key && !anchorQuotes[key]) {
          anchorQuotes[key] = quote;
        }
      }
    }).catch(() => {});
  }

  const results = {};
  for (const [key, def] of Object.entries(ASSETS)) {
    let quote = anchorQuotes[key];

    if (quote) {
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
        history: priceHistory[key].slice(-15),
        momentum: quote.changePercent > 0.4 ? 'STRONG_UP' : quote.changePercent > 0.05 ? 'UP' : quote.changePercent < -0.4 ? 'STRONG_DOWN' : quote.changePercent < -0.05 ? 'DOWN' : 'NEUTRAL'
      };
    } else {
      const base = def.basePrice;
      results[key] = {
        id: key,
        symbol: def.symbol,
        display: def.display,
        name: def.name,
        category: def.category,
        price: base,
        previousClose: base,
        change: 0.00,
        changePercent: 0.00,
        high: base * 1.002,
        low: base * 0.998,
        bid: base - 0.20,
        ask: base + 0.20,
        spread: 0.40,
        history: priceHistory[key].slice(-15),
        momentum: 'NEUTRAL'
      };
    }
  }

  // Macro Metrics
  const goldPrice = results.GOLD.price;
  const silverPrice = results.SILVER.price;
  const gsr = silverPrice > 0 ? Number((goldPrice / silverPrice).toFixed(2)) : 67.4;

  const nominal10Y = results.US10Y.price;
  const estimatedBreakeven = 2.25;
  const realYield10Y = Number((nominal10Y - estimatedBreakeven).toFixed(2));

  const yield2Y = results.US02Y.price;
  const yieldCurveSpread = Number((nominal10Y - yield2Y).toFixed(2));

  // Rolling Correlations
  const goldReturns = priceHistory.GOLD;
  for (const key of Object.keys(results)) {
    if (key === 'GOLD') {
      results[key].correlation = 1.0;
    } else {
      results[key].correlation = calculatePearson(goldReturns, priceHistory[key]);
    }
  }

  const spread = results.GOLD.spread != null ? results.GOLD.spread : 0.40;

  // Active trading session
  const currentDate = new Date();
  const utcHour = currentDate.getUTCHours();
  let session = 'ASIAN';
  if (utcHour >= 7 && utcHour < 12) session = 'LONDON_OPEN';
  else if (utcHour >= 12 && utcHour < 16) session = 'NY_OVERLAP';
  else if (utcHour >= 16 && utcHour < 21) session = 'NY_AFTERNOON';
  else session = 'ASIAN_PACIFIC';

  cachedMarketData = {
    timestamp: new Date().toISOString(),
    session,
    spread,
    goldSpot: results.GOLD,
    gsr,
    realYield10Y,
    yieldCurveSpread,
    assets: results
  };

  return cachedMarketData;
}

export function getCachedMarketData() {
  return cachedMarketData;
}
