import React from 'react';
import { Activity, Wifi, WifiOff, Database, Clock } from 'lucide-react';

function Freshness({ label, live, detail, kind = 'green' }) {
  const color = live ? 'text-emerald-400' : kind === 'warn' ? 'text-amber-400' : 'text-rose-400';
  return (
    <div className="flex items-center justify-between w-full text-[10px] font-mono border-b border-white/5 py-1.5 last:border-0">
      <span className="text-slate-400">{label}</span>
      <span className={`flex items-center gap-1.5 ${color}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
        <span className="font-bold">{live ? 'LIVE' : 'STALE'}</span>
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
  const newsFresh = news?.length && news[0]?.pubDate ? ageLabel(news[0].pubDate) : '';
  const calCount = calendar?.events?.length ?? 0;

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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
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
        <Freshness label="Economic calendar" live={calCount > 0} detail={`${calCount} events`} />
      </div>
    </div>
  );
}