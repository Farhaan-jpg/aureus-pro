import React, { useState, useEffect } from 'react';
import { 
  X, Settings, Bot, Volume2, VolumeX, Send, Key, 
  ShieldCheck, AlertTriangle, CheckCircle, RefreshCw, Eye, EyeOff, Sliders, Bell
} from 'lucide-react';
import { 
  getVoiceSettings, 
  saveVoiceSettings, 
  testIndianEnglishVoice,
  getAvailableVoices
} from '../utils/voiceAlerts';

export default function SettingsModal({ isOpen, onClose, onSettingsUpdated }) {
  const [activeTab, setActiveTab] = useState('voice'); // 'voice' | 'ai' | 'telegram' | 'terminal'
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // AI Keys State
  const [geminiKey, setGeminiKey] = useState('');
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [showGemini, setShowGemini] = useState(false);
  const [showOpenRouter, setShowOpenRouter] = useState(false);
  const [serverAiStatus, setServerAiStatus] = useState({ hasGeminiKey: false, hasOpenRouterKey: false });

  // Voice Settings State
  const [voiceConfig, setVoiceConfig] = useState(getVoiceSettings());
  const [availableVoices, setAvailableVoices] = useState([]);
  const [isSpeakingTest, setIsSpeakingTest] = useState(false);

  // Telegram Settings State
  const [telegramConfig, setTelegramConfig] = useState({
    botToken: '',
    chatId: '',
    enabled: false,
    alertTypes: {
      redFolderNews: true,
      breakingNews: true,
      biasFlips: true,
      handleSweeps: true
    }
  });
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [telegramTestResult, setTelegramTestResult] = useState(null);

  // Load configuration on open
  useEffect(() => {
    if (!isOpen) return;

    setVoiceConfig(getVoiceSettings());
    const voices = getAvailableVoices();
    setAvailableVoices(voices);

    // Fetch server settings
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.ai) {
          setServerAiStatus(data.ai);
        }
        if (data.telegram) {
          setTelegramConfig(prev => ({
            ...prev,
            ...data.telegram,
            botToken: prev.botToken || ''
          }));
        }
      })
      .catch(err => console.error('Failed to load server settings:', err));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestVoice = () => {
    setIsSpeakingTest(true);
    // Save current voice preferences so test uses them
    saveVoiceSettings(voiceConfig);
    testIndianEnglishVoice();
    setTimeout(() => setIsSpeakingTest(false), 3000);
  };

  const handleTestTelegram = async () => {
    if (!telegramConfig.botToken || !telegramConfig.chatId) {
      setTelegramTestResult({ success: false, error: 'Enter both Bot Token and Chat ID to send a test alert.' });
      return;
    }

    setIsTestingTelegram(true);
    setTelegramTestResult(null);

    try {
      const res = await fetch('/api/settings/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: telegramConfig.botToken,
          chatId: telegramConfig.chatId
        })
      });
      const data = await res.json();
      setTelegramTestResult(data);
    } catch (err) {
      setTelegramTestResult({ success: false, error: err.message });
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleSaveAll = async () => {
    setLoading(true);
    setErrorMsg('');
    setSaveSuccess(false);

    try {
      // 1. Save Voice Settings to localStorage
      saveVoiceSettings(voiceConfig);

      // 2. Sync to Backend (/api/settings)
      const payload = {
        telegram: telegramConfig
      };
      if (geminiKey.trim()) payload.geminiApiKey = geminiKey.trim();
      if (openRouterKey.trim()) payload.openRouterApiKey = openRouterKey.trim();

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save settings');
      }

      setSaveSuccess(true);
      if (onSettingsUpdated) onSettingsUpdated(voiceConfig, data);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      setErrorMsg(err.message || 'Error saving settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-xl border border-white/10 bg-[#0c0e15] shadow-2xl shadow-black/80 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-[#121520]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-gold-500/10 border border-gold-500/30 text-gold-400">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-2">
                TERMINAL SETTINGS & DISPATCH
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-normal bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  REALTIME
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">Customize AI models, Indian English voice alerts, and Telegram feeds</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-5 border-b border-white/10 bg-[#090b10] overflow-x-auto">
          <button
            onClick={() => setActiveTab('voice')}
            className={`flex items-center gap-2 px-3 py-3 text-xs font-mono font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'voice' 
                ? 'border-gold-400 text-gold-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            Voice Alerts (Indian Male)
          </button>

          <button
            onClick={() => setActiveTab('telegram')}
            className={`flex items-center gap-2 px-3 py-3 text-xs font-mono font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'telegram' 
                ? 'border-gold-400 text-gold-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            Telegram Alerts
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-2 px-3 py-3 text-xs font-mono font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'ai' 
                ? 'border-gold-400 text-gold-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            AI API Keys
          </button>

          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex items-center gap-2 px-3 py-3 text-xs font-mono font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'terminal' 
                ? 'border-gold-400 text-gold-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Trading Rules
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* TAB 1: Voice Alerts */}
          {activeTab === 'voice' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg bg-gold-950/20 border border-gold-500/20 flex items-start gap-3">
                <Volume2 className="w-5 h-5 text-gold-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-semibold text-gold-300 block">Indian English Male Voice Synthesis</span>
                  <p className="text-slate-300 mt-0.5">
                    Engineered for zero-latency client-side announcement of high-impact releases, handle sweeps, and breaking news using authentic Indian English male prosody.
                  </p>
                </div>
              </div>

              {/* Master Voice Switch */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                <div>
                  <div className="text-xs font-bold text-white uppercase tracking-wider">Voice Alerts Master Switch</div>
                  <div className="text-[11px] text-slate-400">Enable or mute all voice announcements across terminal</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={voiceConfig.enabled}
                    onChange={e => setVoiceConfig({ ...voiceConfig, enabled: e.target.checked })}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold-500"></div>
                </label>
              </div>

              {/* Volume & Speed Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-white/5 border border-white/5 space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-300">Volume</span>
                    <span className="text-gold-400 font-bold">{Math.round((voiceConfig.volume || 1) * 100)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05"
                    value={voiceConfig.volume ?? 1}
                    onChange={e => setVoiceConfig({ ...voiceConfig, volume: parseFloat(e.target.value) })}
                    className="w-full accent-gold-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="p-3 rounded-lg bg-white/5 border border-white/5 space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-300">Speech Rate (Speed)</span>
                    <span className="text-gold-400 font-bold">{voiceConfig.rate || 1.02}x</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.7" 
                    max="1.5" 
                    step="0.05"
                    value={voiceConfig.rate ?? 1.02}
                    onChange={e => setVoiceConfig({ ...voiceConfig, rate: parseFloat(e.target.value) })}
                    className="w-full accent-gold-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* Test Audio Button */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleTestVoice}
                  disabled={isSpeakingTest}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-bold bg-gradient-to-r from-gold-500 to-amber-600 text-black hover:brightness-110 active:scale-95 transition shadow-lg shadow-gold-500/20 disabled:opacity-50"
                >
                  <Volume2 className={`w-4 h-4 ${isSpeakingTest ? 'animate-bounce' : ''}`} />
                  {isSpeakingTest ? 'SPEAKING INDIAN MALE AUDIO...' : 'TEST INDIAN ENGLISH VOICE'}
                </button>
                <span className="text-[11px] text-slate-400 font-mono">Plays audio chime & synthesized voice</span>
              </div>

              {/* Alert Event Triggers */}
              <div className="space-y-2 pt-2">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">Voice Alert Triggers</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2.5 p-2.5 rounded bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition">
                    <input 
                      type="checkbox" 
                      checked={voiceConfig.alertEvents?.redFolderImminent ?? true}
                      onChange={e => setVoiceConfig({
                        ...voiceConfig,
                        alertEvents: { ...voiceConfig.alertEvents, redFolderImminent: e.target.checked }
                      })}
                      className="accent-gold-500 w-4 h-4 rounded"
                    />
                    <span className="text-slate-200">High-Impact News Imminent (&lt;5m)</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition">
                    <input 
                      type="checkbox" 
                      checked={voiceConfig.alertEvents?.breakingNews ?? true}
                      onChange={e => setVoiceConfig({
                        ...voiceConfig,
                        alertEvents: { ...voiceConfig.alertEvents, breakingNews: e.target.checked }
                      })}
                      className="accent-gold-500 w-4 h-4 rounded"
                    />
                    <span className="text-slate-200">Breaking High-Impact News</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition">
                    <input 
                      type="checkbox" 
                      checked={voiceConfig.alertEvents?.biasFlips ?? true}
                      onChange={e => setVoiceConfig({
                        ...voiceConfig,
                        alertEvents: { ...voiceConfig.alertEvents, biasFlips: e.target.checked }
                      })}
                      className="accent-gold-500 w-4 h-4 rounded"
                    />
                    <span className="text-slate-200">Institutional Bias Directional Flip</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition">
                    <input 
                      type="checkbox" 
                      checked={voiceConfig.alertEvents?.handleSweeps ?? true}
                      onChange={e => setVoiceConfig({
                        ...voiceConfig,
                        alertEvents: { ...voiceConfig.alertEvents, handleSweeps: e.target.checked }
                      })}
                      className="accent-gold-500 w-4 h-4 rounded"
                    />
                    <span className="text-slate-200">5M Handle Liquidity Sweeps ($10 Levels)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Telegram Alerts */}
          {activeTab === 'telegram' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg bg-sky-950/20 border border-sky-500/20 flex items-start gap-3">
                <Send className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-semibold text-sky-300 block">Telegram Direct Signal Dispatcher</span>
                  <p className="text-slate-300 mt-0.5">
                    Stream institutional trade commentary, red-folder releases, and bias flips directly to your private channel or group.
                  </p>
                </div>
              </div>

              {/* Master Telegram Switch */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                <div>
                  <div className="text-xs font-bold text-white uppercase tracking-wider">Enable Telegram Dispatch</div>
                  <div className="text-[11px] text-slate-400">Push real-time alerts to your Telegram chat</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={telegramConfig.enabled}
                    onChange={e => setTelegramConfig({ ...telegramConfig, enabled: e.target.checked })}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                </label>
              </div>

              {/* Bot Token & Chat ID */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
                    Telegram Bot Token
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. 7123456789:AAFxz_exampleBotToken"
                    value={telegramConfig.botToken}
                    onChange={e => setTelegramConfig({ ...telegramConfig, botToken: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-sky-500 transition"
                  />
                  <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                    Create a free bot with <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-sky-400 underline">@BotFather</a> on Telegram.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
                    Chat ID / Channel Username
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. -1001234567890 or @my_gold_channel"
                    value={telegramConfig.chatId}
                    onChange={e => setTelegramConfig({ ...telegramConfig, chatId: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-sky-500 transition"
                  />
                  <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                    Get your personal Chat ID from <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-sky-400 underline">@userinfobot</a>. For channels, add bot as admin.
                  </span>
                </div>
              </div>

              {/* Test Button & Status */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleTestTelegram}
                  disabled={isTestingTelegram || !telegramConfig.botToken || !telegramConfig.chatId}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-bold bg-sky-500 hover:bg-sky-400 text-black active:scale-95 transition disabled:opacity-50"
                >
                  <Send className={`w-3.5 h-3.5 ${isTestingTelegram ? 'animate-spin' : ''}`} />
                  {isTestingTelegram ? 'SENDING TEST DISPATCH...' : 'SEND TEST DISPATCH'}
                </button>
              </div>

              {telegramTestResult && (
                <div className={`p-3 rounded-lg text-xs font-mono flex items-start gap-2.5 ${
                  telegramTestResult.success 
                    ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300' 
                    : 'bg-rose-950/40 border border-rose-500/30 text-rose-300'
                }`}>
                  {telegramTestResult.success ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-bold block">
                      {telegramTestResult.success ? 'Dispatch Delivered Successfully!' : 'Dispatch Failed'}
                    </span>
                    <span>{telegramTestResult.error || 'Check your Telegram app for the verification alert.'}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: AI Keys */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg bg-emerald-950/20 border border-emerald-500/20 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-semibold text-emerald-300 block">Custom AI Model Intelligence</span>
                  <p className="text-slate-300 mt-0.5">
                    Add your personal Gemini or OpenRouter keys for zero-rate-limit 5-minute commentary. If omitted, Tier-3 Deterministic Floor Trader Engine provides instant 85ms market analysis.
                  </p>
                </div>
              </div>

              {/* Gemini Key */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-medium text-slate-300 flex items-center gap-2">
                    Google Gemini API Key
                    {serverAiStatus.hasGeminiKey && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        KEY CONFIGURED
                      </span>
                    )}
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">Uses gemini-3.6-flash</span>
                </div>
                <div className="relative">
                  <input 
                    type={showGemini ? 'text' : 'password'}
                    placeholder={serverAiStatus.hasGeminiKey ? 'Enter new key to replace existing' : 'AIzaSy...'}
                    value={geminiKey}
                    onChange={e => setGeminiKey(e.target.value)}
                    className="w-full px-3.5 py-2.5 pr-10 rounded-lg bg-slate-900 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-gold-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGemini(!showGemini)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                  >
                    {showGemini ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* OpenRouter Key */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-medium text-slate-300 flex items-center gap-2">
                    OpenRouter API Key (Fallback)
                    {serverAiStatus.hasOpenRouterKey && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        KEY CONFIGURED
                      </span>
                    )}
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">Free models fallback</span>
                </div>
                <div className="relative">
                  <input 
                    type={showOpenRouter ? 'text' : 'password'}
                    placeholder={serverAiStatus.hasOpenRouterKey ? 'Enter new key to replace existing' : 'sk-or-v1-...'}
                    value={openRouterKey}
                    onChange={e => setOpenRouterKey(e.target.value)}
                    className="w-full px-3.5 py-2.5 pr-10 rounded-lg bg-slate-900 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-gold-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenRouter(!showOpenRouter)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                  >
                    {showOpenRouter ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Trading & Terminal Rules */}
          {activeTab === 'terminal' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg bg-purple-950/20 border border-purple-500/20 flex items-start gap-3">
                <Sliders className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-semibold text-purple-300 block">Daytrading & Scalping Architecture</span>
                  <p className="text-slate-300 mt-0.5">
                    Terminal presets tuned for 5-minute COMEX gold execution, zero-delay tick subscriptions, and automated calendar cleanup.
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="p-3 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-white font-bold block">Auto-Purge Released Economic Events</span>
                    <span className="text-slate-400 text-[11px]">Keep calendar clean; delete released events once historical</span>
                  </div>
                  <span className="text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800">
                    ACTIVE
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-white font-bold block">Tick Bus Frequency</span>
                    <span className="text-slate-400 text-[11px]">Zero-delay SSE WebSocket emulation</span>
                  </div>
                  <span className="text-gold-400 font-bold px-2 py-0.5 rounded bg-gold-950 border border-gold-800">
                    1000ms (1.0s)
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-white font-bold block">Primary Chart Timeframe</span>
                    <span className="text-slate-400 text-[11px]">TradingView integration default interval</span>
                  </div>
                  <span className="text-cyan-400 font-bold px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800">
                    5m (SCALPING)
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Error / Success Alerts */}
        {errorMsg && (
          <div className="px-5 py-2 bg-rose-950/80 border-t border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {saveSuccess && (
          <div className="px-5 py-2 bg-emerald-950/80 border-t border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>Configuration and voice preferences saved successfully!</span>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 bg-[#090b10]">
          <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
            Aureus Pro Institutional Terminal v2.4
          </span>
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-mono text-slate-400 hover:text-white hover:bg-white/5 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-mono font-bold bg-gold-500 hover:bg-gold-400 text-black active:scale-95 transition shadow-lg shadow-gold-500/20 disabled:opacity-50"
            >
              <ShieldCheck className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'SAVING...' : 'SAVE CONFIGURATION'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
