// ─────────────────────────────────────────────────────────────────────────────
// NovaCard PWA Service Worker
// Handles: Push Notifications, Notification Clicks, Offline Caching
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_NAME = 'novacard-v1';
const APP_SHELL = ['/', '/index.html'];

// ── Install: cache app shell ──────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  // Activate immediately without waiting for old SW to finish
  self.skipWaiting();
});

// ── Activate: clean old caches ────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  // Take control of all open clients immediately
  self.clients.claim();
});

// ── Fetch: network-first with cache fallback ──────────────────────────────────
self.addEventListener('fetch', (event) => {
  // Only handle GET requests for same-origin or app shell
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Don't cache API calls
  if (url.pathname.startsWith('/api')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful HTML responses
        if (response.ok && event.request.destination === 'document') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
  );
});

// ── Push: receive and display notification ────────────────────────────────────
self.addEventListener('push', (event) => {
  let payload;
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'NovaCard', body: event.data?.text() || 'New notification' };
  }

  const {
    title = 'NovaCard',
    body = 'You have a new notification',
    icon = '/icons/icon-192.png',
    badge = '/icons/badge-72.png',
    tag = `novacard-${Date.now()}`,
    data = {},
    requireInteraction = false,
    silent = false,
  } = payload;

  const options = {
    body,
    icon,
    badge,
    tag,
    data,
    requireInteraction,
    silent,
    vibrate: [100, 50, 100],
    actions: payload.actions || [],
    timestamp: Date.now(),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification Click: route to correct page ─────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const { action } = event;
  const data = event.notification.data || {};

  // Determine the URL to open based on notification type + action
  let targetUrl = '/';

  if (data.type === 'GROUP_INVITE') {
    targetUrl = data.roll ? `/student/${data.roll}` : '/';
  } else if (data.type === 'GROUP_RESPONSE') {
    targetUrl = data.roll ? `/student/${data.roll}` : '/';
  } else if (data.type === 'ADMIN_ALERT') {
    targetUrl = '/admin-dashboard';
  } else if (data.url) {
    targetUrl = data.url;
  }

  // Handle specific actions (e.g. notification buttons)
  if (action === 'view-group') {
    targetUrl = data.roll ? `/student/${data.roll}` : '/';
  } else if (action === 'dismiss') {
    return; // Just close
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Focus existing tab if one is open
        const existing = clients.find(
          (c) => new URL(c.url).pathname === targetUrl || c.url.includes(targetUrl)
        );
        if (existing) {
          existing.focus();
          existing.postMessage({ type: 'NOTIFICATION_CLICK', data });
          return;
        }
        // Open new window
        return self.clients.openWindow(targetUrl);
      })
  );
});

// ── Notification Close ────────────────────────────────────────────────────────
self.addEventListener('notificationclose', (event) => {
  // Analytics hook: log dismissed notifications
  const data = event.notification.data || {};
  console.log('[SW] Notification dismissed:', data.type || 'unknown');
});

// ── Background Sync (future-ready) ───────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-group-data') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'BACKGROUND_SYNC' }));
      })
    );
  }
});

// ── Push Subscription Change: re-subscribe automatically ──────────────────────
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: self.__VAPID_PUBLIC_KEY__,
      })
      .then((subscription) => {
        // Notify all clients to re-save subscription
        return self.clients.matchAll().then((clients) => {
          clients.forEach((client) =>
            client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED', subscription: subscription.toJSON() })
          );
        });
      })
      .catch((err) => console.error('[SW] Failed to re-subscribe on pushsubscriptionchange:', err))
  );
});
