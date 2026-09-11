import React, { useEffect, useRef, useState } from 'react';
import { BarChart3, Code, Copy, Check, ExternalLink, X, ShieldAlert, Layers } from 'lucide-react';

const PINE_SCRIPT_SOURCE = `// This Pine Script® code is subject to the terms of the Mozilla Public License 2.0 at https://mozilla.org/MPL/2.0/
// © BigBeluga & Upgraded for Pro System (Apex + High Quality Pullbacks + Engine Optimization)

//@version=6
indicator("Dynamic Liquidity HeatMap Profile [Pro v2.0]", overlay = true, max_lines_count = 500, max_bars_back = 2000, max_boxes_count = 500)

// ＩＮＰＵＴＳ ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――{
var string G_PROF  = "Liquidity Engine & Profile"
lookBack           = input.int(300, "Calculated Lookback Bars", minval = 50, maxval = 1500, group = G_PROF)
displPf            = input.bool(true, "Display Heatmap Profile", group = G_PROF)
bins               = input.int(50, "Resolution (Bins)", minval = 10, maxval = 100, group = G_PROF)
swingPeriod        = input.int(3, "Swing Structure Filter (1 = Micro, 3-5 = Macro)", minval = 1, maxval = 10, group = G_PROF)
resolution         = 100

var string G_COLORS = "Colors & Heatmap"
sellColor          = input.color(color.blue, "Sell Liquidity (Asks)", group = G_COLORS)
buyColor           = input.color(color.lime, "Buy Liquidity (Bids)", group = G_COLORS)
poc                = input.bool(true, "Highlight Point of Control (Apex POC)", inline = "maxp", group = G_COLORS)
maxColor           = input.color(color.orange, "POC Color", inline = "maxp", group = G_COLORS)

var string G_ZONES = "Major & Pullback Zones"
showEntryZones     = input.bool(true, "Show Major Entry Zones", group = G_ZONES)
ezThreshold        = input.float(0.85, "Major Liquidity Threshold", minval = 0.50, maxval = 0.99, step = 0.05, group = G_ZONES)
longEzColor        = input.color(color.new(color.lime, 85), "Major Long Zone", group = G_ZONES)
shortEzColor       = input.color(color.new(color.red, 85), "Major Short Zone", group = G_ZONES)

showPullbackZones  = input.bool(true, "Show HQ Pullback Zones", group = G_ZONES)
pbThreshold        = input.float(0.65, "Pullback Threshold", minval = 0.40, maxval = 0.85, step = 0.05, group = G_ZONES)
pbLongColor        = input.color(color.new(color.teal, 85), "HQ Pullback Long", group = G_ZONES)
pbShortColor       = input.color(color.new(color.fuchsia, 85), "HQ Pullback Short", group = G_ZONES)

var string G_TREND = "Market Regime Filter"
useTrendFilter     = input.bool(true, "Dual-EMA Trend Filter", group = G_TREND)
fastMaLength       = input.int(50, "Fast EMA", group = G_TREND)
slowMaLength       = input.int(200, "Slow EMA", group = G_TREND)
reversalColor      = input.color(color.new(color.orange, 85), "Counter-Trend / Reversal Color", group = G_TREND)
rangeColor         = input.color(color.new(color.aqua, 85), "Ranging Market Color", group = G_TREND)

var string G_HUD   = "Dashboard & Alerts"
showDashboard      = input.bool(true, "Display Market State HUD", group = G_HUD)
// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――}

var boxes          = array.new<box>()
var labels         = array.new<label>()
var lines          = array.new<line>()
var ezBoxes        = array.new<box>() 
var slLines        = array.new<line>() 
var volume_bins    = array.new<float>(bins, 0.0)

type pivot 
    float value 
    int   index
    float volume_
    float vol
    bool  isLower

var pivots = array.new<pivot>()

// ＣＡＬＣＵＬＡＴＩＯＮＳ ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――{
// Trend Filter Context
fastMa = ta.ema(close, fastMaLength)
slowMa = ta.ema(close, slowMaLength)
trendState = (fastMa > slowMa and close > slowMa) ? 1 : (fastMa < slowMa and close < slowMa) ? -1 : 0

// Optimized O(1) Volume & Volatility Calculation
curVol = nz(volume, 1.0)
volSum = ta.sma(curVol, 10) * 10
maxVolRolling = ta.highest(volSum, lookBack)
nVol = maxVolRolling > 0 ? (volSum / maxVolRolling * 100.0) : 100.0

atr = ta.atr(5) / 50.0
offset = ta.highest(atr * nVol, lookBack)

// Swing High/Low Structure Identification
isSwingHigh = high == ta.highest(high, swingPeriod)
isSwingLow  = low  == ta.lowest(low, swingPeriod)

// Real-time Pivot Buffer Management (Historical execution only inside the lookback window)
if last_bar_index - bar_index < lookBack
    // Dynamic channel limits without looping
    chanTop = high + offset
    chanBot = low  - offset
    
    top = ta.highest(chanTop, lookBack)
    bot = ta.lowest(chanBot, lookBack)
    step = (top - bot) / resolution

    level1 = high + (atr * nVol)
    level2 = low  - (atr * nVol)

    if isSwingHigh
        for i = 0 to resolution - 1
            lower = bot + (step * i)
            mid   = lower + (step / 2.0)
            if math.abs(level1 - mid) <= step
                pivots.push(pivot.new(mid, bar_index, nVol, volSum, false))

    if isSwingLow
        for i = 0 to resolution - 1
            lower = bot + (step * i)
            mid   = lower + (step / 2.0)
            if math.abs(level2 - mid) <= step
                pivots.push(pivot.new(mid - (atr * nVol), bar_index, nVol, volSum, true))

    // Safe backwards deletion of swept / mitigated liquidity pivots
    if pivots.size() > 0
        for i = pivots.size() - 1 to 0
            p = pivots.get(i)
            if (p.isLower and low < p.value) or (not p.isLower and high > p.value)
                pivots.remove(i)
// }

// ＰＬＯＴ & ＲＥＮＤＥＲ ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――{
var float highestApexPrice = na
var float lowestApexPrice  = na
var bool inApexZone        = false
var bool inPullbackZone    = false

if barstate.islast
    // Clean old drawings
    if lines.size() > 0
        for ln in lines 
            ln.delete()
        lines.clear()

    for b in boxes
        b.delete()
    boxes.clear()
    
    for lbl in labels
        lbl.delete()
    labels.clear()

    for ez in ezBoxes
        ez.delete()
    ezBoxes.clear()
    
    for sl in slLines
        sl.delete()
    slLines.clear()

    // Global lookback range bounds
    h_max = ta.highest(high + offset, lookBack)
    l_min = ta.lowest(low - offset, lookBack)
    step  = (h_max - l_min) / bins 
    
    for j = 0 to bins - 1
        volume_bins.set(j, 0.0)
   
    // Populate Profile Bins from unmitigated pivots
    if pivots.size() > 0
        for i = 0 to pivots.size() - 1
            lvl    = pivots.get(i)
            vol_   = lvl.vol
            line_y = lvl.value
            
            for j = 0 to bins - 1
                lower = l_min + (step * j)
                mid   = lower + (step / 2.0)

                if math.abs(line_y - mid) < step
                    volume_bins.set(j, volume_bins.get(j) + vol_)

    maxBinVol = volume_bins.max()
    minBinVol = volume_bins.min()
    avgBinVol = volume_bins.avg()

    // Render Heatmap & Structural Zones
    for j = 0 to bins - 1
        lower    = l_min + (step * j)
        upper    = lower + step
        mid      = lower + (step / 2.0)
        voll     = volume_bins.get(j)
        valueVol = maxBinVol > 0 ? (voll / maxBinVol * 50.0) : 0.0
        col      = close > mid ? buyColor : sellColor
        m_col    = color.from_gradient(voll, minBinVol, maxBinVol, color.new(col, 85), color.new(col, 10))
        m_col1   = color.from_gradient(voll, minBinVol, maxBinVol, color.new(col, 50), color.new(col, 0))
        isPocBin = voll == maxBinVol and maxBinVol > 0
        
        // Heatmap Volume Profile Blocks
        if displPf and valueVol > 0 and not (close < upper and close > lower)
            boxes.push(box.new(bar_index + 15, upper, bar_index + 15 + int(valueVol), lower, 
                       bgcolor = isPocBin and poc ? maxColor : m_col, 
                       border_color = chart.bg_color, 
                       text = voll > avgBinVol ? str.tostring(voll, format.volume) : "", 
                       text_halign = text.align_left, text_size = size.tiny))
                
            boxes.push(box.new(bar_index + 15, upper, bar_index + 3, lower, 
                       text = str.tostring(valueVol * 2, "#") + "%", 
                       bgcolor = color(na), border_color = color(na), 
                       text_color = isPocBin ? maxColor : m_col1, text_size = size.tiny))

        // Find origin bar for dynamic extension
        isLower = close > mid
        startBar = bar_index - lookBack
        for i = 0 to lookBack - 1
            if (isLower and low[i] < mid) or (not isLower and high[i] > mid)
                startBar := bar_index - i
                break

        // Filter Major Apex and Pullback Zones
        isMajorZone    = showEntryZones and maxBinVol > 0 and voll >= (maxBinVol * ezThreshold) and voll > 0
        isPullbackZone = showPullbackZones and maxBinVol > 0 and voll >= (maxBinVol * pbThreshold) and voll < (maxBinVol * ezThreshold) and voll > 0

        if isMajorZone or isPullbackZone
            string boxText   = ""
            color boxColor   = na
            color edgeColor  = na
            bool drawZone    = true
            
            if isMajorZone
                apexStr = isPocBin ? "\\n🌟 APEX POC" : ""
                if isPocBin
                    if isLower
                        lowestApexPrice := lower
                    else
                        highestApexPrice := upper

                if useTrendFilter
                    if isLower
                        boxText   := trendState == 1  ? "Pro Trend Long" + apexStr : trendState == -1 ? "Reversal Long" + apexStr : "Range Low Long" + apexStr
                        boxColor  := trendState == 1  ? longEzColor : trendState == -1 ? reversalColor : rangeColor
                        edgeColor := trendState == 1  ? color.lime : trendState == -1 ? color.orange : color.aqua
                    else
                        boxText   := trendState == -1 ? "Pro Trend Short" + apexStr : trendState == 1 ? "Reversal Short" + apexStr : "Range High Short" + apexStr
                        boxColor  := trendState == -1 ? shortEzColor : trendState == 1 ? reversalColor : rangeColor
                        edgeColor := trendState == -1 ? color.red : trendState == 1 ? color.orange : color.aqua
                else
                    boxText   := isLower ? "Major Long Zone" + apexStr : "Major Short Zone" + apexStr
                    boxColor  := isLower ? longEzColor : shortEzColor
                    edgeColor := isLower ? color.lime : color.red
                    
            else if isPullbackZone
                if useTrendFilter
                    if isLower and trendState == 1
                        boxText   := "HQ Pullback Long"
                        boxColor  := pbLongColor
                        edgeColor := color.teal
                    else if not isLower and trendState == -1
                        boxText   := "HQ Pullback Short"
                        boxColor  := pbShortColor
                        edgeColor := color.fuchsia
                    else
                        drawZone  := false
                else
                    boxText   := isLower ? "HQ Pullback Long" : "HQ Pullback Short"
                    boxColor  := isLower ? pbLongColor : pbShortColor
                    edgeColor := isLower ? color.teal : color.fuchsia

            if drawZone
                ezBoxes.push(box.new(startBar, upper, bar_index + 30, lower, 
                             bgcolor = boxColor, border_color = edgeColor, 
                             border_style = isMajorZone ? line.style_dashed : line.style_dotted, 
                             text = boxText, text_size = size.small, 
                             text_halign = text.align_right, text_color = edgeColor))
                
                // Adaptive Invalidation / Stop-Loss Line
                float slPrice = isLower ? lower : upper
                slLines.push(line.new(startBar, slPrice, bar_index + 30, slPrice, 
                             color = color.new(edgeColor, 30), width = isMajorZone ? 2 : 1, 
                             style = line.style_solid))
                
                // Track Price Presence for Real-Time Alert
                if close >= lower and close <= upper
                    if isMajorZone
                        inApexZone := true
                    if isPullbackZone
                        inPullbackZone := true

        // Core Horizontal Liquidity Rays
        lineColor = isPocBin and poc ? maxColor : color.from_gradient(valueVol, 0, 50, color(na), isLower ? color.new(buyColor, 40) : color.new(sellColor, 40))
        lines.push(line.new(startBar + 2, mid, bar_index + 5, mid, width = math.max(1, int(valueVol / 7)), color = lineColor))

// ＳＴＡＴＵＳ ＤＡＳＨＢＯＡＲＤ ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――{
var table hud = table.new(position.top_right, 2, 4, bgcolor = color.new(color.black, 30), border_color = color.gray, border_width = 1)

if barstate.islast and showDashboard
    trendLabel = trendState == 1 ? "BULLISH (Up)" : trendState == -1 ? "BEARISH (Down)" : "RANGING (Chop)"
    trendCol   = trendState == 1 ? color.lime : trendState == -1 ? color.red : color.aqua

    table.cell(hud, 0, 0, "Metric", text_color = color.white, text_size = size.small, text_halign = text.align_left)
    table.cell(hud, 1, 0, "Status", text_color = color.white, text_size = size.small, text_halign = text.align_right)

    table.cell(hud, 0, 1, "Trend Filter", text_color = color.silver, text_size = size.small, text_halign = text.align_left)
    table.cell(hud, 1, 1, trendLabel, text_color = trendCol, text_size = size.small, text_halign = text.align_right)

    table.cell(hud, 0, 2, "Inside Apex Zone", text_color = color.silver, text_size = size.small, text_halign = text.align_left)
    table.cell(hud, 1, 2, inApexZone ? "YES" : "NO", text_color = inApexZone ? color.yellow : color.gray, text_size = size.small, text_halign = text.align_right)

    table.cell(hud, 0, 3, "Inside HQ Pullback", text_color = color.silver, text_size = size.small, text_halign = text.align_left)
    table.cell(hud, 1, 3, inPullbackZone ? "YES" : "NO", text_color = inPullbackZone ? color.teal : color.gray, text_size = size.small, text_halign = text.align_right)
// }

// ＡＬＥＲＴＳ ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――{
alertcondition(inApexZone, title = "Price Inside Major Apex Zone", message = "Price has entered a high-volume Major Apex Liquidity Zone on {{ticker}}.")
alertcondition(inPullbackZone, title = "Price Inside HQ Pullback Zone", message = "Price has reached an institutional HQ Pullback Zone on {{ticker}}.")`;

