import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchJson } from './httpClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_FILE = path.join(__dirname, '../data/cot_cache.json');

const GOLD_CODE = '088691';
const CFTC_URL = `https://publicreporting.cftc.gov/resource/6dca-aqww.json?cftc_contract_market_code=${GOLD_CODE}&$order=report_date_as_yyyy_mm_dd DESC&$limit=156`;

let cotCache = {
  reportDate: null,
  releaseDate: null,
  contract: 'COMEX GOLD (100 TROY OZ)',
  source: 'CFTC',
  live: false,
  openInterest: 0,
  openInterestChange: 0,
  managedMoney: {
    longs: 0,
    shorts: 0,
    net: 0,
    weeklyNetChange: 0,
    longShortRatio: 0,
    percentile3Year: null,
    stance: 'UNAVAILABLE'
  },
  commercials: {
    longs: 0,
    shorts: 0,
    net: 0,
    weeklyNetChange: 0,
    stance: 'UNAVAILABLE'
  },
  smallTraders: {
    longs: 0,
    shorts: 0,
    net: 0,
    weeklyNetChange: 0
  },
  weeklyTrend: [],
  signal: {
    bias: 'UNAVAILABLE',
    percentile: null,
    headline: 'Waiting for CFTC weekly gold COT download',
    description: '',
    institutionalAction: ''
  },
  lastUpdated: null
};

try {
  if (fs.existsSync(CACHE_FILE)) {
    const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    if (raw?.live && raw?.managedMoney?.net) {
      cotCache = { ...cotCache, ...raw };
    }
  }
} catch (e) {
  console.warn('[COT] Could not read cache:', e.message);
}

function persistCotCache() {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cotCache, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[COT] Persist failed:', e.message);
  }
}

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function stanceFromPercentile(p) {
  if (p == null) return 'UNAVAILABLE';
  if (p >= 85) return 'EXTREME_BULLISH_OVEREXTENDED';
  if (p >= 65) return 'BULLISH';
  if (p <= 15) return 'EXTREME_BEARISH_CAPITULATION';
  if (p <= 35) return 'BEARISH';
  return 'NEUTRAL';
}

function buildSignal(percentile, mmNet, mmChange, commNet) {
  if (percentile == null) {
    return {
      bias: 'UNAVAILABLE',
      percentile,
      headline: 'CFTC gold COT not loaded',
      description: 'Live weekly positioning is unavailable until the CFTC dataset responds.',
      institutionalAction: 'Do not size from COT until the official report is loaded.'
    };
  }
  if (percentile >= 85) {
    return {
      bias: 'OVERBOUGHT_CONTRARIAN_CAUTION',
      percentile,
      headline: `Managed money net longs at ${percentile}rd percentile — crowded`,
      description: `Specs hold ${mmNet.toLocaleString()} net contracts (weekly Δ ${mmChange.toLocaleString()}). Commercials net ${commNet.toLocaleString()}. Crowded long books are vulnerable to DXY/real-yield spikes.`,
      institutionalAction: 'Avoid chasing late breakouts; wait for a liquidity flush or a drop in spec percentile.'
    };
  }
  if (percentile <= 25) {
    return {
      bias: 'CAPITULATION_ACCUMULATION',
      percentile,
      headline: `Managed money at ${percentile}th percentile — washed out`,
      description: `Spec nets ${mmNet.toLocaleString()}. Historically this is closer to a positioning floor than a top.`,
      institutionalAction: 'Look for discount accumulation after stops are taken, not mid-range chasing.'
    };
  }
  return {
    bias: 'TREND_ALIGNED',
    percentile,
    headline: `Managed money percentile ${percentile} — not an extreme`,
    description: `Spec nets ${mmNet.toLocaleString()} (Δ ${mmChange.toLocaleString()}). Positioning is not a standalone reverse signal.`,
    institutionalAction: 'Weight DXY, real yields, and ETF flows higher than COT this week.'
  };
}

