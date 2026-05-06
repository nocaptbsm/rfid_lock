-- ═══════════════════════════════════════════════════════════════════════
-- Security Migration — Run this on your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Add status column to students table (AUTHORIZED / SUSPENDED)
ALTER TABLE students ADD COLUMN IF NOT EXISTS status TEXT 
  DEFAULT 'AUTHORIZED' CHECK (status IN ('AUTHORIZED', 'SUSPENDED'));

-- 2. Add device_id and authorized columns to scans table
ALTER TABLE scans ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS authorized BOOLEAN DEFAULT true;

-- 3. Allow 'DENIED' type in scans (for logging unauthorized attempts)
-- First drop the existing constraint, then re-create it with DENIED included
ALTER TABLE scans DROP CONSTRAINT IF EXISTS scans_type_check;
ALTER TABLE scans ADD CONSTRAINT scans_type_check 
  CHECK (type IN ('ENTRY', 'EXIT', 'DENIED'));

-- 4. Create nonce table for replay attack prevention
CREATE TABLE IF NOT EXISTS used_nonces (
  nonce TEXT PRIMARY KEY,
  used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient cleanup of old nonces
CREATE INDEX IF NOT EXISTS idx_nonces_time ON used_nonces(used_at);

-- 5. Index for fast authorization lookups
CREATE INDEX IF NOT EXISTS idx_students_status ON students(uid, status);
CREATE INDEX IF NOT EXISTS idx_scans_authorized ON scans(authorized) WHERE authorized = false;
