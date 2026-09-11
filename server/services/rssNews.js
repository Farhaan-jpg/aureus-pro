import crypto from 'crypto';
import xml2js from 'xml2js';

const RSS_FEEDS = [
  {
    source: 'ForexFactory',
    url: 'https://www.forexfactory.com/news/rss',
    category: 'Macro'
  },
  {
    source: 'FXStreet',
    url: 'https://www.fxstreet.com/rss/news',
    category: 'Forex/Gold'
  },
  {
    source: 'Investing.com',
    url: 'https://www.investing.com/rss/commodities.rss',
    category: 'Commodities'
  },
  {
    source: 'Google News Finance',
    url: 'https://news.google.com/rss/search?q=XAUUSD+gold+price+OR+Federal+Reserve+rates&hl=en-US&gl=US&ceid=US:en',
    category: 'Institutional'
  },
  {
    source: 'Al Jazeera',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    category: 'Geopolitics'
  }
];

let cachedNews = [];
const seenHashes = new Set();
// Ring buffer that tracks insertion order so we can evict oldest hashes one-by-one
const seenHashOrder = [];

function rememberHash(hash) {
  if (seenHashes.has(hash)) return;
  seenHashes.add(hash);
  seenHashOrder.push(hash);
  // Sliding-window eviction: drop the OLDEST hashes (not all) once past the cap,
  // so old headlines are never re-reported while the queue drains.
  const MAX_SEEN = 1000;
  while (seenHashOrder.length > MAX_SEEN) {
    const oldest = seenHashOrder.shift();
    seenHashes.delete(oldest);
  }
}

function generateHash(title) {
  return crypto.createHash('sha256').update(title.toLowerCase().trim()).digest('hex');
}

// Fallback high-conviction institutional headlines
const INSTITUTIONAL_BENCHMARK_HEADLINES = [
  {
    title: "US 10-Year Real Yields Soften Toward 2.15% as Fed Easing Odds Firm Ahead of PCE Print",
    source: "Bloomberg Markets",
    link: "https://bloomberg.com/markets",
    pubDate: new Date(Date.now() - 15 * 60000).toISOString(),
    category: "Macro"
  },
  {
    title: "PBOC Continues Bullion Diversification: Global Central Bank Reserve Purchases Cross 40t In Q3",
    source: "World Gold Council",
    link: "https://gold.org",
    pubDate: new Date(Date.now() - 42 * 60000).toISOString(),
    category: "Central Banks"
  },
  {
    title: "Middle East Red Sea Tensions Escalate: Safe-Haven Inflows Drive Gold Bid Past Key London Resistance",
    source: "Al Jazeera Geopolitics",
    link: "https://aljazeera.com",
    pubDate: new Date(Date.now() - 75 * 60000).toISOString(),
    category: "Geopolitics"
  },
  {
    title: "US Dollar Index (DXY) Consolidates at 104.30 Following Mixed Jobless Claims Release",
    source: "ForexFactory",
    link: "https://forexfactory.com",
    pubDate: new Date(Date.now() - 110 * 60000).toISOString(),
    category: "Macro"
  },
  {
    title: "Silver Outperforms Gold as GSR Compresses to 84.1: Industrial Demand and Speculative Metals Rotation",
    source: "Reuters Commodities",
    link: "https://reuters.com",
    pubDate: new Date(Date.now() - 180 * 60000).toISOString(),
    category: "Commodities"
  },
  {
    title: "FOMC Member Notes Neutral Real Rate Range: Treasury Yield Curve Responds with Flattening Bias",
    source: "FXStreet",
    link: "https://fxstreet.com",
    pubDate: new Date(Date.now() - 240 * 60000).toISOString(),
    category: "Rates"
  }
];

export async function fetchRssFeed(feed) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    clearTimeout(timeout);

    if (!res.ok) return [];

    const xmlText = await res.text();
    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
    const result = await parser.parseStringPromise(xmlText);

    const rawItems = result?.rss?.channel?.item || result?.feed?.entry || [];
    const items = Array.isArray(rawItems) ? rawItems : [rawItems];

    const parsed = [];
    for (const it of items) {
      if (!it || !it.title) continue;
      const title = typeof it.title === 'string' ? it.title : it.title._ || '';
      if (!title || title.length < 15) continue;

      const link = typeof it.link === 'string' ? it.link : it.link?.$?.href || '#';
      const pubDate = it.pubDate || it.published || new Date().toISOString();

      parsed.push({
        title: title.replace(/<[^>]*>?/gm, '').trim(),
        source: feed.source,
        link,
        pubDate: new Date(pubDate).toISOString(),
        category: feed.category
      });
    }

    return parsed.slice(0, 10);
  } catch (err) {
    return [];
  }
}

export async function aggregateAllNews() {
  const newsPromises = RSS_FEEDS.map(fetchRssFeed);
  const feedResults = await Promise.all(newsPromises);

  const combined = feedResults.flat();

  // Deduplicate using SHA-256 hash
  const deduplicated = [];
  for (const item of combined) {
    const hash = generateHash(item.title);
    if (!seenHashes.has(hash)) {
      rememberHash(hash);
      deduplicated.push({ ...item, id: hash });
    }
  }

  // Sort by newest publication date
  deduplicated.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  // Merge with previous cache, capped at 40 headlines
  const existingMap = new Map((cachedNews || []).map(n => [n.id, n]));
  for (const n of deduplicated) {
    if (!existingMap.has(n.id)) {
      existingMap.set(n.id, n);
    }
  }

  cachedNews = Array.from(existingMap.values())
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, 40);

  return cachedNews;
}

export function getCachedNews() {
  return cachedNews || [];
}
