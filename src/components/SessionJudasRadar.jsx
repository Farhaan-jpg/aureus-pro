import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Crosshair, AlertTriangle, CheckCircle2, ChevronRight, Flame } from 'lucide-react';

// Season-accurate killzones: London follows UK BST (last Sun Mar -> last Sun
// Oct), New York follows US EDT/EST (2nd Sun Mar -> 1st Sun Nov). Same rules
// as the server's session.js so the HUD agrees with the payload's session label.
const secondSundayMarchUTC = (y) => {
  const first = new Date(Date.UTC(y, 2, 1));
  return new Date(Date.UTC(y, 2, 1 + ((7 - first.getUTCDay()) % 7) + 7)).getTime();
};
const firstSundayNovemberUTC = (y) => {
  const first = new Date(Date.UTC(y, 10, 1));
  return new Date(Date.UTC(y, 10, 1 + ((7 - first.getUTCDay()) % 7))).getTime();
};
const lastSundayOfMonthUTC = (y, m) => {
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const last = new Date(Date.UTC(y, m, days));
  return new Date(Date.UTC(y, m, days - last.getUTCDay())).getTime();
};
const usDST = (d) => { const y = d.getUTCFullYear(); const t = d.getTime(); return t >= secondSundayMarchUTC(y) && t < firstSundayNovemberUTC(y); };
const ukDST = (d) => { const y = d.getUTCFullYear(); const t = d.getTime(); return t >= lastSundayOfMonthUTC(y, 2) && t < lastSundayOfMonthUTC(y, 9); };
// Stable key so the sessions table only recomputes on a DST transition, not per-second.
const seasonKey = (d) => `${usDST(d) ? 1 : 0}${ukDST(d) ? 1 : 0}`;
const fmtMin = (m) => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, '0')}`;

export default function SessionJudasRadar({ currentPrice = null, marketData = null }) {
  const [utcTime, setUtcTime] = useState(new Date());

  // Real-time UTC clock updater
  useEffect(() => {
    const timer = setInterval(() => setUtcTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const utcHours = utcTime.getUTCHours();
  const utcMinutes = utcTime.getUTCMinutes();
  const utcSeconds = utcTime.getUTCSeconds();
  const currentMinuteOfDay = utcHours * 60 + utcMinutes;

  // Institutional Sessions & Killzones (UTC, DST-aware)
  const sessions = useMemo(() => {
    const ukSummer = ukDST(utcTime);   // London +1h in BST
    const usSummer = usDST(utcTime);   // NY in EDT
    return [
      {
        id: 'ASIA',
        name: 'Asian Range',
        city: 'Tokyo / Sydney',
        startMin: 0 * 60,     // 00:00 UTC
        endMin: 6 * 60,       // 06:00 UTC
        role: 'Liquidity Accumulation / Initial Balance',
        color: 'text-amber-400',
        borderActive: 'border-amber-500/60 bg-amber-950/20'
      },
      {
        id: 'LONDON_OPEN',
        name: 'London Killzone',
        city: 'London Open',
        startMin: (ukSummer ? 7 : 8) * 60,     // 07:00Z BST / 08:00Z GMT
        endMin: (ukSummer ? 10 : 11) * 60,     // ±3h window
        role: 'ICT Judas Swing / Stop Run Phase',
        color: 'text-cyan-400',
        borderActive: 'border-cyan-500/60 bg-cyan-950/20'
      },
      {
        id: 'NY_OPEN',
        name: 'New York AM Killzone',
        city: 'New York Open',
        startMin: (usSummer ? 13.5 : 14.5) * 60, // 13:30Z EDT / 14:30Z EST
        endMin: (usSummer ? 16.5 : 17.5) * 60,   // ±3h
        role: 'Macro Expansion & Institutional Trend',
        color: 'text-emerald-400',
        borderActive: 'border-emerald-500/60 bg-emerald-950/20'
      },
      {
        id: 'LONDON_CLOSE',
        name: 'London Close',
        city: 'London Fix',
        startMin: (ukSummer ? 15 : 16) * 60,     // 16:00 London local
        endMin: (ukSummer ? 16.5 : 17.5) * 60,   // 17:30 London local
        role: 'Daily High/Low Lock & Distribution',
        color: 'text-purple-400',
        borderActive: 'border-purple-500/60 bg-purple-950/20'
      }
    ];
  }, [seasonKey(utcTime)]);

  // Determine active session
  const activeSession = sessions.find(
    (s) => currentMinuteOfDay >= s.startMin && currentMinuteOfDay < s.endMin
  ) || null;

  // Next Killzone countdown calculation
  const { nextSession, minsToNext } = useMemo(() => {
    for (const s of sessions) {
      if (currentMinuteOfDay < s.startMin) {
        return { nextSession: s, minsToNext: s.startMin - currentMinuteOfDay };
      }
    }
    // Wraps around to next day Asian open
    return { nextSession: sessions[0], minsToNext: (24 * 60 - currentMinuteOfDay) + sessions[0].startMin };
  }, [sessions, currentMinuteOfDay]);

  const asianHigh = marketData?.asianRange?.high;
  const asianLow = marketData?.asianRange?.low;
  const hasRange = asianHigh != null && asianLow != null && asianHigh > asianLow;

  // Judas Swing Analysis
  const judasAnalysis = useMemo(() => {
    if (!hasRange || currentPrice == null) {
      return {
        status: 'NO_RANGE',
        label: 'ASIAN RANGE NOT TRACKED YET',
        color: 'text-slate-400 bg-slate-900/40 border-slate-700/40',
        detail: 'High/low is captured from live gold ticks between 00:00–07:00 UTC. Until those ticks exist, this is not inferred from the daily high/low.'
      };
    }
    const isAboveAsianHigh = currentPrice > asianHigh;
    const isBelowAsianLow = currentPrice < asianLow;

    if (isAboveAsianHigh) {
      return {
        status: 'BEARISH_JUDAS_SWEEP',
        label: 'ASIAN HIGH SWEPT (POTENTIAL TURTLE SOUP)',
        color: 'text-amber-400 bg-amber-950/40 border-amber-500/40',
        detail: `Price traded above Asian High ($${asianHigh.toFixed(2)}). Buy-side liquidity taken. Watch for 5M reversal or fakeout re-entry.`
      };
    } else if (isBelowAsianLow) {
      return {
        status: 'BULLISH_JUDAS_SWEEP',
        label: 'ASIAN LOW SWEPT (POTENTIAL TURTLE SOUP)',
        color: 'text-cyan-400 bg-cyan-950/40 border-cyan-500/40',
        detail: `Price traded below Asian Low ($${asianLow.toFixed(2)}). Sell-side stops swept. Watch for institutional bullish recovery.`
      };
    } else {
      return {
        status: 'RANGE_BOUND',
        label: 'WITHIN ASIAN RANGE BOUNDARIES',
        color: 'text-slate-400 bg-slate-900/40 border-slate-700/40',
        detail: `Price ($${currentPrice.toFixed(2)}) is consolidating between Asian High ($${asianHigh.toFixed(2)}) and Low ($${asianLow.toFixed(2)}).`
      };
    }
  }, [currentPrice, asianHigh, asianLow, hasRange]);

  return (
    <div className="hud-panel p-3.5 bg-[#0a0d14] border border-white/10 rounded-lg flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-emerald-400" />
          <span className="font-mono font-bold text-xs tracking-wider text-slate-200">
            ICT SESSION & JUDAS SWING RADAR
          </span>
        </div>

        {/* Live UTC Clock */}
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#121624] border border-white/10 font-mono text-xs">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400">UTC:</span>
          <span className="font-bold text-white">
            {String(utcHours).padStart(2, '0')}:{String(utcMinutes).padStart(2, '0')}:{String(utcSeconds).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Asian Range Box Reference */}
      <div className="grid grid-cols-2 gap-2 mb-3 font-mono text-xs">
        <div className="p-2 rounded bg-[#0e121d] border border-white/5 flex items-center justify-between">
          <span className="text-slate-400 text-[11px]">ASIAN HIGH (BSL):</span>
          <span className="font-bold text-amber-400">{asianHigh != null ? `$${asianHigh.toFixed(2)}` : '—'}</span>
        </div>
        <div className="p-2 rounded bg-[#0e121d] border border-white/5 flex items-center justify-between">
          <span className="text-slate-400 text-[11px]">ASIAN LOW (SSL):</span>
          <span className="font-bold text-cyan-400">{asianLow != null ? `$${asianLow.toFixed(2)}` : '—'}</span>
        </div>
      </div>

      {/* Real-Time Judas Status Alert */}
      <div className={`p-2.5 rounded border mb-3 font-mono text-xs ${judasAnalysis.color}`}>
        <div className="flex items-center gap-2 font-bold mb-1">
          <Flame className="w-4 h-4" />
          <span>{judasAnalysis.label}</span>
        </div>
        <p className="text-[11px] opacity-90 leading-relaxed">{judasAnalysis.detail}</p>
      </div>

      {/* Session Progress Grid */}
      <div className="space-y-1.5">
        {sessions.map((s) => {
          const isActive = activeSession?.id === s.id;
          return (
            <div
              key={s.id}
              className={`px-2.5 py-1.5 rounded flex items-center justify-between text-xs font-mono transition border ${
                isActive
                  ? s.borderActive
                  : 'bg-black/30 border-white/5 text-slate-500'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                  }`}
                />
                <span className={`font-bold ${isActive ? 'text-white' : 'text-slate-400'}`}>
                  {s.name}
                </span>
                <span className="text-[10px] text-slate-500 hidden sm:inline">({s.city})</span>
              </div>

              <div className="flex items-center gap-2 text-[11px]">
                <span className={isActive ? s.color : 'text-slate-500'}>
                  {isActive ? 'ACTIVE KILLZONE' : `${fmtMin(s.startMin)} - ${fmtMin(s.endMin)} UTC`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Killzone Countdown Footer */}
      <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <span>NEXT KILLZONE: <strong className="text-white">{nextSession.name}</strong></span>
        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
          in {Math.floor(minsToNext / 60)}h {minsToNext % 60}m
        </span>
      </div>
    </div>
  );
}
