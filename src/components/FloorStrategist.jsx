import React from 'react';
import { Target, AlertTriangle, Crosshair, Shield, Cpu, RefreshCw, Terminal, CheckCircle2 } from 'lucide-react';

export default function FloorStrategist({ commentary, onGenerateAI, isAiGenerating }) {
  const data = commentary || {
    actionableBias: 'BULLISH',
    confidence: 82,
    keySupport: '$2,668.50',
    keyResistance: '$2,710.00',
    invalidationLevel: '$2,654.00',
    highProbabilitySetup: 'Wait for London Open Judas swing to sweep below Asian Range low ($2,668). Look for an institutional absorption wick on 5m chart to enter long targeting the $2,700 psychological liquidity pool.',
    warningTrapZone: 'Avoid aggressive long entries between $2,688-$2,694. High spread chop zone preceding US Session liquidity injection.',
    sessionJudasContext: 'London Open algorithms frequently run stops 15-20 pips against the prevailing daily trend before true volume commits.',
    macroYieldSynthesis: 'US 10Y Real Yields consolidating near 2.15%. So long as Real Yields fail to break above 2.30%, institutional dip buying remains active.',
    floorCommentary: "Retail is looking at the 5-minute moving averages like it's a crystal ball. Smart money is waiting on the other side of their stop losses. Don't chase the green candle at London open — let the market makers sweep the Asian low, then piggyback their recovery order block.",
    provider: 'Google Gemini (gemini-3.6-flash)',
    generatedAt: new Date().toISOString()
  };

  const biasColors = {
    BULLISH: 'bg-emerald-950/60 text-emerald-400 border-emerald-700/60',
    BEARISH: 'bg-rose-950/60 text-rose-400 border-rose-700/60',
    NEUTRAL_CHOP: 'bg-amber-950/60 text-amber-400 border-amber-700/60',
    CASH_IS_KING: 'bg-slate-900 text-slate-300 border-slate-700'
  };

  return (
    <div className="hud-panel p-4 flex flex-col justify-between border-gold-500/30">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-gold-400" />
            <h2 className="font-mono font-bold text-xs tracking-wider text-slate-200 uppercase">
              Modules C & D: The Floor Strategist (10+ Yr Veteran AI)
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* LLM Provider Badge */}
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 text-gold-400 border border-gold-500/20 flex items-center gap-1">
              <Cpu className="w-3 h-3 text-gold-400" />
              {data.provider || 'AI Orchestrator'}
            </span>
            <button
              onClick={onGenerateAI}
              disabled={isAiGenerating}
              className="text-xs p-1 text-slate-400 hover:text-gold-400 transition"
              title="Force Fresh AI Generation"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAiGenerating ? 'animate-spin text-gold-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Primary Signals Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {/* Actionable Bias */}
          <div className="bg-[#0b0e15] border border-white/5 p-2 rounded">
            <span className="text-[9px] font-mono text-slate-400 uppercase block">Actionable Bias</span>
            <span className={`text-xs font-mono font-bold px-1.5 py-0.5 mt-1 inline-block rounded border ${
              biasColors[data.actionableBias] || biasColors.BULLISH
            }`}>
              {data.actionableBias}
            </span>
          </div>

          {/* Invalidation Level */}
          <div className="bg-[#0b0e15] border border-white/5 p-2 rounded">
            <span className="text-[9px] font-mono text-slate-400 uppercase block">Invalidation Level</span>
            <span className="text-xs font-mono font-bold text-rose-400 mt-1 inline-block tabular-nums">
              {data.invalidationLevel}
            </span>
          </div>

          {/* Key Support */}
          <div className="bg-[#0b0e15] border border-white/5 p-2 rounded">
            <span className="text-[9px] font-mono text-slate-400 uppercase block">Key Support Floor</span>
            <span className="text-xs font-mono font-bold text-emerald-400 mt-1 inline-block tabular-nums">
              {data.keySupport}
            </span>
          </div>

          {/* Key Resistance */}
          <div className="bg-[#0b0e15] border border-white/5 p-2 rounded">
            <span className="text-[9px] font-mono text-slate-400 uppercase block">Key Resistance Cap</span>
            <span className="text-xs font-mono font-bold text-amber-400 mt-1 inline-block tabular-nums">
              {data.keyResistance}
            </span>
          </div>
        </div>

        {/* 5-Minute Scalp Execution Card */}
        <div className="bg-gradient-to-r from-gold-500/10 via-[#0f141f] to-amber-500/10 border border-gold-500/30 p-3 rounded mb-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-gold-400 animate-ping" />
              <span className="text-[11px] font-mono font-extrabold text-gold-300 uppercase tracking-wider">
                5-MINUTE DAYTRADE & SCALP EXECUTION
              </span>
            </div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
              data.scalpBias5m === 'LONG_SCALP' ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600' :
              data.scalpBias5m === 'SHORT_SCALP' ? 'bg-rose-950/80 text-rose-300 border-rose-600' :
              'bg-slate-900 text-slate-400 border-slate-700'
            }`}>
              {data.scalpBias5m || '5M SCALP BIAS'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 my-2 text-xs font-mono">
            <div className="bg-black/50 p-1.5 rounded border border-white/5">
              <span className="text-[9px] text-slate-400 block">5M Target 1</span>
              <span className="font-bold text-emerald-400 tabular-nums">{data.scalpTarget1 || '+$1.80 (18 pips)'}</span>
            </div>
            <div className="bg-black/50 p-1.5 rounded border border-white/5">
              <span className="text-[9px] text-slate-400 block">5M Runner (T2)</span>
              <span className="font-bold text-emerald-300 tabular-nums">{data.scalpTarget2 || '+$3.50 (35 pips)'}</span>
            </div>
            <div className="bg-black/50 p-1.5 rounded border border-white/5">
              <span className="text-[9px] text-slate-400 block">Hard Stop Loss</span>
              <span className="font-bold text-rose-400 tabular-nums">{data.scalpStopLoss || '-$1.50 (-15 pips)'}</span>
            </div>
          </div>

          <p className="text-[11px] font-sans text-slate-300 leading-snug">
            <strong className="text-gold-400 font-mono">Trigger: </strong>
            {data.scalpTrigger5m || data.highProbabilitySetup}
          </p>
        </div>

        {/* High-Spread Trap Warning */}
        <div className="bg-rose-950/20 border border-rose-800/30 p-2.5 rounded mb-2.5">
          <div className="flex items-center gap-1.5 text-rose-400 text-[11px] font-mono font-bold uppercase mb-0.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Warning: High-Spread Trap Zone</span>
          </div>
          <p className="text-xs text-rose-200/90 font-sans leading-relaxed">
            {data.warningTrapZone}
          </p>
        </div>

        {/* Raw Floor Trader Voice Quote */}
        <div className="bg-black/40 border border-white/5 p-3 rounded text-xs font-mono text-slate-300 italic relative">
          <div className="text-[10px] text-gold-400/80 font-bold not-italic uppercase mb-1 flex items-center gap-1">
            <span>Floor Strategist Tape Commentary</span>
          </div>
          "{data.floorCommentary}"
        </div>
      </div>

      {/* Footer Timestamp & Judas Note */}
      <div className="mt-3 pt-2 border-t border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-[10px] font-mono text-slate-400">
        <span className="truncate max-w-sm">{data.sessionJudasContext}</span>
        <span className="text-slate-500 shrink-0">
          Generated: {new Date(data.generatedAt || Date.now()).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
