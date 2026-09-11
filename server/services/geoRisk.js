import { fetchJson } from './httpClient.js';

const QUERY = '(gold OR XAUUSD OR "precious metals" OR "federal reserve" OR "central bank gold") AND (war OR attack OR sanction OR iran OR israel OR ukraine OR china OR "red sea" OR houthi OR taiwan)';

let cache = {
  live: false,
  score: 0,
  level: 'UNKNOWN',
  articleCount: 0,
  avgTone: 0,
  headlines: [],
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

export async function refreshGeoRisk(force = false) {
  const now = Date.now();
  if (!force && lastFetch && now - lastFetch < 10 * 60 * 1000 && cache.live) {
    return cache;
  }
  lastFetch = now;

  try {
    const url = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
    url.searchParams.set('query', QUERY);
    url.searchParams.set('mode', 'artlist');
    url.searchParams.set('maxrecords', '25');
    url.searchParams.set('format', 'json');
    url.searchParams.set('sort', 'datedesc');
    url.searchParams.set('timespan', '24h');

    const data = await fetchJson(url.toString(), {}, 10000);
    const articles = Array.isArray(data?.articles) ? data.articles : [];
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
        source: a.domain,
        date: a.seendate,
        tone: a.tone != null ? Number(Number(a.tone).toFixed(2)) : null
      })),
      lastUpdated: new Date().toISOString(),
      goldImplication: score >= 50
        ? 'Elevated geopolitical print volume — historically supports a gold safe-haven bid, not a standalone long.'
        : 'Geopolitical gold-news volume is contained.'
    };
  } catch (err) {
    console.warn('[GDELT] Refresh failed:', err.message);
  }

  return cache;
}

export function getGeoRisk() {
  return cache;
}
