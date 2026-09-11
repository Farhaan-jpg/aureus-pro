import React from 'react';
import { Users, AlertOctagon, BarChart2 } from 'lucide-react';

export default function OrderBookSentiment({ retailData, currentGoldPrice }) {
  const data = retailData || {};
  const longPct = data.longPercentage;
  const shortPct = data.shortPercentage;
  const hasSplit = longPct != null && shortPct != null;

  return (
    <div className="hud-panel p-4 flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gold-400" />
            <h2 className="font-mono font-bold text-xs tracking-wider text-slate-200 uppercase">
              Spec positioning & round-number map
            </h2>
          </div>
          <span className="text-[10px] font-mono text-slate-400">{data.source || 'unavailable'}</span>
        </div>

        {data.isExtremeLongTrap && (
          <div className="bg-rose-950/40 border border-rose-600/50 p-2.5 rounded mb-3 flex items-start gap-2 text-rose-200 text-xs">
            <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">{data.contrarianMessage}</p>
          </div>
        )}

        {hasSplit ? (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs font-mono mb-1 font-bold">
              <span className="text-emerald-400">Small-trader long: {longPct}%</span>
              <span className="text-rose-400">Short: {shortPct}%</span>
            </div>
            <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden flex border border-white/10 p-0.5">
              <div className="h-full bg-emerald-500 rounded-l" style={{ width: `${longPct}%` }} />
              <div className="h-full bg-rose-500 rounded-r" style={{ width: `${shortPct}%` }} />
            </div>
            <p className="text-[10px] font-mono text-slate-500 mt-1">{data.contrarianMessage}</p>
          </div>
        ) : (
          <p className="text-xs font-mono text-slate-500 mb-3">{data.contrarianMessage}</p>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono font-bold text-slate-300 uppercase flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5 text-gold-400" />
              Distance to round handles
            </span>
            <span className="text-[10px] font-mono text-slate-500">Not a live order book</span>
          </div>
          <div className="space-y-1.5 font-mono text-xs">
            {(data.orderFlowHeatmap || []).map((level) => {
              const isSupply = level.type === 'ASK_SUPPLY_WALL';
              return (
                <div key={level.price} className="bg-[#0b0e15] border border-white/5 p-2 rounded relative overflow-hidden">
                  <div className={`absolute top-0 bottom-0 left-0 opacity-15 ${isSupply ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${level.intensity}%` }} />
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white tabular-nums">{level.label}</span>
                      <span className={`text-[9px] px-1.5 rounded ${isSupply ? 'text-rose-400 bg-rose-950/60' : 'text-emerald-400 bg-emerald-950/60'}`}>
                        {isSupply ? 'ABOVE' : 'BELOW'}
                      </span>
                    </div>
                    <span className="text-slate-400">{level.distance} pts</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-3 pt-2 border-t border-white/5 text-[9px] font-mono text-slate-500">
        Spot {currentGoldPrice != null ? `$${Number(currentGoldPrice).toFixed(2)}` : '—'}. Weekly CFTC small traders, not MyFXBook/IG live retail.
      </div>
    </div>
  );
}
