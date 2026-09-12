import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import Header from './components/Header';
import MobileNav from './components/MobileNav';
import MacroDriversGrid from './components/MacroDriversGrid';
import CompositeBiasMeter from './components/CompositeBiasMeter';
import NewsSentimentFeed from './components/NewsSentimentFeed';
import SessionRecapPanel from './components/SessionRecapPanel';
import OrderBookSentiment from './components/OrderBookSentiment';
import EconomicCalendar from './components/EconomicCalendar';
import MultiTimeframeMatrix from './components/MultiTimeframeMatrix';
import SessionJudasRadar from './components/SessionJudasRadar';
import CotReportGauge from './components/CotReportGauge';
import GeoRiskPanel from './components/GeoRiskPanel';
import GoldEtfPanel from './components/GoldEtfPanel';
import DataHealthMonitor from './components/DataHealthMonitor';
import SeasonalityPanel from './components/SeasonalityPanel';
import PriceAlertManager from './components/PriceAlertManager';
import SettingsModal from './components/SettingsModal';
import KeyLevelsPanel from './components/KeyLevelsPanel';
import VolatilityRegimePanel from './components/VolatilityRegimePanel';
import RealtimePulsePanel from './components/RealtimePulsePanel';
import SirenBanner from './components/SirenBanner';
import NowcastPanel from './components/NowcastPanel';
import NewsLockoutBanner from './components/NewsLockoutBanner';
import {
  getVoiceSettings,
  saveVoiceSettings,
  speakBiasFlip,
  speakEventImminent,
  speakBreakingNews,
  speakHandleSweep,
  speakSiren,
  speakSurprise,
  speakLevelAlert
} from './utils/voiceAlerts';
import {
  getBuddySettings,
  saveBuddySettings,
  nextCharacter,
  getCharacters,
  getChatterRange,
  announce,
  speakGreeting
} from './utils/buddyMode';

// Heavy TradingView widget (large inline Pine Script) — lazy-loaded at module scope
// so its component identity stays stable across re-renders (a locally-defined lazy
// component would remount on every market tick and cause constant chart flicker).
const TradingViewChart = lazy(() => import('./components/TradingViewChart'));