function mapRow(row, prev) {
  const mmLong = n(row.noncomm_positions_long_all);
  const mmShort = n(row.noncomm_positions_short_all);
  const mmNet = mmLong - mmShort;
  const commLong = n(row.comm_positions_long_all);
  const commShort = n(row.comm_positions_short_all);
  const commNet = commLong - commShort;
  const smallLong = n(row.nonrept_positions_long_all);
  const smallShort = n(row.nonrept_positions_short_all);
  const prevMmNet = prev ? (n(prev.noncomm_positions_long_all) - n(prev.noncomm_positions_short_all)) : mmNet;
  const prevCommNet = prev ? (n(prev.comm_positions_long_all) - n(prev.comm_positions_short_all)) : commNet;
  const prevOi = prev ? n(prev.open_interest_all) : n(row.open_interest_all);
  const prevSmallNet = prev ? (n(prev.nonrept_positions_long_all) - n(prev.nonrept_positions_short_all)) : (smallLong - smallShort);

  return {
    reportDate: String(row.report_date_as_yyyy_mm_dd || '').slice(0, 10),
    openInterest: n(row.open_interest_all),
    openInterestChange: n(row.open_interest_all) - prevOi,
    mmLong,
    mmShort,
    mmNet,
    mmChange: mmNet - prevMmNet,
    commLong,
    commShort,
    commNet,
    commChange: commNet - prevCommNet,
    smallLong,
    smallShort,
    smallNet: smallLong - smallShort,
    smallChange: (smallLong - smallShort) - prevSmallNet
  };
}

export async function fetchCotReport() {
  try {
    const rows = await fetchJson(CFTC_URL, {}, 12000);
    if (!Array.isArray(rows) || rows.length < 2) {
      return cotCache;
    }

    const latest = mapRow(rows[0], rows[1]);
    const historyNets = rows.map((r) => n(r.noncomm_positions_long_all) - n(r.noncomm_positions_short_all));
    const currentNet = historyNets[0];
    const sorted = [...historyNets].sort((a, b) => a - b);
    const rank = sorted.findIndex((v) => v >= currentNet);
    const percentile = Number((((rank < 0 ? sorted.length - 1 : rank) / Math.max(1, sorted.length - 1)) * 100).toFixed(1));

    const weeklyTrend = rows.slice(0, 4).map((r, i) => {
      const mapped = mapRow(r, rows[i + 1]);
      return {
        week: mapped.reportDate,
        net: mapped.mmNet,
        change: mapped.mmChange,
        stance: mapped.mmChange > 0 ? 'ADDING_LONGS' : mapped.mmChange < 0 ? 'CUTTING_LONGS' : 'FLAT'
      };
    });

    const commShortRatio = latest.commLong > 0 ? Number((latest.commShort / latest.commLong).toFixed(2)) : null;

    cotCache = {
      reportDate: latest.reportDate,
      releaseDate: latest.reportDate,
      contract: rows[0].contract_market_name || 'GOLD - COMMODITY EXCHANGE INC.',
      source: 'CFTC public reporting (088691)',
      live: true,
      openInterest: latest.openInterest,
      openInterestChange: latest.openInterestChange,
      managedMoney: {
        longs: latest.mmLong,
        shorts: latest.mmShort,
        net: latest.mmNet,
        weeklyNetChange: latest.mmChange,
        longShortRatio: latest.mmShort > 0 ? Number((latest.mmLong / latest.mmShort).toFixed(2)) : latest.mmLong,
        percentile3Year: percentile,
        stance: stanceFromPercentile(percentile)
      },
      commercials: {
        longs: latest.commLong,
        shorts: latest.commShort,
        net: latest.commNet,
        weeklyNetChange: latest.commChange,
        stance: latest.commNet < 0 ? 'NET_SHORT_HEDGE' : 'NET_LONG',
        shortRatio: commShortRatio
      },
      smallTraders: {
        longs: latest.smallLong,
        shorts: latest.smallShort,
        net: latest.smallNet,
        weeklyNetChange: latest.smallChange
      },
      weeklyTrend,
      signal: buildSignal(percentile, latest.mmNet, latest.mmChange, latest.commNet),
      lastUpdated: new Date().toISOString()
    };

    persistCotCache();
    return cotCache;
  } catch (err) {
    console.error('[COT] Fetch failed:', err.message);
    return cotCache;
  }
}

export function getCotData() {
  return cotCache;
}
