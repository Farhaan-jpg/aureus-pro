// Market Data Engine for Aureus Pro
// Tracks XAU/USD, correlated commodities, macro drivers, and computes rolling correlations.

const ASSETS = {
  GOLD: { symbol: 'OANDA:XAUUSD', name: 'Gold Spot', display: 'XAU/USD', category: 'metal', basePrice: 4335.00 },
  SILVER: { symbol: 'TVC:SILVER', name: 'Silver Spot', display: 'XAG/USD', category: 'metal', basePrice: 63.80 },
  CRUDE_OIL: { symbol: 'CL=F', name: 'WTI Crude Oil', display: 'USOIL', category: 'energy', basePrice: 68.75 },
  COPPER: { symbol: 'HG=F', name: 'Copper Futures', display: 'HG/USD', category: 'metal', basePrice: 4.12 },
  PLATINUM: { symbol: 'TVC:PLATINUM', name: 'Platinum', display: 'XPT/USD', category: 'metal', basePrice: 1794.80 },
  DXY: { symbol: 'TVC:DXY', name: 'US Dollar Index', display: 'DXY', category: 'currency', basePrice: 99.16 },
  US10Y: { symbol: '^TNX', name: 'US 10Y Yield', display: 'US10Y', category: 'rate', basePrice: 4.42 },
  US02Y: { symbol: '^IRX', name: 'US 2Y Yield', display: 'US02Y', category: 'rate', basePrice: 4.28 },
  VIX: { symbol: 'TVC:VIX', name: 'CBOE Volatility', display: 'VIX', category: 'volatility', basePrice: 17.08 }
};

