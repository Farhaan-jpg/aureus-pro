import React, { useEffect, useRef, useState } from 'react';
import { BarChart3, Maximize2 } from 'lucide-react';

export default function TradingViewChart() {
  const containerRef = useRef(null);
  const [interval, setInterval] = useState('15');

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if (typeof window.TradingView !== 'undefined' && containerRef.current) {
        new window.TradingView.widget({
          autosize: true,
          symbol: 'OANDA:XAUUSD',
          interval: interval,
          timezone: 'Etc/UTC',
          theme: 'dark',
          style: '1', // Candlestick
          locale: 'en',
          toolbar_bg: '#0a0c12',
          enable_publishing: false,
          hide_side_toolbar: false,
          allow_symbol_change: false,
          container_id: 'tradingview_xauusd_advanced',
          studies: [
            'RSI@tv-basicstudies',
            'MACD@tv-basicstudies',
            'Volume@tv-basicstudies'
          ],
          disabled_features: [
            'header_compare',
            'header_symbol_search'
          ],
          enabled_features: [
            'study_templates',
            'side_toolbar_in_fullscreen_mode'
          ],
          overrides: {
            'paneProperties.background': '#0a0c12',
            'paneProperties.vertGridProperties.color': 'rgba(255, 255, 255, 0.04)',
            'paneProperties.horzGridProperties.color': 'rgba(255, 255, 255, 0.04)',
            'scalesProperties.textColor': '#94a3b8',
            'mainSeriesProperties.candleStyle.upColor': '#10b981',
            'mainSeriesProperties.candleStyle.downColor': '#f43f5e',
            'mainSeriesProperties.candleStyle.drawWick': true,
            'mainSeriesProperties.candleStyle.drawBorder': true,
            'mainSeriesProperties.candleStyle.borderColor': '#374151',
            'mainSeriesProperties.candleStyle.borderUpColor': '#10b981',
            'mainSeriesProperties.candleStyle.borderDownColor': '#f43f5e',
            'mainSeriesProperties.candleStyle.wickUpColor': '#10b981',
            'mainSeriesProperties.candleStyle.wickDownColor': '#f43f5e',
          }
        });
      }
    };

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [interval]);

  const intervals = [
    { label: '15M', value: '15' },
    { label: '1H', value: '60' },
    { label: '4H', value: '240' },
    { label: '1D', value: 'D' },
  ];

  return (
    <div className="hud-panel p-3.5 flex flex-col h-[540px]">
      {/* Chart Header Bar */}
      <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-gold-400" />
          <span className="font-mono font-bold text-xs tracking-wider text-slate-200">
            LIVE OANDA:XAUUSD ADVANCED CHART
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 font-mono">
            RSI / MACD / Volume Active
          </span>
        </div>

        {/* Timeframe Controls */}
        <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded border border-white/10">
          {intervals.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setInterval(tf.value)}
              className={`px-2 py-0.5 text-xs font-mono font-semibold rounded transition ${
                interval === tf.value
                  ? 'bg-gold-500 text-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* TradingView Container */}
      <div className="flex-1 w-full rounded overflow-hidden relative">
        <div
          id="tradingview_xauusd_advanced"
          ref={containerRef}
          className="w-full h-full"
        />
      </div>
    </div>
  );
}
