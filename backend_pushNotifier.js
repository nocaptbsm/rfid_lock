// ─────────────────────────────────────────────────────────────────────────────
// Push Notification Sender — Backend Utility
// Add this file to your Express backend (rfid-lock on Render)
// Location: src/utils/pushNotifier.js (or wherever your backend utils live)
//
// Usage:
//   const { notifyGroupInvite, notifyGroupAccepted } = require('./pushNotifier');
//   await notifyGroupInvite({ receiverRoll, senderName, groupName, inviteId });
// ─────────────────────────────────────────────────────────────────────────────

// This utility calls your Supabase Edge Function to deliver push notifications.
// This keeps web-push VAPID logic centralized in the Edge Function (free tier).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[pushNotifier] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — push disabled');
}

/**
 * Internal: call the Supabase Edge Function to deliver a push notification
 * Failures are swallowed — never crashes the API response
 */
async function callPushEdgeFunction(payload) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    console.log('[pushNotifier]', payload.type, '→', JSON.stringify(result));
  } catch (err) {
    // Non-fatal: push notification failure should never crash the API
    console.error('[pushNotifier] Failed to send push:', err.message);
  }
}

// ── Notification helpers ──────────────────────────────────────────────────────

/**
 * Notify a student they received a group invite
 * Call this after successfully inserting into group_invites table
 */
async function notifyGroupInvite({ receiverRoll, senderName, groupName, inviteId }) {
  await callPushEdgeFunction({
    type: 'GROUP_INVITE',
    targetRoll: receiverRoll,
    data: { receiverRoll, senderName, groupName, inviteId },
  });
}

/**
 * Notify the group admin that their invite was accepted
 * Call this when a student accepts a group invite
 */
async function notifyGroupAccepted({ senderRoll, memberName, groupName, inviteId }) {
  await callPushEdgeFunction({
    type: 'GROUP_ACCEPTED',
    targetRoll: senderRoll,
    data: { senderRoll, memberName, groupName, inviteId },
  });
}

/**
 * Notify the group admin that their invite was rejected
 */
async function notifyGroupRejected({ senderRoll, memberName, inviteId }) {
  await callPushEdgeFunction({
    type: 'GROUP_REJECTED',
    targetRoll: senderRoll,
    data: { senderRoll, memberName, inviteId },
  });
}

/**
 * Send an admin broadcast to all students
 */
async function notifyAdminAlert({ message }) {
  await callPushEdgeFunction({
    type: 'ADMIN_ALERT',
    targetRole: 'STUDENT',
    data: { message },
  });
}

/**
 * Send a targeted admin alert to a specific student
 */
async function notifyStudentAlert({ targetRoll, message }) {
  await callPushEdgeFunction({
    type: 'ADMIN_ALERT',
    targetRoll,
    data: { message },
  });
}

module.exports = {
  notifyGroupInvite,
  notifyGroupAccepted,
  notifyGroupRejected,
  notifyAdminAlert,
  notifyStudentAlert,
};
