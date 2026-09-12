// Web Push Notifications for Aureus Pro.
// Self-hosted VAPID keys: auto-generated on first boot and persisted so
// subscriptions survive restarts (env overrides allowed for manual control).
// Sends through the browser's own push service (FCM/Web Push on Android,
// APNs on iOS) — no app-store or third-party key required.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import webPush from 'web-push';
import { recordError } from './errorLog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const VAPID_FILE = path.join(DATA_DIR, 'webpush_vapid.json');
const SUBS_FILE = path.join(DATA_DIR, 'push_subscriptions.json');

let vapidKeys = { publicKey: '', privateKey: '', generated: false };

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadVapid() {
  // Env overrides win; otherwise persist an auto-generated keypair.
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    vapidKeys = {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
      generated: false
    };
    return;
  }
  try {
    if (fs.existsSync(VAPID_FILE)) {
      const raw = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'));
      if (raw.publicKey && raw.privateKey) {
        vapidKeys = { ...raw, generated: false };
        return;
      }
    }
    const gen = webPush.generateVAPIDKeys();
    vapidKeys = { publicKey: gen.publicKey, privateKey: gen.privateKey, generated: true };
    ensureDir();
    fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2), 'utf8');
  } catch (err) {
    console.warn('[WebPush] VAPID init failed:', err.message);
  }
}

function loadSubs() {
  try {
    const parsed = JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

let subscriptions = loadSubs();

function persistSubs() {
  try {
    ensureDir();
    fs.writeFileSync(SUBS_FILE, JSON.stringify(subscriptions, null, 2), 'utf8');
  } catch (err) {
    recordError('webPushPersist', err?.message);
  }
}

loadVapid();

webPush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:ops@aureus-pro.invalid',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

export function getPushConfig() {
  loadVapid();
  return {
    supported: typeof webPush.sendNotification === 'function',
    publicKey: vapidKeys.publicKey,
    publicKeyGenerated: vapidKeys.generated,
    subscriberCount: subscriptions.length
  };
}

export function saveSubscription(subscription) {
  if (!subscription?.endpoint) return { success: false, error: 'Invalid subscription' };
  const exists = subscriptions.some((s) => s.endpoint === subscription.endpoint);
  if (!exists) {
    subscriptions.push({ ...subscription, created: Date.now() });
    // Bound set: keep the newest 10 subscriptions (personal/family use).
    if (subscriptions.length > 10) {
      subscriptions.sort((a, b) => (b.created || 0) - (a.created || 0));
      subscriptions = subscriptions.slice(0, 10);
    }
    persistSubs();
  }
  return { success: true, subscriberCount: subscriptions.length };
}

export function removeSubscription(endpoint) {
  const before = subscriptions.length;
  subscriptions = subscriptions.filter((s) => s.endpoint !== endpoint);
  if (subscriptions.length !== before) persistSubs();
  return { success: true, removed: before - subscriptions.length };
}

async function sendToOne(subscription, payload, options) {
  const json = JSON.stringify(payload);
  const opts = { TTL: options?.ttl ?? 86400, urgency: options?.urgency ?? 'normal' };
  try {
    await webPush.sendNotification(subscription, json, opts);
    return { ok: true };
  } catch (err) {
    const code = err?.statusCode;
    // Endpoint expired or gone: drop it so we stop wasting a send.
    if (code === 404 || code === 410 || code === 403) {
      removeSubscription(subscription.endpoint);
      return { ok: false, dropped: true, code };
    }
    recordError('webPushSend', `HTTP ${code ?? 'ERR'}: ${err.message}`);
    return { ok: false, dropped: false, code };
  }
}

// Broadcast to every registered device. Resolves with a send summary.
export async function sendPush(payload, options = {}) {
  if (!subscriptions.length) return { sent: 0, dropped: 0, errors: 0 };
  const results = await Promise.all(
    subscriptions.map((s) => sendToOne(s, payload, options))
  );
  return {
    sent: results.filter((r) => r.ok).length,
    dropped: results.filter((r) => r.dropped).length,
    errors: results.filter((r) => !r.ok && !r.dropped).length,
    recipients: subscriptions.length
  };
}

export function getSubscriberCount() {
  return subscriptions.length;
}