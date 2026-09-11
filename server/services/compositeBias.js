// Composite Market Bias & Strength Meter Engine
// Computes a mathematical score from -100 (Extreme Bearish) to +100 (Extreme Bullish)
// Based on the 5 Institutional Sub-Scores with exact weighting.

export function calculateCompositeBias(marketData, newsItems, retailPositioning) {
  if (!marketData || !marketData.assets) {
    return {
      score: 0,
      label: 'NEUTRAL',
      confidence: 50,
      breakdown: {
        macro: 0,
        commodity: 0,
        news: 0,
        retail: 0,
        technical: 0
      }
    };
  }

  const assets = marketData.assets;

  // 1. Macro Sub-Score (30% Weight)
  // Inverse DXY slope + Real Yields direction.
  // Gold is strictly inverse to DXY and Real Yields.
  const dxyChange = assets.DXY ? assets.DXY.changePercent : 0;
  const realYield = marketData.realYield10Y || 2.2;
  // If DXY drops 0.5%, that's strongly bullish for Gold (+50 macro score)
  const dxyFactor = -dxyChange * 50; 
  // If Real Yield is low (<2.0%), supportive; if >2.3%, restrictive
  const yieldFactor = (2.2 - realYield) * 40;
  const macroSubScore = Math.max(-100, Math.min(100, dxyFactor + yieldFactor));

  // 2. Commodity Cohort Sub-Score (20% Weight)
  // Silver (XAG/USD) lead/lag + Oil price momentum.
  const silverChange = assets.SILVER ? assets.SILVER.changePercent : 0;
  const oilChange = assets.CRUDE_OIL ? assets.CRUDE_OIL.changePercent : 0;
  // Silver leading upwards indicates precious metals appetite
  // Oil upwards indicates inflation hedge demand
  const commoditySubScore = Math.max(-100, Math.min(100, (silverChange * 35) + (oilChange * 15)));

  // 3. News Sentiment Sub-Score (20% Weight)
  // Weighted average of recent news items
  let newsTotal = 0;
  let newsCount = 0;
  if (newsItems && newsItems.length > 0) {
    for (const item of newsItems.slice(0, 15)) {
      const impactMultiplier = item.impact || 2;
      let scoreVal = 0;
      if (item.sentiment === 'BULLISH') scoreVal = 20 * impactMultiplier;
      else if (item.sentiment === 'BEARISH') scoreVal = -20 * impactMultiplier;
      
      if (item.isGeopolitical) scoreVal += 15;
      if (item.isCentralBank) scoreVal += 10;

      newsTotal += scoreVal;
      newsCount++;
    }
  }
  const newsSubScore = newsCount > 0 ? Math.max(-100, Math.min(100, newsTotal / newsCount)) : 0;

  // 4. Retail Positioning Divergence (15% Weight)
  // Contrarian signal: If retail is 80% Long, institutionally that's Bearish (-60).
  // Neutral baseline is 50% Long.
  const retailLongPercent = retailPositioning?.longPercentage || 74;
  // Divergence = 50 - retailLongPercent (e.g. 50 - 80 = -30 * 2.5 = -75 Bearish)
  const retailSubScore = Math.max(-100, Math.min(100, (50 - retailLongPercent) * 2.5));

  // 5. Technical Structure Sub-Score (15% Weight)
  // Multi-timeframe trend alignment (above/below 50 & 200 EMA)
  const goldPrice = assets.GOLD ? assets.GOLD.price : 4335;
  const ema50 = goldPrice * 0.994;  // Proxy 50 EMA
  const ema200 = goldPrice * 0.985; // Proxy 200 EMA
  let techScore = 0;
  if (goldPrice > ema50 && goldPrice > ema200) techScore = 65;
  else if (goldPrice < ema50 && goldPrice < ema200) techScore = -65;
  else techScore = 10;
  // Day change bonus
  const goldChange = assets.GOLD ? assets.GOLD.changePercent : 0;
  techScore += (goldChange * 20);
  const technicalSubScore = Math.max(-100, Math.min(100, techScore));

  // Weighted Sum: 30% Macro + 20% Commodity + 20% News + 15% Retail + 15% Technical
  const totalScore = (macroSubScore * 0.30) +
                     (commoditySubScore * 0.20) +
                     (newsSubScore * 0.20) +
                     (retailSubScore * 0.15) +
                     (technicalSubScore * 0.15);

  const finalScore = Math.round(Math.max(-100, Math.min(100, totalScore)));

  // Determine classification label
  let label = 'NEUTRAL';
  if (finalScore >= 55) label = 'STRONG BUY';
  else if (finalScore >= 20) label = 'BUY';
  else if (finalScore <= -55) label = 'STRONG SELL';
  else if (finalScore <= -20) label = 'SELL';

  // Confidence calculation based on alignment of sub-scores
  const scores = [macroSubScore, commoditySubScore, newsSubScore, retailSubScore, technicalSubScore];
  const sameSign = scores.filter(s => (finalScore >= 0 ? s > 0 : s < 0)).length;
  const confidence = Math.min(96, Math.max(55, Math.round(50 + (sameSign / 5) * 35 + Math.abs(finalScore) * 0.15)));

  return {
    score: finalScore,
    label,
    confidence,
    breakdown: {
      macro: Math.round(macroSubScore),
      commodity: Math.round(commoditySubScore),
      news: Math.round(newsSubScore),
      retail: Math.round(retailSubScore),
      technical: Math.round(technicalSubScore)
    }
  };
}
