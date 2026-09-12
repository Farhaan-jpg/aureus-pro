import { CalendarClock } from 'lucide-react';

export default function SessionRecapPanel({ recap }) {
  if (!recap || !recap.summaryText) return null;

  const dirColor =
    recap.direction === 'UP' ? 'text-emerald-400'
    : recap.direction === 'DOWN' ? 'text-rose-400'
    : 'text-slate-300';

  const parts = recap.summaryText.split(' · ');

  return (
    <div className="p-3.5 rounded-lg bg-slate-950/60 border border-indigo-500/20 anim-panel">
      <div className="flex items-center gap-2 mb-2">
        <CalendarClock className="w-4 h-4 text-indigo-400 shrink-0" />
        <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest">
          Session Recap — {recap.session}
        </span>
        <span className="ml-auto text-[10px] font-mono text-slate-500">
          {new Date(recap.asOf).toLocaleTimeString()}
        </span>
      </div>

      <div className="space-y-1">
        {parts.map((p, i) => {
          const isPrice = p.startsWith('XAU/USD');
          return (
            <p key={i} className={`text-[11px] font-mono leading-relaxed ${isPrice ? 'text-slate-100' : 'text-slate-400'}`}>
              {isPrice && recap.direction !== '—' ? (
                <>
                  XAU/USD <span className={`font-bold ${dirColor}`}>{recap.direction}</span>{' '}
                  <span className={dirColor}>{recap.changePercent > 0 ? '+' : ''}{recap.changePercent}%</span>
                  {' '}from ${recap.prevClose?.toFixed(2)} to <span className="text-white font-bold">${recap.price?.toFixed(2)}</span>
                </>
              ) : p}
            </p>
          );
        })}
      </div>
    </div>
  );
}