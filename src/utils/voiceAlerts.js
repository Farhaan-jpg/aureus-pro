// Indian English Male Voice Alerts Engine for Aureus Pro
// Native Web Speech Synthesis with Indian English male vocal profile (en-IN),
// pitch adjustment, and dual-tone alert chime. Buddy Mode may override the
// line and voice per character — alert routes defer to it when enabled.
import { announce } from './buddyMode.js';

const DEFAULT_SETTINGS = {
  enabled: true,
  volume: 1.0,
  rate: 1.02,
  pitch: 0.88, // Slightly lower pitch for authoritative institutional male voice
  alertEvents: {
    redFolderImminent: true,
    breakingNews: true,
    biasFlips: true,
    handleSweeps: true,
    sirens: true,
    eventActuals: true
  }
};

let currentSettings = { ...DEFAULT_SETTINGS };

// Per-kind audible cooldowns: stop the same development from re-speaking on
// every refresh. Shared by both the default and Buddy paths (checked before
// announce()), keyed by payload so distinct events still sound.
const COOLDOWN_WINDOW = {
  breakingNews: 30 * 60 * 1000,
  biasFlips: 90 * 1000,
  handleSweeps: 90 * 1000,
  sirens: 60 * 1000,
  eventActuals: 60 * 1000
};
const lastSpokenAt = new Map();

function withinCooldown(kind, key) {
  if (lastSpokenAt.size > 600) {
    const first = lastSpokenAt.keys().next().value;
    if (first) lastSpokenAt.delete(first);
  }
  const now = Date.now();
  const stamped = lastSpokenAt.get(`${kind}|${key}`) || 0;
  if (now - stamped < (COOLDOWN_WINDOW[kind] ?? 0)) return true;
  lastSpokenAt.set(`${kind}|${key}`, now);
  return false;
}

// Load settings from localStorage
export function getVoiceSettings() {
  if (typeof window === 'undefined') return currentSettings;
  try {
    const saved = localStorage.getItem('aureus_voice_settings');
    if (saved) {
      currentSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {}
  return currentSettings;
}

export function saveVoiceSettings(newSettings) {
  currentSettings = { ...currentSettings, ...newSettings };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('aureus_voice_settings', JSON.stringify(currentSettings));
    } catch (e) {}
  }
  return currentSettings;
}

// Initial load
getVoiceSettings();

export function isVoiceEnabled() {
  return Boolean(currentSettings.enabled);
}

export function updateVoiceSettings(newSettings) {
  return saveVoiceSettings(newSettings);
}

// List all available voices in the client browser
export function getAvailableVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices() || [];
}

// ── Voice quality pipeline ─────────────────────────────────────────────────
// Windows Chrome exposes mostly SAPI voices (David/Zira/Aria) that sound
// robotic, plus downloaded Google network voices which are far more natural.
// We always prefer natural/neural male voices, explicitly avoid female voices,
// and only fall back to "any English" as a last resort.

// Lowercased substrings that mark a voice as male.
const MALE_TOKENS = [
  'male', 'ravi', 'david', 'guy', 'mark', 'george', 'daniel', 'oliver',
  'james', 'jacob', 'william', 'ryan', 'anthony', 'brian', 'christopher',
  'matthew', 'thomas', 'richard', 'michael', 'alex', 'eric', 'steve', 'tom',
  'paul', 'neil', 'fred', 'check', 'narrator', 'google us english',
  'google british english', 'mohan', 'prabhat'
];

// Lowercased substrings that mark a voice as female (never pick these for male personas).
const FEMALE_TOKENS = [
  'female', 'zira', 'aria', 'jenny', 'emma', 'heera', 'kalpana', 'priya',
  'ananya', 'neerja', 'samantha', 'victoria', 'tessa', 'fiona', 'karen',
  'moira', 'allison', 'ava', 'susan', 'hazel', 'kate', 'michelle', 'nancy',
  'trinity', 'soyoung', 'zuzana', 'ana', 'woman', 'girl network'
];

