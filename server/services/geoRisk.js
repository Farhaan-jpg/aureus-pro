import { fetchJson, fetchText } from './httpClient.js';
import xml2js from 'xml2js';

const GDELT_QUERY = '(gold OR XAUUSD OR "precious metals" OR "federal reserve" OR "central bank gold") AND (war OR attack OR sanction OR iran OR israel OR ukraine OR china OR "red sea" OR houthi OR taiwan)';

const FALLBACK_FEEDS = [
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC World' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', source: 'Al Jazeera' }
];

let cache = {
  live: false,
  score: 0,
  level: 'UNKNOWN',
  articleCount: 0,
  avgTone: 0,
  headlines: [],
  source: 'none',
  lastUpdated: null
};
let lastFetch = 0;

function levelFromScore(score) {
  if (score >= 70) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 30) return 'ELEVATED';
  if (score >= 15) return 'WATCH';
  return 'LOW';
}

function buildPayload(articles, source) {
  const tones = articles.map((a) => Number(a.tone)).filter((t) => Number.isFinite(t));
  const avgTone = tones.length ? tones.reduce((a, b) => a + b, 0) / tones.length : 0;
  const volumeScore = Math.min(55, articles.length * 2.2);
  const negativity = avgTone < 0 ? Math.min(35, Math.abs(avgTone) * 2.5) : 0;
  const score = Math.round(Math.min(100, volumeScore + negativity));

  cache = {
    live: true,
    score,
    level: levelFromScore(score),
    articleCount: articles.length,
    avgTone: Number(avgTone.toFixed(2)),
    headlines: articles.slice(0, 8).map((a) => ({
      title: a.title,
      url: a.url,
      source: a.source,
      date: a.date,
      tone: a.tone != null ? Number(Number(a.tone).toFixed(2)) : null
    })),
    source,
    lastUpdated: new Date().toISOString(),
    goldImplication: score >= 50
      ? 'Elevated geopolitical print volume — historically supports a gold safe-haven bid, not a standalone long.'
      : 'Geopolitical gold-news volume is contained.'
  };
  return cache;
}

async function fetchGdelt() {
  const url = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
  url.searchParams.set('query', GDELT_QUERY);
  url.searchParams.set('mode', 'artlist');
  url.searchParams.set('maxrecords', '25');
  url.searchParams.set('format', 'json');
  url.searchParams.set('sort', 'datedesc');
  url.searchParams.set('timespan', '24h');

  const data = await fetchJson(url.toString(), {}, 10000);
  const articles = Array.isArray(data?.articles) ? data.articles : [];
  return articles.map((a) => ({
    title: a.title,
    url: a.url,
    source: a.domain,
    date: a.seendate,
    tone: a.tone != null ? Number(a.tone) : null
  }));
}

async function fetchGdeltWithRetry(attempts = 2) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const articles = await fetchGdelt();
      if (articles.length) return articles;
      lastErr = new Error('GDELT returned empty result set');
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw lastErr || new Error('GDELT unavailable');
}

async function scoreRelevance(title) {
  const t = (title || '').toLowerCase();
  let score = 0;
  const goldTerms = ['gold', 'xau', 'bullion', 'precious metal', 'treasury', 'fed', 'federal reserve', 'central bank', 'safe haven'];
  const strongConflict = ['attack', 'missile', 'sanction', 'invasion', 'missile strike', 'strike', 'escalation', 'explosion', 'drone', 'oil price', 'crude'];
  for (const kw of goldTerms) if (t.includes(kw)) score += 3;
  for (const kw of strongConflict) if (t.includes(kw)) score += 2;
  // Generic geopolitics only count half-strength (news is abundant, gold impact is not)
  if (/israel|iran|ukraine|china|taiwan|russia|houthi|red sea|nato/.test(t)) score += 1;
  if (/war|conflict|military|border/.test(t)) score += 0.5;
  return score;
}

async function parseRssFeed(feed) {
  try {
    const xmlText = await fetchText(feed.url, {}, 8000);
    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
    const result = await parser.parseStringPromise(xmlText);
    const rawItems = result?.rss?.channel?.item || [];
    const items = Array.isArray(rawItems) ? rawItems : [rawItems];

    const parsed = [];
    for (const it of items) {
      if (!it?.title) continue;
      const title = typeof it.title === 'string' ? it.title : it.title._ || '';
      if (!title || title.length < 15) continue;
      const relevance = await scoreRelevance(title);
      if (relevance < 2.5) continue;
      const link = typeof it.link === 'string' ? it.link : '#';
      const pubDate = it.pubDate || new Date().toISOString();
      parsed.push({
        title: title.replace(/<[^>]*>?/gm, '').trim(),
        url: link,
        source: feed.source,
        date: new Date(pubDate).toISOString(),
        tone: null,
        relevance
      });
    }
    return parsed;
  } catch {
    return [];
  }
}

async function fetchRssFallback() {
  const results = await Promise.all(FALLBACK_FEEDS.map(parseRssFeed));
  const all = results.flat();
  // Sort by relevance score (geopolitically salient first), cap at 25
  const sorted = all.sort((a, b) => (b.relevance || 0) - (a.relevance || 0)).slice(0, 25);
  // GDELT-normalize dates for downstream display
  return sorted.map((a) => ({ ...a, tone: null }));
}

export async function refreshGeoRisk(force = false) {
  const now = Date.now();
  if (!force && lastFetch && now - lastFetch < 10 * 60 * 1000 && cache.live) {
    return cache;
  }
  lastFetch = now;

  // Race GDELT (preferred) against the RSS fallback so the dashboard never
  // waits on GDELT's slow/blocked endpoint while the fallback is ready.
  const [gdeltResult, rssResult] = await Promise.allSettled([
    fetchGdeltWithRetry(),
    fetchRssFallback()
  ]);

  if (gdeltResult.status === 'fulfilled' && gdeltResult.value.length) {
    return buildPayload(gdeltResult.value, 'gdelt');
  }
  if (gdeltResult.reason) {
    console.warn('[GDELT] Failed, using fallback feed:', gdeltResult.reason.message);
  }

  if (rssResult.status === 'fulfilled' && rssResult.value.length) {
    return buildPayload(rssResult.value, 'rss-fallback');
  }

  // Hard fallback: keep last known good data if we have it
  return cache;
}

export function getGeoRisk() {
  return cache;
}