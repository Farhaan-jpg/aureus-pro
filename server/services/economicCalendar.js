// Economic Calendar & Institutional Gold Impact Matrix Engine
// Powered by live Forex Factory feeds & institutional Gold Impact rules
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_FILE = path.join(__dirname, '../data/calendar_cache.json');

// Institutional Gold Impact Logic Generator
export function generateGoldImpactRule(title, country, impact) {
  const t = title.toLowerCase();
  const c = (country || 'USD').toUpperCase();

  if (c === 'USD') {
    if (t.includes('cpi') || t.includes('pce') || t.includes('inflation')) {
      return 'Actual > Forecast: Fed Hawkish -> Yields & DXY Spike -> Gold BEARISH 🔻 | Actual < Forecast: Fed Dovish -> Real Yields Fall -> Gold BULLISH 🚀';
    }
    if (t.includes('payrolls') || t.includes('nfp') || t.includes('employment') || t.includes('jobless') || t.includes('claims')) {
      return 'Labor Market Strong: Rate Cut Bets Recede -> Gold BEARISH 🔻 | Rising Unemployment/Claims: Fast Rate Cuts Priced In -> Gold BULLISH 🚀';
    }
    if (t.includes('fomc') || t.includes('fed') || t.includes('powell') || t.includes('rate decision') || t.includes('funds rate')) {
      return 'Hawkish Pause / Rate Freeze: Dollar Liquidity Squeeze -> Gold Flush 🔻 | 25-50bps Dovish Cut / Guidance: Currency Debasement -> Gold All-Time Highs 🚀';
    }
    if (t.includes('sentiment') || t.includes('confidence') || t.includes('uom')) {
      return 'Consumer Optimism: US Growth Resilience -> DXY Up -> Gold Softens 🔻 | Depressed Sentiment: Stagflation & Safe-Haven Inflows -> Gold BULLISH 🚀';
    }
    if (t.includes('gdp') || t.includes('retail sales') || t.includes('manufacturing') || t.includes('ism') || t.includes('pmi')) {
      return 'Macro Expansion Beats: Higher-for-Longer Rates -> Gold Down 🔻 | Macro Misses: Recessionary Hedging & Safe-Haven Buying -> Gold BULLISH 🚀';
    }
    if (t.includes('budget') || t.includes('debt') || t.includes('treasury')) {
      return 'Widening Fiscal Deficit & Treasury Issuance: Sovereign Fiat Debasement -> Structural Long-Term Gold Accumulation 🚀';
    }
    return 'Stronger US Data strengthens DXY and pressurizes Gold | Weaker US Data fuels rate-cut bets and lifts Bullion';
  }

  if (c === 'EUR') {
    if (t.includes('lagarde') || t.includes('ecb') || t.includes('interest rate')) {
      return 'Hawkish ECB: EUR/USD Surges -> DXY Tumbles -> Gold BULLISH 🚀 | Dovish ECB: EUR Drops -> DXY Spikes -> Gold Pressure 🔻';
    }
    return 'Eurozone Macro shifts EUR/USD weight in the Dollar Index (57.6% DXY Basket Weight), driving inverse Gold moves';
  }

  if (c === 'GBP') {
    return 'UK CPI/GDP data drives GBP/USD and European cross-market risk appetite; watch transatlantic bond spread differentials';
  }

  if (c === 'CHF') {
    return 'Swiss Franc is a premier safe-haven competitor; SNB intervention or negative rate policy triggers global capital flight to Gold';
  }

  return 'Global macro release; institutional desk monitors secondary currency volatility and safe-haven liquidity rotation';
}