// "Natural" voices (neural Google/network or explicitly named Natural) sound
// human; SAPI desktop voices are last-resort only.
function isVoiceFemale(v) {
  const n = (v.name || '').toLowerCase();
  return FEMALE_TOKENS.some((t) => n.includes(t));
}
function isVoiceMale(v) {
  const n = (v.name || '').toLowerCase();
  return MALE_TOKENS.some((t) => n.includes(t)) && !isVoiceFemale(v);
}
function isNaturalVoice(v) {
  const n = (v.name || '').toLowerCase();
  return n.includes('natural') || n.includes('google') || n.includes('online');
}

// Best-quality male voice for the given language + optional explicit name hint.
// Tiers: (1) explicit hint match, (2) natural male, (3) natural ungendered,
// (4) any male-token voice, (5) any non-female English voice, (6) any voice.
export function resolveBestVoice(langHint = 'en-IN', nameHint = '') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const norm = (lang) => (lang || '').toLowerCase().replace('_', '-');
  const pool = langHint
    ? voices.filter((v) => norm(v.lang).startsWith(norm(langHint)))
    : voices;
  const usable = pool.length ? pool : voices;

  const pick = (test, list = usable) => list.find(test);
  const scoreOrdinal = (v) => (isNaturalVoice(v) ? 0 : 1);

  if (nameHint) {
    const h = nameHint.toLowerCase();
    const hintMatch = pick((v) => (v.name || '').toLowerCase().includes(h) && !isVoiceFemale(v));
    if (hintMatch) return hintMatch;
  }

  // Sort candidates male-first, natural-first for a stable deterministic pick.
  const candidates = [...usable].sort((a, b) => {
    const maleA = isVoiceMale(a) ? 0 : 1;
    const maleB = isVoiceMale(b) ? 0 : 1;
    if (maleA !== maleB) return maleA - maleB;
    return scoreOrdinal(a) - scoreOrdinal(b);
  });

  const naturalMale = candidates.find((v) => isVoiceMale(v) && isNaturalVoice(v));
  if (naturalMale) return naturalMale;

  const naturalAny = candidates.find((v) => isNaturalVoice(v) && !isVoiceFemale(v));
  if (naturalAny) return naturalAny;

  const maleToken = candidates.find((v) => isVoiceMale(v));
  if (maleToken) return maleToken;

  const anyEnglish = candidates.find((v) => norm(v.lang).startsWith('en') && !isVoiceFemale(v));
  if (anyEnglish) return anyEnglish;

  const anyVoice = pick(() => true);
  if (anyVoice) return anyVoice;

  return null;
}

// Backwards-compatible entry point: best Indian-English male voice.
export function getIndianEnglishVoice() {
  const voice = resolveBestVoice('en-IN');
  return voice || resolveBestVoice('en');
}

// Warm the voice list — modern Chrome loads voices asynchronously.
(function warmVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.getVoices();
  const onVoices = () => window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', onVoices);
})();

// Subtle acoustic alert chime before voice announcement (587Hz -> 880Hz)
export function playAlertChime() {
  if (typeof window === 'undefined') return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880.00, ctx.currentTime + 0.12);

    const vol = (currentSettings.volume ?? 1.0) * 0.08;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.30);
  } catch (e) {}
}

// Core speech synthesis function
export function speakAlert(text, options = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  if (!currentSettings.enabled && !options.force) return;

  try {
    // Cancel any stuck utterances
    window.speechSynthesis.cancel();

    if (options.chime !== false) {
      playAlertChime();
    }

    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = options.voice || getIndianEnglishVoice();

      if (voice) {
        utterance.voice = voice;
      }

      // If voice is female or generic, lower pitch slightly to shape male timbre
      const name = (voice?.name || '').toLowerCase();
      const isFemale = name.includes('female') || name.includes('zira') || name.includes('heera') || name.includes('kalpana');
      utterance.pitch = options.pitch ?? (isFemale ? 0.76 : (currentSettings.pitch || 0.88));
      utterance.rate = options.rate ?? (currentSettings.rate || 1.02);
      utterance.volume = options.volume ?? (currentSettings.volume ?? 1.0);

      window.speechSynthesis.speak(utterance);
    }, options.chime !== false ? 120 : 0);
  } catch (err) {
    console.warn('[Voice Alerts Error]:', err.message);
  }
}