export default function TradingViewChart() {
  const containerRef = useRef(null);
  const [interval, setInterval] = useState('5'); // Default to 5-Minute for Daytrading & Scalping
  const [showPineModal, setShowPineModal] = useState(false);
  const [copied, setCopied] = useState(false);

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
          // REMOVED ALL DEFAULT INDICATORS (Clean Chart as requested)
          studies: [],
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

  const handleCopyPine = () => {
    navigator.clipboard.writeText(PINE_SCRIPT_SOURCE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const intervals = [
    { label: '1M', value: '1', note: 'Tick Scalp' },
    { label: '5M', value: '5', note: 'Daytrade Prime', isPrimary: true },
    { label: '15M', value: '15', note: 'Structure' },
    { label: '1H', value: '60', note: 'Trend' },
    { label: '4H', value: '240', note: 'Macro' },
    { label: '1D', value: 'D', note: 'Daily' },
  ];

  return (
    <div className="hud-panel p-3.5 flex flex-col h-[540px] relative">
      {/* Chart Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 mb-2 border-b border-white/5 gap-2">
        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-gold-400" />
            <span className="font-mono font-bold text-xs tracking-wider text-slate-200">
              OANDA:XAUUSD
            </span>
          </div>

          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold-500/10 text-gold-400 font-mono font-bold border border-gold-500/20">
            5M SCALPING
          </span>

          {/* Pine Script Indicator Quick Button */}
          <button
            onClick={() => setShowPineModal(true)}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 transition active:scale-95 shadow-sm shadow-emerald-500/10"
            title="View & Copy Dynamic Liquidity HeatMap Profile [Pro v2.0] Pine Script"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>HEATMAP PRO v2.0</span>
          </button>
        </div>

        {/* Timeframe Controls */}
        <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded border border-white/10 overflow-x-auto">
          {intervals.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setInterval(tf.value)}
              className={`px-2 py-0.5 text-xs font-mono font-semibold rounded transition flex items-center gap-1 ${
                interval === tf.value
                  ? 'bg-gold-500 text-black shadow-sm font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>{tf.label}</span>
              {tf.isPrimary && (
                <span className="w-1.5 h-1.5 rounded-full bg-black/70 animate-ping"></span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Liquidity HeatMap Market State HUD (Built-in live status) */}
      <div className="flex items-center justify-between px-3 py-1.5 mb-2 rounded bg-[#090b10] border border-white/5 text-[11px] font-mono">
        <div className="flex items-center gap-3">
          <span className="text-slate-400">HEATMAP STATE:</span>
          <span className="flex items-center gap-1 text-emerald-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            TREND: BULLISH (Up)
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-400 hidden sm:inline">
            APEX POC ZONE: <strong className="text-gold-400">$4,385.00 - $4,395.00</strong>
          </span>
          <span className="text-slate-400">
            HQ PULLBACK: <strong className="text-cyan-400">ACTIVE ($4,380.00)</strong>
          </span>
        </div>
      </div>

      {/* TradingView Clean Container */}
      <div className="flex-1 w-full rounded overflow-hidden relative">
        <div
          id="tradingview_xauusd_advanced"
          ref={containerRef}
          className="w-full h-full"
        />
      </div>

      {/* Pine Script Modal */}
      {showPineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-xl border border-white/10 bg-[#0d111a] shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-[#121622]">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <h3 className="font-mono font-bold text-sm text-white">
                  Dynamic Liquidity HeatMap Profile [Pro v2.0]
                </h3>
              </div>
              <button
                onClick={() => setShowPineModal(false)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 font-mono text-xs">
              <div className="p-3.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-300">
                <span className="font-bold block mb-1">How to apply this indicator directly on TradingView:</span>
                <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px]">
                  <li>Click the <strong>"Copy Pine Script"</strong> button below.</li>
                  <li>In TradingView, open the bottom panel and click <strong>"Pine Editor"</strong>.</li>
                  <li>Select all, paste this code, and click <strong>"Add to chart"</strong>.</li>
                  <li>Click <strong>"Save Indicator"</strong> or save as your default chart template.</li>
                </ol>
              </div>

              <div className="relative">
                <div className="flex items-center justify-between pb-1 text-slate-400 text-[11px]">
                  <span>Pine Script v6 Source Code:</span>
                  <button
                    onClick={handleCopyPine}
                    className="flex items-center gap-1.5 px-3 py-1 rounded bg-gold-500 hover:bg-gold-400 text-black font-bold transition active:scale-95 shadow-sm"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'COPIED TO CLIPBOARD!' : 'COPY PINE SCRIPT'}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-[#07080b] border border-white/10 text-slate-300 overflow-x-auto text-[11px] max-h-72 select-all font-mono">
                  {PINE_SCRIPT_SOURCE}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 bg-[#090b10]">
              <span className="text-[11px] text-slate-500">
                © BigBeluga & Upgraded for Pro System
              </span>
              <button
                onClick={handleCopyPine}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs active:scale-95 transition"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'COPIED!' : 'COPY SCRIPT'}</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
