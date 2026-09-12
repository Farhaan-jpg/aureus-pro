import React from 'react';
import { Waves, Gauge, Link2, Timer } from 'lucide-react';

const regimeTheme = {
  HIGH: 'text-rose-400 bg-rose-950/50 border-rose-600/40',
  ELEVATED: 'text-amber-400 bg-amber-950/40 border-amber-600/40',
  MODERATE: 'text-emerald-400 bg-emerald-950/40 border-emerald-700/40',
  LOW: 'text-cyan-400 bg-cyan-950/40 border-cyan-700/40',
  UNKNOWN: 'text-slate-400 bg-slate-900 border-slate-700'
};

function Bar({ label, value, color }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] font-mono mb-0.5">
        <span className="text-slate-400">{label}</span>
        <span className="font-bold text-slate-200 tabular-nums">{value == null ? '—' : `${pct.toFixed(0)}%`}</span>
      </div>
      <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/5">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CorrChip({ label, value, healthy }) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5 rounded bg-[#0b0e15] border border-white/5">
      <div>
        <span className="text-[9px] font-mono text-slate-500 uppercase block">{label}</span>
        <span className={`text-[10px] font-mono font-bold ${healthy ? 'text-emerald-400' : 'text-slate-300'}`}>
          {value == null ? '—' : value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2)}
        </span>
      </div>
      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${healthy ? 'text-emerald-400 border-emerald-700/40 bg-emerald-950/30' : 'text-amber-400 border-amber-700/40 bg-amber-950/30'}`}>
        {value == null ? '—' : value < -0.4 ? 'INVERSE' : value < 0 ? 'WEAK' : 'BROKEN'}
      </span>
    </div>
  );
}

export default function VolatilityRegimePanel({ marketData }) {
  const vreg = marketData?.volatilityRegime || {};
  const corr = marketData?.longCorrelations || {};
  const theme = regimeTheme[vreg.regime] || regimeTheme.UNKNOWN;

  return (
    <div className="hud-panel p-3.5 h-full flex flex-col">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Waves className="w-4 h-4 text-cyan-400" />
          <h2 className="font-mono font-bold text-xs tracking-wider text-slate-200 uppercase">
            Module J: Volatility & Correlation Regime
          </h2>
        </div>
        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${theme}`}>
          {vreg.regime || 'UNKNOWN'}
        </span>
      </div>

      {/* ATR + realized vol percentiles */}
      <div className="space-y-2">
        <Bar label={`ATR(14) $${vreg.atr14 ?? '—'} — Vol percentile`} value={vreg.atr14Percentile} color="bg-cyan-400" />
        <Bar label={`Realized Vol 30d ${vreg.realizedVol30 ?? '—'}% (ann.) — percentile`} value={vreg.realizedVolPercentile} color="bg-blue-400" />
      </div>

      <div className="mt-2 p-2 rounded bg-[#090b10] border border-white/5 text-[10px] font-mono text-slate-400 leading-relaxed">
        {vreg.recommendation || 'Volatility model warming up — data pending.'}
      </div>

      <div className="mt-2 pt-2 border-t border-white/5">
        <span className="flex items-center gap-1.5 text-[9px] font-mono text-slate-500 uppercase mb-1.5">
          <Link2 className="w-3 h-3" /> Structural Correlations (60-day daily)
        </span>
        <div className="grid grid-cols-2 gap-2">
          <CorrChip label="Gold vs DXY" value={corr.goldDxy} healthy={corr.goldDxy != null && corr.goldDxy < 0} />
          <CorrChip label="Gold vs US10Y" value={corr.goldUs10y} healthy={corr.goldUs10y != null && corr.goldUs10y < 0} />
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-slate-500">
        <span className="flex items-center gap-1">
          <Timer className="w-3 h-3" />
          {vreg.lastUpdated ? `Updated ${new Date(vreg.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC` : 'pending'}
        </span>
        <span className="flex items-center gap-1">
          <Gauge className="w-3 h-3" />
          {corr.goldDxyRegime !== 'UNKNOWN' ? `DXY ${corr.goldDxyRegime} · YLD ${corr.goldUs10yRegime}` : '—'}
        </span>
      </div>
    </div>
  );
}