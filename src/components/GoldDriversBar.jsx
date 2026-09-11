import React from 'react';
import { Activity, AlertTriangle } from 'lucide-react';

function Chip({ label, value, sub, tone = 'slate' }) {
  const tones = {
    slate: 'text-slate-200',
    up: 'text-emerald-400',
    down: 'text-rose-400',
    warn: 'text-amber-400'
  };
  return (
    <div className="px-2.5 py-1.5 rounded bg-[#0e121d] border border-white/5 min-w-[110px]">
      <div className="text-[9px] font-mono text-slate-500 tracking-wider uppercase">{label}</div>
      <div className={`text-sm font-mono font-bold tabular-nums ${tones[tone]}`}>{value}</div>
      {sub ? <div className="text-[9px] font-mono text-slate-500">{sub}</div> : null}
    </div>
  );
}

export default function GoldDriversBar({ marketData, etf, geo }) {
  const assets = marketData?.assets || {};
  const dxy = assets.DXY;
  const vix = assets.VIX;
  const jpy = assets.USDJPY;
  const real = marketData?.realYield10Y;
  const gsr = marketData?.gsr;
  const stale = marketData?.dataHealth?.stale;
  const goldAge = marketData?.dataHealth?.goldAgeMs;

  const pctTone = (p) => (p == null ? 'slate' : p >= 0 ? 'up' : 'down');
  const fmt = (v, d = 2) => (v == null ? '—' : Number(v).toFixed(d));
  const fmtPct = (v) => (v == null ? '' : `${v > 0 ? '+' : ''}${Number(v).toFixed(2)}%`);

  return (
    <div className="hud-panel p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 pr-2 mr-1 border-r border-white/10">
          <Activity className="w-3.5 h-3.5 text-gold-400" />
          <span className="font-mono text-[10px] tracking-wider text-slate-300 uppercase">Gold drivers</span>
        </div>
        <Chip label="DXY" value={fmt(dxy?.price, 3)} sub={fmtPct(dxy?.changePercent)} tone={dxy?.changePercent != null ? (dxy.changePercent > 0 ? 'down' : 'up') : 'slate'} />
        <Chip label="Real 10Y" value={real == null ? '—' : `${fmt(real, 2)}%`} sub={marketData?.breakeven10Y != null ? `BEI ${fmt(marketData.breakeven10Y, 2)}%` : 'FRED + TNX'} tone={real != null && real > 2 ? 'down' : 'up'} />
        <Chip label="USDJPY" value={fmt(jpy?.price, 3)} sub={fmtPct(jpy?.changePercent)} tone={pctTone(jpy?.changePercent)} />
        <Chip label="VIX" value={fmt(vix?.price, 2)} sub={fmtPct(vix?.changePercent)} tone={vix?.price >= 20 ? 'warn' : 'slate'} />
        <Chip label="GSR" value={fmt(gsr, 1)} sub="Gold / Silver" />
        <Chip label="Gold ETFs" value={etf?.goldEtfBias || '—'} sub={etf?.live ? `${etf.inflowCount} in / ${etf.outflowCount} out` : 'loading'} tone={etf?.goldEtfBias === 'INFLOW' ? 'up' : etf?.goldEtfBias === 'OUTFLOW' ? 'down' : 'slate'} />
        <Chip label="Geo risk" value={geo?.live ? `${geo.score} ${geo.level}` : '—'} sub={geo?.live ? `${geo.articleCount} GDELT 24h` : 'GDELT'} tone={geo?.score >= 50 ? 'warn' : 'slate'} />
        <div className={`ml-auto px-2 py-1 rounded border font-mono text-[10px] ${stale ? 'border-amber-500/40 text-amber-300 bg-amber-950/30' : 'border-emerald-500/30 text-emerald-400 bg-emerald-950/20'}`}>
          {stale ? (
            <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Gold feed stale{goldAge ? ` ${Math.round(goldAge / 1000)}s` : ''}</span>
          ) : (
            <span>LIVE {marketData?.dataHealth?.goldSource || ''}</span>
          )}
        </div>
      </div>
    </div>
  );
}
