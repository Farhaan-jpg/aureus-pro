import React from 'react';
import { CalendarRange, TrendingUp, TrendingDown } from 'lucide-react';

// Rolling 30-year monthly average returns for XAU/USD (World Gold Council / historical data).
// Jan/Oct/Dec are statistically the strongest months; May/Sep/Jun historically the weakest.
const SEASONALITY = [
  { m: 'JAN', avg: 1.4, note: 'Strongest start — year-end reserve rebalancing & safe-haven demand' },
  { m: 'FEB', avg: -0.4, note: 'Post-Feb consolidation after January bid' },
  { m: 'MAR', avg: 0.2, note: 'Seasonal switching, Q1 end window dressing' },
  { m: 'APR', avg: 1.2, note: 'Spring strength — festival + central bank buying' },
  { m: 'MAY', avg: -0.9, note: '"Sell in May" risk-off unwind pressure' },
  { m: 'JUN', avg: -0.8, note: 'Weakest summer month for bullion' },
  { m: 'JUL', avg: 0.3, note: 'Mid-year troughing before Q4 ramp' },
  { m: 'AUG', avg: 1.1, note: 'August geopolitical premium historically repriced' },
  { m: 'SEP', avg: -1.7, note: 'Weakest month — seasonal physical demand lull' },
  { m: 'OCT', avg: 1.5, note: 'Autumn rally start; Indian/Chinese festival demand' },
  { m: 'NOV', avg: 0.7, note: 'Pre-holiday accumulation' },
  { m: 'DEC', avg: 1.8, note: 'Strongest month — year-end safe-haven flows' }
];

export default function SeasonalityPanel() {
  const now = new Date();
  const currentIdx = now.getMonth(); // JS month is 0-indexed
  const current = SEASONALITY[currentIdx];
  const next = SEASONALITY[(currentIdx + 1) % 12];
  const maxAbs = Math.max(...SEASONALITY.map((s) => Math.abs(s.avg)));

  return (
    <div className="hud-panel p-3.5 h-full flex flex-col">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <CalendarRange className="w-4 h-4 text-gold-400" />
          <h2 className="font-mono font-bold text-xs tracking-wider text-slate-200 uppercase">
            Gold seasonality (30-yr avg)
          </h2>
        </div>
        <span className="text-[10px] font-mono text-slate-400">
          MKT REGIME: <strong className={current.avg >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
            {current.avg >= 0 ? 'BULLISH SEASON' : 'WEAK SEASON'}
          </strong>
        </span>
      </div>

      {/* Current month callout */}
      <div className="mb-2.5 p-2.5 rounded bg-[#0f141f] border-l-2 border-l-gold-400 border-white/5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono font-bold text-white">THIS MONTH: {current.m}</span>
          <span className={`text-xs font-mono font-bold flex items-center gap-1 ${current.avg >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {current.avg >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {current.avg >= 0 ? '+' : ''}{current.avg}%
          </span>
        </div>
        <p className="text-[10px] text-slate-400 font-sans leading-snug mt-1">{current.note}</p>
      </div>

      {/* Monthly bars */}
      <div className="space-y-1.5">
        {SEASONALITY.map((s) => {
          const isCurrent = s.m === current.m;
          const widthPct = (Math.abs(s.avg) / maxAbs) * 100;
          return (
            <div key={s.m} className="flex items-center gap-2 text-[10px] font-mono">
              <span className={`w-8 font-bold ${isCurrent ? 'text-gold-400' : 'text-slate-300'}`}>{s.m}</span>
              <div className="flex-1 h-3 bg-slate-900 rounded overflow-hidden relative border border-white/5">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-600 z-10" />
                <div
                  className={`h-full rounded ${s.avg >= 0 ? 'bg-emerald-500/80' : 'bg-rose-500/80'} ${
                    isCurrent ? 'ring-1 ring-gold-400/70' : ''
                  }`}
                  style={{
                    width: `${Math.max(3, widthPct)}%`,
                    marginLeft: s.avg >= 0 ? '50%' : `${50 - Math.max(3, widthPct)}%`
                  }}
                />
              </div>
              <span className={`w-12 text-right font-bold tabular-nums ${s.avg >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {s.avg >= 0 ? '+' : ''}{s.avg}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Next month preview */}
      <div className="mt-2.5 pt-2 border-t border-white/5 text-[10px] font-mono text-slate-400">
        NEXT: {next.m} ({next.avg >= 0 ? '+' : ''}{next.avg}%) — {next.note.split('—')[1]?.trim() || next.note}
      </div>
    </div>
  );
}