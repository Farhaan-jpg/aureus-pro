import React, { useState, useEffect } from 'react';
import { Landmark, AlertCircle, BarChart2, Layers } from 'lucide-react';

export default function CotReportGauge({ cotData: cotProp }) {
  const [cotData, setCotData] = useState(cotProp || null);
  const [isLoading, setIsLoading] = useState(!cotProp);

  useEffect(() => {
    if (cotProp) {
      setCotData(cotProp);
      setIsLoading(false);
      return;
    }
    fetch('/api/cot-data')
      .then((r) => r.json())
      .then((data) => {
        if (data) setCotData(data);
      })
      .catch((e) => console.warn('COT fetch failed:', e))
      .finally(() => setIsLoading(false));
  }, [cotProp]);

  if (isLoading || !cotData) {
    return (
      <div className="hud-panel p-3.5 bg-[#0a0d14] border border-white/10 rounded-lg flex items-center justify-center h-full min-h-[350px]">
        <span className="font-mono text-xs text-slate-500 animate-pulse">
          LOADING CFTC GOLD COT...
        </span>
      </div>
    );
  }

  if (!cotData.live) {
    return (
      <div className="hud-panel p-4 h-full">
        <h2 className="font-mono font-bold text-xs tracking-wider text-slate-200 uppercase mb-2">CFTC Gold COT</h2>
        <p className="text-xs font-mono text-slate-500">Official weekly COMEX gold positioning has not loaded yet. No synthetic fallback is shown.</p>
      </div>
    );
  }

  const mm = cotData.managedMoney || {};
  const comm = cotData.commercials || {};
  const signal = cotData.signal || {};
  const percentile = mm.percentile3Year;
  const isOvercrowded = percentile != null && percentile >= 80;
  const weeklyTrend = cotData.weeklyTrend || [];

  return (
    <div className="hud-panel p-4 bg-[#0a0d14] border border-white/10 rounded-lg flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4 text-gold-400" />
            <h2 className="font-mono font-bold text-xs tracking-wider text-slate-200 uppercase">
              CFTC Gold COT (088691)
            </h2>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            AS OF {cotData.reportDate || '—'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3 font-mono text-xs">
          <div className="p-2.5 rounded bg-[#0e121d] border border-white/5">
            <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
              <span>NON-COMM / SPECS</span>
              <span className={mm.weeklyNetChange >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                {mm.weeklyNetChange > 0 ? '+' : ''}{Number(mm.weeklyNetChange || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-white font-bold text-sm">
                {mm.net > 0 ? '+' : ''}{Math.round((mm.net || 0) / 1000)}k
              </span>
              <span className="text-[10px] text-emerald-400">{mm.longShortRatio}:1 L/S</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Long {((mm.longs || 0) / 1000).toFixed(0)}k · Short {((mm.shorts || 0) / 1000).toFixed(0)}k
            </div>
          </div>

          <div className="p-2.5 rounded bg-[#0e121d] border border-white/5">
            <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
              <span>COMMERCIALS</span>
              <span className={comm.weeklyNetChange >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                {Number(comm.weeklyNetChange || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-red-400 font-bold text-sm">{Math.round((comm.net || 0) / 1000)}k</span>
              <span className="text-[10px] text-slate-400">{comm.stance}</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Long {((comm.longs || 0) / 1000).toFixed(0)}k · Short {((comm.shorts || 0) / 1000).toFixed(0)}k
            </div>
          </div>
        </div>

        <div className="p-2.5 rounded bg-[#0e121d] border border-white/5 mb-3 font-mono text-xs">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="text-slate-400 flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5 text-gold-400" />
              SPEC NET PERCENTILE (~3Y)
            </span>
            <span className={`font-bold ${isOvercrowded ? 'text-amber-400' : 'text-emerald-400'}`}>
              {percentile != null ? `${percentile}%` : '—'} {isOvercrowded ? '(CROWDED)' : ''}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div className={`h-full ${isOvercrowded ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${percentile || 0}%` }} />
          </div>
        </div>

        <div className="p-2.5 rounded bg-[#0e121d] border border-white/5 mb-3 font-mono text-xs">
          <span className="text-[10px] text-slate-400 font-bold mb-1.5 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            LAST 4 WEEKLY SPEC NETS
          </span>
          <div className="space-y-1">
            {weeklyTrend.map((row) => (
              <div key={row.week} className="flex items-center justify-between text-[11px] py-0.5 border-b border-white/5 last:border-0">
                <span className="text-slate-400">{row.week}</span>
                <span className="text-white font-bold">{row.net > 0 ? '+' : ''}{Number(row.net).toLocaleString()}</span>
                <span className={row.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {row.change > 0 ? '+' : ''}{Number(row.change).toLocaleString()}
                </span>
                <span className="text-[9px] px-1.5 rounded bg-white/5 text-slate-400">{row.stance}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-2.5 rounded bg-amber-950/25 border border-amber-500/30 text-amber-300 font-mono text-[11px] leading-relaxed">
        <div className="flex items-center gap-1.5 font-bold mb-1">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{signal.headline}</span>
        </div>
        <p className="text-[10px] text-slate-300 opacity-90 leading-relaxed">{signal.institutionalAction}</p>
      </div>
    </div>
  );
}
