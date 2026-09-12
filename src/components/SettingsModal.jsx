import React, { useState, useEffect } from 'react';
import { 
  X, Settings, Volume2, VolumeX, Send,
  ShieldCheck, AlertTriangle, CheckCircle, RefreshCw, Sliders, Bell, Smile
} from 'lucide-react';
import { 
  getVoiceSettings, 
  saveVoiceSettings, 
  testIndianEnglishVoice,
  getAvailableVoices
} from '../utils/voiceAlerts';
import {
  getBuddySettings,
  saveBuddySettings,
  getCharacters,
  resolveVoiceFor,
  speakGreeting
} from '../utils/buddyMode';
import {
  getPushState,
  isPushSupported,
  subscribePush,
  unsubscribePush,
  sendTestPush
} from '../utils/webPush';

export default function SettingsModal({ isOpen, onClose, onSettingsUpdated }) {
  const [activeTab, setActiveTab] = useState('voice'); // 'voice' | 'telegram' | 'terminal' | 'buddy'
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Voice Settings State
  const [voiceConfig, setVoiceConfig] = useState(getVoiceSettings());
  const [availableVoices, setAvailableVoices] = useState([]);
  const [isSpeakingTest, setIsSpeakingTest] = useState(false);

  // Buddy Mode State
  const [buddyConfig, setBuddyConfig] = useState(getBuddySettings());
  const characters = getCharacters();
  const currentChar = characters.find((c) => c.id === buddyConfig.characterId) || characters[0];

  // Web Push State
  const [pushState, setPushState] = useState({ supported: isPushSupported(), subscribed: false, permission: 'denied', checked: false });
  const [pushBusy, setPushBusy] = useState(false);
  const [pushResult, setPushResult] = useState(null);

  const refreshPushState = async () => {
    const st = await getPushState();
    setPushState({ ...st, checked: true });
    return st;
  };

  const handleEnablePush = async () => {
    setPushBusy(true);
    setPushResult(null);
    try {
      await subscribePush();
      await refreshPushState();
      setPushResult({ success: true, message: 'Push notifications enabled on this device.' });
    } catch (err) {
      setPushResult({ success: false, message: err.message || 'Could not enable push notifications.' });
    } finally {
      setPushBusy(false);
    }
  };

  const handleDisablePush = async () => {
    setPushBusy(true);
    setPushResult(null);
    try {
      await unsubscribePush();
      await refreshPushState();
      setPushResult({ success: true, message: 'Push notifications disabled.' });
    } catch (err) {
      setPushResult({ success: false, message: err.message || 'Could not disable push notifications.' });
    } finally {
      setPushBusy(false);
    }
  };

  const handleTestPush = async () => {
    setPushBusy(true);
    setPushResult(null);
    try {
      await sendTestPush();
      await refreshPushState();
      setPushResult({ success: true, message: 'Test notification sent — check your device.' });
    } catch (err) {
      setPushResult({ success: false, message: err.message || 'Could not send test push.' });
    } finally {
      setPushBusy(false);
    }
  };

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
    setAvailableVoices(getAvailableVoices());
    setBuddyConfig(getBuddySettings());
    refreshPushState();

    // Keep the buddy voice list warm as Chrome loads voices asynchronously
    const onVoices = () => setAvailableVoices(getAvailableVoices());
    window.speechSynthesis?.addEventListener?.('voiceschanged', onVoices);

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

    return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', onVoices);
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
              <p className="text-[11px] text-slate-400 font-mono">Customize Indian English voice alerts and Telegram feeds</p>
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

          <button
            onClick={() => setActiveTab('buddy')}
            className={`flex items-center gap-2 px-3 py-3 text-xs font-mono font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'buddy' 
                ? 'border-gold-400 text-gold-400' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smile className="w-3.5 h-3.5" />
            Buddy Mode
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

              {/* Web Push Notifications (phone/browser) */}
              <div className="mt-2 pt-3 border-t border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white uppercase tracking-wider">Phone Push Notifications</div>
                    <div className="text-[11px] text-slate-400">Red-folder, bias flips and breaking news — even with the app closed</div>
                  </div>
                  {pushState.checked && pushState.supported && (
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      pushState.subscribed
                        ? 'text-emerald-300 border-emerald-500/40 bg-emerald-950/40'
                        : 'text-slate-400 border-white/10 bg-slate-900'
                    }`}>
                      {pushState.subscribed ? 'ACTIVE' : 'OFF'}
                    </span>
                  )}
                </div>

                {!pushState.checked ? (
                  <div className="text-[11px] font-mono text-slate-500 animate-pulse">CHECKING PUSH CAPABILITY…</div>
                ) : !pushState.supported ? (
                  <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-600/30 text-[11px] font-mono text-amber-300">
                    Not supported here. Use the latest Chrome / Edge / Safari (iOS 16.4+) on this device.
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    {pushState.subscribed ? (
                      <button
                        type="button"
                        onClick={handleDisablePush}
                        disabled={pushBusy}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono font-bold bg-rose-500/15 border border-rose-500/40 text-rose-300 hover:bg-rose-500/25 active:scale-95 transition disabled:opacity-50"
                      >
                        {pushBusy ? '…' : 'DISABLE PUSH'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleEnablePush}
                        disabled={pushBusy}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono font-bold bg-sky-500 hover:bg-sky-400 text-black active:scale-95 transition disabled:opacity-50"
                      >
                        {pushBusy ? '…' : 'ENABLE PUSH'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleTestPush}
                      disabled={pushBusy}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono font-bold bg-white/5 border border-white/15 text-slate-200 hover:bg-white/10 active:scale-95 transition disabled:opacity-50"
                    >
                      SEND TEST
                    </button>
                    {pushState.permission === 'denied' && !pushState.subscribed && (
                      <span className="text-[10px] text-rose-400 font-mono">Permission blocked — allow notifications for this site in your browser.</span>
                    )}
                  </div>
                )}

                {pushResult && (
                  <div className={`p-2.5 rounded-lg text-[11px] font-mono flex items-start gap-2 ${
                    pushResult.success
                      ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-950/40 border border-rose-500/30 text-rose-300'
                  }`}>
                  {pushResult.success
                    ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    : <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />}
                    <span>{pushResult.message}</span>
                  </div>
                )}
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

          {/* TAB 5: Buddy Mode */}
          {activeTab === 'buddy' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg bg-purple-950/20 border border-purple-500/20 flex items-start gap-3">
                <Smile className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-semibold text-purple-300 block">Terminal Buddy — Voice Persona</span>
                  <p className="text-slate-300 mt-0.5">
                    Turns dry alerts into character: random idle chatter, funny reactions to big moves,
                    and event announcements in persona. Requires the Voice Alerts master switch in the
                    Voice tab. Voices are inspired (pitch/rate/voice tuning), not cloned recordings of real actors.
                  </p>
                </div>
              </div>

              {/* Master Buddy Switch */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                <div>
                  <div className="text-xs font-bold text-white uppercase tracking-wider">Buddy Mode Master Switch</div>
                  <div className="text-[11px] text-slate-400">Persona on all alerts + idle chatter</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={buddyConfig.buddyEnabled}
                    onChange={e => {
                      const next = { ...buddyConfig, buddyEnabled: e.target.checked };
                      setBuddyConfig(next);
                      saveBuddySettings(next);
                      if (e.target.checked) speakGreeting();
                    }}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                </label>
              </div>

              {/* Chatter Switch */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                <div>
                  <div className="text-xs font-bold text-white uppercase tracking-wider">Random Chatter</div>
                  <div className="text-[11px] text-slate-400">Buddy occasionally talks for fun while the tape is live</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={buddyConfig.chatterEnabled}
                    onChange={e => {
                      const next = { ...buddyConfig, chatterEnabled: e.target.checked };
                      setBuddyConfig(next);
                      saveBuddySettings(next);
                    }}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                </label>
              </div>

              {/* Chat Density */}
              <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Chatter Frequency</div>
                <div className="flex gap-2">
                  {[
                    { id: 'chill', label: 'Chill', desc: '5-12 min' },
                    { id: 'balanced', label: 'Balanced', desc: '3-8 min' },
                    { id: 'hyper', label: 'Hyper', desc: '1.5-4 min' }
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        const next = { ...buddyConfig, cadence: c.id };
                        setBuddyConfig(next);
                        saveBuddySettings(next);
                      }}
                      className={`flex-1 px-2 py-2 rounded-lg border text-xs font-mono transition active:scale-95 ${
                        buddyConfig.cadence === c.id
                          ? 'bg-purple-500/15 border-purple-500/50 text-purple-300'
                          : 'bg-slate-900 border-white/10 text-slate-400 hover:border-white/25'
                      }`}
                    >
                      <span className="block font-bold">{c.label}</span>
                      <span className="block text-[10px] opacity-70">{c.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Character Grid */}
              <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Character ({currentChar && <span className="text-purple-300">{currentChar.emoji} {currentChar.name}</span>})
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {characters.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        const next = { ...buddyConfig, characterId: c.id, buddyEnabled: true };
                        setBuddyConfig(next);
                        saveBuddySettings(next);
                        speakGreeting();
                      }}
                      className={`p-2.5 rounded-lg border text-left transition active:scale-95 ${
                        buddyConfig.characterId === c.id
                          ? 'bg-purple-500/15 border-purple-500/50'
                          : 'bg-slate-900 border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div className="text-lg leading-none">{c.emoji}</div>
                      <div className="text-xs font-bold text-white mt-1.5">{c.name}</div>
                      <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{c.blurb}</div>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => speakGreeting(true)}
                  className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-bold bg-purple-500 hover:bg-purple-400 text-black active:scale-95 transition shadow-lg shadow-purple-500/20"
                >
                  <Volume2 className="w-4 h-4" />
                  HEAR {currentChar?.name?.toUpperCase() || 'BUDDY'}
                </button>
                <p className="mt-2 text-[10px] text-slate-500">Tuning note: voices are inspired by personas (pitch/rate). Exact actor voices can't be used — platform policy blocks cloned voices, even for personal use.</p>

                <div className="mt-4 pt-3 border-t border-white/10">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Voice Override</div>
                  <div className="text-[10px] text-slate-500 mb-2">
                    Currently using: <span className="text-purple-300">{resolveVoiceFor(currentChar)?.name || 'system default'}</span>
                  </div>
                  <select
                    value={buddyConfig.voiceOverride || ''}
                    onChange={(e) => {
                      const next = { ...buddyConfig, voiceOverride: e.target.value ? e.target.value : null };
                      setBuddyConfig(next);
                      saveBuddySettings(next);
                      speakGreeting(true);
                    }}
                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value="">Auto — best male voice quality first (natural over robotic)</option>
                    {availableVoices.map((v) => (
                      <option key={`${v.name}_${v.lang}`} value={v.name}>{v.name} ({v.lang})</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-[10px] text-slate-500">Tip: on Windows Chrome, "Google" voices (downloaded) sound far more human than "Microsoft ... Desktop" voices. Pick one named Google or Natural if you see it.</p>
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