export default function App() {
  const [marketData, setMarketData] = useState(null);
  const [news, setNews] = useState([]);
  const [bias, setBias] = useState(null);
  const [retail, setRetail] = useState(null);
  const [calendar, setCalendar] = useState(null);
  const [timeframes, setTimeframes] = useState(null);
  const [geo, setGeo] = useState(null);
  const [etf, setEtf] = useState(null);
  const [sessionRecap, setSessionRecap] = useState(null);
  const [realtimePulse, setRealtimePulse] = useState(null);
  const [siren, setSiren] = useState(null);
  const [nowCast, setNowCast] = useState(null);
  const [riskOff, setRiskOff] = useState(null);
  const [newsLockout, setNewsLockout] = useState(null);
  const [levelAlerts, setLevelAlerts] = useState([]);

  const [isLive, setIsLive] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Operator health snapshot: polled from /api/health so the terminal wears
  // its own failures (DEGRADED) instead of only reporting them to machines.
  const [health, setHealth] = useState(null);
  const [reconnecting, setReconnecting] = useState(false);

  // Mobile-first section switch. Desktop ignores it (section always 'all').
  const [section, setSection] = useState('live');
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const onChange = (e) => {
      setIsMobile(e.matches);
      if (!e.matches) setSection('all');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const vis = (tab) => (!isMobile || section === 'all' || section === tab) ? '' : 'hidden';
  const onSelectSection = (tab) => {
    setSection(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const stagger = (i) => ({ animationDelay: `${70 + i * 55}ms` });

  // Settings & Voice Controls
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPriceAlertsOpen, setIsPriceAlertsOpen] = useState(false);
  const [voiceConfig, setVoiceConfig] = useState(getVoiceSettings());

  // Buddy Mode: persona + chatter engine (see utils/buddyMode.js)
  const [buddyState, setBuddyState] = useState(getBuddySettings());
  const buddyChar = getCharacters().find(c => c.id === buddyState.characterId) || getCharacters()[0];

  // Voice/Buddy Alert Tracking Refs to prevent spam
  const lastBiasRef = useRef(null);
  const lastSpokenNewsIdRef = useRef(null);
  const lastSpokenHandleRef = useRef(null);
  const alertedEventsRef = useRef(new Set());
  const prevPriceRef = useRef(null);
  const lastMoveSpokenAtRef = useRef(0);
  const lastMarketOpenRef = useRef(null);
  const wasDegradedRef = useRef(false);
  const greetedRef = useRef(false);

  // Quick Voice Toggle
  const handleToggleVoice = useCallback(() => {
    const updated = saveVoiceSettings({ enabled: !voiceConfig.enabled });
    setVoiceConfig({ ...updated });
  }, [voiceConfig.enabled]);

  // Budget-friendly market session window (mirrors server session util):
  // opens Sunday 22:00 UTC, closes Friday 21:00 UTC.
  const isMarketOpenNow = useCallback(() => {
    const now = new Date();
    const utcDay = now.getUTCDay();
    const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
    if (utcDay === 0) return utcHours >= 22;
    if (utcDay === 5) return utcHours < 21;
    if (utcDay === 6) return false;
    return true;
  }, []);

  // Cycle Buddy: next character + greet from the new persona
  const cycleBuddy = useCallback(() => {
    const { settings } = nextCharacter();
    setBuddyState({ ...settings });
    speakGreeting();
  }, []);

  // Boot-time sync + resync when SettingsModal closes
  const resyncBuddy = useCallback(() => {
    setBuddyState(getBuddySettings());
  }, []);

  // Active health poll so the HUD reflects feed degradation in real time
  useEffect(() => {
    let cancelled = false;
    const pollHealth = async () => {
      try {
        const r = await fetch('/api/health');
        const h = await r.json();
        if (!cancelled && h?.status) setHealth(h);
      } catch (err) {}
    };
    pollHealth();
    const t = setInterval(pollHealth, 30000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // Initial Fetch of all dashboard data — non-blocking: each feed paints the
  // moment it arrives instead of waiting for the slowest endpoint (GDELT/ETF).
  const loadInitialData = useCallback(() => {
    const endpoints = [
      ['market-data', (d) => { if (d?.goldSpot) setMarketData(d); }],
      ['news', (d) => {
        if (d?.news) {
          setNews(d.news);
          if (!lastSpokenNewsIdRef.current && d.news[0]?.title) {
            lastSpokenNewsIdRef.current = d.news[0].title;
          }
        }
      }],
      ['composite-bias', (d) => {
        if (d) {
          setBias(d);
          if (!lastBiasRef.current && d.label) lastBiasRef.current = d.label;
        }
      }],
      ['orderbook-sentiment', (d) => { if (d) setRetail(d); }],
      ['economic-calendar', (d) => { if (d) setCalendar(d); }],
      ['geo-risk', (d) => { if (d) setGeo(d); }],
      ['etf-flows', (d) => { if (d) setEtf(d); }],
      ['timeframes', (d) => { if (d) setTimeframes(d); }],
      ['realtime-pulse', (d) => { if (d) setRealtimePulse(d); }],
      ['nowcast', (d) => { if (d) setNowCast(d); }],
      ['risk-off', (d) => { if (d) setRiskOff(d); }],
      ['news-lockout', (d) => { if (d) setNewsLockout(d); }],
      ['level-alerts', (d) => { if (Array.isArray(d?.alerts)) setLevelAlerts(d.alerts); }]
    ];
    for (const [path, apply] of endpoints) {
      fetch(`/api/${path}`)
        .then((r) => r.json())
        .then(apply)
        .catch((err) => console.error(`Error fetching /api/${path}:`, err));
    }
  }, []);

  // Real-Time Server-Sent Events (SSE) Bus Listener
  const liveRef = useRef(false);
  useEffect(() => {
    loadInitialData();

    // Populate the recap panel with the latest known recap before the next close.
    fetch('/api/session-recap')
      .then((r) => r.json())
      .then((d) => { if (d?.recap?.summaryText) setSessionRecap(d.recap); })
      .catch(() => {});

    let eventSource = null;
    let reconnectTimeout = null;

    function connectSSE() {
      eventSource = new EventSource('/api/stream');

      eventSource.onopen = () => {
        liveRef.current = true;
        setIsLive(true);
        setReconnecting(false);
      };

      eventSource.addEventListener('CONNECTED', (e) => {
        liveRef.current = true;
        setIsLive(true);
        setReconnecting(false);
      });

      eventSource.addEventListener('TICK_UPDATE', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.marketData) {
            setMarketData(data.marketData);
            // 5M Key Handle Liquidity Sweeps ($10 Psychological Levels)
            const currentPrice = data.marketData.goldSpot?.price;
            if (currentPrice) {
              const nearestHandle = Math.round(currentPrice / 10) * 10;
              if (Math.abs(currentPrice - nearestHandle) < 0.20 && lastSpokenHandleRef.current !== nearestHandle) {
                lastSpokenHandleRef.current = nearestHandle;
                speakHandleSweep(nearestHandle);
              }
            }
          }
          if (data.timeframes) setTimeframes(data.timeframes);
          if (data.bias) {
            setBias(data.bias);
            // Institutional Bias Flip Detection
            if (lastBiasRef.current && lastBiasRef.current !== data.bias.label) {
              speakBiasFlip(data.bias.label, data.bias.score);
            }
            lastBiasRef.current = data.bias.label;
          }
          if (data.retail) setRetail(data.retail);
        } catch (err) {}
      });

      eventSource.addEventListener('NEWS_UPDATE', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.geo) setGeo(data.geo);
          if (data.news && data.news.length > 0) {
            setNews(data.news);
            const latest = data.news[0];
            // Breaking Bullion News Alert
            if (lastSpokenNewsIdRef.current && lastSpokenNewsIdRef.current !== latest.title) {
              if (Math.abs(latest.score || 0) >= 30) {
                speakBreakingNews(latest.title, latest.sentiment);
              }
            }
            lastSpokenNewsIdRef.current = latest.title;
          }
        } catch (err) {}
      });

      eventSource.addEventListener('MACRO_UPDATE', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.geo) setGeo(data.geo);
          if (data.etf) setEtf(data.etf);
          if (data.timeframes) setTimeframes(data.timeframes);
        } catch (err) {}
      });

      eventSource.addEventListener('FULL_SYNC', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.marketData) setMarketData(data.marketData);
          if (data.news) setNews(data.news);
          if (data.bias) setBias(data.bias);
          if (data.retail) setRetail(data.retail);
          if (data.timeframes) setTimeframes(data.timeframes);
          if (data.geo) setGeo(data.geo);
          if (data.etf) setEtf(data.etf);
          if (data.nowCast) setNowCast(data.nowCast);
          if (data.riskOff) setRiskOff(data.riskOff);
          if (data.newsLockout) setNewsLockout(data.newsLockout);
          if (Array.isArray(data.levelAlerts)) setLevelAlerts(data.levelAlerts);
        } catch (err) {}
      });

      eventSource.addEventListener('SESSION_RECAP', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.summaryText) setSessionRecap(data);
        } catch (err) {}
      });

      eventSource.addEventListener('REALTIME_PULSE', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data?.pulse) setRealtimePulse(data.pulse);
        } catch (err) {}
      });

      eventSource.addEventListener('SIREN', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data?.id && data?.firedAt) {
            setSiren(data);
            const price = Number(data.price) || 0;
            speakSiren(data.direction || 'UNKNOWN', price, data.factorCount || data.factors?.length || 0);
          }
        } catch (err) {}
      });

      eventSource.addEventListener('NOWCAST', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data) setNowCast(data);
        } catch (err) {}
      });

      eventSource.addEventListener('RISK_ADVISORY', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data?.level) setRiskOff(data);
        } catch (err) {}
      });

      eventSource.addEventListener('NEWS_LOCKOUT', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data) setNewsLockout(data);
        } catch (err) {}
      });

      eventSource.addEventListener('LEVEL_ALERT', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data?.key && data?.firedAt) {
            setLevelAlerts((prev) => [data, ...prev].slice(0, 12));
            speakLevelAlert(data.side, data.label, data.current);
          }
        } catch (err) {}
      });

      eventSource.addEventListener('EVENT_ACTUAL', (e) => {
        try {
          const data = JSON.parse(e.data);
          const outcome = data?.outcome;
          if (outcome?.surprise?.direction) {
            speakSurprise(
              outcome.event?.title || 'Economic data',
              outcome.surprise.direction.toLowerCase(),
              outcome.surprise.magnitude
            );
          }
        } catch (err) {}
      });

      eventSource.onerror = () => {
        liveRef.current = false;
        setIsLive(false);
        setReconnecting(true);
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        // Zero-delay fast reconnect (800ms)
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(connectSSE, 800);
      };
    }

    connectSSE();

    // Fast 1.5s fallback polling in case SSE is reconnecting (uses ref, not stale closure)
    const pollInterval = setInterval(() => {
      if (!liveRef.current) {
        fetch('/api/market-data')
          .then(r => r.json())
          .then(data => {
            if (data?.goldSpot) setMarketData(data);
          })
          .catch(() => {});
      }
    }, 1500);

    // Instant sync when trader switches back to this tab
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadInitialData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      clearInterval(pollInterval);
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  }, [loadInitialData]);

  // High-Impact Economic Event Imminent (< 5m) Countdown Watcher
  useEffect(() => {
    if (!calendar?.events || calendar.events.length === 0) return;

    const checkImminentEvents = () => {
      const now = Date.now();
      calendar.events.forEach(ev => {
        if (ev.impact !== 'High') return;
        const evTime = new Date(ev.date).getTime();
        const diffMin = (evTime - now) / 60000;

        // Between 0 and 5 minutes away
        if (diffMin > 0 && diffMin <= 5.0) {
          const key = `${ev.title}_${ev.date}`;
          if (!alertedEventsRef.current.has(key)) {
            alertedEventsRef.current.add(key);
            speakEventImminent(ev.title, Math.max(1, Math.round(diffMin)));
          }
        }
      });
    };

    checkImminentEvents();
    const timer = setInterval(checkImminentEvents, 20000); // Check every 20s
    return () => clearInterval(timer);
  }, [calendar]);

  // Live Browser Tab Title Ticker (Bloomberg / TradingView style)
  useEffect(() => {
    const gold = marketData?.goldSpot;
    if (gold?.price) {
      const priceStr = `$${Number(gold.price).toFixed(2)}`;
      const pct = gold.changePercent || 0;
      const sign = pct >= 0 ? '+' : '';
      const pctStr = `(${sign}${Number(pct).toFixed(2)}%)`;
      document.title = `${priceStr} ${pctStr} | XAU/USD Aureus Pro`;
    }
  }, [marketData?.goldSpot?.price, marketData?.goldSpot?.changePercent]);

  // AudioContext & Speech Synthesis Unblock on First User Interaction
  useEffect(() => {
    const unlockAudio = () => {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          const ctx = new AudioContext();
          ctx.resume();
        }
        if (window.speechSynthesis && window.speechSynthesis.resume) {
          window.speechSynthesis.resume();
        }
      } catch (e) {}
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  // ── Buddy Mode engine ────────────────────────────────────────────────────
  // Welcome greet on first live tape
  useEffect(() => {
    if (!greetedRef.current && marketData?.goldSpot?.price && buddyState.buddyEnabled) {
      greetedRef.current = true;
      const t = setTimeout(() => speakGreeting(), 4000);
      return () => clearTimeout(t);
    }
  }, [marketData?.goldSpot?.price, buddyState.buddyEnabled]);

  // Big-move reactions (|price delta| >= 0.12% between ticks, 60s cool-down)
  useEffect(() => {
    const price = marketData?.goldSpot?.price;
    if (typeof price !== 'number' || !buddyState.buddyEnabled) {
      prevPriceRef.current = price;
      return;
    }
    if (prevPriceRef.current != null && prevPriceRef.current !== price) {
      const pct = Math.abs((price - prevPriceRef.current) / prevPriceRef.current) * 100;
      const now = Date.now();
      if (pct >= 0.12 && now - lastMoveSpokenAtRef.current > 60000) {
        lastMoveSpokenAtRef.current = now;
        announce(price > prevPriceRef.current ? 'moveUp' : 'moveDown');
      }
    }
    prevPriceRef.current = price;
  }, [marketData?.goldSpot?.price, buddyState.buddyEnabled]);

  // Market open/close transition announcements
  useEffect(() => {
    const open = isMarketOpenNow();
    if (buddyState.buddyEnabled && lastMarketOpenRef.current != null && lastMarketOpenRef.current !== open) {
      announce(open ? 'marketOpen' : 'marketClosed');
    }
    lastMarketOpenRef.current = open;
  }, [isMarketOpenNow, buddyState.buddyEnabled]);

  // Feed DEGRADED -> healthy transition chatter
  useEffect(() => {
    const degraded = health?.status === 'DEGRADED';
    if (buddyState.buddyEnabled && degraded && !wasDegradedRef.current) {
      announce('degraded');
    }
    wasDegradedRef.current = degraded;
  }, [health?.status, buddyState.buddyEnabled]);

  // Random idle chatter while the tape is live, market is open, tab visible
  useEffect(() => {
    let timeout = null;
    let cancelled = false;

    const schedule = () => {
      if (cancelled) return;
      const [min, max] = getChatterRange();
      const minMs = Math.max(min, 45) * 1000;
      const maxMs = Math.max(max, minMs + 15000) * 1000;
      timeout = setTimeout(() => {
        const settings = getBuddySettings();
        const hasPrice = typeof marketData?.goldSpot?.price === 'number';
        if (
          settings.buddyEnabled && settings.chatterEnabled &&
          !document.hidden && liveRef.current && hasPrice && isMarketOpenNow()
        ) {
          announce('idle');
        }
        schedule();
      }, Math.floor(minMs + Math.random() * (maxMs - minMs)));
    };

    if (buddyState.buddyEnabled) schedule();
    return () => { cancelled = true; if (timeout) clearTimeout(timeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buddyState.buddyEnabled]);

  // Manual Trigger: Sync all market data
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetch('/api/refresh', { method: 'POST' });
      await loadInitialData();
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06070a] text-slate-100 flex flex-col selection:bg-gold-500 selection:text-black">
      {/* Minimal real-time tape */}
      <Header
        marketData={marketData}
        bias={bias}
        isLive={isLive}
        health={health}
        reconnecting={reconnecting}
        isRefreshing={isRefreshing}
        onRefresh={handleManualRefresh}
        voiceEnabled={voiceConfig.enabled}
        onToggleVoice={handleToggleVoice}
        buddyChar={buddyChar}
        buddyEnabled={buddyState.buddyEnabled}
        onCycleBuddy={cycleBuddy}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenPriceAlerts={() => setIsPriceAlertsOpen(true)}
      />

      {reconnecting && (
        <div className="bg-amber-950/60 border-y border-amber-700/40 text-amber-300 text-[11px] font-mono px-4 py-1.5 flex items-center justify-center gap-2 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          RECONNECTING TO TERMINAL STREAM…
        </div>
      )}

      <div className="px-3 lg:px-4 pt-1 space-y-2">
        <NewsLockoutBanner lockout={newsLockout} />
        <SirenBanner siren={siren} onDismiss={() => setSiren(null)} />
      </div>

      {/* Main Terminal Workspace */}
      <main className={`flex-1 max-w-[1920px] w-full mx-auto p-3 lg:p-4 space-y-4 ${isMobile ? 'pb-nav' : ''}`}>

        {/* ── LIVE: chart + bias + structure ─────────────────────────────── */}
        <section className={vis('live')} style={stagger(0)}>
          <div className="anim-panel grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            <div className="lg:col-span-8 flex flex-col h-full">
              <Suspense fallback={
                <div className="hud-panel flex-1 min-h-[340px] lg:min-h-[540px] flex items-center justify-center">
                  <span className="font-mono text-xs text-slate-500 animate-pulse">LOADING LIVE CHART ENGINE...</span>
                </div>
              }>
                <TradingViewChart marketData={marketData} />
              </Suspense>
            </div>
            <div className="lg:col-span-4 flex flex-col h-full">
              <CompositeBiasMeter bias={bias} />
            </div>
          </div>
        </section>

        <section className={`anim-panel ${vis('live')}`} style={stagger(1)}>
          <NowcastPanel thesis={nowCast} riskOff={riskOff} />
        </section>

        <section className={`anim-panel ${vis('live')}`} style={stagger(2)}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            <div className="lg:col-span-7 flex flex-col h-full">
              <KeyLevelsPanel marketData={marketData} levelAlerts={levelAlerts} />
            </div>
            <div className="lg:col-span-5 flex flex-col h-full">
              <VolatilityRegimePanel marketData={marketData} />
            </div>
          </div>
        </section>

        <section className={`anim-panel ${vis('live')}`} style={stagger(3)}>
          <MultiTimeframeMatrix
            matrix={timeframes}
            currentPrice={marketData?.goldSpot?.price}
            changePercent={marketData?.goldSpot?.changePercent || 0}
          />
        </section>

        <section className={`anim-panel ${vis('live')}`} style={stagger(4)}>
          <RealtimePulsePanel pulse={realtimePulse} />
        </section>

        {/* ── MACRO: correlated assets + fundamentals ───────────────────── */}
        <section className={`anim-panel ${vis('macro')}`} style={stagger(5)}>
          <MacroDriversGrid marketData={marketData} />
        </section>

        <section className={`anim-panel ${vis('macro')}`} style={stagger(6)}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
            <div className="flex flex-col h-full"><CotReportGauge /></div>
            <div className="flex flex-col h-full"><SeasonalityPanel /></div>
            <div className="flex flex-col h-full"><GeoRiskPanel geo={geo} /></div>
            <div className="flex flex-col h-full"><GoldEtfPanel etf={etf} /></div>
          </div>
        </section>

        {/* ── FLOW: sentiment + sessions + news ─────────────────────────── */}
        <section className={`anim-panel ${vis('flow')}`} style={stagger(7)}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            <div className="lg:col-span-5 flex flex-col h-full">
              <OrderBookSentiment
                retailData={retail}
                currentGoldPrice={marketData?.goldSpot?.price}
              />
            </div>
            <div className="lg:col-span-7 flex flex-col h-full">
              <SessionJudasRadar currentPrice={marketData?.goldSpot?.price} marketData={marketData} />
            </div>
          </div>
        </section>

        <section className={`anim-panel ${vis('news')}`} style={stagger(8)}>
          {sessionRecap && (
            <div className="mb-3">
              <SessionRecapPanel recap={sessionRecap} />
            </div>
          )}
          <NewsSentimentFeed news={news} />
        </section>

        {/* ── DATA: calendar + integrity ────────────────────────────────── */}
        <section className={`anim-panel ${vis('data')}`} style={stagger(9)}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            <div className="lg:col-span-7 flex flex-col h-full">
              <EconomicCalendar calendarData={calendar} />
            </div>
            <div className="lg:col-span-5 flex flex-col h-full">
              <DataHealthMonitor
                marketData={marketData}
                geo={geo}
                etf={etf}
                timeframes={timeframes}
                calendar={calendar}
                news={news}
              />
            </div>
          </div>
        </section>

      </main>

      {/* Minimal footer */}
      <footer className={`border-t border-white/5 py-2 px-4 text-center text-[10px] font-mono text-slate-600 ${isMobile ? 'pb-nav' : ''}`}>
        <span>AUREUS PRO · XAU/USD INTELLIGENCE BUS v1.0.0 · /healthz</span>
      </footer>

      {/* Mobile section switch */}
      <MobileNav active={section} onSelect={onSelectSection} />

      {/* Terminal Settings & Dispatch Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => { setIsSettingsOpen(false); resyncBuddy(); }}
        onSettingsUpdated={(newVoice) => {
          if (newVoice) setVoiceConfig({ ...newVoice });
        }}
      />

      {/* Custom Price Level Audio Alerts Modal */}
      <PriceAlertManager
        isOpen={isPriceAlertsOpen}
        onClose={() => setIsPriceAlertsOpen(false)}
        currentPrice={marketData?.goldSpot?.price}
        voiceEnabled={voiceConfig.enabled}
      />
    </div>
  );
}