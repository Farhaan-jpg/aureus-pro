// Economic Calendar & Institutional Gold Impact Matrix

export function getEconomicCalendar() {
  const now = Date.now();

  const events = [
    {
      id: 'cpi_us',
      title: 'US Consumer Price Index (CPI YoY)',
      currency: 'USD',
      impact: 'HIGH',
      date: new Date(now + 2.5 * 3600 * 1000).toISOString(),
      forecast: '2.6%',
      previous: '2.7%',
      goldImpactRule: 'Actual > Forecast: Fed Hawkish -> Yields Rise -> Gold BEARISH | Actual < Forecast: Fed Dovish -> Gold BULLISH'
    },
    {
      id: 'claims_us',
      title: 'US Initial Jobless Claims',
      currency: 'USD',
      impact: 'HIGH',
      date: new Date(now + 8 * 3600 * 1000).toISOString(),
      forecast: '215K',
      previous: '221K',
      goldImpactRule: 'Claims > Forecast: Labor Weakness -> Rate Cuts Priced In -> Gold BULLISH | Claims < Forecast: Gold BEARISH'
    },
    {
      id: 'pce_us',
      title: 'Core PCE Price Index (MoM)',
      currency: 'USD',
      impact: 'HIGH',
      date: new Date(now + 26 * 3600 * 1000).toISOString(),
      forecast: '0.2%',
      previous: '0.3%',
      goldImpactRule: 'Fed Benchmark Inflation: Core PCE Beats -> Bullion Headwind | Core PCE Misses -> Bullion Safe Haven Breakout'
    },
    {
      id: 'fomc_rate',
      title: 'FOMC Interest Rate Decision & Press Conference',
      currency: 'USD',
      impact: 'CRITICAL',
      date: new Date(now + 74 * 3600 * 1000).toISOString(),
      forecast: '4.50%',
      previous: '4.75%',
      goldImpactRule: '25bps Cut + Dovish Guidance: Dollar Drops -> Bullion Tests ATH | Pause or Hawkish Dissent: Aggressive Liquidity Flush'
    },
    {
      id: 'nfp_us',
      title: 'US Non-Farm Payrolls & Unemployment Rate',
      currency: 'USD',
      impact: 'CRITICAL',
      date: new Date(now + 120 * 3600 * 1000).toISOString(),
      forecast: '160K',
      previous: '142K',
      goldImpactRule: 'NFP < Forecast & Unemployment Rises: Stagflation / Aggressive Easing Odds -> Strong Bullish Impulse'
    }
  ];

  // Gold Impact Matrix reference guides
  const matrixRules = [
    {
      indicator: "CPI / Core Inflation",
      hawkishOutcome: "Above Forecast (Hot)",
      dxyReaction: "Surges Upward",
      yieldsReaction: "Spikes Higher (Nominal & Real)",
      goldDirection: "BEARISH",
      mechanism: "Higher inflation forces Fed to stay restrictive, raising opportunity cost of holding non-yielding gold."
    },
    {
      indicator: "Non-Farm Payrolls (NFP)",
      hawkishOutcome: "Above Forecast (Tight Labor)",
      dxyReaction: "Strengthens",
      yieldsReaction: "Rises",
      goldDirection: "BEARISH",
      mechanism: "Strong labor market delays rate cuts and pushes treasury yields upward."
    },
    {
      indicator: "Initial Jobless Claims",
      hawkishOutcome: "Above Forecast (Spike in layoffs)",
      dxyReaction: "Weakens Downward",
      yieldsReaction: "Declines",
      goldDirection: "BULLISH",
      mechanism: "Weak labor prompts emergency easing odds; safe haven and real interest rate tailwinds kick in."
    },
    {
      indicator: "FOMC Rate Cut (25-50 bps)",
      hawkishOutcome: "Dovish Easing Delivery",
      dxyReaction: "Tumbles",
      yieldsReaction: "Yield curve steepens, real rates fall",
      goldDirection: "BULLISH",
      mechanism: "Zero-yield asset advantage restored; currency debasement demand from sovereign reserves accelerates."
    }
  ];

  return {
    events,
    matrixRules
  };
}