// Initial Verified Benchmark Calendar (Matching Forex Factory Real-World Schedule)
const BENCHMARK_EVENTS = [
  {
    id: 'ff_20260911_gbp_const',
    title: 'Construction Output m/m',
    country: 'GBP',
    currency: 'GBP',
    impact: 'LOW',
    date: '2026-09-11T06:00:00.000Z',
    actual: '0.1%',
    forecast: '0.1%',
    previous: '-0.1%',
    isGoldDriver: false
  },
  {
    id: 'ff_20260911_gbp_trade',
    title: 'Goods Trade Balance',
    country: 'GBP',
    currency: 'GBP',
    impact: 'LOW',
    date: '2026-09-11T06:00:00.000Z',
    actual: '-21.0B',
    forecast: '-22.6B',
    previous: '-23.0B',
    isGoldDriver: false
  },
  {
    id: 'ff_20260911_gbp_serv',
    title: 'Index of Services 3m/3m',
    country: 'GBP',
    currency: 'GBP',
    impact: 'LOW',
    date: '2026-09-11T06:00:00.000Z',
    actual: '0.6%',
    forecast: '0.5%',
    previous: '0.5%',
    isGoldDriver: false
  },
  {
    id: 'ff_20260911_gbp_ind',
    title: 'Industrial Production m/m',
    country: 'GBP',
    currency: 'GBP',
    impact: 'LOW',
    date: '2026-09-11T06:00:00.000Z',
    actual: '0.2%',
    forecast: '-0.2%',
    previous: '-0.2%',
    isGoldDriver: false
  },
  {
    id: 'ff_20260911_gbp_mfg',
    title: 'Manufacturing Production m/m',
    country: 'GBP',
    currency: 'GBP',
    impact: 'LOW',
    date: '2026-09-11T06:00:00.000Z',
    actual: '0.9%',
    forecast: '0.2%',
    previous: '-0.5%',
    isGoldDriver: false
  },
  {
    id: 'ff_20260911_chf_seco',
    title: 'SECO Consumer Climate',
    country: 'CHF',
    currency: 'CHF',
    impact: 'LOW',
    date: '2026-09-11T07:00:00.000Z',
    actual: '-33',
    forecast: '-33',
    previous: '-35',
    isGoldDriver: false
  },
  {
    id: 'ff_20260911_eur_unemp',
    title: 'Italian Quarterly Unemployment Rate',
    country: 'EUR',
    currency: 'EUR',
    impact: 'LOW',
    date: '2026-09-11T08:00:00.000Z',
    actual: '5.6%',
    forecast: '5.4%',
    previous: '5.5%',
    isGoldDriver: false
  },
  {
    id: 'ff_20260911_gbp_infexp',
    title: 'Consumer Inflation Expectations',
    country: 'GBP',
    currency: 'GBP',
    impact: 'LOW',
    date: '2026-09-11T08:30:00.000Z',
    actual: '3.2%',
    forecast: '4.0%',
    previous: '4.0%',
    isGoldDriver: false
  },
  {
    id: 'ff_20260911_chf_snb',
    title: 'SNB Chairman Schlegel Speaks',
    country: 'CHF',
    currency: 'CHF',
    impact: 'MEDIUM',
    date: '2026-09-11T09:15:00.000Z',
    actual: '',
    forecast: '',
    previous: '',
    isGoldDriver: false
  },
  {
    id: 'ff_20260911_usd_corecpi_mm',
    title: 'Core CPI m/m',
    country: 'USD',
    currency: 'USD',
    impact: 'HIGH',
    date: '2026-09-11T12:30:00.000Z',
    actual: '',
    forecast: '0.2%',
    previous: '0.2%',
    isGoldDriver: true
  },
  {
    id: 'ff_20260911_usd_corecpi_yy',
    title: 'Core CPI y/y',
    country: 'USD',
    currency: 'USD',
    impact: 'HIGH',
    date: '2026-09-11T12:30:00.000Z',
    actual: '',
    forecast: '2.4%',
    previous: '2.5%',
    isGoldDriver: true
  },
  {
    id: 'ff_20260911_usd_cpi_mm',
    title: 'CPI m/m',
    country: 'USD',
    currency: 'USD',
    impact: 'HIGH',
    date: '2026-09-11T12:30:00.000Z',
    actual: '',
    forecast: '0.4%',
    previous: '0.1%',
    isGoldDriver: true
  },
  {
    id: 'ff_20260911_usd_cpi_yy',
    title: 'CPI y/y',
    country: 'USD',
    currency: 'USD',
    impact: 'HIGH',
    date: '2026-09-11T12:30:00.000Z',
    actual: '',
    forecast: '3.4%',
    previous: '3.4%',
    isGoldDriver: true
  },
  {
    id: 'ff_20260911_eur_lagarde',
    title: 'ECB President Lagarde Speaks',
    country: 'EUR',
    currency: 'EUR',
    impact: 'MEDIUM',
    date: '2026-09-11T14:00:00.000Z',
    actual: '',
    forecast: '',
    previous: '',
    isGoldDriver: true
  },
  {
    id: 'ff_20260911_usd_uom_sent',
    title: 'Prelim UoM Consumer Sentiment',
    country: 'USD',
    currency: 'USD',
    impact: 'MEDIUM',
    date: '2026-09-11T14:00:00.000Z',
    actual: '',
    forecast: '51.0',
    previous: '51.7',
    isGoldDriver: true
  },
  {
    id: 'ff_20260911_usd_uom_inf',
    title: 'Prelim UoM Inflation Expectations',
    country: 'USD',
    currency: 'USD',
    impact: 'MEDIUM',
    date: '2026-09-11T14:00:00.000Z',
    actual: '',
    forecast: '',
    previous: '4.0%',
    isGoldDriver: true
  },
  {
    id: 'ff_20260911_usd_budget',
    title: 'Federal Budget Balance',
    country: 'USD',
    currency: 'USD',
    impact: 'LOW',
    date: '2026-09-11T18:00:00.000Z',
    actual: '',
    forecast: '-221.1B',
    previous: '-432.3B',
    isGoldDriver: false
  },
  {
    id: 'ff_20260915_usd_retail',
    title: 'US Retail Sales m/m',
    country: 'USD',
    currency: 'USD',
    impact: 'HIGH',
    date: '2026-09-15T12:30:00.000Z',
    actual: '',
    forecast: '0.3%',
    previous: '1.0%',
    isGoldDriver: true
  },
  {
    id: 'ff_20260916_usd_fomc_rate',
    title: 'FOMC Interest Rate Decision & Policy Statement',
    country: 'USD',
    currency: 'USD',
    impact: 'CRITICAL',
    date: '2026-09-16T18:00:00.000Z',
    actual: '',
    forecast: '4.50%',
    previous: '4.75%',
    isGoldDriver: true
  },
  {
    id: 'ff_20260916_usd_fomc_press',
    title: 'FOMC Press Conference (Fed Chair Powell)',
    country: 'USD',
    currency: 'USD',
    impact: 'CRITICAL',
    date: '2026-09-16T18:30:00.000Z',
    actual: '',
    forecast: '',
    previous: '',
    isGoldDriver: true
  },
  {
    id: 'ff_20260917_usd_claims',
    title: 'US Initial Jobless Claims',
    country: 'USD',
    currency: 'USD',
    impact: 'HIGH',
    date: '2026-09-17T12:30:00.000Z',
    actual: '',
    forecast: '218K',
    previous: '222K',
    isGoldDriver: true
  }
];

