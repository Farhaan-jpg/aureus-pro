import React from 'react';
import { Crosshair, AlertTriangle, ShieldAlert, Clock, Activity } from 'lucide-react';

const RISK_META = {
  NONE: { label: 'RISK OFF: NO', cls: 'text-emerald-300 border-emerald-500/30 bg-emerald-950/40' },
  CAUTION: { label: 'RISK OFF: CAUTION', cls: 'text-amber-300 border-amber-500/30 bg-amber-950/40' },
  ADVISORY: { label: 'RISK OFF: ADVISORY', cls: 'text-rose-300 border-rose-500/40 bg-rose-950/50 animate-pulse' }
};

export default function NowcastPanel({ thesis, riskOff }) {
  const stance = thesis?.stance?.label || 'NEUTRAL';
  const score = thesis?.stance?.score;
  const stanceCls =
    stance === 'BUY' || stance === 'STRONG BUY'
      ? 'text-emerald-300 border-emerald-500/40 bg-emerald-950/40'
      : stance === 'SELL' || stance === 'STRONG SELL'
        ? 'text-rose-300 border-rose-500/40 bg-rose-950/40'
        : 'text-slate-300 border-white/15 bg-white/5';

  const risk = (riskOff && riskOff.level) ? riskOff.level : 'NONE';
  const riskMeta = RISK_META[risk] || RISK_META.NONE;

  const nextRelease = thesis?.nextRelease;
  const nearestLevel = thesis?.nearestLevel;
  const pulseNotes = thesis?.pulse?.notes && thesis.pulse.notes.length ? thesis.pulse.notes : null;

  return (
    <div className="hud-panel p-3 sm:p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gold-500/10 border border-gold-500/30 text-gold-400">
            <Crosshair className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-white uppercase tracking-wider block leading-none">NowCast Thesis</span>
            <span className="text-[10px] font-mono text-slate-500">Composite + Live Pulse</span>
          </div>
        </div>
        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${riskMeta.cls}`}>
          {riskMeta.label}
        </span>
      </div>

      {thesis ? (
        <>
          <div className="text-sm sm:text-base font-bold text-white leading-snug">
            {thesis.headline || 'Composite nowcast assembled.'}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${stanceCls}`}>
              {stance}
            </span>
            {typeof score === 'number' && (
              <span className="text-[10px] font-mono text-slate-300 px-2 py-0.5 rounded bg-white/5 border border-white/10">
                SCORE {score}
              </span>
            )}
            {thesis.newsLockout && (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border text-pink-300 border-pink-500/40 bg-pink-950/40">
                LIVE EVENT LOCKOUT
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] font-mono">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-white/5 border border-white/5">
              <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-slate-400">Pulse:</span>
              <span className="text-slate-200 truncate">{thesis.pulseLabel || thesis.pulse?.live ? 'LIVE' : 'warming up'}</span>
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-white/5 border border-white/5">
              <Crosshair className="w-3.5 h-3.5 text-gold-400 shrink-0" />
              <span className="text-slate-400">Nearest level:</span>
              <span className="text-slate-200">
                {nearestLevel ? `${nearestLevel.name} $${Number(nearestLevel.price).toFixed(2)}` : '—'}
              </span>
            </div>
          </div>

          {nextRelease && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-white/5 border border-white/5 text-[11px] font-mono">
              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-slate-400">Next release:</span>
              <span className="text-amber-200">{nextRelease.title}</span>
              <span className="text-slate-500 ml-auto">{nextRelease.inMinutes >= 1 ? `T-${nextRelease.inMinutes}m` : 'RELEASING NOW'}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {pulseNotes
              ? pulseNotes.map((n, i) => (
                  <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                    {n}
                  </span>
                ))
              : <span className="text-[10px] font-mono text-slate-600 animate-pulse">pulse warming up…</span>}
          </div>

          {risk === 'ADVISORY' && (
            <div className="flex items-start gap-2 px-2.5 py-2 rounded bg-rose-950/50 border border-rose-500/40 text-[11px] font-mono text-rose-200">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>
                Gold is in a risk-off regime — volatility and flow pressure are elevated. Flatten scalping exposure and defend with wider stops.
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="text-[11px] font-mono text-slate-500 animate-pulse">
          Assembling nowcast thesis from composite channels and live pulse…
        </div>
      )}

      {!nextRelease && thesis && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-white/5 border border-white/5 text-[11px] font-mono text-slate-400">
          <AlertTriangle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          No high-impact releases in the 8-hour forecast horizon.
        </div>
      )}
    </div>
  );
}