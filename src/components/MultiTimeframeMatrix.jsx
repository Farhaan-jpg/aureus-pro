import React from 'react';
import { Layers, TrendingUp, TrendingDown, Minus, ShieldCheck } from 'lucide-react';

export default function MultiTimeframeMatrix({ matrix }) {
  const timeframes = matrix?.timeframes || [];
  const confluence = matrix?.confluence;

  const stance = confluence?.stance || 'WAITING FOR GC=F BARS';
  const bullPct = confluence?.bullPct ?? 0;

  return (
    <div className="hud-panel p-3 bg-[#0a0d14] border border-white/10 rounded-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 mb-2 border-b border-white/5 gap-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="font-mono font-bold text-xs tracking-wider text-slate-200">
            MULTI-TIMEFRAME CONFLUENCE (GC=F)
          </span>
          <span className="text-[10px] text-slate-500 font-mono hidden md:inline">
            EMA 9/21 + RSI 14 from Yahoo gold futures
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#121624] border border-white/10 font-mono text-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">BULL WEIGHT:</span>
            <span className="font-bold text-emerald-400">{bullPct}%</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-slate-300 font-mono font-bold border border-white/10">
            {stance}
          </span>
        </div>
      </div>

      {timeframes.length === 0 ? (
        <p className="text-xs font-mono text-slate-500 py-2">Loading gold futures candles…</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {timeframes.map((item) => {
            const isBull = item.trend === 'BULLISH';
            const isBear = item.trend === 'BEARISH';
            const emaSpread = item.fastEma != null && item.slowEma != null ? item.fastEma - item.slowEma : null;
            return (
              <div
                key={item.tf}
                className={`p-2 rounded border ${
                  isBull ? 'bg-emerald-950/20 border-emerald-500/30'
                    : isBear ? 'bg-red-950/20 border-red-500/30'
                    : 'bg-slate-900/40 border-slate-700/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-bold text-xs text-white">{item.tf}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{item.role}</span>
                </div>
                <div className="flex items-center gap-1 my-1">
                  {isBull ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> : isBear ? <TrendingDown className="w-3.5 h-3.5 text-red-400" /> : <Minus className="w-3.5 h-3.5 text-slate-400" />}
                  <span className={`font-mono font-bold text-xs ${isBull ? 'text-emerald-400' : isBear ? 'text-red-400' : 'text-slate-300'}`}>
                    {item.trend}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-white/5 pt-1 mt-1">
                  <span>RSI {item.rsi ?? '—'}</span>
                  <span className="text-slate-500">
                    EMA {emaSpread == null ? '—' : `${emaSpread > 0 ? '+' : ''}${emaSpread.toFixed(1)}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
