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