// 1. Test Voice Announcement
export function testIndianEnglishVoice() {
  speakAlert(
    "Aureus Pro voice synthesis operational. Tracking XAU USD 5-minute liquidity sweeps and institutional order flow.",
    { force: true }
  );
}

// 2. High-Impact Economic Event Imminent Alert
export function speakEventImminent(eventTitle, minutesRemaining) {
  if (!currentSettings.enabled || !currentSettings.alertEvents?.redFolderImminent) return;
  if (announce('redFolder', { event: eventTitle, mins: minutesRemaining })) return;
  const minText = minutesRemaining <= 1 ? "in one minute" : `in ${minutesRemaining} minutes`;
  speakAlert(`High impact event alert: ${eventTitle} releases ${minText}. Flatten scalping exposure.`);
}

// 3. Breaking High-Impact Bullion News Alert
export function speakBreakingNews(headline, sentiment) {
  if (!currentSettings.enabled || !currentSettings.alertEvents?.breakingNews) return;
  if (withinCooldown('breakingNews', String(headline).slice(0, 80))) return;
  const sentimentNote = sentiment === 'BULLISH' ? 'Bullish for gold.' : sentiment === 'BEARISH' ? 'Bearish pressure on bullion.' : '';
  if (announce('breakingNews', { headline, sentiment: sentimentNote })) return;
  speakAlert(`Breaking gold news: ${headline}. ${sentimentNote}`);
}

// 4. Institutional Bias Directional Flip Alert
export function speakBiasFlip(newBiasLabel, score) {
  if (!currentSettings.enabled || !currentSettings.alertEvents?.biasFlips) return;
  if (withinCooldown('biasFlips', `${newBiasLabel}|${Math.round(score / 5)}`)) return;
  if (announce('biasFlip', { label: newBiasLabel, score })) return;
  speakAlert(`Market flow shift: Institutional composite bias flipped to ${newBiasLabel}. Score ${score}.`);
}

// 5. 5-Minute Psychological Handle Sweep Alert ($10 Round Numbers)
export function speakHandleSweep(priceHandle) {
  if (!currentSettings.enabled || !currentSettings.alertEvents?.handleSweeps) return;
  if (withinCooldown('handleSweeps', String(priceHandle))) return;
  if (announce('sweep', { handle: priceHandle })) return;
  speakAlert(`Gold spot testing key handle: ${priceHandle} dollars. Watch for five minute liquidity sweep.`);
}

// 6. Custom Interactive Price Level Alert
export function speakPriceAlert(targetPrice, condition = 'reached') {
  if (!currentSettings.enabled) return;
  const condText = condition === 'above' ? 'broken above' : condition === 'below' ? 'fallen below' : 'reached';
  speakAlert(`Price target triggered: Gold has ${condText} ${targetPrice} dollars.`);
}

// 7. Reversal Confluence Siren (3+ factors aligned)
export function speakSiren(direction, price, factorCount) {
  if (!currentSettings.enabled || !currentSettings.alertEvents?.sirens) return;
  if (withinCooldown('sirens', `${direction}|${Math.round(price / 10)}`)) return;
  if (announce('siren', { price, direction, factorCount })) return;
  speakAlert(`High conviction reversal alert. ${factorCount} factors aligned at ${price}. Direction: ${direction}.`);
}

// 8. Released Economic Data Surprise (Actuals re-price)
export function speakSurprise(eventTitle, direction, magnitude) {
  if (!currentSettings.enabled || !currentSettings.alertEvents?.eventActuals) return;
  if (withinCooldown('eventActuals', `${eventTitle}|${direction}`)) return;
  if (announce('eventActual', { event: eventTitle, direction, magnitude })) return;
  speakAlert(`Economic data released: ${eventTitle} surprised to the ${direction} side. ${magnitude} move expected.`);
}

