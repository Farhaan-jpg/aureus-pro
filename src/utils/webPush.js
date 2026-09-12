// Web Push Notifications — browser/phone side.
// Registers the service worker + VAPID subscription against the app's own
// /api/push/* endpoints. Works on Android (Web Push/FCM) and iOS 16.4+
// (APNs) without an app store.
export function isPushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function registerServiceWorker() {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  return reg;
}

export async function getPushState() {
  if (!isPushSupported()) {
    return { supported: false, subscribed: false, permission: 'unsupported' };
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return {
      supported: true,
      subscribed: Boolean(sub),
      permission: Notification.permission
    };
  } catch (err) {
    return { supported: true, subscribed: false, permission: 'denied' };
  }
}

export async function subscribePush() {
  if (!isPushSupported()) throw new Error('Web Push is not supported on this device/browser.');
  const reg = await registerServiceWorker();
  const cfg = await (await fetch('/api/push/config')).json();
  if (!cfg.publicKey) throw new Error('Server is missing VAPID keys.');

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(cfg.publicKey)
  });

  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON() })
  });

  return { ...cfg, subscription: sub.toJSON() };
}

export async function unsubscribePush() {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) {
    await sub.unsubscribe();
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint })
    });
  }
}

export async function sendTestPush() {
  await fetch('/api/push/test', { method: 'POST' });
}