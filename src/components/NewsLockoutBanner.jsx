import React, { useEffect, useState } from 'react';
import { AlarmClock, ShieldCheck } from 'lucide-react';

// Live countdown component for an active or pending lockout window.
function Countdown({ epochMs }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [epochMs]);
  const ms = Math.max(0, epochMs - now);
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export default function NewsLockoutBanner({ lockout }) {
  const [expanded, setExpanded] = useState(false);

  if (!lockout) return null;

  // Active silo window: release happened, price protection window [-5m, +1m] live.
  if (lockout.active && lockout.endMs) {
    return (
      <div className="hud-panel relative !border-pink-500/50 bg-pink-950/40 px-3 py-2.5 flex items-center gap-3 cursor-pointer select-none" onClick={() => setExpanded(v => !v)}>
        <div className="p-1.5 rounded-lg bg-pink-500/20 border border-pink-500/40 text-pink-300">
          <AlarmClock className="w-4 h-4 animate-pulse" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-mono font-bold text-pink-200 uppercase tracking-wider block leading-none">
            News Lockout Active — <span className="text-pink-100">{lockout.eventTitle || 'High-Impact Release'}</span>
          </div>
          <div className="text-[10px] font-mono text-pink-300/80 mt-0.5">
            Siren engine & breakout alerts suppressed while the auction digests the print.
          </div>
        </div>
        <div className="text-xs font-mono font-bold text-pink-100 tabular-nums whitespace-nowrap">
          <Countdown epochMs={lockout.endMs} />
        </div>
        <span className="text-pink-300 font-mono text-[10px]">{expanded ? '▾' : '▸'}</span>
        {expanded && (
          <div className="absolute inset-x-0 top-full mt-1 mx-3 rounded-lg bg-[#0c0e15] border border-pink-500/30 p-2.5 text-[10px] font-mono text-pink-200/80 z-10 shadow-xl shadow-black/60">
            Releases within the lockout horizon: <span className="text-white">{lockout.calendarSnippet || lockout.eventTitle}</span>
          </div>
        )}
      </div>
    );
  }

  // Pending: a high-impact event is approaching inside the warning horizon (~15m).
  if (!lockout.active && lockout.pending && lockout.startMs) {
    return (
      <div className="hud-panel border-amber-500/30 bg-amber-950/30 px-3 py-2.5 flex items-center gap-3">
        <div className="p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300">
          <AlarmClock className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-mono font-bold text-amber-200 uppercase tracking-wider block leading-none">
            High-Impact Release Approaching
          </div>
          <div className="text-[10px] font-mono text-amber-300/70 mt-0.5 truncate">
            {lockout.eventTitle || 'Red-folder event'} — lockout window opens at release.
          </div>
        </div>
        <div className="text-xs font-mono font-bold text-amber-200 tabular-nums whitespace-nowrap">
          T-<Countdown epochMs={lockout.startMs} />
        </div>
      </div>
    );
  }

  // Idle: guarded, no high-impact window in the horizon.
  return (
    <div className="hud-panel px-3 py-2 flex items-center gap-3">
      <div className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-500">
        <ShieldCheck className="w-4 h-4" />
      </div>
      <div className="text-[11px] font-mono text-slate-500">
        News lockout guard armed — <span className="text-slate-300">no high-impact window</span> in the 80-minute horizon.
      </div>
    </div>
  );
}