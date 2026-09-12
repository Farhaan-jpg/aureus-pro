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
    actionable: false,
    breakdown: { macro: 0, commodity: 0, volatility: 0, ictSweeps: 0, cot: 0, retail: 0, news: 0, etf: 0, geo: 0, structure: 0, trend: 0 },
    used: []
  };

  if (!marketData?.assets) return empty;

  const assets = marketData.assets;
  const gold = assets.GOLD || {};
  const currentPrice = gold.price;
  const cotData = extras.cot || null;
  const etf = extras.etf || null;
  const geo = extras.geo || null;
  const timeframes = extras.timeframes || null;

  const dxyChange = assets.DXY?.changePercent;
  const realYield = marketData.realYield10Y;
  const yieldCurve = marketData.yieldCurveSpread;
  const dxyFactor = dxyChange != null ? -dxyChange * 45 : 0;
  const realYieldFactor = realYield != null ? (1.5 - realYield) * 28 : 0;
  // Inverted curve (10Y < 2Y) = recession signal -> gold safe-haven BULLISH.
  // Steep positive curve on growth = mild headwind for gold.
  const curveFactor = yieldCurve == null ? 0 : yieldCurve < 0 ? 12 : yieldCurve > 0.5 ? -6 : 0;
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

  // News channel: fade headlines out over time so last week's CPI doesn't
  // keep steering today's bias at full strength (~5.5h half-life). Decay scales
  // each headline's raw contribution; the average is taken over headline count
  // so an all-fresh feed scores exactly like the pre-decay behavior.
  const nowMs = Date.now();
  let newsTotal = 0;
  const newsWindow = (newsItems?.length ? newsItems.slice(0, 15) : []);
  if (newsWindow.length) {
    for (const item of newsWindow) {
      const impactMultiplier = item.impact || 2;
      let decay = 1;
      if (item.pubDate) {
        const ageHours = Math.max(0, (nowMs - new Date(item.pubDate).getTime()) / 3600000);
        decay = Math.exp(-ageHours / 8);
      }
      let scoreVal = 0;
      if (item.sentiment === 'BULLISH') scoreVal = 18 * impactMultiplier;
      else if (item.sentiment === 'BEARISH') scoreVal = -18 * impactMultiplier;
      newsTotal += scoreVal * decay;
    }
  }
  const newsSubScore = newsWindow.length > 0 ? clamp(newsTotal / newsWindow.length) : 0;

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

  // ── Module I: Price structure / key levels ───────────────────────────
  const levels = marketData.keyLevels?.levels;
  const dailySwingHigh = levels?.swingHighs?.at(-1)?.price;
  const dailySwingLow = levels?.swingLows?.at(-1)?.price;
  let structureScore = 0;
  if (currentPrice != null && levels?.pivots) {
    const rds = [levels.pdh, levels.pivots.r1, levels.pivots.r2, levels.pwh, levels.weekPivots?.r1, dailySwingHigh];
    const sds = [levels.pdl, levels.pivots.s1, levels.pivots.s2, levels.pwl, levels.weekPivots?.s1, dailySwingLow];
    const resistances = rds.filter((v) => v != null && v > currentPrice);
    const supports = sds.filter((v) => v != null && v < currentPrice);
    const nearestRes = resistances.length ? Math.min(...resistances) : null;
    const nearestSup = supports.length ? Math.max(...supports) : null;
    const upMom = (gold.changePercent || 0) > 0.3;
    const downMom = (gold.changePercent || 0) < -0.3;

    if (nearestRes == null && (levels.pdh != null && currentPrice > levels.pdh) && (levels.pwh == null || levels.pwh == null || currentPrice > (levels.pwh || -Infinity))) {
      // Cleared daily (and weekly) resistance engines -> breakout continuation
      structureScore = upMom ? 16 : 10;
    } else if (nearestSup == null && (levels.pdl != null && currentPrice < levels.pdl)) {
      structureScore = downMom ? -16 : -10;
    } else if (nearestRes != null && (nearestRes - currentPrice) < currentPrice * 0.0012) {
      structureScore = -7; // lodged under key resistance
    } else if (nearestSup != null && (currentPrice - nearestSup) < currentPrice * 0.0012) {
      structureScore = 7; // riding key support
    } else {
      structureScore = currentPrice >= ((levels.pdh ?? currentPrice) + (levels.pdl ?? currentPrice)) / 2 ? 3 : -3;
    }
  }
  let structureSubScore = clamp(structureScore);

  // ── Volatility regime overlay (ATR percentile) ───────────────────────
  const vreg = marketData.volatilityRegime;
  let volRegimeFactor = 0;
  if (vreg?.live && vreg.compositePercentile != null && currentPrice != null) {
    const up = (gold.changePercent || 0) >= 0.2;
    if (vreg.compositePercentile >= 75) volRegimeFactor = up ? 10 : -10;
    else if (vreg.compositePercentile >= 50) volRegimeFactor = up ? 4 : -4;
    else if (vreg.compositePercentile < 15) volRegimeFactor = 6; // squeeze anticipating expansion
  }

  // ── Long-horizon correlation regime (daily window) ───────────────────
  const longCorr = marketData.longCorrelations;
  let corrFactor = 0;
  if (longCorr?.live) {
    if (longCorr.goldDxy != null && longCorr.goldDxy > 0.35) corrFactor -= 8; // dollar rising WITH gold = move cracks
    if (longCorr.goldUs10y != null && longCorr.goldUs10y < -0.45 && corrFactor === 0) corrFactor += 4; // deep inverse with yields = real bid
  }
  structureSubScore += volRegimeFactor + corrFactor;
  structureSubScore = clamp(structureSubScore);

  // ── Multi-timeframe trend alignment (EMA9/21 on 5M..1D) ──────────────
  let trendSubScore = 0;
  if (timeframes?.live && timeframes.confluence?.bullPct != null && timeframes.confluence?.bearPct != null) {
    const net = timeframes.confluence.bullPct - timeframes.confluence.bearPct; // -100..+100
    trendSubScore = clamp(Math.round(net * 0.85));
  }

  const weights = {
    macro: 0.14,
    commodity: 0.08,
    volatility: 0.10,
    ictSweeps: 0.08,
    cot: 0.08,
    retail: 0.06,
    news: 0.12,
    etf: 0.08,
    geo: 0.06,
    structure: 0.10,
    trend: 0.10
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
    geoSubScore * weights.geo +
    structureSubScore * weights.structure +
    trendSubScore * weights.trend;

  const finalScore = Math.round(clamp(totalScore));
  let label = 'NEUTRAL';
  if (finalScore >= 55) label = 'STRONG BUY';
  else if (finalScore >= 20) label = 'BUY';
  else if (finalScore <= -55) label = 'STRONG SELL';
  else if (finalScore <= -20) label = 'SELL';

  const subScores = [macroSubScore, commoditySubScore, volatilitySubScore, ictSubScore, cotSubScore, retailSubScore, newsSubScore, etfSubScore, geoSubScore, structureSubScore, trendSubScore];
  const sameSign = subScores.filter((s) => (finalScore >= 0 ? s > 0 : s < 0)).length;
  const dataPoints = [
    dxyChange != null,
    realYield != null,
    currentPrice != null,
    cotPercentile != null,
    etf?.live,
    geo?.live,
    newsWindow.length > 0,
    structureSubScore !== 0,
    vreg?.live,
    longCorr?.live,
    timeframes?.live
  ].filter(Boolean).length;
  const confidence = Math.min(92, Math.max(20, Math.round(18 + dataPoints * 7 + (sameSign / subScores.length) * 28)));

  // A score computed from a frozen Friday tape over the weekend is descriptive,
  // not actionable — surface that so nothing gets acted on blindly.
  const marketOpen = marketData.marketState?.open !== false;
  const tapeFresh = gold.ageMs != null ? gold.ageMs < 30000 : currentPrice != null;
  const actionable = Boolean(marketOpen && tapeFresh);

  return {
    score: finalScore,
    label,
    confidence,
    actionable,
    breakdown: {
      macro: Math.round(macroSubScore),
      commodity: Math.round(commoditySubScore),
      volatility: Math.round(volatilitySubScore),
      ictSweeps: Math.round(ictSubScore),
      cot: Math.round(cotSubScore),
      retail: Math.round(retailSubScore),
      news: Math.round(newsSubScore),
      etf: Math.round(etfSubScore),
      geo: Math.round(geoSubScore),
      structure: Math.round(structureSubScore),
      trend: Math.round(trendSubScore)
    }
  };
}
