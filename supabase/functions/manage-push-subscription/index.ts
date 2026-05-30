// ─────────────────────────────────────────────────────────────────────────────
// Supabase Edge Function: manage-push-subscription
// POST /subscribe   — save/update a push subscription
// POST /unsubscribe — mark a subscription as inactive
// ─────────────────────────────────────────────────────────────────────────────

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop(); // 'subscribe' or 'unsubscribe'

  try {
    const body = await req.json();

    // ── POST /subscribe ────────────────────────────────────────────────────
    if (path === "subscribe" && req.method === "POST") {
      const { subscription, userRoll, userUid, userRole } = body;

      if (!subscription?.endpoint || !subscription?.keys) {
        return new Response(
          JSON.stringify({ error: "Invalid subscription object" }),
          { status: 400, headers: corsHeaders }
        );
      }

      const { endpoint, keys } = subscription;
      const { p256dh, auth } = keys;

      // Upsert: if endpoint already exists, update; otherwise insert
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          endpoint,
          p256dh,
          auth,
          user_roll: userRoll || null,
          user_uid: userUid || null,
          user_role: userRole || null,
          active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" }
      );

      if (error) throw error;

      console.log(`[sub] Saved subscription for roll=${userRoll} uid=${userUid}`);
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // ── POST /unsubscribe ──────────────────────────────────────────────────
    if (path === "unsubscribe" && req.method === "POST") {
      const { endpoint } = body;

      if (!endpoint) {
        return new Response(
          JSON.stringify({ error: "endpoint is required" }),
          { status: 400, headers: corsHeaders }
        );
      }

      const { error } = await supabase
        .from("push_subscriptions")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("endpoint", endpoint);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: corsHeaders });
  } catch (err) {
    console.error("[manage-push-subscription] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
