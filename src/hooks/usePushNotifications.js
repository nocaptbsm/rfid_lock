// ─────────────────────────────────────────────────────────────────────────────
// usePushNotifications Hook
// Manages the full lifecycle of push notification subscriptions
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  isPushSupported,
  getPermissionState,
  registerServiceWorker,
  subscribeToPush,
  unsubscribeFromPush,
  getExistingSubscription,
  shouldPromptForPush,
  markPromptShown,
} from '@/utils/pushUtils';
import { savePushSubscription, removePushSubscription } from '@/api/pushApi';

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * @typedef {'idle' | 'subscribing' | 'subscribed' | 'unsubscribing' | 'error' | 'denied' | 'unsupported'} PushStatus
 */

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState(
    /** @type {PushStatus} */ 'idle'
  );
  const [error, setError] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const swReadyRef = useRef(false);

  // ── On mount: register SW and check existing subscription ─────────────────
  useEffect(() => {
    if (!isPushSupported()) {
      setStatus('unsupported');
      return;
    }

    const init = async () => {
      await registerServiceWorker();
      swReadyRef.current = true;

      // Check current permission
      const perm = getPermissionState();
      if (perm === 'denied') {
        setStatus('denied');
        return;
      }

      // Check for existing subscription
      const existing = await getExistingSubscription();
      if (existing) {
        setSubscription(existing);
        setStatus('subscribed');
      } else {
        setStatus(perm === 'granted' ? 'idle' : 'idle');
      }
    };

    init().catch(console.error);
  }, []);

  // ── Listen for messages from service worker ───────────────────────────────
  useEffect(() => {
    const handleSWMessage = (event) => {
      const { type, subscription: newSub } = event.data || {};

      if (type === 'PUSH_SUBSCRIPTION_CHANGED' && newSub && user) {
        // Re-save new subscription after browser auto-rotated keys
        saveSubscription(newSub).catch(console.error);
        setSubscription(newSub);
      }

      if (type === 'NOTIFICATION_CLICK') {
        // Can dispatch a custom event to open a modal, etc.
        window.dispatchEvent(new CustomEvent('nc:notification-click', { detail: event.data.data }));
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleSWMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
  }, [user]);

  // ── Subscribe ─────────────────────────────────────────────────────────────
  const subscribe = useCallback(async () => {
    if (!user) return;
    if (!isPushSupported()) { setStatus('unsupported'); return; }

    setStatus('subscribing');
    setError(null);

    try {
      const { subscription: sub, isNew } = await subscribeToPush();

      if (isNew) {
        // Save to Supabase via Edge Function — pass roll/uid for user-device mapping
        await savePushSubscription({
          ...sub.toJSON(),
          userRoll: user.roll,
          userUid: user.uid,
          userRole: user.role,
        });
      }

      setSubscription(sub);
      setStatus('subscribed');
      markPromptShown();
    } catch (err) {
      console.error('[usePush] Subscribe failed:', err);
      const msg = err.message || 'Failed to enable notifications';
      setError(msg);
      if (msg.includes('denied')) {
        setStatus('denied');
      } else {
        setStatus('error');
      }
    }
  }, [user]);

  // ── Unsubscribe ───────────────────────────────────────────────────────────
  const unsubscribe = useCallback(async () => {
    setStatus('unsubscribing');
    setError(null);
    try {
      const endpoint = subscription?.endpoint;
      await unsubscribeFromPush();
      if (endpoint) await removePushSubscription(endpoint);
      setSubscription(null);
      setStatus('idle');
    } catch (err) {
      console.error('[usePush] Unsubscribe failed:', err);
      setError(err.message || 'Failed to disable notifications');
      setStatus('error');
    }
  }, [subscription]);

  // ── Contextual prompt (called after user engagement) ─────────────────────
  const promptIfAppropriate = useCallback(() => {
    if (shouldPromptForPush() && user && status === 'idle') {
      // Don't auto-call subscribe() — return true to let UI show the CTA
      return true;
    }
    return false;
  }, [user, status]);

  return {
    /** Current subscription state */
    status,
    /** Error message if status === 'error' */
    error,
    /** The raw PushSubscription object */
    subscription,
    /** Subscribe to push notifications */
    subscribe,
    /** Unsubscribe from push notifications */
    unsubscribe,
    /** Returns true if UI should show the "Enable Notifications" CTA */
    promptIfAppropriate,
    /** Convenience booleans */
    isSubscribed: status === 'subscribed',
    isSupported: isPushSupported(),
    isDenied: status === 'denied',
    isLoading: status === 'subscribing' || status === 'unsubscribing',
  };
};
