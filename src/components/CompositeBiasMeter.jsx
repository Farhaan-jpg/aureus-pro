import React, { useState } from 'react';
import { Gauge, ShieldCheck, Zap, Info, ChevronDown, ChevronRight } from 'lucide-react';

export default function CompositeBiasMeter({ bias }) {
  const [expandedRow, setExpandedRow] = useState(null);
  const actionable = bias?.actionable !== false;
  const score = bias?.score ?? 0;
  const label = bias?.label ?? 'NEUTRAL';
  const confidence = bias?.confidence ?? 50;
  const breakdown = bias?.breakdown || {
    macro: 0,
    commodity: 0,
    news: 0,
    retail: 0,
    volatility: 0,
    ictSweeps: 0,
    cot: 0,
    etf: 0,
    geo: 0,
    structure: 0,
    trend: 0,
    centralBank: 0
  };
  const weights = bias?.weights || {};
  const drivers = bias?.drivers || {};

  const wPct = (k) => {
    const w = weights[k];
    if (typeof w === 'number') return `${(w * 100).toFixed(0)}%`;
    return String(w ?? '—');
  };

  // Convert -100..+100 to angle in degrees (-90deg to +90deg for semi-circle)
  // -100 -> -90deg, 0 -> 0deg, +100 -> +90deg
  const needleAngle = (score / 100) * 90;

  const colorConfig = {
    'STRONG BUY': { text: 'text-emerald-400', bg: 'bg-emerald-950/60', border: 'border-emerald-700/60', glow: 'glow-green' },
    'BUY': { text: 'text-emerald-300', bg: 'bg-emerald-950/40', border: 'border-emerald-800/40', glow: '' },
    'NEUTRAL': { text: 'text-slate-300', bg: 'bg-slate-900', border: 'border-slate-700', glow: '' },
    'SELL': { text: 'text-rose-300', bg: 'bg-rose-950/40', border: 'border-rose-800/40', glow: '' },
    'STRONG SELL': { text: 'text-rose-400', bg: 'bg-rose-950/60', border: 'border-rose-700/60', glow: 'glow-red' },
  };

  const factors = [
    { key: 'macro', name: 'Macro (DXY / real yield)' },
    { key: 'structure', name: 'Price structure / key levels' },
    { key: 'trend', name: 'Multi-TF trend alignment' },
    { key: 'commodity', name: 'Metals & GSR' },
    { key: 'volatility', name: 'VIX / risk-off' },
    { key: 'news', name: 'News' },
    { key: 'ictSweeps', name: 'Asian range / ICT' },
    { key: 'cot', name: 'CFTC COT' },
    { key: 'etf', name: 'Gold ETF tape' },
    { key: 'retail', name: 'Retail / small traders' },
    { key: 'geo', name: 'Geopolitics (GDELT)' },
    { key: 'centralBank', name: 'Central bank watch' },
  ];

  const currentTheme = colorConfig[label] || colorConfig.NEUTRAL;

  return (
    <div className="hud-panel p-4 flex flex-col justify-between h-full">
      {/* Module Title */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-gold-400" />
          <h2 className="font-mono font-bold text-xs tracking-wider text-slate-200 uppercase">
            Module H: Composite Market Bias
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Confidence: {confidence}%</span>
        </div>
      </div>

      {/* Main Gauge Graphic */}
      <div className="flex flex-col items-center justify-center my-1 relative">
        {!actionable && (
          <div className="absolute top-0 inset-x-0 z-30 flex justify-center">
            <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded border border-amber-500/40 text-amber-300 bg-amber-950/60 animate-pulse">
              NOT ACTIONABLE — market closed / tape stale
            </span>
          </div>
        )}
        <div className="relative w-64 h-32 overflow-hidden flex items-end justify-center mt-4">
          {/* Background Arc SVG */}
          <svg className="w-64 h-64 -mb-32 transform -rotate-180" viewBox="0 0 200 200">
            {/* Background track */}
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke="#161a26"
              strokeWidth="20"
              strokeDasharray="251.2"
              strokeDashoffset="0"
            />
            {/* Colored Zones: Strong Sell (Red), Sell, Neutral, Buy, Strong Buy (Green) */}
            {/* Red Zone */}
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke="#e11d48"
              strokeWidth="20"
              strokeDasharray="50 201.2"
              strokeDashoffset="0"
              strokeOpacity="0.8"
            />
            {/* Neutral Zone */}
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke="#64748b"
              strokeWidth="20"
              strokeDasharray="50 201.2"
              strokeDashoffset="-100"
              strokeOpacity="0.5"
            />
            {/* Green Zone */}
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke="#10b981"
              strokeWidth="20"
              strokeDasharray="50 201.2"
              strokeDashoffset="-201.2"
              strokeOpacity="0.8"
            />
          </svg>

          {/* Needle */}
          <div
            className="absolute bottom-0 left-1/2 w-1.5 h-24 origin-bottom -translate-x-1/2 transition-transform duration-700 ease-out z-20"
            style={{ transform: `translateX(-50%) rotate(${needleAngle}deg)` }}
          >
            <div className="w-full h-full bg-gradient-to-t from-gold-400 to-amber-200 rounded-t-full shadow-lg shadow-gold-500/50" />
            <div className="w-4 h-4 rounded-full bg-gold-400 border-2 border-black absolute -bottom-2 -left-1.5" />
          </div>
        </div>

        {/* Needle Value Readout */}
        <div className="mt-2 text-center">
          <div className="flex items-center justify-center gap-2">
            <span className={`text-3xl font-mono font-black text-white tabular-nums tracking-tight ${actionable ? '' : 'opacity-40'}`}>
              {score > 0 ? `+${score}` : score}
            </span>
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border uppercase ${actionable ? `${currentTheme.text} ${currentTheme.bg} ${currentTheme.border}` : 'text-amber-300 bg-amber-950/40 border-amber-800/50'}`}>
              {actionable ? label : 'HOLD — CLOSED'}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
            Mathematical Range: -100 (Extreme Bearish) to +100 (Extreme Bullish)
          </p>
        </div>
      </div>

      {/* 12-Channel Institutional Weighted Algorithm Breakdown */}
      <div className="mt-3 pt-2 border-t border-white/5">
        <span className="text-[10px] font-mono text-slate-400 font-semibold tracking-wider uppercase block mb-1">
          12-Channel Institutional Breakdown — tap a channel for "why"
        </span>
        <div className="max-h-[230px] overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
        {factors.map((f) => {
          const val = breakdown[f.key] ?? 0;
          const isPositive = val >= 0;
          const isOpen = expandedRow === f.key;
          const why = drivers[f.key];
          return (
            <div key={f.key}>
              <button
                type="button"
                onClick={() => setExpandedRow(isOpen ? null : f.key)}
                className={`w-full text-left text-[11px] font-mono rounded transition ${why ? 'cursor-pointer' : ''}`}
              >
                <div className="flex items-center justify-between gap-2 text-slate-300">
                  <span className="flex items-center gap-1 min-w-0">
                    {why ? (
                      isOpen
                        ? <ChevronDown className="w-3 h-3 text-gold-400 shrink-0" />
                        : <ChevronRight className="w-3 h-3 text-gold-400 shrink-0" />
                    ) : (
                      <span className="w-3" />
                    )}
                    <span className="text-slate-400 truncate">{f.name}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-gold-400/80">{wPct(f.key)}</span>
                    <span className={`font-bold tabular-nums ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isPositive ? `+${val}` : val}
                    </span>
                  </span>
                </div>
                {/* Factor mini bar */}
                <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden relative mt-0.5 border border-white/5">
                  <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-600" />
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isPositive ? 'bg-emerald-400' : 'bg-rose-400'
                    }`}
                    style={{
                      width: `${Math.abs(val) / 2}%`,
                      marginLeft: isPositive ? '50%' : `${50 - Math.abs(val) / 2}%`
                    }}
                  />
                </div>
              </button>
              {why && isOpen && (
                <div className="mt-1 ml-3 px-2.5 py-1.5 rounded bg-gold-950/30 border border-gold-500/20 text-[10px] font-mono text-slate-300 leading-snug">
                  <Zap className="w-3 h-3 text-gold-400 inline mr-1 -mt-0.5" />
                  {why}
                </div>
              )}
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
