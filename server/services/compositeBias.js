function clamp(n, lo = -100, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

function signedPct(changePercent, k) {
  if (changePercent == null || Number.isNaN(changePercent)) return 0;
  return changePercent * k;
}

export function calculateCompositeBias(marketData, newsItems, retailPositioning, extras = {}) {
  const empty = {
    score: 0,
    label: 'NEUTRAL',
    confidence: 0,
    breakdown: { macro: 0, commodity: 0, volatility: 0, ictSweeps: 0, cot: 0, retail: 0, news: 0, etf: 0, geo: 0 },
    used: []
  };

  if (!marketData?.assets) return empty;

  const assets = marketData.assets;
  const gold = assets.GOLD || {};
  const currentPrice = gold.price;
  const cotData = extras.cot || null;
  const etf = extras.etf || null;
  const geo = extras.geo || null;

  const dxyChange = assets.DXY?.changePercent;
  const realYield = marketData.realYield10Y;
  const yieldCurve = marketData.yieldCurveSpread;
  const dxyFactor = dxyChange != null ? -dxyChange * 45 : 0;
  const realYieldFactor = realYield != null ? (1.5 - realYield) * 28 : 0;
  const curveFactor = yieldCurve == null ? 0 : yieldCurve > 0 ? 8 : -12;
  const macroSubScore = clamp(dxyFactor + realYieldFactor + curveFactor);

  const silverChange = assets.SILVER?.changePercent;
  const oilChange = assets.CRUDE_OIL?.changePercent;
  const gsr = marketData.gsr;
  const silverFactor = signedPct(silverChange, 28);
  const gsrFactor = gsr == null ? 0 : gsr < 70 ? 18 : gsr > 90 ? -18 : 0;
  const oilFactor = signedPct(oilChange, 8);
  const commoditySubScore = clamp(silverFactor + gsrFactor + oilFactor);

  const vix = assets.VIX?.price;
  const vixChange = assets.VIX?.changePercent;
  let volScore = 0;
  if (vix != null) {
    if (vix >= 22) volScore += 40;
    else if (vix >= 18) volScore += 16;
    else if (vix <= 13) volScore -= 16;
  }
  volScore += signedPct(vixChange, 2.2);
  const volatilitySubScore = clamp(volScore);

  const asianHigh = marketData.asianRange?.high;
  const asianLow = marketData.asianRange?.low;
  let ictScore = 0;
  if (currentPrice != null && asianHigh != null && asianLow != null && asianHigh > asianLow) {
    if (currentPrice < asianLow) ictScore = 35;
    else if (currentPrice > asianHigh) ictScore = -28;
    else {
      const mid = (asianHigh + asianLow) / 2;
      ictScore = currentPrice >= mid ? 8 : -8;
    }
  }
  const ictSubScore = clamp(ictScore);

  const cotPercentile = cotData?.live ? cotData.managedMoney?.percentile3Year : null;
  let cotScore = 0;
  if (cotPercentile != null) {
    if (cotPercentile >= 85) cotScore = -22;
    else if (cotPercentile <= 25) cotScore = 45;
    else if (cotPercentile >= 65) cotScore = 10;
    else if (cotPercentile <= 40) cotScore = 18;
    else cotScore = 0;
  }
  const cotSubScore = clamp(cotScore);

  const retailLongPercent = retailPositioning?.live ? retailPositioning.longPercentage : null;
  const retailSubScore = retailLongPercent != null ? clamp((50 - retailLongPercent) * 2.2) : 0;

  let newsTotal = 0;
  let newsCount = 0;
  if (newsItems?.length) {
    for (const item of newsItems.slice(0, 15)) {
      const impactMultiplier = item.impact || 2;
      let scoreVal = 0;
      if (item.sentiment === 'BULLISH') scoreVal = 18 * impactMultiplier;
      else if (item.sentiment === 'BEARISH') scoreVal = -18 * impactMultiplier;
      newsTotal += scoreVal;
      newsCount++;
    }
  }
  const newsSubScore = newsCount > 0 ? clamp(newsTotal / newsCount) : 0;

  let etfScore = 0;
  if (etf?.live) {
    if (etf.goldEtfBias === 'INFLOW') etfScore = 28;
    else if (etf.goldEtfBias === 'OUTFLOW') etfScore = -28;
    else if (etf.goldEtfBias === 'MIXED') etfScore = 0;
    if (etf.minersConfirm === 'RISK_ON_MINERS') etfScore += 8;
    if (etf.minersConfirm === 'MINERS_LAGGING') etfScore -= 6;
  }
  const etfSubScore = clamp(etfScore);

  let geoScore = 0;
  if (geo?.live && geo.score != null) {
    geoScore = Math.min(40, geo.score * 0.45);
    if (geo.avgTone > 1) geoScore *= 0.4;
  }
  const geoSubScore = clamp(geoScore);

  const weights = {
    macro: 0.18,
    commodity: 0.12,
    volatility: 0.12,
    ictSweeps: 0.10,
    cot: 0.10,
    retail: 0.08,
    news: 0.12,
    etf: 0.10,
    geo: 0.08
  };

  const totalScore =
    macroSubScore * weights.macro +
    commoditySubScore * weights.commodity +
    volatilitySubScore * weights.volatility +
    ictSubScore * weights.ictSweeps +
    cotSubScore * weights.cot +
    retailSubScore * weights.retail +
    newsSubScore * weights.news +
    etfSubScore * weights.etf +
    geoSubScore * weights.geo;

  const finalScore = Math.round(clamp(totalScore));
  let label = 'NEUTRAL';
  if (finalScore >= 55) label = 'STRONG BUY';
  else if (finalScore >= 20) label = 'BUY';
  else if (finalScore <= -55) label = 'STRONG SELL';
  else if (finalScore <= -20) label = 'SELL';

  const subScores = [macroSubScore, commoditySubScore, volatilitySubScore, ictSubScore, cotSubScore, retailSubScore, newsSubScore, etfSubScore, geoSubScore];
  const sameSign = subScores.filter((s) => (finalScore >= 0 ? s > 0 : s < 0)).length;
  const dataPoints = [
    dxyChange != null,
    realYield != null,
    currentPrice != null,
    cotPercentile != null,
    etf?.live,
    geo?.live,
    newsCount > 0
  ].filter(Boolean).length;
  const confidence = Math.min(92, Math.max(20, Math.round(18 + dataPoints * 7 + (sameSign / subScores.length) * 28)));

  return {
    score: finalScore,
    label,
    confidence,
    breakdown: {
      macro: Math.round(macroSubScore),
      commodity: Math.round(commoditySubScore),
      volatility: Math.round(volatilitySubScore),
      ictSweeps: Math.round(ictSubScore),
      cot: Math.round(cotSubScore),
      retail: Math.round(retailSubScore),
      news: Math.round(newsSubScore),
      etf: Math.round(etfSubScore),
      geo: Math.round(geoSubScore)
    }
  };
}