let cachedMarketData = null;
let priceHistory = {
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

// Seed initial historical return arrays
function seedHistory() {
  const points = 30;
  for (const key of Object.keys(ASSETS)) {
    const base = ASSETS[key].basePrice;
    let cur = base;
    priceHistory[key] = [];
    for (let i = 0; i < points; i++) {
      const delta = (Math.random() - 0.49) * 0.004 * cur;
      cur = Math.max(0.01, cur + delta);
      priceHistory[key].push(Number(cur.toFixed(4)));
    }
  }
}
seedHistory();

// Calculate Pearson Correlation Coefficient between two series
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

// Fetch single quote from Yahoo Finance v8 endpoint
async function fetchYahooQuote(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=2m&range=1d`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
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

// Batch fetch real-time quotes directly from TradingView Scanner API (OANDA / TVC feeds)
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
        const spread = (bid != null && ask != null && ask >= bid) ? Number((ask - bid).toFixed(2)) : null;

        result[s] = {
          price: Number(close.toFixed(s.includes('DXY') || s.includes('HG') ? 3 : 2)),
          previousClose: Number((close - changeAbs).toFixed(2)),
          change: Number(changeAbs.toFixed(2)),
          changePercent: Number(changePercent.toFixed(2)),
          high: Number(high.toFixed(2)),
          low: Number(low.toFixed(2)),
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

// Fallback synthetic micro-tick engine if APIs rate limit or are unreachable
function generateMicroTick(key) {
  const asset = ASSETS[key];
  const lastPrice = priceHistory[key][priceHistory[key].length - 1] || asset.basePrice;
  const driftFactor = (Math.random() - 0.495) * 0.0015;
  const newPrice = Number((lastPrice * (1 + driftFactor)).toFixed(key === 'COPPER' || key.includes('Y') ? 3 : 2));

  priceHistory[key].push(newPrice);
  if (priceHistory[key].length > 60) priceHistory[key].shift();

  const prevClose = asset.basePrice;
  const change = newPrice - prevClose;
  const changePercent = (change / prevClose) * 100;

  return {
    price: newPrice,
    previousClose: prevClose,
    change: Number(change.toFixed(2)),
    changePercent: Number(changePercent.toFixed(2)),
    high: Number((Math.max(...priceHistory[key])).toFixed(2)),
    low: Number((Math.min(...priceHistory[key])).toFixed(2)),
    quotes: priceHistory[key]
  };
}

let lastTvFetch = 0;
let lastYahooFetch = 0;
const anchorQuotes = {};

export async function getMarketData() {
  const now = Date.now();
  const shouldRefreshTv = (now - lastTvFetch) > 2500; // Refresh TV quotes every 2.5s for real-time chart sync
  const shouldRefreshYahoo = (now - lastYahooFetch) > 15000; // Refresh Yahoo yields/crude every 15s

  const tvTickers = [];
  const yahooTickers = [];

  for (const [key, def] of Object.entries(ASSETS)) {
    if (def.symbol.includes(':')) {
      tvTickers.push({ key, symbol: def.symbol });
    } else {
      yahooTickers.push({ key, symbol: def.symbol });
    }
  }

  // 1. Fetch TradingView quotes in one fast batch
  if (shouldRefreshTv || !anchorQuotes.GOLD) {
    lastTvFetch = now;
    const tvQuotes = await fetchTradingViewQuotes(tvTickers.map(t => t.symbol));
    for (const item of tvTickers) {
      if (tvQuotes[item.symbol]) {
        anchorQuotes[item.key] = tvQuotes[item.symbol];
      }
    }
  }

  // 2. Fetch Yahoo quotes if needed
  if (shouldRefreshYahoo || yahooTickers.some(t => !anchorQuotes[t.key])) {
    lastYahooFetch = now;
    await Promise.all(
      yahooTickers.map(async (item) => {
        const quote = await fetchYahooQuote(item.symbol);
        if (quote) {
          anchorQuotes[item.key] = quote;
        }
      })
    );
  }

  const results = {};
  for (const [key, def] of Object.entries(ASSETS)) {
    let quote = anchorQuotes[key];

    if (quote) {
      const price = quote.price;
      priceHistory[key].push(price);
      if (priceHistory[key].length > 60) priceHistory[key].shift();

      results[key] = {
        id: key,
        symbol: def.symbol,
        display: def.display,
        name: def.name,
        category: def.category,
        price: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
        high: quote.high,
        low: quote.low,
        spread: quote.spread,
        history: priceHistory[key].slice(-15),
        momentum: quote.changePercent > 0.4 ? 'STRONG_UP' : quote.changePercent > 0.05 ? 'UP' : quote.changePercent < -0.4 ? 'STRONG_DOWN' : quote.changePercent < -0.05 ? 'DOWN' : 'NEUTRAL'
      };
    } else {
      const micro = generateMicroTick(key);
      results[key] = {
        id: key,
        symbol: def.symbol,
        display: def.display,
        name: def.name,
        category: def.category,
        price: micro.price,
        change: micro.change,
        changePercent: micro.changePercent,
        high: micro.high,
        low: micro.low,
        spread: 0.30,
        history: priceHistory[key].slice(-15),
        momentum: micro.changePercent > 0.4 ? 'STRONG_UP' : micro.changePercent > 0.05 ? 'UP' : micro.changePercent < -0.4 ? 'STRONG_DOWN' : micro.changePercent < -0.05 ? 'DOWN' : 'NEUTRAL'
      };
    }
  }

  // Compute Special Macro Metrics
  const goldPrice = results.GOLD.price;
  const silverPrice = results.SILVER.price;
  const gsr = silverPrice > 0 ? Number((goldPrice / silverPrice).toFixed(2)) : 68.0;

  // Real Yield = Nominal 10Y - 5Y5Y forward breakeven inflation proxy (~2.25%)
  const nominal10Y = results.US10Y.price;
  const estimatedBreakeven = 2.25;
  const realYield10Y = Number((nominal10Y - estimatedBreakeven).toFixed(2));

  // Yield Curve 10Y-2Y Spread
  const yield2Y = results.US02Y.price;
  const yieldCurveSpread = Number((nominal10Y - yield2Y).toFixed(2));

  // Calculate Rolling Correlations against Gold
  const goldReturns = priceHistory.GOLD;
  for (const key of Object.keys(results)) {
    if (key === 'GOLD') {
      results[key].correlation = 1.0;
    } else {
      results[key].correlation = calculatePearson(goldReturns, priceHistory[key]);
    }
  }

  // Calculate Gold Spread: use real OANDA spread if available, else standard institutional spread
  const spread = results.GOLD.spread != null ? results.GOLD.spread : Number((0.20 + (Math.random() * 0.10)).toFixed(2));

  // Determine current active trading session
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
