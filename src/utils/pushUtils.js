// ─────────────────────────────────────────────────────────────────────────────
// Push Notification Utility — Frontend
// Handles SW registration, permission requests, and subscription management
// ─────────────────────────────────────────────────────────────────────────────

// VAPID Public Key (safe to be public — it's not the private key)
export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/**
 * Convert a VAPID public key (base64url) to a Uint8Array
 * Required by the Push API's subscribe() method
 */
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if the browser supports push notifications
 */
export function isPushSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Get the current notification permission state
 * @returns {'granted' | 'denied' | 'default'}
 */
export function getPermissionState() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/**
 * Register the service worker. Safe to call multiple times.
 * @returns {Promise<ServiceWorkerRegistration | null>}
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('[Push] Service Worker registered:', reg.scope);
    return reg;
  } catch (err) {
    console.error('[Push] Service Worker registration failed:', err);
    return null;
  }
}

/**
 * Get the existing push subscription (if any)
 * @returns {Promise<PushSubscription | null>}
 */
export async function getExistingSubscription() {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/**
 * Subscribe to push notifications.
 * Requests permission if needed and creates a PushSubscription.
 * @returns {Promise<{ subscription: PushSubscription, isNew: boolean } | null>}
 */
export async function subscribeToPush() {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported in this browser.');
  }
  if (!VAPID_PUBLIC_KEY) {
    throw new Error('VAPID public key is not configured (VITE_VAPID_PUBLIC_KEY missing).');
  }

  // 1. Request permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(`Push notification permission ${permission}.`);
  }

  // 2. Wait for service worker
  const reg = await navigator.serviceWorker.ready;

  // 3. Check for existing subscription to avoid duplicates
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    return { subscription: existing, isNew: false };
  }

  // 4. Create new subscription
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  return { subscription, isNew: true };
}

/**
 * Unsubscribe from push notifications.
 * @returns {Promise<boolean>}
 */
export async function unsubscribeFromPush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await sub.unsubscribe();
      return true;
    }
    return false;
  } catch (err) {
    console.error('[Push] Unsubscribe failed:', err);
    return false;
  }
}

/**
 * Throttle: prevent asking for permission more than once per session
 */
const PROMPT_COOLDOWN_KEY = 'nc_push_prompt_ts';
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export function shouldPromptForPush() {
  if (getPermissionState() === 'granted') return false; // already subscribed
  if (getPermissionState() === 'denied') return false;  // already denied

  const lastPrompt = localStorage.getItem(PROMPT_COOLDOWN_KEY);
  if (!lastPrompt) return true;
  return Date.now() - parseInt(lastPrompt, 10) > COOLDOWN_MS;
}

export function markPromptShown() {
  localStorage.setItem(PROMPT_COOLDOWN_KEY, Date.now().toString());
}
