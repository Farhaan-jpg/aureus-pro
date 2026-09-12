// Central-bank gold demand channel.
//
// Official-sector flows are the slow structural bid under gold, but there is no
// reliable keyless intraday API for them (IMF/IFS needs a key; WGC xlsx is
// manual). This channel therefore trades transparency for honesty:
//   1. WATCH (live): scores the existing headline stream for central-bank /
//      sovereign-reserve news, with a ~14-day half-life — a Q2'26 "PBoC adds
//      gold" headline still steers the channel for two weeks, exactly like the
//      demand it implies.
//   2. REFERENCE (display-only): the latest published WGC figures, labeled with
//      their as-of date. Never used as a live input; surfacing it lets the
//      operator sanity-check the watch against the official quarterly numbers.
const REFERENCE = {
  q: 'Q2 2026',
  netPurchasesTonnes: 289,
  h1NetTonnes: 346,
  biggestBuyer: 'Poland (+82t H1)', 
  chinaH1: 'PBoC +40t H1 (reserves 2,346t)',
  asOf: '2026-07-30',
  source: 'World Gold Council (IMF IFS basis)'
};

// Headline triggers for official-sector demand news.
const KEYWORDS = [
  'central bank', 'central-bank', 'pboc', 'people\u2019s bank of china', 'peoples bank',
  'china gold', 'poland', 'nbp', 'uzbekistan', 'kazakhstan', 'singapore',
  'reserve', 'reserves', 'official sector', 'sovereign', 'world gold council',
  'wgc', 'gold demand', 'gold holdings', 'bullion diversification'
];

const HALF_LIFE_MS = 336 * 3600000; // 14 days: structural flows decay slowly
const MAX_HEADLINES = 40;

let cache = {
  watch: null,
  refetchedAt: null
};

function matchesKeywords(title) {
  const t = (title || '').toLowerCase();
  return KEYWORDS.some((k) => t.includes(k));
}

// Pure scoring over classified news for the channel's directional stance.
export function scoreCentralBankWatch(newsItems = []) {
  const now = Date.now();
  const matched = [];
  let total = 0;
  for (const item of newsItems.slice(0, MAX_HEADLINES)) {
    if (!matchesKeywords(item.title)) continue;
    let decay = 1;
    if (item.pubDate) {
      const ageHours = Math.max(0, (now - new Date(item.pubDate).getTime()) / 3600000);
      decay = Math.exp(-ageHours / (HALF_LIFE_MS / 3600000));
    }
    const impact = item.impact || 2;
    const sign = item.sentiment === 'BULLISH' ? 1 : item.sentiment === 'BEARISH' ? -1 : 0;
    if (sign !== 0) {
      total += sign * 16 * impact * decay;
      matched.push(item.title);
    }
  }
  const live = matched.length > 0;
  const score = live
    ? Math.max(-100, Math.min(100, Math.round(total / matched.length)))
    : 0;
  return { live, score, headlines: matched.slice(0, 6), reference: REFERENCE };
}

export function refreshCentralBankWatch(classifiedNews = []) {
  cache = { watch: scoreCentralBankWatch(classifiedNews), refetchedAt: new Date().toISOString() };
  return cache.watch;
}

export function getCentralBankWatch() {
  return cache;
}