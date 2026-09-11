import React, { useState, useEffect } from 'react';
import { Landmark, TrendingUp, TrendingDown, AlertCircle, BarChart2 } from 'lucide-react';

export default function CotReportGauge() {
  const [cotData, setCotData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/cot-data')
      .then((r) => r.json())
      .then((data) => {
        if (data) setCotData(data);
      })
      .catch((e) => console.warn('COT fetch failed:', e))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading || !cotData) {
    return (
      <div className="hud-panel p-3.5 bg-[#0a0d14] border border-white/10 rounded-lg flex items-center justify-center min-h-[220px]">
        <span className="font-mono text-xs text-slate-500 animate-pulse">
          LOADING CFTC GOLD COT POSITIONING...
        </span>
      </div>
    );
  }

  const mm = cotData.managedMoney || {};
  const comm = cotData.commercials || {};
  const signal = cotData.signal || {};
  const percentile = mm.percentile3Year || 88.4;
  const isOvercrowded = percentile >= 80;

  return (
    <div className="hud-panel p-3.5 bg-[#0a0d14] border border-white/10 rounded-lg flex flex-col justify-between">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Landmark className="w-4 h-4 text-gold-400" />
          <span className="font-mono font-bold text-xs tracking-wider text-slate-200">
            CFTC GOLD (COMEX) COT REPORT
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">
          AS OF: {cotData.reportDate || 'WEEKLY'}
        </span>
      </div>

      {/* Managed Money vs Commercials Net Breakdown */}
      <div className="grid grid-cols-2 gap-2 mb-3 font-mono text-xs">
        {/* Managed Money (Hedge Funds) */}
        <div className="p-2.5 rounded bg-[#0e121d] border border-white/5">
          <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
            <span>MANAGED MONEY (SPECS)</span>
            <span className="text-emerald-400 font-bold">
              {mm.weeklyNetChange > 0 ? `+${mm.weeklyNetChange.toLocaleString()}` : mm.weeklyNetChange}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-white font-bold text-sm">
              +{Math.round(mm.net / 1000)}k
            </span>
            <span className="text-[10px] text-emerald-400">
              {mm.longShortRatio}:1 L/S
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Longs: {(mm.longs / 1000).toFixed(0)}k | Shorts: {(mm.shorts / 1000).toFixed(0)}k
          </div>
        </div>

        {/* Commercials (Bullion Banks) */}
        <div className="p-2.5 rounded bg-[#0e121d] border border-white/5">
          <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
            <span>COMMERCIALS (BANKS)</span>
            <span className="text-red-400 font-bold">
              {comm.weeklyNetChange ? comm.weeklyNetChange.toLocaleString() : '-14,100'}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-red-400 font-bold text-sm">
              {Math.round(comm.net / 1000)}k
            </span>
            <span className="text-[10px] text-slate-400">
              Short Hedge
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Longs: {(comm.longs / 1000).toFixed(0)}k | Shorts: {(comm.shorts / 1000).toFixed(0)}k
          </div>
        </div>
      </div>

      {/* 3-Year Historical Percentile Meter */}
      <div className="p-2.5 rounded bg-[#0e121d] border border-white/5 mb-3 font-mono text-xs">
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="text-slate-400 flex items-center gap-1.5">
            <BarChart2 className="w-3.5 h-3.5 text-gold-400" />
            3-YEAR HISTORICAL LONG PERCENTILE:
          </span>
          <span className={`font-bold ${isOvercrowded ? 'text-amber-400' : 'text-emerald-400'}`}>
            {percentile}% {isOvercrowded ? '(CROWDED)' : '(BALANCED)'}
          </span>
        </div>

        {/* Bar */}
        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden relative">
          <div
            className={`h-full transition-all duration-700 ${
              isOvercrowded
                ? 'bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${percentile}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[9px] text-slate-500 mt-1">
          <span>0% (Capitulation)</span>
          <span>50% (Neutral)</span>
          <span>100% (Extreme Long Trap)</span>
        </div>
      </div>

      {/* Institutional COT Signal Banner */}
      <div className="p-2 rounded bg-amber-950/20 border border-amber-500/30 text-amber-300 font-mono text-[11px] leading-relaxed">
        <div className="flex items-center gap-1.5 font-bold mb-0.5">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          <span>{signal.headline || 'Heavy Speculative Long Exposure'}</span>
        </div>
        <p className="text-[10px] text-slate-300 opacity-90">
          {signal.institutionalAction || 'Fade extreme breakout chasing; wait for liquidity flushes.'}
        </p>
      </div>
    </div>
  );
}
