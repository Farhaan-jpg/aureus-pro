import React, { useEffect, useState } from 'react';
import { Activity, Wifi, WifiOff, Database, Clock, Shuffle, Target } from 'lucide-react';

// Bias accuracy is measured server-side from persisted snapshots; this block
// polls it so the feedback loop is visible where the operator already looks.
const HORIZONS = [60, 240, 1440];
function useBiasAccuracy() {
  const [agg, setAgg] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const entries = await Promise.all(HORIZONS.map(async (m) => {
          const r = await fetch(`/api/bias-accuracy?horizonMinutes=${m}`);
          return [m, await r.json()];
        }));
        if (!cancelled) setAgg(Object.fromEntries(entries));
      } catch (err) {}
    };
    load();
    const t = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);
  return agg;
}

function pct(x) {
  if (x == null || (!Number.isFinite(x) && x !== 0)) return '—';
  return `${Math.round(x * 100)}%`;
}

function Freshness({ label, live, detail, kind = 'green' }) {
  const color = kind === 'warn' ? 'text-amber-400' : live ? 'text-emerald-400' : 'text-rose-400';
  return (
    <div className="flex items-center justify-between w-full text-[10px] font-mono border-b border-white/5 py-1.5 last:border-0">
      <span className="text-slate-400">{label}</span>
      <span className={`flex items-center gap-1.5 ${color}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${kind === 'warn' ? 'bg-amber-400 animate-pulse' : live ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
        <span className="font-bold">{kind === 'warn' ? 'FALLBACK' : live ? 'LIVE' : 'STALE'}</span>
        {detail && <span className="text-slate-500 hidden sm:inline">{detail}</span>}
      </span>
    </div>
  );
}

function ageLabel(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '— now';
  if (mins < 60) return `— ${mins}m`;
  return `— ${(mins / 60).toFixed(1)}h`;
}

export default function DataHealthMonitor({ marketData, geo, etf, timeframes, calendar, news }) {
  const dh = marketData?.dataHealth || {};
  const goldAge = dh.goldAgeMs;
  const marketOpen = marketData?.marketState?.open !== false;
  const newsFresh = news?.length && news[0]?.pubDate ? ageLabel(news[0].pubDate) : '';
  const calCount = calendar?.events?.length ?? 0;
  const accuracy = useBiasAccuracy();
  const totalResolved = accuracy ? Object.values(accuracy).reduce((a, h) => a + (h?.overall?.resolved ?? 0), 0) : 0;

  const rowCls = "bg-[#0b0e15] border rounded p-2 flex flex-col gap-1";
  const labelCls = "text-[9px] font-mono text-slate-500 uppercase";
  const valCls = "text-[11px] font-mono font-bold tabular-nums";

  return (
    <div className="hud-panel p-3.5 h-full flex flex-col">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h2 className="font-mono font-bold text-xs tracking-wider text-slate-200 uppercase">Feed health monitor</h2>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-mono">
          <Wifi className="w-3 h-3 text-emerald-400" />
          <span className="text-emerald-400 font-bold">SSE</span>
          <Clock className="w-3 h-3 text-slate-500 ml-2" />
          <span className="text-slate-400">
            {goldAge == null ? '—' : goldAge < 30000 ? `${(goldAge / 1000).toFixed(0)}s` : `${(goldAge / 60000).toFixed(1)}m`}
          </span>
        </div>
      </div>

      {/* Core health summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
        <div className={rowCls}>
          <span className={labelCls}>Gold source</span>
          <span className={`${valCls} ${dh.goldSource && dh.goldSource !== 'unavailable' ? 'text-emerald-400' : 'text-rose-400'}`}>
            {dh.goldSource || '—'}
          </span>
        </div>
        <div className={rowCls}>
          <span className={labelCls}>TV websocket</span>
          <span className={`${valCls} flex items-center gap-1 ${dh.tvWs ? 'text-emerald-400' : 'text-rose-400'}`}>
            {dh.tvWs ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {dh.tvWs ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>
        <div className={`${rowCls} sm:col-span-1 col-span-2`}>
          <span className={labelCls}>Data staleness</span>
          <span className={`${valCls} ${!dh.stale ? 'text-emerald-400' : 'text-amber-400'}`}>
            {goldAge == null ? 'NO DATA' : dh.stale ? 'STALE > 30s' : 'FRESH'}
          </span>
        </div>
        <div className={`${rowCls} sm:col-span-1 col-span-2`}>
          <span className={labelCls}>Price cross-check</span>
          <span className={`${valCls} flex items-center gap-1 ${
            marketOpen
              ? (dh.priceCheck?.sources >= 2 ? (dh.priceCheck?.discrepancy ? 'text-amber-400' : 'text-emerald-400') : 'text-slate-500')
              : 'text-slate-500'
          }`}>
            <Shuffle className="w-3 h-3" />
            {dh.priceCheck?.sources ?? 0} src · spread {dh.priceCheck?.spread == null ? '?' : `$${dh.priceCheck.spread.toFixed(2)}`}
            {marketOpen && dh.priceCheck?.discrepancy ? ' ⚠' : ''}
            {!marketOpen ? ' · CLOSED' : ''}
          </span>
        </div>
      </div>

      {/* Per-source freshness checklist */}
      <div className="bg-[#090b10] border border-white/5 rounded p-2">
        <Freshness label="TradingView WS ticks (XAU/DXY/SILVER)" live={Boolean(dh.tvWs)} />
        <Freshness label="Yahoo Finance fallback quotes" live={Boolean(dh.goldSource && dh.goldSource !== 'unavailable')} />
        <Freshness label="FRED real yields (DGS10 − T10YIE)" live={marketData?.realYield10Y != null} detail={marketData?.realYield10Y != null ? `${marketData.realYield10Y}%` : 'unavailable'} />
        <Freshness label={geo?.source === 'rss-fallback' ? 'GEO RISK (RSS fallback)' : 'GDELT geopolitics'} live={Boolean(geo?.live)} detail={`${geo?.source || 'none'}${geo?.lastUpdated ? ' · ' + ageLabel(geo?.lastUpdated) : ''}`} />
        <Freshness label="Gold ETF flows (GLD/IAU/GLDM/SGOL)" live={Boolean(etf?.live)} detail={ageLabel(etf?.lastUpdated)} />
        <Freshness label="Multi-TF matrix (GC=F)" live={Boolean(timeframes?.live)} detail={ageLabel(timeframes?.lastUpdated)} />
        <Freshness label="News RSS (5 sources)" live={news?.length > 0} detail={newsFresh} />
        <Freshness label="Economic calendar" live={calCount > 0} kind={calendar?.feedSource === 'benchmark' ? 'warn' : 'green'} detail={`${calCount} events · ${calendar?.feedSource === 'forexfactory' ? 'FF live' : 'est.'}${ageLabel(calendar?.lastUpdated)}`} />
      </div>

      {/* Bias outcome accuracy (server-resolved from persisted snapshots) */}
      <div className="mt-2 bg-[#090b10] border border-white/5 rounded p-2">
        <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 uppercase mb-1.5">
          <span className="flex items-center gap-1"><Target className="w-3 h-3 text-cyan-400" /> Bias outcome accuracy</span>
          <span className={totalResolved === 0 ? 'text-slate-600' : 'text-slate-500'}>{totalResolved} resolved calls</span>
        </div>
        {accuracy == null ? (
          <div className="text-[10px] font-mono text-slate-600">loading…</div>
        ) : totalResolved === 0 ? (
          <div className="text-[10px] font-mono text-slate-500">
            COLLECTING — measures once live sessions accumulate (≤24h to first 1H verdicts)
          </div>
        ) : (
          <div className="space-y-1">
            {HORIZONS.map((m) => {
              const h = accuracy[m];
              if (!h) return null;
              const hue = h.overall.hitRate == null ? 'text-slate-500' : h.overall.hitRate >= 0.55 ? 'text-emerald-400' : h.overall.hitRate >= 0.48 ? 'text-amber-400' : 'text-rose-400';
              return (
                <div key={m} className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-400">{m >= 60 ? `${m / 60}h` : `${m}m`} horizon</span>
                  <span className={hue}>
                    {h.overall.hitRate == null ? '—' : pct(h.overall.hitRate)} hit · {h.overall.resolved} calls
                    {h.overall.avgPnlPct != null && <span className="text-slate-500"> · {h.overall.avgPnlPct > 0 ? '+' : ''}{h.overall.avgPnlPct}%/call</span>}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}