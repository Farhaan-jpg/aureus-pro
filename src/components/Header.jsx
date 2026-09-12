import React from 'react';
import { RefreshCw, Bell, Volume2, VolumeX, Settings } from 'lucide-react';

// Minimal terminal tape: price + change + session + bias + stream state.
// Chrome removed; every pixel carries a number.
export default function Header({
  marketData,
  bias,
  isLive,
  health,
  reconnecting,
  isRefreshing,
  onRefresh,
  voiceEnabled,
  onToggleVoice,
  onOpenSettings,
  onOpenPriceAlerts
}) {
  const gold = marketData?.goldSpot || { price: 4380.0, change: 0, changePercent: 0, high: 4385, low: 4320 };
  const isUp = (gold.changePercent !== undefined && gold.changePercent !== 0 ? gold.changePercent : (gold.change || 0)) >= 0;
  const change = gold.changePercent != null ? gold.changePercent : (gold.change || 0);
  const session = marketData?.session || 'ASIAN';

  const prevPriceRef = React.useRef(gold.price);
  const [flash, setFlash] = React.useState(null); // 'up' | 'down' | null
  const [bumpKey, setBumpKey] = React.useState(0);

  React.useEffect(() => {
    if (prevPriceRef.current !== undefined && gold.price !== prevPriceRef.current) {
      const dir = gold.price > prevPriceRef.current ? 'up' : 'down';
      setFlash(dir);
      setBumpKey((k) => k + 1);
      const timer = setTimeout(() => setFlash(null), 650);
      prevPriceRef.current = gold.price;
      return () => clearTimeout(timer);
    }
    prevPriceRef.current = gold.price;
  }, [gold.price]);

  const sessionMap = {
    ASIAN: { label: 'Asian', color: 'text-cyan-400' },
    ASIAN_PACIFIC: { label: 'Asian', color: 'text-cyan-400' },
    LONDON_OPEN: { label: 'London', color: 'text-amber-400' },
    NY_OVERLAP: { label: 'Overlap', color: 'text-emerald-400' },
    NY_AFTERNOON: { label: 'NY', color: 'text-purple-400' },
    CLOSED: { label: 'Closed', color: 'text-rose-400' }
  };
  const s = sessionMap[session] || sessionMap.ASIAN;

  const marketOpen = marketData?.marketState?.open !== false;
  const tapeAge = marketData?.dataHealth?.goldAgeMs;
  const tapeFresh = tapeAge == null || tapeAge < 30000;
  const streamText = !marketOpen
    ? 'CLOSED'
    : isLive && tapeFresh ? 'LIVE'
    : isLive ? `STALE ${Math.round((tapeAge ?? 0) / 1000)}s`
    : 'CONNECT';
  const streamCls = !marketOpen
    ? 'bg-slate-500'
    : isLive && tapeFresh ? 'bg-emerald-400 live-ring'
    : isLive ? 'bg-amber-400 animate-pulse'
    : 'bg-rose-500 animate-pulse';

  const degraded = health?.status === 'DEGRADED';
  const degradedFeeds = health?.feeds
    ? Object.entries(health.feeds).filter(([, v]) => v === false || v === 'offline' || v === 'unavailable').map(([k]) => k).join(', ')
    : '';

  const biasCls = !bias
    ? 'text-slate-500'
    : bias.score >= 35 ? 'text-emerald-400'
    : bias.score <= -35 ? 'text-rose-400'
    : 'text-slate-300';

  const iconCls = 'pad-tap w-10 lg:w-8 grid place-items-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 border border-transparent transition active:scale-95';

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#07080b]/85 backdrop-blur-xl">
      <div className="max-w-[1920px] mx-auto px-3 lg:px-4 py-2.5 flex items-center gap-3 lg:gap-4 flex-wrap">
        {/* Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-gold-400 to-amber-600 grid place-items-center font-extrabold text-black text-sm shadow-md shadow-gold-500/20">
            AU
          </div>
          <span className="hidden sm:block font-bold tracking-widest text-sm text-white">
            AUREUS
          </span>
        </div>

        {/* Price + flash */}
        <div className="flex items-center gap-2">
          <div className={`px-2 py-1 rounded-lg border transition-colors duration-200 ${
            flash === 'up' ? 'bg-emerald-500/20 border-emerald-400/70' :
            flash === 'down' ? 'bg-rose-500/20 border-rose-400/70' :
            'bg-white/5 border-white/10'
          }`}>
            <span key={bumpKey} className={`font-mono font-extrabold text-lg sm:text-2xl tabular-nums tracking-tight ${
              flash === 'up' ? 'text-emerald-300' : flash === 'down' ? 'text-rose-300' : 'text-white'
            }`}>
              ${gold.price ? Number(gold.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
            </span>
          </div>

          <div className={`text-[11px] lg:text-xs font-mono font-bold tabular-nums ${
            isUp ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {isUp ? '+' : ''}{Number(gold.change || 0).toFixed(2)} ({isUp ? '+' : ''}{Number(change || 0).toFixed(2)}%)
          </div>

          <div className="hidden md:flex items-center gap-2.5 text-[10px] font-mono text-slate-500">
            <span>H <b className="text-slate-300">${Number(gold.high || gold.price || 0).toFixed(2)}</b></span>
            <span>L <b className="text-slate-300">${Number(gold.low || gold.price || 0).toFixed(2)}</b></span>
          </div>
        </div>

        {/* Session + Bias (quiet chips) */}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className={`hidden xl:inline text-[10px] font-mono uppercase tracking-wider ${s.color}`}>{s.label}</span>

          {bias && (
            <span className={`text-[10px] lg:text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md ${biasCls}`}>
              {bias.label} {bias.score > 0 ? '+' : ''}{bias.score}
            </span>
          )}

          <span
            className="flex items-center gap-1.5 text-[10px] lg:text-[11px] font-mono px-2 py-0.5 rounded-md text-slate-400"
            title={degraded ? `Degraded: ${degradedFeeds}` : tapeAge == null ? 'feed state unknown' : `tape ${Math.round(tapeAge / 1000)}s old`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${streamCls}`} />
            <span>{reconnecting ? 'RECONNECT' : streamText}</span>
          </span>

          {health && degraded && (
            <span className="text-[10px] font-mono font-bold text-amber-300 animate-pulse">
              {degradedFeeds ? degradedFeeds.toUpperCase() : 'DEGRADED'}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button onClick={onRefresh} disabled={isRefreshing} className={iconCls} title="Sync all feeds">
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-gold-400' : ''}`} />
          </button>
          <button onClick={onOpenPriceAlerts} className={iconCls} title="Price alerts">
            <Bell className="w-4 h-4" />
          </button>
          <button onClick={onToggleVoice} className={`${iconCls} ${voiceEnabled ? 'text-gold-400' : 'text-slate-500'}`} title="Voice alerts">
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button onClick={onOpenSettings} className={iconCls} title="Settings">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}