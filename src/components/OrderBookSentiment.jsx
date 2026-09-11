import React from 'react';
import { Users, AlertOctagon, BarChart2, ShieldAlert, TrendingDown } from 'lucide-react';

export default function OrderBookSentiment({ retailData, currentGoldPrice }) {
  const data = retailData || {
    longPercentage: 76.4,
    shortPercentage: 23.6,
    contrarianSignal: 'EXTREME_LONG_RETAIL_TRAP',
    contrarianMessage: 'Retail crowd is heavily overleveraged at 76.4% Long. Institutional order flow desks frequently trigger aggressive stop hunts.',
    isExtremeLongTrap: true,
    isExtremeShortTrap: false,
    orderFlowHeatmap: []
  };

  const longPct = data.longPercentage || 75;
  const shortPct = data.shortPercentage || 25;

  return (
    <div className="hud-panel p-4 flex flex-col justify-between h-full">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gold-400" />
            <h2 className="font-mono font-bold text-xs tracking-wider text-slate-200 uppercase">
              Module G: Order Book Depth & Retail Sentiment Tracker
            </h2>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            Contrarian Sentiment Signal
          </span>
        </div>

        {/* Contrarian Retail Trap Alert Banner */}
        {data.isExtremeLongTrap && (
          <div className="bg-rose-950/40 border border-rose-600/50 p-2.5 rounded mb-3 flex items-start gap-2 text-rose-200 text-xs">
            <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <span className="font-mono font-bold text-rose-300 uppercase tracking-wide block">
                EXTREME LONG RETAIL TRAP DETECTED
              </span>
              <p className="text-[11px] leading-relaxed text-rose-200/80 mt-0.5">
                {data.contrarianMessage}
              </p>
            </div>
          </div>
        )}

        {/* Long / Short Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs font-mono mb-1 font-bold">
            <span className="text-emerald-400">Retail Long: {longPct}%</span>
            <span className="text-rose-400">Retail Short: {shortPct}%</span>
          </div>

          <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden flex border border-white/10 p-0.5">
            <div
              className="h-full bg-emerald-500 rounded-l transition-all duration-700"
              style={{ width: `${longPct}%` }}
            />
            <div
              className="h-full bg-rose-500 rounded-r transition-all duration-700"
              style={{ width: `${shortPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-1">
            <span>Crowd Long Concentration</span>
            <span className="text-gold-400">Fade Level: {longPct > 75 ? 'DANGER ZONE' : 'NORMAL'}</span>
            <span>Crowd Short</span>
          </div>
        </div>

        {/* Institutional Liquidity Depth & Supply-Demand Heatmap */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono font-bold text-slate-300 uppercase flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5 text-gold-400" />
              Institutional Liquidity Depth Heatmap
            </span>
            <span className="text-[10px] font-mono text-slate-500">Order Flow Proxy</span>
          </div>

          <div className="space-y-1.5 font-mono text-xs">
            {(data.orderFlowHeatmap || []).map((level, idx) => {
              const isSupply = level.type === 'ASK_SUPPLY_WALL';
              return (
                <div key={idx} className="bg-[#0b0e15] border border-white/5 p-2 rounded relative overflow-hidden">
                  {/* Background Depth Bar */}
                  <div
                    className={`absolute top-0 bottom-0 left-0 opacity-15 ${
                      isSupply ? 'bg-rose-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${level.intensity}%` }}
                  />

                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white tabular-nums">{level.label}</span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                        isSupply ? 'text-rose-400 bg-rose-950/60' : 'text-emerald-400 bg-emerald-950/60'
                      }`}>
                        {isSupply ? 'SUPPLY WALL' : 'DEMAND WALL'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="text-slate-400">
                        {level.institutionalLots?.toLocaleString()} Lots
                      </span>
                      <span className={`text-[9px] font-bold ${
                        level.significance === 'MAJOR_PSYCHOLOGICAL_HANDLE' ? 'text-gold-400' : 'text-slate-500'
                      }`}>
                        {level.significance === 'MAJOR_PSYCHOLOGICAL_HANDLE' ? '★ PSYCH HANDLE' : 'INTERMEDIATE'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer disclaimer */}
      <div className="mt-3 pt-2 border-t border-white/5 text-[9px] font-mono text-slate-500">
        Aggregated from retail sentiment pools & Institutional Depth Proxies.
      </div>
    </div>
  );
}
