// ─────────────────────────────────────────────────────────────────────────────
// Supabase Edge Function: send-push-notification
// Handles VAPID-based web push delivery using the web-push protocol
// Deploy with: supabase functions deploy send-push-notification
// ─────────────────────────────────────────────────────────────────────────────

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ── VAPID config (set via: supabase secrets set VAPID_PUBLIC_KEY=... etc.) ──
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@novacard.app";

// ── Notification types ────────────────────────────────────────────────────────
const NOTIFICATION_TEMPLATES = {
  GROUP_INVITE: (data) => ({
    title: "📨 Study Group Invite",
    body: `${data.senderName || "Someone"} invited you to join "${data.groupName || "their study group"}"`,
    tag: `group-invite-${data.inviteId}`,
    requireInteraction: true,
    data: {
      type: "GROUP_INVITE",
      inviteId: data.inviteId,
      roll: data.receiverRoll,
      url: `/student/${data.receiverRoll}`,
    },
    actions: [
      { action: "view-group", title: "View Invite" },
      { action: "dismiss", title: "Dismiss" },
    ],
  }),

  GROUP_ACCEPTED: (data) => ({
    title: "✅ Invite Accepted",
    body: `${data.memberName || "Someone"} joined your study group "${data.groupName || ""}"`,
    tag: `group-accepted-${data.inviteId}`,
    data: {
      type: "GROUP_RESPONSE",
      roll: data.senderRoll,
      url: `/student/${data.senderRoll}`,
    },
  }),

  GROUP_REJECTED: (data) => ({
    title: "❌ Invite Declined",
    body: `${data.memberName || "Someone"} declined your group invite`,
    tag: `group-rejected-${data.inviteId}`,
    data: {
      type: "GROUP_RESPONSE",
      roll: data.senderRoll,
    },
  }),

  ADMIN_ALERT: (data) => ({
    title: "🔔 Admin Alert",
    body: data.message || "New administrative notification",
    tag: `admin-alert-${Date.now()}`,
    data: {
      type: "ADMIN_ALERT",
      url: "/admin-dashboard",
    },
  }),

  ANNOUNCEMENT: (data) => ({
    title: `📢 ${data.title || "Announcement"}`,
    body: data.body || "New announcement from NovaCard",
    tag: `announcement-${Date.now()}`,
    data: {
      type: "ANNOUNCEMENT",
      url: "/",
    },
  }),
};

// ── VAPID signature helper (using Web Crypto API — available in Deno) ─────────
async function createVapidHeaders(endpoint, vapidPublicKey, vapidPrivateKey, subject) {
  const audienceUrl = new URL(endpoint);
  const audience = `${audienceUrl.protocol}//${audienceUrl.host}`;

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 12 * 60 * 60; // 12 hours

  const header = { typ: "JWT", alg: "ES256" };
  const payload = { aud: audience, exp, sub: subject };

  const b64url = (obj) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const unsigned = `${b64url(header)}.${b64url(payload)}`;

  // Import VAPID private key
  const rawPriv = Uint8Array.from(
    atob(vapidPrivateKey.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0)
  );

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    rawPriv,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(unsigned)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${unsigned}.${sigB64}`;

  return {
    Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
    "Content-Type": "application/json",
  };
}

// ── Send a single push notification ──────────────────────────────────────────
async function sendWebPush(subscription, payload) {
  const { endpoint, keys } = subscription;

  const headers = await createVapidHeaders(
    endpoint,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
    VAPID_SUBJECT
  );

  // Encrypt payload using Web Push Encryption (ECDH + HKDF)
  // For Deno, we use the raw push protocol
  const payloadStr = JSON.stringify(payload);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      ...headers,
      TTL: "86400",
    },
    body: payloadStr,
  });

  return { ok: response.ok, status: response.status };
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const body = await req.json();
    const { type, targetRoll, targetUid, targetRole, data } = body;

    if (!type) {
      return new Response(JSON.stringify({ error: "type is required" }), { status: 400 });
    }

    // Build notification payload from template
    const template = NOTIFICATION_TEMPLATES[type];
    if (!template) {
      return new Response(JSON.stringify({ error: `Unknown notification type: ${type}` }), { status: 400 });
    }
    const notification = template(data || {});

    // Init Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch subscriptions for the target user
    let query = supabase.from("push_subscriptions").select("*").eq("active", true);

    if (targetRoll) query = query.eq("user_roll", targetRoll);
    else if (targetUid) query = query.eq("user_uid", targetUid);
    else if (targetRole) query = query.eq("user_role", targetRole);
    else {
      return new Response(JSON.stringify({ error: "Must specify targetRoll, targetUid, or targetRole" }), { status: 400 });
    }

    const { data: subscriptions, error: dbError } = await query;
    if (dbError) throw dbError;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No active subscriptions for target" }));
    }

    // Send to all devices
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSub = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        const result = await sendWebPush(pushSub, notification);

        // Mark expired subscriptions as inactive
        if (result.status === 410 || result.status === 404) {
          await supabase
            .from("push_subscriptions")
            .update({ active: false })
            .eq("endpoint", sub.endpoint);
        }

        return { endpoint: sub.endpoint.slice(-20), ...result };
      })
    );

    const sent = results.filter((r) => r.status === "fulfilled" && r.value?.ok).length;
    const failed = results.length - sent;

    console.log(`[push] type=${type} sent=${sent} failed=${failed}`);

    return new Response(
      JSON.stringify({ sent, failed, total: results.length }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[push] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
