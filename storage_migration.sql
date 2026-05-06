-- ═══════════════════════════════════════════════════════════════════════
-- Storage Optimization Migration 
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- Step 1: Add device_id to sessions (replaces scans.device_id)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_id TEXT;

-- Step 2: Create lightweight security_log for denied scans only
CREATE TABLE IF NOT EXISTS security_log (
  id SERIAL PRIMARY KEY,
  uid TEXT NOT NULL,
  reason TEXT NOT NULL,  -- 'UNKNOWN_CARD' or 'CARD_SUSPENDED'
  device_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Index for fast auto-deletion
CREATE INDEX IF NOT EXISTS idx_security_log_time ON security_log(created_at);

-- Step 4: Disable Supabase Realtime (Reduces WAL generation)
ALTER PUBLICATION supabase_realtime SET TABLE NONE;

-- Step 5: Setup pg_cron for auto-cleanup (Optional but recommended)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('cleanup-old-logs', '0 3 * * *', $$
--   DELETE FROM sessions WHERE status = 'COMPLETED' AND entry_time < NOW() - INTERVAL '30 days';
--   DELETE FROM security_log WHERE created_at < NOW() - INTERVAL '7 days';
--   DELETE FROM used_nonces WHERE used_at < NOW() - INTERVAL '1 day';
-- $$);

-- ⚠️ WARNING: Run this ONLY after deploying the backend and confirming everything works
-- DROP TABLE IF EXISTS scans;
