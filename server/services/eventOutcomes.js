// Actuals re-pricer: turns released economic data into an immediate,
// gold-directional read. Pure logic so the surprise math is unit-testable;
// cronWorker applies it against the calendar as releases roll in.
export function parseFigure(raw) {
  if (raw == null) return null;
  const str = String(raw).replace(/,/g, '').trim();
  if (!str || str === '' || /^[Nn]/i.test(str) || ['—', '-'].includes(str)) return null;
  const numeric = parseFloat(str);
  if (!Number.isFinite(numeric)) return null;
  return {
    value: numeric,
    isPct: /%/.test(str),
    raw: str
  };
}

// Consensus "surprise" for gold: how far the actual print landed from the
// forecast, scaled so CPI (pp) and NFP (K) are comparable via z-band around
// the forecast. Returns null when it can't be computed.
export function surpriseRule(event) {
  const actual = parseFigure(event?.actual);
  const forecast = parseFigure(event?.forecast);
  if (!actual || !forecast || forecast.value === 0) return null;
  const mismatch = actual.value - forecast.value;
  const mismatchPct = Math.abs((mismatch / forecast.value) * 100);

  // Magnitude bands tuned to real risk data:
  //  - rates/Fed decides (pp step) are big at >= 0.25pp
  //  - everything else scales off 50% of the forecast (or large given scale).
  const big = event.impact === 'CRITICAL'
    ? Math.abs(mismatch) >= 0.25
    : mismatchPct >= 40;
  const direction = (event.currency || '').toUpperCase() === 'USD'
    ? (mismatch < 0 ? 'BULLISH' : 'BEARISH')   // miss → dovish → gold soft bid
    : (mismatch > 0 ? 'BULLISH' : 'BEARISH');  // strong ex-US print → USD headwind

  return {
    actual: actual.raw,
    forecast: forecast.raw,
    mismatch: Number(mismatch.toFixed(2)),
    mismatchPct: Number(mismatchPct.toFixed(1)),
    direction,
    magnitude: big ? 'BIG' : mismatchPct >= 15 || Math.abs(mismatch) >= 0.1 ? 'MODERATE' : 'MINOR'
  };
}

// Classify a just-released event. Only triggers on a real, parseable print.
export function evaluateReleasedEvent(event, now = Date.now()) {
  if (!event?.date) return null;
  const releasedMs = new Date(event.date).getTime();
  if (!Number.isFinite(releasedMs) || releasedMs > now) return null;
  const surprise = surpriseRule(event);
  if (!surprise) return null;
  return {
    type: 'SURPRISE',
    event: {
      id: event.id,
      title: event.title,
      currency: event.currency,
      impact: event.impact
    },
    surprise
  };
}