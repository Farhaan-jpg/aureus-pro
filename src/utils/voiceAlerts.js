// Indian English Male Voice Alerts Engine for Aureus Pro
// Native Web Speech Synthesis with Indian English male vocal profile (en-IN), pitch adjustment, and dual-tone alert chime.

const DEFAULT_SETTINGS = {
  enabled: true,
  volume: 1.0,
  rate: 1.02,
  pitch: 0.88, // Slightly lower pitch for authoritative institutional male voice
  alertEvents: {
    redFolderImminent: true,
    breakingNews: true,
    biasFlips: true,
    handleSweeps: true
  }
};

let currentSettings = { ...DEFAULT_SETTINGS };

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

// Find best matching Indian English male voice
export function getIndianEnglishVoice() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // 1. Explicit Indian English Male (e.g. Microsoft Ravi, Google en-IN Male, Mohan, Prabhat)
  const inMale = voices.find(v => {
    const lang = (v.lang || '').toLowerCase();
    const name = (v.name || '').toLowerCase();
    const isIndian = lang.includes('en-in') || lang.includes('en_in') || name.includes('india');
    const isMale = name.includes('male') || name.includes('ravi') || name.includes('prabhat') || name.includes('mohan') || name.includes('neerja') === false;
    return isIndian && isMale && !name.includes('heera') && !name.includes('kalpana') && !name.includes('priya') && !name.includes('ananya');
  });
  if (inMale) return inMale;

  // 2. Any Indian English voice (Ravi, Heera, Google en-IN, etc.)
  const inAny = voices.find(v => {
    const lang = (v.lang || '').toLowerCase();
    const name = (v.name || '').toLowerCase();
    return lang.includes('en-in') || lang.includes('en_in') || name.includes('india');
  });
  if (inAny) return inAny;

  // 3. Fallback to British / International English male
  const enMale = voices.find(v => {
    const lang = (v.lang || '').toLowerCase();
    const name = (v.name || '').toLowerCase();
    return lang.startsWith('en') && (name.includes('male') || name.includes('george') || name.includes('david') || name.includes('oliver') || name.includes('guy'));
  });
  if (enMale) return enMale;

  // 4. Default English voice
  return voices.find(v => (v.lang || '').startsWith('en')) || voices[0] || null;
}

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
      const voice = getIndianEnglishVoice();

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
  const minText = minutesRemaining <= 1 ? "in one minute" : `in ${minutesRemaining} minutes`;
  speakAlert(`High impact event alert: ${eventTitle} releases ${minText}. Flatten scalping exposure.`);
}

// 3. Breaking High-Impact Bullion News Alert
export function speakBreakingNews(headline, sentiment) {
  if (!currentSettings.enabled || !currentSettings.alertEvents?.breakingNews) return;
  const sentimentNote = sentiment === 'BULLISH' ? 'Bullish for gold.' : sentiment === 'BEARISH' ? 'Bearish pressure on bullion.' : '';
  speakAlert(`Breaking gold news: ${headline}. ${sentimentNote}`);
}

// 4. Institutional Bias Directional Flip Alert
export function speakBiasFlip(newBiasLabel, score) {
  if (!currentSettings.enabled || !currentSettings.alertEvents?.biasFlips) return;
  speakAlert(`Market flow shift: Institutional composite bias flipped to ${newBiasLabel}. Score ${score}.`);
}

// 5. 5-Minute Psychological Handle Sweep Alert ($10 Round Numbers)
export function speakHandleSweep(priceHandle) {
  if (!currentSettings.enabled || !currentSettings.alertEvents?.handleSweeps) return;
  speakAlert(`Gold spot testing key handle: ${priceHandle} dollars. Watch for five minute liquidity sweep.`);
}
