import React from 'react';
import { Landmark } from 'lucide-react';

export default function GoldEtfPanel({ etf }) {
  const rows = etf?.etfs || [];
  return (
    <div className="hud-panel p-3.5 h-full">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Landmark className="w-4 h-4 text-gold-400" />
          <h2 className="font-mono font-bold text-xs tracking-wider text-slate-200 uppercase">Gold ETF tape (GLD/IAU)</h2>
        </div>
        <span className="text-[10px] font-mono text-slate-500">{etf?.goldEtfBias || '—'}</span>
      </div>
      {!etf?.live ? (
        <p className="text-xs font-mono text-slate-500">Waiting for Yahoo gold ETF prints…</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row) => (
            <div key={row.ticker} className="flex items-center justify-between text-[11px] font-mono border-b border-white/5 py-1">
              <span className="text-white font-bold w-12">{row.ticker}</span>
              <span className="text-slate-400 flex-1 truncate">{row.issuer}</span>
              <span className="text-slate-200 tabular-nums">${row.price}</span>
              <span className={`w-16 text-right ${row.priceChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {row.priceChange >= 0 ? '+' : ''}{row.priceChange}%
              </span>
              <span className={`w-16 text-right ${row.direction === 'inflow' ? 'text-emerald-400' : row.direction === 'outflow' ? 'text-rose-400' : 'text-slate-500'}`}>
                {row.direction}
              </span>
            </div>
          ))}
          <p className="text-[9px] font-mono text-slate-500 pt-1">{etf.note}</p>
        </div>
      )}
    </div>
  );
}
