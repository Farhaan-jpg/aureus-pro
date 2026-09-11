// High-Speed Gold Sentiment Classifier
// Classifies headlines specifically on Gold (BULLISH, BEARISH, NEUTRAL) with 1-5 impact and risk tags.

const BULLISH_PATTERNS = [
  { regex: /\b(rate cut|fed cut|easing|dovish|lower yields?|yields? fall|yields? drop|dollar drops?|dxy plunges?|dxy weakens?)\b/i, score: 4 },
  { regex: /\b(war|military|attack|missile|conflict|escalat(e|ion)|middle east|gaza|red sea|ukraine|russia|tensions? surge)\b/i, score: 5, geopolitical: true },
  { regex: /\b(central bank|pboc|reserve purchases?|gold reserves?|de-dollarization|brics|bullion demand)\b/i, score: 4, centralBank: true },
  { regex: /\b(inflation surges?|cpi beats?|hot inflation|safe haven|flight to safety|recession fear|debt spiral|deficit)\b/i, score: 4 },
  { regex: /\b(gold rallies|gold surges|gold climbs|bulls? in control|ath|record high|gold breakout)\b/i, score: 3 }
];

const BEARISH_PATTERNS = [
  { regex: /\b(rate hike|fed pause|hawkish|higher for longer|yields? surge|yields? jump|yields? rise|dollar rallies?|dxy spikes?|dxy surges?)\b/i, score: 4 },
  { regex: /\b(ceasefire|peace deal|tensions? ease|de-escalat(e|ion)|diplomatic accord|treaty)\b/i, score: 4, geopolitical: true },
  { regex: /\b(cpi cools?|inflation slows?|disinflation|strong payrolls?|nfp beats?|jobless claims drop|gdp surges?)\b/i, score: 4 },
  { regex: /\b(gold plunges|gold slides|gold tumbles|gold breaks down|profit taking|bearish reversal)\b/i, score: 3 }
];

export function classifyHeadline(title) {
  let bullishWeight = 0;
  let bearishWeight = 0;
  let maxImpact = 2; // Default baseline impact
  let isGeopolitical = false;
  let isCentralBank = false;

  for (const p of BULLISH_PATTERNS) {
    if (p.regex.test(title)) {
      bullishWeight += p.score;
      maxImpact = Math.max(maxImpact, p.score);
      if (p.geopolitical) isGeopolitical = true;
      if (p.centralBank) isCentralBank = true;
    }
  }

  for (const p of BEARISH_PATTERNS) {
    if (p.regex.test(title)) {
      bearishWeight += p.score;
      maxImpact = Math.max(maxImpact, p.score);
      if (p.geopolitical) isGeopolitical = true;
    }
  }

  let sentiment = 'NEUTRAL';
  if (bullishWeight > bearishWeight) {
    sentiment = 'BULLISH';
  } else if (bearishWeight > bullishWeight) {
    sentiment = 'BEARISH';
  } else {
    // If neutral or subtle
    maxImpact = Math.min(maxImpact, 2);
  }

  return {
    sentiment,
    impact: Math.min(5, Math.max(1, maxImpact)),
    isGeopolitical,
    isCentralBank,
    confidence: bullishWeight || bearishWeight ? Math.min(95, 60 + Math.abs(bullishWeight - bearishWeight) * 8) : 55
  };
}

// Memoized classifier — news only changes every few minutes, but broadcastTick
// runs on every live tick, so cache per-headline and recompute only new items.
const classificationCache = new Map();

export function classifyAllNews(newsList) {
  const seenKeys = new Set();
  const result = newsList.map(item => {
    const key = item.id != null ? `id:${item.id}` : `title:${item.title}`;
    seenKeys.add(key);
    let classification = classificationCache.get(key);
    if (!classification) {
      classification = classifyHeadline(item.title);
      classificationCache.set(key, classification);
    }
    return {
      ...item,
      ...classification
    };
  });

  // Prune stale entries so the cache never drifts
  if (classificationCache.size > 200) {
    for (const key of classificationCache.keys()) {
      if (!seenKeys.has(key)) classificationCache.delete(key);
    }
  }

  return result;
}
