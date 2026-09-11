import React from 'react';
import { Activity, Radio, RefreshCw, ShieldAlert, Zap, TrendingUp, TrendingDown, Clock } from 'lucide-react';

export default function Header({
  marketData,
  bias,
  isLive,
  isRefreshing,
  onRefresh,
  onGenerateAI,
  isAiGenerating
}) {
  const gold = marketData?.goldSpot || { price: 4335.00, change: 0, changePercent: 0, high: 4350, low: 4310 };
  const isUp = gold.change >= 0;
  const session = marketData?.session || 'ASIAN';

  const prevPriceRef = React.useRef(gold.price);
  const [flash, setFlash] = React.useState(null); // 'up' | 'down' | null

  React.useEffect(() => {
    if (prevPriceRef.current !== undefined && gold.price !== prevPriceRef.current) {
      const dir = gold.price > prevPriceRef.current ? 'up' : 'down';
      setFlash(dir);
      const timer = setTimeout(() => setFlash(null), 700);
      prevPriceRef.current = gold.price;
      return () => clearTimeout(timer);
    }
    prevPriceRef.current = gold.price;
  }, [gold.price]);

  const sessionDisplayMap = {
    ASIAN: { label: 'Asian Session (Tokyo/HK)', color: 'text-cyan-400 bg-cyan-950/40 border-cyan-800/50' },
    LONDON_OPEN: { label: 'London Open (Judas Swing Zone)', color: 'text-amber-400 bg-amber-950/40 border-amber-800/50' },
    NY_OVERLAP: { label: 'London / NY Overlap (Peak Volatility)', color: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50' },
    NY_AFTERNOON: { label: 'NY Afternoon (Late Settlement)', color: 'text-purple-400 bg-purple-950/40 border-purple-800/50' },
    ASIAN_PACIFIC: { label: 'Asian Range (Pacific/Sydney)', color: 'text-cyan-400 bg-cyan-950/40 border-cyan-800/50' }
  };

  const sessionInfo = sessionDisplayMap[session] || sessionDisplayMap.ASIAN;

  return (
    <header className="border-b border-white/10 bg-[#0a0c12]/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-[1920px] mx-auto px-4 py-2.5 flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Brand & Ticker */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-gold-400 to-amber-600 flex items-center justify-center font-extrabold text-black text-lg shadow-lg shadow-gold-500/20">
              AU
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-wider text-white">AUREUS PRO</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold bg-gold-500/20 text-gold-400 border border-gold-500/30">
                  INSTITUTIONAL
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">XAU/USD Real-Time Intelligence Bus</p>
            </div>
          </div>

          <div className="h-7 w-[1px] bg-white/10 hidden sm:block"></div>

          {/* Primary Gold Price Display with Real-Time Tick Flash */}
          <div className="flex items-baseline gap-2.5">
            <div className={`px-2 py-0.5 rounded transition-colors duration-300 ${
              flash === 'up' ? 'bg-emerald-500/20 text-emerald-300' :
              flash === 'down' ? 'bg-rose-500/20 text-rose-300' :
              'bg-transparent text-white'
            }`}>
              <span className="text-xl sm:text-2xl font-mono font-bold tracking-tight tabular-nums">
                ${gold.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className={`flex items-center text-xs font-mono font-semibold px-1.5 py-0.5 rounded ${
              isUp ? 'text-emerald-400 bg-emerald-950/50' : 'text-rose-400 bg-rose-950/50'
            }`}>
              {isUp ? <TrendingUp className="w-3 h-3 mr-0.5 inline" /> : <TrendingDown className="w-3 h-3 mr-0.5 inline" />}
              {isUp ? '+' : ''}{gold.change?.toFixed(2)} ({isUp ? '+' : ''}{gold.changePercent?.toFixed(2)}%)
            </div>
            <div className="hidden xl:flex items-center gap-3 text-[11px] text-slate-400 font-mono">
              <span>H: <strong className="text-slate-200">${gold.high?.toFixed(2)}</strong></span>
              <span>L: <strong className="text-slate-200">${gold.low?.toFixed(2)}</strong></span>
              <span>Bid: <strong className="text-slate-200">${((gold.price || 4335) - ((marketData?.spread || 0.50) / 2)).toFixed(2)}</strong></span>
              <span>Ask: <strong className="text-slate-200">${((gold.price || 4335) + ((marketData?.spread || 0.50) / 2)).toFixed(2)}</strong></span>
              <span>Spread: <strong className="text-gold-400">${(marketData?.spread || 0.50).toFixed(2)}</strong></span>
            </div>
            <div className="flex xl:hidden items-center gap-2 text-[11px] text-slate-400 font-mono">
              <span>H: <strong className="text-slate-200">${gold.high?.toFixed(2)}</strong></span>
              <span>L: <strong className="text-slate-200">${gold.low?.toFixed(2)}</strong></span>
              <span>Spread: <strong className="text-gold-400">${(marketData?.spread || 0.50).toFixed(2)}</strong></span>
            </div>
          </div>
        </div>

        {/* Middle Session & Bias Pills */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Active Trading Session */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-medium border ${sessionInfo.color}`}>
            <Clock className="w-3.5 h-3.5" />
            <span>{sessionInfo.label}</span>
          </div>

          {/* Composite Bias Pill */}
          {bias && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-semibold border ${
              bias.score >= 35 ? 'text-emerald-400 bg-emerald-950/50 border-emerald-800/60' :
              bias.score <= -35 ? 'text-rose-400 bg-rose-950/50 border-rose-800/60' :
              'text-slate-300 bg-slate-900 border-slate-700'
            }`}>
              <Zap className="w-3.5 h-3.5 text-gold-400" />
              <span>BIAS: {bias.label} ({bias.score > 0 ? '+' : ''}{bias.score})</span>
            </div>
          )}
        </div>

        {/* Right Status & Trigger Buttons */}
        <div className="flex items-center gap-2">
          {/* SSE Connection State */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900/80 border border-white/5 text-[11px] font-mono">
            <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span className={isLive ? 'text-emerald-400' : 'text-slate-400'}>
              {isLive ? 'STREAM LIVE' : 'CONNECTING'}
            </span>
          </div>

          {/* Trigger Floor AI */}
          <button
            onClick={onGenerateAI}
            disabled={isAiGenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold font-mono bg-gold-500 hover:bg-gold-400 text-black transition-all shadow-md shadow-gold-500/10 active:scale-95 disabled:opacity-50"
            title="Generate fresh AI Floor Trader commentary"
          >
            <Activity className={`w-3.5 h-3.5 ${isAiGenerating ? 'animate-spin' : ''}`} />
            <span>{isAiGenerating ? 'THINKING...' : 'FLOOR INTEL'}</span>
          </button>

          {/* Manual Refresh */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-white/10 transition active:scale-95"
            title="Sync all market feeds"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-gold-400' : ''}`} />
          </button>
        </div>

      </div>
    </header>
  );
}
