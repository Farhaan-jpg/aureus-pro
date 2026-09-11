import React from 'react';
import { Layers, TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight, Compass } from 'lucide-react';

export default function MacroDriversGrid({ marketData }) {
  const assets = marketData?.assets || {};
  const gsr = marketData?.gsr || 84.3;
  const realYield = marketData?.realYield10Y || 2.15;
  const yieldSpread = marketData?.yieldCurveSpread || 0.14;

  const cards = [
    {
      id: 'SILVER',
      title: 'Silver Spot (XAG/USD)',
      role: 'Primary Precious Proxy & Beta Driver',
      data: assets.SILVER,
      extra: `GSR: ${gsr} (Gold/Silver Ratio)`,
      inverse: false
    },
    {
      id: 'DXY',
      title: 'US Dollar Index (DXY)',
      role: 'Primary Currency Peg (Inverse Driver)',
      data: assets.DXY,
      extra: 'Inversely correlated to Bullion',
      inverse: true
    },
    {
      id: 'US10Y',
      title: 'US 10-Year Treasury Yield',
      role: 'Benchmark Nominal Risk-Free Rate',
      data: assets.US10Y,
      extra: `Real Yield: ${realYield}% (TIPS Proxy)`,
      suffix: '%',
      inverse: true
    },
    {
      id: 'CRUDE_OIL',
      title: 'WTI Crude Oil (USOIL)',
      role: 'Headline Inflationary Impulse Driver',
      data: assets.CRUDE_OIL,
      extra: 'Energy cost pass-through pressure',
      inverse: false
    },
    {
      id: 'US02Y',
      title: 'US 2-Year Treasury Yield',
      role: 'Fed Policy Rate Expectations',
      data: assets.US02Y,
      extra: `10Y-2Y Spread: ${yieldSpread > 0 ? '+' : ''}${yieldSpread}%`,
      suffix: '%',
      inverse: true
    },
    {
      id: 'COPPER',
      title: 'Copper Futures (HG)',
      role: 'Global Industrial Growth Barometer',
      data: assets.COPPER,
      extra: 'Risk-On / Manufacturing Pulse',
      inverse: false
    },
    {
      id: 'PLATINUM',
      title: 'Platinum Spot (XPT/USD)',
      role: 'Precious Metals Cohort Confirmation',
      data: assets.PLATINUM,
      extra: 'Industrial & Speculative metals bid',
      inverse: false
    },
    {
      id: 'VIX',
      title: 'CBOE Volatility (VIX)',
      role: 'Equity Panic & Flight to Quality Trigger',
      data: assets.VIX,
      extra: 'Above 20 signals systemic hedging',
      inverse: false
    }
  ];

  return (
    <div className="hud-panel p-4">
      {/* Module Title */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-gold-400" />
          <h2 className="font-mono font-bold text-xs tracking-wider text-slate-200 uppercase">
            Module A: Correlated Assets & Macro Drivers Engine
          </h2>
        </div>
        <div className="text-[11px] font-mono text-slate-400">
          Rolling Correlation Window: <strong className="text-slate-200">30-Sample Return Delta</strong>
        </div>
      </div>

      {/* Grid of 8 Core Macro Drivers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card) => {
          const item = card.data || { price: 0, change: 0, changePercent: 0, correlation: 0, momentum: 'NEUTRAL' };
          const isUp = (item.changePercent !== undefined && item.changePercent !== 0 ? item.changePercent : (item.change || 0)) >= 0;
          const corr = item.correlation ?? 0;
          // Correlation percentage (-1 to +1 -> 0% to 100% position)
          const corrPct = Math.round(((corr + 1) / 2) * 100);

          return (
            <div
              key={card.id}
              className="bg-[#0b0e15] border border-white/5 hover:border-white/15 p-3 rounded transition flex flex-col justify-between"
            >
              <div>
                {/* Header & Symbol */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono font-bold text-xs text-white">
                      {card.title}
                    </span>
                    <p className="text-[10px] text-slate-400 leading-tight mt-0.5 font-sans">
                      {card.role}
                    </p>
                  </div>
                  {/* Momentum Pill */}
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    item.momentum?.includes('UP')
                      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                      : item.momentum?.includes('DOWN')
                      ? 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
                      : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}>
                    {item.momentum || 'FLAT'}
                  </span>
                </div>

                {/* Price & Change */}
                <div className="flex items-baseline justify-between mt-2.5">
                  <span className="text-base font-mono font-bold text-white tabular-nums">
                    {card.suffix ? `${Number(item.price || 0).toFixed(2)}%` : `$${Number(item.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </span>
                  <div className={`flex items-center text-xs font-mono font-bold px-1.5 py-0.5 rounded border ${
                    isUp ? 'text-emerald-400 bg-emerald-950/50 border-emerald-800/40' : 'text-rose-400 bg-rose-950/50 border-rose-800/40'
                  }`}>
                    {isUp ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5 shrink-0" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5 shrink-0" />}
                    <span className="tabular-nums">{isUp ? '+' : ''}{Number(item.changePercent || 0).toFixed(2)}%</span>
                  </div>
                </div>

                {/* Extra Insight Note */}
                <div className="mt-1 text-[10px] font-mono text-gold-400/90 truncate">
                  {card.extra}
                </div>
              </div>

              {/* Rolling Correlation Meter */}
              <div className="mt-3 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                  <span>Rolling Correlation</span>
                  <span className={`font-bold ${corr > 0.3 ? 'text-emerald-400' : corr < -0.3 ? 'text-cyan-400' : 'text-slate-300'}`}>
                    {corr > 0 ? `+${corr.toFixed(2)}` : corr.toFixed(2)}
                  </span>
                </div>
                {/* Horizontal correlation track from -1.0 to +1.0 */}
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden relative border border-white/5">
                  <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-600 z-10" />
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      corr >= 0 ? 'bg-emerald-400' : 'bg-cyan-400'
                    }`}
                    style={{
                      width: `${Math.abs(corr) * 50}%`,
                      marginLeft: corr >= 0 ? '50%' : `${50 - Math.abs(corr) * 50}%`
                    }}
                  />
                </div>
                <div className="flex justify-between text-[8px] font-mono text-slate-500 mt-0.5">
                  <span>-1.0 (Inv)</span>
                  <span>0.0</span>
                  <span>+1.0 (Direct)</span>
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}
