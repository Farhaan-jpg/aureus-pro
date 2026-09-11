import { fetchJson } from './httpClient.js';

const ETF_LIST = [
  { ticker: 'GLD', issuer: 'SPDR', name: 'SPDR Gold Shares' },
  { ticker: 'IAU', issuer: 'iShares', name: 'iShares Gold Trust' },
  { ticker: 'GLDM', issuer: 'SPDR', name: 'Gold MiniShares' },
  { ticker: 'SGOL', issuer: 'Aberdeen', name: 'Physical Gold ETF' },
  { ticker: 'GDX', issuer: 'VanEck', name: 'Gold Miners ETF' }
];

let cache = {
  live: false,
  timestamp: null,
  etfs: [],
  inflowCount: 0,
  outflowCount: 0,
  totalEstFlow: 0,
  goldEtfBias: 'UNAVAILABLE',
  minersConfirm: 'UNAVAILABLE'
};
let lastFetch = 0;

async function fetchChart(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=5d&interval=1d`;
  return fetchJson(url, {}, 8000);
}

function parseChart(chart, meta) {
  const result = chart?.chart?.result?.[0];
  if (!result) return null;
  const quote = result.indicators?.quote?.[0];
  const closes = (quote?.close || []).filter((p) => p != null);
  const volumes = (quote?.volume || []).filter((v) => v != null);
  if (closes.length < 2) return null;

  const latestPrice = closes[closes.length - 1];
  const prevPrice = closes[closes.length - 2];
  const priceChange = prevPrice ? ((latestPrice - prevPrice) / prevPrice) * 100 : 0;
  const latestVolume = volumes.at(-1) || 0;
  const avgVolume = volumes.length > 1
    ? volumes.slice(0, -1).reduce((a, b) => a + b, 0) / (volumes.length - 1)
    : latestVolume;
  const volumeRatio = avgVolume > 0 ? latestVolume / avgVolume : 1;
  const direction = priceChange > 0.15 ? 'inflow' : priceChange < -0.15 ? 'outflow' : 'neutral';
  const estFlow = latestVolume * latestPrice * (priceChange / 100);

  return {
    ticker: meta.ticker,
    issuer: meta.issuer,
    name: meta.name,
    price: Number(latestPrice.toFixed(2)),
    priceChange: Number(priceChange.toFixed(2)),
    volume: latestVolume,
    avgVolume: Math.round(avgVolume),
    volumeRatio: Number(volumeRatio.toFixed(2)),
    direction,
    estFlow: Math.round(estFlow)
  };
}

export async function refreshGoldEtfFlows(force = false) {
  const now = Date.now();
  if (!force && lastFetch && now - lastFetch < 5 * 60 * 1000 && cache.live) {
    return cache;
  }
  lastFetch = now;

  try {
    const charts = await Promise.allSettled(ETF_LIST.map((etf) => fetchChart(etf.ticker)));
    const etfs = [];
    for (let i = 0; i < ETF_LIST.length; i++) {
      if (charts[i].status !== 'fulfilled') continue;
      const parsed = parseChart(charts[i].value, ETF_LIST[i]);
      if (parsed) etfs.push(parsed);
    }

    const bullion = etfs.filter((e) => e.ticker !== 'GDX');
    const miners = etfs.find((e) => e.ticker === 'GDX');
    const inflowCount = bullion.filter((e) => e.direction === 'inflow').length;
    const outflowCount = bullion.filter((e) => e.direction === 'outflow').length;
    const totalEstFlow = bullion.reduce((sum, e) => sum + e.estFlow, 0);

    let goldEtfBias = 'MIXED';
    if (totalEstFlow > 0 && inflowCount >= outflowCount) goldEtfBias = 'INFLOW';
    else if (totalEstFlow < 0 && outflowCount >= inflowCount) goldEtfBias = 'OUTFLOW';

    cache = {
      live: etfs.length > 0,
      timestamp: new Date().toISOString(),
      etfs,
      inflowCount,
      outflowCount,
      totalEstFlow,
      goldEtfBias,
      minersConfirm: miners
        ? (miners.priceChange > 0.3 ? 'RISK_ON_MINERS' : miners.priceChange < -0.3 ? 'MINERS_LAGGING' : 'FLAT')
        : 'UNAVAILABLE',
      note: 'Flow direction is inferred from daily price × volume (not official creation/redemption prints).'
    };
  } catch (err) {
    console.warn('[ETF] Refresh failed:', err.message);
  }

  return cache;
}

export function getGoldEtfFlows() {
  return cache;
}
