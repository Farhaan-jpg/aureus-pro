import React from 'react';
import { Crosshair, TrendingUp, TrendingDown, Ruler } from 'lucide-react';

function Level({ label, value, extra }) {
  return (
    <div className="flex items-center justify-between px-2 py-1 rounded bg-[#0b0e15] border border-white/5">
      <span className="text-[9px] font-mono text-slate-500 uppercase">{label}</span>
      <span className="text-[11px] font-mono font-bold text-white tabular-nums">
        {value == null ? '—' : `$${Number(value).toFixed(0)}`}
        {extra && <span className="text-slate-500 font-normal ml-1">{extra}</span>}
      </span>
    </div>
  );
}

function PivotRow({ name, value, hi }) {
  return (
    <div className={`flex items-center justify-between px-2 py-0.5 rounded font-mono ${hi ? 'bg-white/5 border border-white/10' : ''}`}>
      <span className="text-[9px] text-slate-500">{name}</span>
      <span className="text-[10px] font-bold tabular-nums text-slate-200">
        {value == null ? '—' : `$${Number(value).toFixed(0)}`}
      </span>
    </div>
  );
}

export default function KeyLevelsPanel({ marketData }) {
  const levels = marketData?.keyLevels?.levels || {};
  const current = marketData?.keyLevels?.current || {};
  const currentPrice = marketData?.goldSpot?.price;

  const referencesUp = [
    { name: 'R2', v: levels.pivots?.r2 },
    { name: 'R1', v: levels.pivots?.r1 },
    { name: 'PDH', v: levels.pdh },
    { name: 'PWH', v: levels.pwh }
  ].filter((x) => x.v != null && (currentPrice == null || x.v > currentPrice));
  const referencesDown = [
    { name: 'S1', v: levels.pivots?.s1 },
    { name: 'S2', v: levels.pivots?.s2 },
    { name: 'PDL', v: levels.pdl },
    { name: 'PWL', v: levels.pwl }
  ].filter((x) => x.v != null && (currentPrice == null || x.v < currentPrice));

  const nearestRes = referencesUp.length ? referencesUp.reduce((a, b) => (a.v < b.v ? a : b)) : null;
  const nearestSup = referencesDown.length ? referencesDown.reduce((a, b) => (a.v > b.v ? a : b)) : null;

  const straddled = currentPrice != null && (levels.pdh != null ? currentPrice > levels.pdh : false) && (levels.pwh != null ? currentPrice > levels.pwh : false);

  return (
    <div className="hud-panel p-3.5 h-full flex flex-col">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-gold-400" />
          <h2 className="font-mono font-bold text-xs tracking-wider text-slate-200 uppercase">
            Module I: Key Levels & Price Structure
          </h2>
        </div>
        <span className="text-[10px] font-mono text-slate-500">
          {straddled ? (
            <span className="text-emerald-400 font-bold">DAILY+WEEKLY BREAKOUT</span>
          ) : nearestRes || nearestSup ? (
            <span className="text-cyan-400 font-bold">INSIDE RANGE</span>
          ) : '—'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 min-h-0">
        {/* Previous session & day */}
        <div className="space-y-1.5">
          <span className="text-[9px] font-mono text-slate-500 uppercase block">Prev Day</span>
          <Level label="Day High" value={levels.pdh} />
          <Level label="Day Low" value={levels.pdl} />
          <Level label="Open" value={levels.pcOpen} />
          <Level label="Close" value={levels.pcClose} />
        </div>
        {/* Previous week */}
        <div className="space-y-1.5">
          <span className="text-[9px] font-mono text-slate-500 uppercase block">Prev Week</span>
          <Level label="Week High" value={levels.pwh} />
          <Level label="Week Low" value={levels.pwl} />
          <Level label="Open" value={levels.pwOpen} />
          <Level label="Close" value={levels.pwClose} />
        </div>
        {/* Floor pivots */}
        <div className="space-y-0.5">
          <span className="text-[9px] font-mono text-slate-500 uppercase block mb-1">Pivot Engine</span>
          <PivotRow name="R2" value={levels.pivots?.r2} />
          <PivotRow name="R1" value={levels.pivots?.r1} hi={nearestRes?.name === 'R1'} />
          <PivotRow name="P" value={levels.pivots?.p} />
          <PivotRow name="S1" value={levels.pivots?.s1} hi={nearestSup?.name === 'S1'} />
          <PivotRow name="S2" value={levels.pivots?.s2} />
        </div>
        {/* Market positioning */}
        <div className="space-y-1.5">
          <span className="text-[9px] font-mono text-slate-500 uppercase block">Positioning</span>
          <div className="px-2 py-1 rounded bg-[#0b0e15] border border-white/5 flex items-center justify-between">
            <span className="text-[9px] font-mono text-slate-500 uppercase">Spot</span>
            <span className="text-[11px] font-mono font-bold text-gold-400 tabular-nums">
              {currentPrice == null ? '—' : `$${Number(currentPrice).toFixed(2)}`}
            </span>
          </div>
          <Level label="Day High (live)" value={current.high} />
          <Level label="Day Low (live)" value={current.low} />
          <div className="px-2 py-1 rounded bg-[#0b0e15] border border-white/5">
            <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
              <span>Nearest Res</span>
              <span className="text-slate-200 tabular-nums font-bold">
                {nearestRes ? `$${Number(nearestRes.v).toFixed(0)} (${nearestRes.name})` : 'NONE'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 mt-0.5">
              <span>Nearest Sup</span>
              <span className="text-slate-200 tabular-nums font-bold">
                {nearestSup ? `$${Number(nearestSup.v).toFixed(0)} (${nearestSup.name})` : 'NONE'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Swing structure strip */}
      <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-slate-400">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1 text-emerald-400">
            <TrendingUp className="w-3 h-3" />
            Swing High {levels.swingHighs?.length ? `$${Number(levels.swingHighs[levels.swingHighs.length - 1].price).toFixed(0)}` : '—'}
          </span>
          <span className="flex items-center gap-1 text-rose-400">
            <TrendingDown className="w-3 h-3" />
            Swing Low {levels.swingLows?.length ? `$${Number(levels.swingLows[levels.swingLows.length - 1].price).toFixed(0)}` : '—'}
          </span>
        </div>
        <span className="flex items-center gap-1 text-slate-500">
          <Ruler className="w-3 h-3" />
          GC=F daily/weekly pivots
        </span>
      </div>
    </div>
  );
}