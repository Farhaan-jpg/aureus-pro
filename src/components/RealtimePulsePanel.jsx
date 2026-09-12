import React from 'react';
import { Activity, BrainCircuit, TrendingUp, TrendingDown } from 'lucide-react';

const volTheme = {
  EXPANSION: 'text-rose-400 bg-rose-950/50 border-rose-600/40',
  SQUEEZE: 'text-cyan-400 bg-cyan-950/40 border-cyan-700/40',
  NORMAL: 'text-emerald-400 bg-emerald-950/40 border-emerald-700/40',
  null: 'text-slate-400 bg-slate-900 border-slate-700'
};

function Chip({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5 rounded bg-[#0b0e15] border border-white/5">
      <span className="text-[9px] font-mono text-slate-500 uppercase">{label}</span>
      <span className={`text-[10px] font-mono font-bold tabular-nums ${tone || 'text-slate-200'}`}>
        {value == null ? '—' : value}
      </span>
    </div>
  );
}

function CorrChip({ label, value, note }) {
  const tone = note ? 'text-rose-400' : value != null && value < -0.1 ? 'text-emerald-400' : 'text-slate-300';
  return (
    <div className="flex items-center justify-between px-2 py-1.5 rounded bg-[#0b0e15] border border-white/5">
      <span className="text-[9px] font-mono text-slate-500 uppercase">{label}</span>
      <span className={`text-[10px] font-mono font-bold tabular-nums ${tone}`}>
        {value == null ? '—' : value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2)}
      </span>
    </div>
  );
}

export default function RealtimePulsePanel({ pulse }) {
  const p = pulse || {};
  const rsi = p.rsi14;
  const rsiTone = rsi == null ? 'text-slate-200' : rsi >= 70 ? 'text-rose-400' : rsi <= 30 ? 'text-emerald-400' : 'text-slate-200';
  const div = p.divergence || {};
  const theme = volTheme[p.volState] || volTheme.null;

  return (
    <div className="hud-panel p-3.5 h-full flex flex-col">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-gold-500" />
          <h2 className="font-mono font-bold text-xs tracking-wider text-slate-200 uppercase">
            Module K: Realtime Pulse
          </h2>
        </div>
        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${p.live ? 'text-emerald-400 border-emerald-700/40 bg-emerald-950/30' : 'text-slate-500 border-slate-700 bg-slate-900'}`}>
          {p.live ? '5M LIVE' : `OFFLINE · ${p.bars ?? 0} BARS`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Chip label={`RSI(14) ${p.highSource || ''}`} value={rsi == null ? null : Number(rsi).toFixed(1)} tone={rsiTone} />
        <Chip label="ATR(14) $5m" value={p.atr14 == null ? null : `$${Number(p.atr14).toFixed(2)}`} />
        <Chip
          label="ATR percentile"
          value={p.atr14Percentile == null ? null : `${Math.round(p.atr14Percentile)}%`}
          tone={p.atr14Percentile != null ? (p.atr14Percentile >= 90 ? 'text-rose-400' : p.atr14Percentile >= 75 ? 'text-amber-400' : 'text-emerald-400') : undefined}
        />
        <div className="flex items-center justify-between px-2 py-1.5 rounded bg-[#0b0e15] border border-white/5">
          <span className="text-[9px] font-mono text-slate-500 uppercase">Vol state</span>
          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${theme}`}>
            {p.volState || '—'}
          </span>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-white/5">
        <span className="flex items-center gap-1.5 text-[9px] font-mono text-slate-500 uppercase mb-1.5">
          <BrainCircuit className="w-3 h-3" /> 5-Min Divergence Scan
        </span>
        <div className={`p-2 rounded border text-[10px] font-mono leading-relaxed ${div.type === 'BULLISH' ? 'text-emerald-400 border-emerald-700/40 bg-emerald-950/20' : div.type === 'BEARISH' ? 'text-rose-400 border-rose-700/40 bg-rose-950/20' : 'text-slate-500 border-white/5 bg-[#090b10]'}`}>
          {div.type === 'NONE' || !div.type
            ? 'No divergence structure building on the 5-minute tape.'
            : `${div.type} divergence: price ${div.priceLeg} vs momentum ${div.rsiLeg}. ${div.note || ''}`}
          {p.divergenceChanged && (
            <span className="block mt-1 text-[9px] uppercase text-amber-400">⚠ structure changed this bar</span>
          )}
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-white/5">
        <span className="flex items-center gap-1.5 text-[9px] font-mono text-slate-500 uppercase mb-1.5">
          <TrendingUp className="w-3 h-3" /> Intraday Correlations (20 vs 90 bars)
        </span>
        <div className="grid grid-cols-2 gap-2">
          <CorrChip label="Gold vs DXY 5m" value={p.corr?.goldDxy20} note={p.corr?.broken} />
          <CorrChip label="Gold vs SILVER 5m" value={p.corr?.goldSilver20} />
        </div>
        {p.corr?.broken && (
          <p className="mt-1.5 text-[9px] font-mono text-rose-400 leading-relaxed">
            ↑ {p.corr.brokenNote}
          </p>
        )}
      </div>

      <div className="mt-auto pt-2 text-[9px] font-mono text-slate-600">
        <span className="flex items-center gap-1.5">
          <TrendingDown className="w-3 h-3" />
          {p.builds ? `${p.builds.gold} gold · ${p.builds.dxy} dxy · ${p.builds.silver} silver 5m bars cached` : 'Series warming up…'}
        </span>
      </div>
    </div>
  );
}