// Telegram Alerts Dispatcher for Aureus Pro
// Dispatches high-conviction institutional market alerts, breaking news, and 5M red-folder warnings directly to Telegram.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SETTINGS_FILE = path.join(__dirname, '../data/terminal_settings.json');

let botConfig = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  chatId: process.env.TELEGRAM_CHAT_ID || '',
  enabled: false,
  alertTypes: {
    redFolderNews: true,
    breakingNews: true,
    biasFlips: true,
    handleSweeps: true
  }
};

// Load saved settings if present
function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.telegram) {
        botConfig = { ...botConfig, ...parsed.telegram };
      }
    }
  } catch (e) {}
}
loadSettings();

export function getTelegramConfig() {
  return {
    botToken: botConfig.botToken ? `${botConfig.botToken.slice(0, 8)}...` : '',
    hasToken: Boolean(botConfig.botToken),
    chatId: botConfig.chatId,
    enabled: botConfig.enabled,
    alertTypes: botConfig.alertTypes
  };
}

export function updateTelegramConfig(newSettings = {}) {
  if (newSettings.botToken !== undefined) botConfig.botToken = newSettings.botToken;
  if (newSettings.chatId !== undefined) botConfig.chatId = newSettings.chatId;
  if (newSettings.enabled !== undefined) botConfig.enabled = newSettings.enabled;
  if (newSettings.alertTypes) botConfig.alertTypes = { ...botConfig.alertTypes, ...newSettings.alertTypes };

  try {
    let allSettings = {};
    if (fs.existsSync(SETTINGS_FILE)) {
      allSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
    }
    allSettings.telegram = botConfig;
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(allSettings, null, 2), 'utf-8');
  } catch (e) {}

  return getTelegramConfig();
}

// Send message to Telegram API
export async function sendTelegramMessage(text, customToken = null, customChatId = null) {
  const token = customToken || botConfig.botToken;
  const chatId = customChatId || botConfig.chatId;

  if (!token || !chatId) {
    return { success: false, error: 'Telegram Bot Token and Chat ID must be configured.' };
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
    clearTimeout(timeout);

    const json = await res.json();
    if (!res.ok || !json.ok) {
      throw new Error(json.description || `Telegram HTTP ${res.status}`);
    }

    return { success: true, result: json.result };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Test message for settings panel verification
export async function sendTestTelegramAlert(customToken = null, customChatId = null) {
  const message = `
⚡ <b>AUREUS PRO — INSTITUTIONAL DISPATCH TEST</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ <b>Telegram Alert Pipeline:</b> ONLINE
🕒 <b>Timestamp:</b> ${new Date().toUTCString()}
📡 <b>Engine:</b> XAU/USD Real-Time Intelligence Bus
🎯 <b>Status:</b> Ready to receive 5M scalping alerts & red-folder releases.
━━━━━━━━━━━━━━━━━━━━━━━━━━
<i>Aureus Pro Terminal • London / NY Floor Operations</i>
`.trim();

  return await sendTelegramMessage(message, customToken, customChatId);
}

// Red-folder event imminent alert
export async function sendRedFolderTelegramAlert(event, minutesRemaining, goldPrice) {
  if (!botConfig.enabled || !botConfig.alertTypes.redFolderNews) return;

  const message = `
🚨 <b>HIGH-IMPACT RELEASE IMMINENT (${minutesRemaining}M)</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 <b>Event:</b> ${event.title} (${event.currency})
⚡ <b>Impact:</b> ${event.impact}
⏱ <b>Scheduled:</b> ${new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
🎯 <b>XAU/USD Spot:</b> $${goldPrice.toFixed(2)}
📉 <b>Forecast:</b> ${event.forecast || '---'} | <b>Prior:</b> ${event.previous || '---'}
━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 <b>Institutional Rule:</b>
<i>${event.goldImpactRule || 'Severe liquidity sweeps expected. Flatten 5M scalps!'}</i>
`.trim();

  return await sendTelegramMessage(message);
}

// Extreme Retail Sentiment Trap Alert (>80% Long or Short)
export async function sendRetailTrapTelegramAlert(retailData, goldPrice) {
  if (!botConfig.enabled) return;

  const isLongTrap = retailData.longPercentage >= 80;
  const trapType = isLongTrap ? 'EXTREME RETAIL LONG TRAP' : 'EXTREME RETAIL SHORT TRAP';
  const icon = isLongTrap ? '🪤 🚨' : '🪤 ⚠️';
  const contrarianAction = isLongTrap ? 'Institutional Liquidity Pools sit BELOW. Expect Long Liquidation Sweep.' : 'Institutional Liquidity Pools sit ABOVE. Expect Short Squeeze Sweep.';

  const message = `
${icon} <b>CONTRARIAN ALERT: ${trapType}</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 <b>XAU/USD Spot:</b> $${goldPrice.toFixed(2)}
👥 <b>Retail Positioning:</b> ${retailData.longPercentage.toFixed(1)}% Long / ${retailData.shortPercentage.toFixed(1)}% Short
⚖️ <b>Ratio:</b> ${retailData.ratio}:1
━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 <b>Institutional Floor Stance:</b>
<i>${contrarianAction}</i>
`.trim();

  return await sendTelegramMessage(message);
}

// Institutional Composite Bias Flip Alert
export async function sendBiasFlipTelegramAlert(newBias, score, goldPrice) {
  if (!botConfig.enabled || !botConfig.alertTypes.biasFlips) return;

  const icon = score > 0 ? '🟢 📈' : score < 0 ? '🔴 📉' : '⚪ ⚖️';

  const message = `
${icon} <b>AUREUS PRO: COMPOSITE BIAS FLIP</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
🧭 <b>New Regime:</b> ${newBias.toUpperCase()} (${score > 0 ? '+' : ''}${score}/100)
🎯 <b>XAU/USD Spot:</b> $${goldPrice.toFixed(2)}
🕒 <b>Time:</b> ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
━━━━━━━━━━━━━━━━━━━━━━━━━━
<i>5-Factor Macro, Real Yield, News, Retail & Order Book Model Realigned.</i>
`.trim();

  return await sendTelegramMessage(message);
}

// ICT Session Judas Liquidity Sweep Alert
export async function sendJudasSweepTelegramAlert(sessionName, sweptLevel, sweepType, goldPrice) {
  if (!botConfig.enabled) return;

  const message = `
⚡ <b>ICT JUDAS SWING DETECTED (${sessionName})</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 <b>XAU/USD Spot:</b> $${goldPrice.toFixed(2)}
🎯 <b>Swept Key Reference:</b> $${sweptLevel.toFixed(2)} (${sweepType})
🕒 <b>Killzone:</b> ${sessionName}
━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 <b>Institutional Playbook:</b>
<i>Asian Session liquidity captured. Watch for turtle-soup reversal rejection candles on 5M timeframe.</i>
`.trim();

  return await sendTelegramMessage(message);
}