// Institutional Gold Impact Matrix Logic
const MATRIX_RULES = [
  {
    indicator: "CPI / Core Inflation (MoM & YoY)",
    hawkishOutcome: "Above Forecast (Hot CPI)",
    dxyReaction: "Surges Upward",
    yieldsReaction: "Spikes Higher (Nominal & Real)",
    goldDirection: "BEARISH",
    mechanism: "Elevated inflation delays Fed rate cuts, increasing the opportunity cost of holding non-yielding Gold bullion."
  },
  {
    indicator: "CPI Miss / Disinflation",
    hawkishOutcome: "Below Forecast (Cool CPI)",
    dxyReaction: "Tumbles Downward",
    yieldsReaction: "Collapses Across the Curve",
    goldDirection: "BULLISH",
    mechanism: "Rapid disinflation enables aggressive Fed easing; lower real rates remove bullion holding headwind."
  },
  {
    indicator: "Non-Farm Payrolls (NFP)",
    hawkishOutcome: "Above Forecast (Tight Labor)",
    dxyReaction: "Strengthens Aggressively",
    yieldsReaction: "Rises",
    goldDirection: "BEARISH",
    mechanism: "Wage pressure and strong employment force central bank into higher-for-longer regime."
  },
  {
    indicator: "Initial Jobless Claims Spike",
    hawkishOutcome: "Above Forecast (>230K)",
    dxyReaction: "Weakens Downward",
    yieldsReaction: "Declines sharply",
    goldDirection: "BULLISH",
    mechanism: "Labor deterioration accelerates monetary stimulus pricing; safe haven flows seek shelter in Gold."
  },
  {
    indicator: "FOMC Rate Cut Delivery (25-50 bps)",
    hawkishOutcome: "Dovish Easing Delivery",
    dxyReaction: "Tumbles",
    yieldsReaction: "Yield curve steepens, real rates fall",
    goldDirection: "BULLISH",
    mechanism: "Zero-yield asset advantage restored; global central banks and institutional funds accelerate de-dollarization."
  },
  {
    indicator: "FOMC Hawkish Pause / Dissent",
    hawkishOutcome: "Rates Held High / Hawkish Dots",
    dxyReaction: "Rallies Strongly",
    yieldsReaction: "Spikes at the Short End",
    goldDirection: "BEARISH",
    mechanism: "Traders price out rate cuts, triggering aggressive long liquidation flush across precious metals desks."
  }
];

