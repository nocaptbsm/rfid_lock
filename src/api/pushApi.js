// Push API — routes subscription management to Supabase Edge Functions
// This is intentionally a separate API module to keep push concerns isolated
// from the main API client (which points to the Express backend on Render)

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[PushAPI] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not configured.');
}

const edgeFn = (name) => `${SUPABASE_URL}/functions/v1/${name}`;

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
});

/**
 * Save/update a push subscription in Supabase
 * @param {{ endpoint, keys, userRoll, userUid, userRole }} subscription
 */
export const savePushSubscription = async (subscription) => {
  const res = await fetch(`${edgeFn('manage-push-subscription')}/subscribe`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ subscription }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

/**
 * Remove (soft-delete) a push subscription by endpoint
 * @param {string} endpoint
 */
export const removePushSubscription = async (endpoint) => {
  const res = await fetch(`${edgeFn('manage-push-subscription')}/unsubscribe`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ endpoint }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

/**
 * Trigger a push notification via the Edge Function
 * This is called from the backend (Express on Render) — provided here
 * for completeness / admin-triggered notifications
 * @param {{ type, targetRoll?, targetUid?, targetRole?, data }} options
 */
export const triggerPushNotification = async ({ type, targetRoll, targetUid, targetRole, data }) => {
  const res = await fetch(edgeFn('send-push-notification'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ type, targetRoll, targetUid, targetRole, data }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};
