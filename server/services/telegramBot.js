// Telegram Alerts Dispatcher for Aureus Pro
// Dispatches high-conviction institutional market alerts, breaking news, and 5M red-folder warnings directly to Telegram.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SETTINGS_FILE = path.join(__dirname, '../data/terminal_settings.json');

const DEFAULT_ALERT_TYPES = {
  redFolderNews: true,
  breakingNews: true,
  biasFlips: true,
  handleSweeps: true,
  dataHealth: true
};

let botConfig = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  chatId: process.env.TELEGRAM_CHAT_ID || '',
  enabled: false,
  alertTypes: { ...DEFAULT_ALERT_TYPES }
};

// Load saved settings if present
function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.telegram) {
        botConfig = { ...botConfig, ...parsed.telegram };
        botConfig.alertTypes = { ...DEFAULT_ALERT_TYPES, ...(parsed.telegram.alertTypes || {}) };
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
  if (newSettings.alertTypes) botConfig.alertTypes = { ...DEFAULT_ALERT_TYPES, ...botConfig.alertTypes, ...newSettings.alertTypes };

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

// Feed degradation / fallback transition alert (deduped by the caller)
export async function sendFeedHealthTelegramAlert(issues) {
  if (!botConfig.enabled || !botConfig.alertTypes.dataHealth) return;

  const lines = issues
    .map((i) => `🔻 <b>${i.label}:</b> ${i.detail}`)
    .join('\n');

  const message = `
⚠️ <b>AUREUS PRO FEED DEGRADATION</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
${lines}
━━━━━━━━━━━━━━━━━━━━━━━━━━
🕒 <b>Detected:</b> ${new Date().toUTCString()}
<i>Terminal automatically switched to fallback sources. Monitor accuracy on gold prints.</i>
`.trim();

  return await sendTelegramMessage(message);
}

// Scheduled daily morning briefing digest
export async function sendDailyBriefingTelegramAlert(snap) {
  if (!botConfig.enabled) return { success: false, error: 'Telegram dispatch disabled — configure a bot token & chat ID in Settings.' };

  const fmt = (v, digits = 2) => (v == null ? '—' : Number(v).toFixed(digits));
  const biasIcon = snap.bias?.score > 0 ? '🟢' : snap.bias?.score < 0 ? '🔴' : '⚪';
  const levels = snap.marketData?.keyLevels?.levels || {};
  const piv = levels.pivots || {};
  const wk = levels.weekPivots || {};
  const vreg = snap.marketData?.volatilityRegime || {};
  const corr = snap.marketData?.longCorrelations || {};
  const calendar = snap.calendar?.events || [];
  const now = Date.now();
  const upcoming = calendar
    .filter((e) => {
      const t = new Date(e.date).getTime();
      return t > now - 60 * 60 * 1000 && t < now + 30 * 24 * 60 * 60 * 1000;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);
  const catLines = upcoming.length
    ? upcoming.map((e) => `${e.date ? new Date(e.date).toISOString().slice(11, 16) : ''}Z ${e.impact || ''} ${e.currency || ''} ${e.title || ''}${e.isEstimated ? ' (est)' : ''}`).join('\n')
    : 'No scheduled high-importance releases in window.';

  const dh = snap.marketData?.dataHealth || {};
  const ms = snap.marketData?.marketState || {};
  const ageSec = dh.goldAgeMs != null ? Math.round(dh.goldAgeMs / 1000) : null;
  const cross = dh.priceCheck || {};
  const feedLine = [
    `${ms.open === false ? '⛔ <b>MARKET CLOSED</b> · ' : ''}${ms.label || 'OPEN'}`,
    `Gold ${dh.goldSource || '—'}${ageSec != null ? ` (${ageSec}s)` : ''}`,
    `TV-WS ${dh.tvWs ? '✅' : '⚠'} · spread $${cross.spread ?? '—'}${cross.discrepancy ? ' ⚠' : ''} acr ${cross.sources ?? 0} src`
  ].join('\n');

  // Bias outcome track record — the honest scoreboard for the composite model.
  const acc = snap.accuracy || {};
  const o = acc.overall || {};
  const accLine = o.resolved > 0
    ? `${(o.hitRate * 100).toFixed(0)}% hit (${o.resolved} calls, ${o.unresolved ?? 0} unresolved skirted) · avg ${o.avgPnlPct == null ? '—' : (o.avgPnlPct > 0 ? '+' : '') + o.avgPnlPct.toFixed(2)}%/call · 1H window since ${acc.windowStart ? new Date(acc.windowStart).toISOString().slice(0, 10) : '—'}`
    : 'COLLECTING — needs ~24h of live sessions for the first 1H verdicts';

  const message = `
🌅 ☕ <b>AUREUS PRO DAILY BRIEFING</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Session:</b> ${snap.marketData?.session || '—'} UTC | ${new Date().toUTCString().slice(0, 16)}
<b>XAU/USD:</b> $${fmt(snap.marketData?.goldSpot?.price)} (${(snap.marketData?.goldSpot?.changePercent || 0) > 0 ? '+' : ''}${fmt(snap.marketData?.goldSpot?.changePercent)}%)

<b>🧭 Composite Bias:</b> ${biasIcon} <b>${(snap.bias?.label || 'NEUTRAL').toUpperCase()}</b> (${snap.bias?.score > 0 ? '+' : ''}${snap.bias?.score ?? 0}/100) — Conf ${snap.bias?.confidence ?? '—'}%

<b>🔑 Key Levels:</b>
PDH <b>$${fmt(levels.pdh, 0)}</b> | PDL <b>$${fmt(levels.pdl, 0)}</b>
PWH <b>$${fmt(levels.pwh, 0)}</b> | PWL <b>$${fmt(levels.pwl, 0)}</b>
P <b>$${fmt(piv.p, 0)}</b> | R1 <b>$${fmt(piv.r1, 0)}</b> | S1 <b>$${fmt(piv.s1, 0)}</b>

<b>📊 Volatility:</b> ${vreg.regime || '—'} (ATR14 $${fmt(vreg.atr14)} · pct ${vreg.compositePercentile ?? '—'}%)
<b>🎯 Corr (60d):</b> Gold vs DXY <b>${corr.goldDxy == null ? '—' : corr.goldDxy.toFixed(2)}</b> · vs US10Y <b>${corr.goldUs10y == null ? '—' : corr.goldUs10y.toFixed(2)}</b>
<b>👥 Retail:</b> ${snap.retail?.live ? `${snap.retail.longPercentage?.toFixed(1) ?? '—'}% L / ${snap.retail.shortPercentage?.toFixed(1) ?? '—'}% S` : 'data pending'}
<b>🌍 Geo risk:</b> ${snap.geo?.live ? `${snap.geo.score ?? 0}/100 (${(snap.geo.level || 'LOW')})` : 'data pending'}

<b>🩺 Feed Health:</b>
${feedLine}

<b>🎯 Bias Track Record (1H):</b>
${accLine}

<b>📅 Next Releases:</b>
${catLines}
━━━━━━━━━━━━━━━━━━━━━━━━━━
<i>Aureus Pro Terminal • Scheduled 08:05 IST daily digest</i>
`.trim();

  return await sendTelegramMessage(message);
}

