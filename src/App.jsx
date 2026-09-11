import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import TradingViewChart from './components/TradingViewChart';
import MacroDriversGrid from './components/MacroDriversGrid';
import CompositeBiasMeter from './components/CompositeBiasMeter';
import FloorStrategist from './components/FloorStrategist';
import NewsSentimentFeed from './components/NewsSentimentFeed';
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
import {
  getVoiceSettings,
  saveVoiceSettings,
  speakBiasFlip,
  speakEventImminent,
  speakBreakingNews,
  speakHandleSweep
} from './utils/voiceAlerts';

export default function App() {
  const [marketData, setMarketData] = useState(null);
  const [news, setNews] = useState([]);
  const [bias, setBias] = useState(null);
  const [retail, setRetail] = useState(null);
  const [commentary, setCommentary] = useState(null);
  const [calendar, setCalendar] = useState(null);
  const [timeframes, setTimeframes] = useState(null);
  const [geo, setGeo] = useState(null);
  const [etf, setEtf] = useState(null);

  const [isLive, setIsLive] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // Settings & Voice Controls
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPriceAlertsOpen, setIsPriceAlertsOpen] = useState(false);
  const [voiceConfig, setVoiceConfig] = useState(getVoiceSettings());

  // Voice Alert Tracking Refs to prevent spam
  const lastBiasRef = useRef(null);
  const lastSpokenNewsIdRef = useRef(null);
  const lastSpokenHandleRef = useRef(null);
  const alertedEventsRef = useRef(new Set());

  // Quick Voice Toggle
  const handleToggleVoice = useCallback(() => {
    const updated = saveVoiceSettings({ enabled: !voiceConfig.enabled });
    setVoiceConfig({ ...updated });
  }, [voiceConfig.enabled]);

  // Initial Fetch of all dashboard data
  const loadInitialData = useCallback(async () => {
    try {
      const [marketRes, newsRes, biasRes, retailRes, commRes, calRes, geoRes, etfRes, tfRes] = await Promise.all([
        fetch('/api/market-data').then(r => r.json()),
        fetch('/api/news').then(r => r.json()),
        fetch('/api/composite-bias').then(r => r.json()),
        fetch('/api/orderbook-sentiment').then(r => r.json()),
        fetch('/api/strategist').then(r => r.json()),
        fetch('/api/economic-calendar').then(r => r.json()),
        fetch('/api/geo-risk').then(r => r.json()),
        fetch('/api/etf-flows').then(r => r.json()),
        fetch('/api/timeframes').then(r => r.json())
      ]);

      if (marketRes) setMarketData(marketRes);
      if (newsRes?.news) {
        setNews(newsRes.news);
        if (!lastSpokenNewsIdRef.current && newsRes.news[0]?.title) {
          lastSpokenNewsIdRef.current = newsRes.news[0].title;
        }
      }
      if (biasRes) {
        setBias(biasRes);
        if (!lastBiasRef.current && biasRes.label) {
          lastBiasRef.current = biasRes.label;
        }
      }
      if (retailRes) setRetail(retailRes);
      if (commRes) setCommentary(commRes);
      if (calRes) setCalendar(calRes);
      if (geoRes) setGeo(geoRes);
      if (etfRes) setEtf(etfRes);
      if (tfRes) setTimeframes(tfRes);
    } catch (err) {
      console.error('Error fetching initial terminal data:', err);
    }
  }, []);

  // Real-Time Server-Sent Events (SSE) Bus Listener
  const liveRef = useRef(false);
  useEffect(() => {
    loadInitialData();

    let eventSource = null;
    let reconnectTimeout = null;

    function connectSSE() {
      eventSource = new EventSource('/api/stream');

      eventSource.onopen = () => {
        liveRef.current = true;
        setIsLive(true);
      };

      eventSource.addEventListener('CONNECTED', (e) => {
        liveRef.current = true;
        setIsLive(true);
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

      eventSource.addEventListener('STRATEGIST_UPDATE', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.commentary) setCommentary(data.commentary);
        } catch (err) {}
      });

      eventSource.addEventListener('FULL_SYNC', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.marketData) setMarketData(data.marketData);
          if (data.news) setNews(data.news);
          if (data.bias) setBias(data.bias);
          if (data.retail) setRetail(data.retail);
          if (data.commentary) setCommentary(data.commentary);
          if (data.timeframes) setTimeframes(data.timeframes);
          if (data.geo) setGeo(data.geo);
          if (data.etf) setEtf(data.etf);
        } catch (err) {}
      });

      eventSource.onerror = () => {
        liveRef.current = false;
        setIsLive(false);
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

  // Manual Trigger: Force fresh AI Floor Strategist commentary
  const handleGenerateAI = async () => {
    setIsAiGenerating(true);
    try {
      const res = await fetch('/api/strategist/generate', { method: 'POST' });
      const data = await res.json();
      if (data) setCommentary(data);
    } catch (err) {
      console.error('AI Generation failed:', err);
    } finally {
      setIsAiGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07080b] text-slate-100 flex flex-col selection:bg-gold-500 selection:text-black">
      {/* Institutional Navigation & Real-Time Header */}
      <Header
        marketData={marketData}
        bias={bias}
        isLive={isLive}
        isRefreshing={isRefreshing}
        onRefresh={handleManualRefresh}
        onGenerateAI={handleGenerateAI}
        isAiGenerating={isAiGenerating}
        voiceEnabled={voiceConfig.enabled}
        onToggleVoice={handleToggleVoice}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenPriceAlerts={() => setIsPriceAlertsOpen(true)}
      />

      {/* Main Terminal Workspace */}
      <main className="flex-1 max-w-[1920px] w-full mx-auto p-3 sm:p-4 space-y-4">
        
        {/* Top Institutional Layer: Multi-Timeframe Alignment Matrix (1M - 1D) */}
        <div>
          <MultiTimeframeMatrix
            matrix={timeframes}
            currentPrice={marketData?.goldSpot?.price || 4390}
            changePercent={marketData?.goldSpot?.changePercent || 0}
          />
        </div>

        {/* Row 1: Primary Advanced Chart + Floor Strategist AI Commentary */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Module E: TradingView Live Chart (7 cols) */}
          <div className="lg:col-span-7">
            <TradingViewChart marketData={marketData} />
          </div>

          {/* Modules C & D: The Floor Strategist AI Engine (5 cols) */}
          <div className="lg:col-span-5">
            <FloorStrategist
              commentary={commentary}
              onGenerateAI={handleGenerateAI}
              isAiGenerating={isAiGenerating}
            />
          </div>
        </div>

        {/* Row 2: Module A - Correlated Assets & Macro Drivers Grid */}
        <div>
          <MacroDriversGrid marketData={marketData} />
        </div>

        {/* Row 2b: Feed Health Monitor + Gold Seasonality Strip */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-stretch">
          <div className="lg:col-span-7 flex flex-col h-full">
            <DataHealthMonitor
              marketData={marketData}
              geo={geo}
              etf={etf}
              timeframes={timeframes}
              calendar={calendar}
              news={news}
            />
          </div>
          <div className="lg:col-span-5 flex flex-col h-full">
            <SeasonalityPanel />
          </div>
        </div>

        {/* Row 3: Institutional Sentiment & Session Execution Grid (3 cols) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
          {/* Module H: Composite Market Bias & Strength Meter */}
          <div className="flex flex-col h-full">
            <CompositeBiasMeter bias={bias} />
          </div>

          {/* Module G: Order Book Depth & Retail Sentiment Tracker */}
          <div className="flex flex-col h-full">
            <OrderBookSentiment
              retailData={retail}
              currentGoldPrice={marketData?.goldSpot?.price || 4385}
            />
          </div>

          {/* Institutional ICT Session & Judas Swing Radar */}
          <div className="flex flex-col h-full">
            <SessionJudasRadar
              currentPrice={marketData?.goldSpot?.price || 4390}
              marketData={marketData}
            />
          </div>
        </div>

        {/* Row 4: Macro Positioning & Fundamental Catalysts (2 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* CFTC Gold (COMEX) COT Report Gauge (5 cols) */}
          <div className="lg:col-span-5 flex flex-col h-full">
            <CotReportGauge />
          </div>

          {/* Module F: Real-Time Economic Calendar & Gold Impact Matrix (7 cols) */}
          <div className="lg:col-span-7 flex flex-col h-full">
            <EconomicCalendar calendarData={calendar} />
          </div>
        </div>

        {/* Row 4b: Geopolitical Risk Heat + Gold ETF Tape (2 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          <div className="lg:col-span-6 flex flex-col h-full">
            <GeoRiskPanel geo={geo} />
          </div>
          <div className="lg:col-span-6 flex flex-col h-full">
            <GoldEtfPanel etf={etf} />
          </div>
        </div>

        {/* Row 5: Module B - High-Speed News Aggregator & AI Sentiment Classifier */}
        <div>
          <NewsSentimentFeed news={news} />
        </div>

      </main>

      {/* Terminal Footer */}
      <footer className="border-t border-white/5 bg-[#090b10] py-2.5 px-4 text-center text-[11px] font-mono text-slate-500">
        <div className="max-w-[1920px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>AUREUS PRO INSTITUTIONAL GOLD TERMINAL v1.0.0</span>
            <span className="text-slate-600">|</span>
            <span>COMEX / LONDON OTC LIQUIDITY BUS</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Primary AI: Google Gemini 3.6 Flash</span>
            <span>Fallback AI: OpenRouter Multi-Model</span>
            <span>Keep-Alive: /healthz</span>
          </div>
        </div>
      </footer>

      {/* Terminal Settings & Dispatch Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsUpdated={(newVoice) => {
          if (newVoice) setVoiceConfig({ ...newVoice });
        }}
      />

      {/* Custom Price Level Audio Alerts Modal */}
      <PriceAlertManager
        isOpen={isPriceAlertsOpen}
        onClose={() => setIsPriceAlertsOpen(false)}
        currentPrice={marketData?.goldSpot?.price || 4390}
        voiceEnabled={voiceConfig.enabled}
      />
    </div>
  );
}
