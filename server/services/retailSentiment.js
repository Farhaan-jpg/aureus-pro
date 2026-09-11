import { getCotData } from './cotData.js';

export function getRetailSentiment(currentGoldPrice = null) {
  const cot = getCotData();
  const small = cot?.smallTraders;
  const live = Boolean(cot?.live && small && (small.longs + small.shorts) > 0);
  const total = live ? (small.longs + small.shorts) : 0;
  const longPercentage = live ? Number(((small.longs / total) * 100).toFixed(1)) : null;
  const shortPercentage = live ? Number((100 - longPercentage).toFixed(1)) : null;

  const isExtremeLongTrap = longPercentage != null && longPercentage >= 75;
  const isExtremeShortTrap = shortPercentage != null && shortPercentage >= 75;

  let contrarianSignal = 'UNAVAILABLE';
  let contrarianMessage = 'No live retail book is connected. Showing CFTC non-reportable (small trader) split when the weekly gold COT file is loaded — this is not a tick-by-tick retail feed.';

  if (live) {
    contrarianSignal = 'NEUTRAL';
    contrarianMessage = `CFTC small/non-reportable traders are ${longPercentage}% long / ${shortPercentage}% short as of ${cot.reportDate}. This is weekly, not intraday retail.`;
    if (isExtremeLongTrap) {
      contrarianSignal = 'EXTREME_LONG_RETAIL_TRAP';
      contrarianMessage = `Small traders are ${longPercentage}% long on the latest COT. That is a crowded speculative long, not a live order book.`;
    } else if (isExtremeShortTrap) {
      contrarianSignal = 'EXTREME_SHORT_RETAIL_TRAP';
      contrarianMessage = `Small traders are ${shortPercentage}% short on the latest COT. Crowded shorts can fuel squeezes, still weekly data.`;
    }
  }

  const price = Number(currentGoldPrice);
  const orderFlowHeatmap = Number.isFinite(price)
    ? [10, 5, 0, -5, -10].map((offset) => {
        const level = Math.round(price / 5) * 5 + offset;
        const distance = Math.abs(level - price);
        return {
          price: level,
          type: level > price ? 'ASK_SUPPLY_WALL' : 'BID_DEMAND_WALL',
          label: `$${level.toFixed(2)}`,
          distance: Number(distance.toFixed(2)),
          significance: level % 10 === 0 ? 'PSYCH_HANDLE' : 'MICRO_HANDLE',
          intensity: Math.max(12, Math.round(100 - distance * 8))
        };
      })
    : [];

  return {
    live,
    source: live ? 'CFTC non-reportable traders (weekly)' : 'unavailable',
    reportDate: cot?.reportDate || null,
    longPercentage,
    shortPercentage,
    contrarianSignal,
    contrarianMessage,
    isExtremeLongTrap,
    isExtremeShortTrap,
    sampleSize: live ? `${total.toLocaleString()} small-trader contracts` : 'No live retail sample',
    orderFlowHeatmap
  };
}
