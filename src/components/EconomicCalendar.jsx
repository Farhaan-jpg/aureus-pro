import React, { useState, useEffect } from 'react';
import { Calendar, Clock, HelpCircle, ChevronRight, AlertCircle } from 'lucide-react';

export default function EconomicCalendar({ calendarData }) {
  const [now, setNow] = useState(Date.now());
  const [activeTab, setActiveTab] = useState('UPCOMING'); // 'UPCOMING' or 'MATRIX'

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const events = calendarData?.events || [];
  const matrixRules = calendarData?.matrixRules || [];

  function formatCountdown(targetDateStr) {
    const diff = new Date(targetDateStr).getTime() - now;
    if (diff <= 0) return 'RELEASED';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
  }

  return (
    <div className="hud-panel p-4 flex flex-col justify-between h-full">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gold-400" />
            <h2 className="font-mono font-bold text-xs tracking-wider text-slate-200 uppercase">
              Module F: Real-Time Economic Calendar & Gold Impact Matrix
            </h2>
          </div>

          <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded border border-white/10 text-xs font-mono">
            <button
              onClick={() => setActiveTab('UPCOMING')}
              className={`px-2 py-0.5 rounded transition ${
                activeTab === 'UPCOMING' ? 'bg-gold-500 text-black font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Upcoming Releases
            </button>
            <button
              onClick={() => setActiveTab('MATRIX')}
              className={`px-2 py-0.5 rounded transition ${
                activeTab === 'MATRIX' ? 'bg-gold-500 text-black font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Impact Matrix
            </button>
          </div>
        </div>

        {/* Tab 1: Upcoming Events */}
        {activeTab === 'UPCOMING' && (
          <div className="space-y-2">
            {events.map((evt) => {
              const countdown = formatCountdown(evt.date);
              const isUrgent = countdown.includes('00h') || countdown.includes('01h') || countdown.includes('02h');

              return (
                <div key={evt.id} className="bg-[#0b0e15] border border-white/5 p-2.5 rounded hover:border-white/15 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white font-mono">{evt.title}</span>
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          evt.impact === 'CRITICAL'
                            ? 'bg-rose-950/80 text-rose-400 border border-rose-800/50'
                            : 'bg-amber-950/80 text-amber-400 border border-amber-800/50'
                        }`}>
                          {evt.impact}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 mt-1">
                        <span>Forecast: <strong className="text-slate-200">{evt.forecast}</strong></span>
                        <span>Prior: <strong className="text-slate-300">{evt.previous}</strong></span>
                        <span>Scheduled: {new Date(evt.date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} {new Date(evt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    {/* Live Countdown Timer */}
                    <div className="text-right shrink-0">
                      <div className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                        countdown === 'RELEASED'
                          ? 'bg-slate-900 text-slate-400 border-slate-800'
                          : isUrgent
                          ? 'bg-rose-950/60 text-rose-300 border-rose-800/60 animate-pulse'
                          : 'bg-slate-900/80 text-gold-400 border-gold-500/20'
                      }`}>
                        {countdown}
                      </div>
                      <span className="text-[9px] font-mono text-slate-500 block mt-0.5">Countdown</span>
                    </div>
                  </div>

                  {/* Impact Rule Strip */}
                  <div className="mt-2 pt-1.5 border-t border-white/5 text-[10px] font-mono text-gold-400/90 leading-tight">
                    {evt.goldImpactRule}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Institutional Gold Impact Logic Matrix */}
        {activeTab === 'MATRIX' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 text-[10px] uppercase">
                  <th className="py-1.5 px-2">Macro Release</th>
                  <th className="py-1.5 px-2">Surprise Direction</th>
                  <th className="py-1.5 px-2">DXY & Yields</th>
                  <th className="py-1.5 px-2">Gold Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {matrixRules.map((rule, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition">
                    <td className="py-2 px-2 font-bold text-slate-200">{rule.indicator}</td>
                    <td className="py-2 px-2 text-slate-300">{rule.hawkishOutcome}</td>
                    <td className="py-2 px-2 text-slate-400">
                      <div>DXY: {rule.dxyReaction}</div>
                      <div>Yields: {rule.yieldsReaction}</div>
                    </td>
                    <td className="py-2 px-2">
                      <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                        rule.goldDirection === 'BULLISH'
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
                          : 'bg-rose-950/80 text-rose-400 border border-rose-800/50'
                      }`}>
                        {rule.goldDirection}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer explanation */}
      <div className="mt-3 pt-2 border-t border-white/5 text-[9px] font-mono text-slate-500">
        High-tier Tier 1 macro events trigger violent institutional liquidity sweeps.
      </div>
    </div>
  );
}
