import React, { useState, useEffect } from 'react';
import { Calendar, Clock, AlertTriangle, ExternalLink, Zap, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function EconomicCalendar({ calendarData }) {
  const [now, setNow] = useState(Date.now());
  const [activeTab, setActiveTab] = useState('GOLD_DRIVERS'); // 'GOLD_DRIVERS' | 'ALL_EVENTS' | 'MATRIX'

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const allEvents = calendarData?.events || [];
  const matrixRules = calendarData?.matrixRules || [];

  // Auto-delete all released economic events: strictly keep upcoming releases where eventTime > now
  const upcomingEvents = allEvents.filter(e => new Date(e.date).getTime() > now);

  // Filter upcoming events based on active tab
  const displayedEvents = activeTab === 'GOLD_DRIVERS'
    ? upcomingEvents.filter(e => e.isGoldDriver || e.currency === 'USD' || e.impact === 'HIGH' || e.impact === 'CRITICAL')
    : upcomingEvents;

  function formatCountdown(targetDateStr) {
    const diff = new Date(targetDateStr).getTime() - now;
    if (diff <= 0) return 'RELEASED';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
  }

  const currencyStyles = {
    USD: 'text-emerald-400 bg-emerald-950/60 border-emerald-700/50 font-bold',
    EUR: 'text-blue-400 bg-blue-950/60 border-blue-700/50',
    GBP: 'text-indigo-300 bg-indigo-950/60 border-indigo-700/50',
    CHF: 'text-cyan-400 bg-cyan-950/60 border-cyan-700/50',
    JPY: 'text-rose-400 bg-rose-950/60 border-rose-700/50',
    AUD: 'text-amber-400 bg-amber-950/60 border-amber-700/50',
    CAD: 'text-purple-400 bg-purple-950/60 border-purple-700/50'
  };

  return (
    <div className="hud-panel p-4 flex flex-col justify-between h-full">
      {/* Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 mb-2.5 border-b border-white/5 gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gold-400" />
            <h2 className="font-mono font-bold text-xs tracking-wider text-slate-200 uppercase flex items-center gap-1.5">
              <span>Module F: Economic Calendar & Gold Impact Matrix</span>
              <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                FOREX FACTORY LIVE
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                AUTO-PURGE RELEASED
              </span>
            </h2>
          </div>

          {/* Navigation Filter Tabs */}
          <div className="flex items-center gap-1 bg-black/50 p-0.5 rounded border border-white/10 text-xs font-mono">
            <button
              onClick={() => setActiveTab('GOLD_DRIVERS')}
              className={`px-2.5 py-1 rounded transition text-[11px] ${
                activeTab === 'GOLD_DRIVERS'
                  ? 'bg-gold-500 text-black font-extrabold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Gold Drivers ({upcomingEvents.filter(e => e.isGoldDriver || e.currency === 'USD' || e.impact === 'HIGH' || e.impact === 'CRITICAL').length})
            </button>
            <button
              onClick={() => setActiveTab('ALL_EVENTS')}
              className={`px-2.5 py-1 rounded transition text-[11px] ${
                activeTab === 'ALL_EVENTS'
                  ? 'bg-gold-500 text-black font-extrabold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Upcoming ({upcomingEvents.length})
            </button>
            <button
              onClick={() => setActiveTab('MATRIX')}
              className={`px-2.5 py-1 rounded transition text-[11px] ${
                activeTab === 'MATRIX'
                  ? 'bg-gold-500 text-black font-extrabold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Impact Matrix
            </button>
          </div>
        </div>

        {/* Tab 1 & 2: Events List */}
        {activeTab !== 'MATRIX' && (
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {/* 5M Scalper Rule Banner */}
            <div className="bg-amber-950/30 border border-amber-500/30 p-2 rounded flex items-center justify-between text-[11px] font-mono">
              <span className="text-amber-400 font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                5M SCALPING PROTOCOL:
              </span>
              <span className="text-slate-300 text-[10px]">
                Close or tighten stops 5 mins prior to High/Critical red-folder USD releases
              </span>
            </div>

            {displayedEvents.length === 0 ? (
              <div className="text-center py-8 font-mono text-xs text-slate-500">
                No scheduled releases found for this filter.
              </div>
            ) : (
              displayedEvents.map((evt) => {
                const countdown = formatCountdown(evt.date);
                const isUrgent = countdown.includes('00h') || countdown.includes('01h');
                const isReleased = countdown === 'RELEASED';
                const currencyBadge = currencyStyles[evt.currency] || 'text-slate-300 bg-slate-900 border-slate-700';

                return (
                  <div
                    key={evt.id}
                    className={`bg-[#0b0e15] border p-2.5 rounded transition ${
                      evt.impact === 'HIGH' || evt.impact === 'CRITICAL'
                        ? 'border-rose-900/40 hover:border-rose-600/50'
                        : 'border-white/5 hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Currency, Impact & Event Name */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${currencyBadge}`}>
                            {evt.currency}
                          </span>
                          <span
                            className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                              evt.impact === 'CRITICAL' || evt.impact === 'HIGH'
                                ? 'bg-rose-950/90 text-rose-300 border border-rose-600/60 shadow-sm shadow-rose-950'
                                : evt.impact === 'MEDIUM'
                                ? 'bg-amber-950/80 text-amber-300 border border-amber-600/50'
                                : 'bg-slate-900 text-slate-400 border border-slate-800'
                            }`}
                          >
                            {evt.impact}
                          </span>
                          <span className="text-xs font-bold text-white font-mono truncate">
                            {evt.title}
                          </span>
                        </div>

                        {/* Triad: Actual vs Forecast vs Previous */}
                        <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400 mt-1.5">
                          <div>
                            <span className="text-slate-500 text-[10px]">Actual: </span>
                            {evt.actual ? (
                              <strong className="text-emerald-400 font-bold bg-emerald-950/40 px-1 py-0.2 rounded border border-emerald-800/40">
                                {evt.actual}
                              </strong>
                            ) : (
                              <span className="text-slate-500 italic text-[10px]">Pending</span>
                            )}
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px]">Forecast: </span>
                            <strong className="text-slate-200">{evt.forecast || '---'}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px]">Prior: </span>
                            <strong className="text-slate-300">{evt.previous || '---'}</strong>
                          </div>
                          <div className="hidden sm:inline text-slate-500 text-[10px]">
                            {new Date(evt.date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} • {new Date(evt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>

                      {/* Live Countdown Clock */}
                      <div className="text-right shrink-0">
                        <div
                          className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                            isReleased
                              ? 'bg-slate-900/90 text-slate-400 border-slate-800'
                              : isUrgent
                              ? 'bg-rose-950/70 text-rose-300 border-rose-600/70 animate-pulse'
                              : 'bg-slate-900/80 text-gold-400 border-gold-500/20'
                          }`}
                        >
                          {countdown}
                        </div>
                        <span className="text-[9px] font-mono text-slate-500 block mt-0.5">
                          {isReleased ? 'Released' : 'Countdown'}
                        </span>
                      </div>
                    </div>

                    {/* Institutional Gold Impact Strategy Strip */}
                    {evt.goldImpactRule && (
                      <div className="mt-2 pt-1.5 border-t border-white/5 text-[10px] font-mono text-gold-400/90 leading-relaxed flex items-start gap-1">
                        <Zap className="w-3 h-3 text-gold-400 shrink-0 mt-0.5" />
                        <span>{evt.goldImpactRule}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 3: Institutional Gold Impact Logic Matrix */}
        {activeTab === 'MATRIX' && (
          <div className="overflow-x-auto max-h-[380px]">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 text-[10px] uppercase bg-black/20">
                  <th className="py-2 px-2.5">Indicator Release</th>
                  <th className="py-2 px-2.5">Hawkish / Hot Bias</th>
                  <th className="py-2 px-2.5">Yields & Dollar Reaction</th>
                  <th className="py-2 px-2.5">Gold Direction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {matrixRules.map((rule, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition">
                    <td className="py-2.5 px-2.5 font-bold text-slate-200">
                      <div>{rule.indicator}</div>
                      <div className="text-[10px] text-slate-500 font-normal mt-0.5">{rule.mechanism}</div>
                    </td>
                    <td className="py-2.5 px-2.5 text-slate-300">{rule.hawkishOutcome}</td>
                    <td className="py-2.5 px-2.5 text-slate-400 text-[11px]">
                      <div>DXY: {rule.dxyReaction}</div>
                      <div>Yields: {rule.yieldsReaction}</div>
                    </td>
                    <td className="py-2.5 px-2.5">
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          rule.goldDirection === 'BULLISH'
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                            : 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
                        }`}
                      >
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

      {/* Footer */}
      <div className="mt-3 pt-2 border-t border-white/5 text-[10px] font-mono text-slate-500 flex items-center justify-between">
        <span>Synced with Forex Factory real-world institutional schedule</span>
        <span className="text-slate-400">Timezone: Local System Clock</span>
      </div>
    </div>
  );
}
