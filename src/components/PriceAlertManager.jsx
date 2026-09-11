import React, { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, CheckCircle, Volume2, X, AlertCircle } from 'lucide-react';
import { speakPriceAlert } from '../utils/voiceAlerts';

const STORAGE_KEY = 'aureus_custom_price_alerts';

export default function PriceAlertManager({
  isOpen,
  onClose,
  currentPrice = 4390,
  voiceEnabled = true
}) {
  const [alerts, setAlerts] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [
        { id: '1', targetPrice: 4400.00, condition: 'above', label: 'Psychological $4,400 Handle', triggered: false },
        { id: '2', targetPrice: 4380.00, condition: 'below', label: 'Major 5M Support Level', triggered: false }
      ];
    } catch (e) {
      return [];
    }
  });

  const [inputPrice, setInputPrice] = useState('');
  const [inputCondition, setInputCondition] = useState('crosses');
  const [inputLabel, setInputLabel] = useState('');

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
    } catch (e) {}
  }, [alerts]);

  // Real-time Tick Trigger Monitor
  useEffect(() => {
    if (!currentPrice) return;

    let modified = false;
    const updated = alerts.map((a) => {
      if (a.triggered) return a;

      let hasTriggered = false;
      if (a.condition === 'above' && currentPrice >= a.targetPrice) {
        hasTriggered = true;
      } else if (a.condition === 'below' && currentPrice <= a.targetPrice) {
        hasTriggered = true;
      } else if (a.condition === 'crosses' && Math.abs(currentPrice - a.targetPrice) <= 0.35) {
        hasTriggered = true;
      }

      if (hasTriggered) {
        modified = true;
        if (voiceEnabled) {
          speakPriceAlert(a.targetPrice, a.condition);
        }
        return { ...a, triggered: true, triggeredAt: new Date().toLocaleTimeString() };
      }
      return a;
    });

    if (modified) {
      setAlerts(updated);
    }
  }, [currentPrice, voiceEnabled, alerts]);

  // Add new alert
  const handleAddAlert = (e) => {
    e.preventDefault();
    const priceNum = parseFloat(inputPrice);
    if (isNaN(priceNum) || priceNum <= 0) return;

    const newAlert = {
      id: Date.now().toString(),
      targetPrice: priceNum,
      condition: inputCondition,
      label: inputLabel.trim() || `XAU/USD ${inputCondition} $${priceNum.toFixed(2)}`,
      triggered: false
    };

    setAlerts([newAlert, ...alerts]);
    setInputPrice('');
    setInputLabel('');
  };

  // Remove alert
  const handleDeleteAlert = (id) => {
    setAlerts(alerts.filter((a) => a.id !== id));
  };

  // Re-arm triggered alert
  const handleRearmAlert = (id) => {
    setAlerts(alerts.map((a) => a.id === id ? { ...a, triggered: false, triggeredAt: null } : a));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-lg flex flex-col rounded-xl border border-white/10 bg-[#0d111a] shadow-2xl overflow-hidden font-mono">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-[#121622]">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-gold-400" />
            <h3 className="font-bold text-sm text-white">
              CUSTOM PRICE LEVEL AUDIO ALERTS
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Price Banner */}
        <div className="px-5 py-2.5 bg-[#080a0f] border-b border-white/5 flex items-center justify-between text-xs">
          <span className="text-slate-400">LIVE GOLD SPOT:</span>
          <span className="text-gold-400 font-bold text-sm">
            ${currentPrice?.toFixed(2) || '---'}
          </span>
          <span className="text-[10px] text-slate-500">
            Voice Alerts: {voiceEnabled ? 'ACTIVE (Indian Male)' : 'MUTED'}
          </span>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
          
          {/* Add Alert Form */}
          <form onSubmit={handleAddAlert} className="p-3.5 rounded-lg bg-[#121622] border border-white/5 space-y-3">
            <span className="font-bold text-slate-200 block text-xs">Create New Price Alert</span>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="number"
                step="0.1"
                placeholder="Target Price ($)"
                value={inputPrice}
                onChange={(e) => setInputPrice(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#090b10] border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:border-gold-500"
                required
              />

              <select
                value={inputCondition}
                onChange={(e) => setInputCondition(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[#090b10] border border-white/10 text-white focus:outline-none focus:border-gold-500"
              >
                <option value="crosses">Price Crosses</option>
                <option value="above">Price &gt;= Level</option>
                <option value="below">Price &lt;= Level</option>
              </select>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded bg-gold-500 hover:bg-gold-400 text-black font-bold active:scale-95 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>SET ALERT</span>
              </button>
            </div>

            <input
              type="text"
              placeholder="Optional note / label (e.g. 5M Liquidity Pool)"
              value={inputLabel}
              onChange={(e) => setInputLabel(e.target.value)}
              className="w-full px-3 py-1.5 rounded bg-[#090b10] border border-white/10 text-white placeholder:text-slate-600 focus:outline-none focus:border-gold-500 text-[11px]"
            />
          </form>

          {/* Alerts List */}
          <div className="space-y-2">
            <span className="text-[11px] text-slate-400 font-bold block">
              Active & Triggered Alerts ({alerts.length})
            </span>

            {alerts.length === 0 ? (
              <div className="p-6 rounded bg-[#090b10] border border-dashed border-white/10 text-center text-slate-500">
                No custom price alerts configured. Set a level above to receive instant voice triggers.
              </div>
            ) : (
              alerts.map((a) => (
                <div
                  key={a.id}
                  className={`p-3 rounded-lg border flex items-center justify-between transition ${
                    a.triggered
                      ? 'bg-amber-950/20 border-amber-500/30 text-amber-300'
                      : 'bg-[#121622] border-white/5 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-full ${a.triggered ? 'bg-amber-500/20 text-amber-400' : 'bg-gold-500/10 text-gold-400'}`}>
                      {a.triggered ? <CheckCircle className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">${a.targetPrice.toFixed(2)}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 uppercase">
                          {a.condition}
                        </span>
                        {a.triggered && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">
                            TRIGGERED {a.triggeredAt}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 block mt-0.5">{a.label}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {a.triggered && (
                      <button
                        onClick={() => handleRearmAlert(a.id)}
                        className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[10px] text-slate-300 transition"
                        title="Re-arm alert"
                      >
                        RE-ARM
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteAlert(a.id)}
                      className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition"
                      title="Delete alert"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 bg-[#090b10] flex items-center justify-between text-[11px] text-slate-500">
          <span>Alerts persist in browser localStorage</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white font-bold text-xs"
          >
            CLOSE
          </button>
        </div>

      </div>
    </div>
  );
}
