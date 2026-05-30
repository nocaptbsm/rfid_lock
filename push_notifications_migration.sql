-- ═══════════════════════════════════════════════════════════════════════════════
-- Push Notifications Schema Migration
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Push subscriptions table
--    Stores browser push subscription objects, one per device per user.
--    Supports multi-device: the same user can have multiple entries.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The subscription endpoint URL (unique per browser/device)
  endpoint     TEXT NOT NULL UNIQUE,

  -- ECDH keys for payload encryption
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,

  -- User identity (stored for query routing)
  user_roll    TEXT,   -- Student roll number
  user_uid     TEXT,   -- Student UID (RFID card)
  user_role    TEXT DEFAULT 'STUDENT', -- 'STUDENT' | 'ADMIN'

  -- Subscription state
  active       BOOLEAN NOT NULL DEFAULT TRUE,

  -- Timestamps
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Notification history (optional — for in-app notification center)
CREATE TABLE IF NOT EXISTS notification_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_roll  TEXT,
  target_uid   TEXT,
  type         TEXT NOT NULL,   -- 'GROUP_INVITE' | 'GROUP_ACCEPTED' | 'ADMIN_ALERT' etc.
  title        TEXT NOT NULL,
  body         TEXT,
  data         JSONB,
  read         BOOLEAN DEFAULT FALSE,
  delivered    BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_push_subs_user_roll    ON push_subscriptions(user_roll) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_push_subs_user_uid     ON push_subscriptions(user_uid) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_push_subs_user_role    ON push_subscriptions(user_role) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_notif_history_roll     ON notification_history(target_roll);
CREATE INDEX IF NOT EXISTS idx_notif_history_created  ON notification_history(created_at DESC);

-- 4. Auto-update updated_at on change
CREATE OR REPLACE FUNCTION update_push_sub_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS push_sub_updated_at ON push_subscriptions;
CREATE TRIGGER push_sub_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_push_sub_updated_at();

-- 5. Row Level Security (allow Edge Functions via service role, restrict direct access)
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS — Edge Functions use service role key
-- Anon/authenticated users cannot directly read/write subscriptions (security!)
CREATE POLICY "Service role only" ON push_subscriptions
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "Service role only" ON notification_history
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- 6. Cleanup function: remove stale inactive subscriptions older than 30 days
--    Schedule via Supabase pg_cron or call periodically from Edge Function
CREATE OR REPLACE FUNCTION cleanup_expired_push_subscriptions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM push_subscriptions
  WHERE active = FALSE
    AND updated_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