let cachedCalendar = null;
let lastCalendarFetch = 0;
const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes safe cooldown to prevent 429 rate limits

// Initialize cache from disk or benchmark
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.events) && parsed.events.length > 0) {
        cachedCalendar = parsed;
        return;
      }
    }
  } catch (e) {}

  // Fallback to enriched benchmark
  const enriched = BENCHMARK_EVENTS.map(evt => ({
    ...evt,
    goldImpactRule: generateGoldImpactRule(evt.title, evt.country, evt.impact)
  }));

  cachedCalendar = {
    events: enriched,
    matrixRules: MATRIX_RULES,
    lastUpdated: new Date().toISOString()
  };

  saveCache(cachedCalendar);
}

function saveCache(data) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {}
}

// Fetch live events from Forex Factory weekly JSON feed
async function fetchForexFactoryFeed() {
  try {
    const url = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const items = await res.json();
    if (!Array.isArray(items) || items.length === 0) return null;

    const mappedEvents = items.map((item, index) => {
      const country = (item.country || 'USD').toUpperCase();
      const impactRaw = (item.impact || 'Low').toUpperCase();
      const impact = impactRaw.includes('HIGH') ? 'HIGH' : impactRaw.includes('MED') ? 'MEDIUM' : impactRaw.includes('HOLIDAY') ? 'HOLIDAY' : 'LOW';
      const isGoldDriver = country === 'USD' || impact === 'HIGH' || impact === 'CRITICAL';

      return {
        id: `ff_${item.date ? new Date(item.date).getTime() : index}_${country}_${index}`,
        title: item.title || 'Economic Event',
        country,
        currency: country,
        impact,
        date: item.date ? new Date(item.date).toISOString() : new Date().toISOString(),
        actual: item.actual || '',
        forecast: item.forecast || '',
        previous: item.previous || '',
        isGoldDriver,
        goldImpactRule: generateGoldImpactRule(item.title || '', country, impact)
      };
    });

    // Sort chronologically
    mappedEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

    return {
      events: mappedEvents,
      matrixRules: MATRIX_RULES,
      lastUpdated: new Date().toISOString()
    };
  } catch (err) {
    return null;
  }
}

// Main accessor
export async function getEconomicCalendar() {
  const now = Date.now();

  if (!cachedCalendar) {
    loadCache();
  }

  // Trigger gentle background update every 30 minutes
  if ((now - lastCalendarFetch) > REFRESH_INTERVAL_MS) {
    lastCalendarFetch = now;
    fetchForexFactoryFeed().then(fresh => {
      if (fresh && fresh.events?.length > 0) {
        cachedCalendar = fresh;
        saveCache(fresh);
      }
    }).catch(() => {});
  }

  return cachedCalendar;
}

export function getCachedCalendar() {
  if (!cachedCalendar) loadCache();
  return cachedCalendar;
}
