-- ═══════════════════════════════════════════════════════════════════════
-- Group System Migration — Run this on your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Create groups table
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by TEXT NOT NULL, -- references students(uid)
  target_hours NUMERIC NOT NULL,
  penalty_points NUMERIC NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create group_members table
CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL, -- references students(uid)
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  role TEXT DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'MEMBER')),
  UNIQUE(group_id, student_id)
);

-- 3. Create group_invites table
CREATE TABLE IF NOT EXISTS group_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL, -- references students(uid)
  receiver_id TEXT NOT NULL, -- references students(uid)
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, receiver_id)
);

-- 4. Create group_daily_scores table
-- This stores the daily evaluation for a user in a group (actual hours vs target, points earned/lost)
CREATE TABLE IF NOT EXISTS group_daily_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- references students(uid)
  date DATE NOT NULL,
  actual_hours NUMERIC NOT NULL DEFAULT 0,
  earned_points NUMERIC NOT NULL DEFAULT 0,
  penalty_points NUMERIC NOT NULL DEFAULT 0,
  final_points NUMERIC NOT NULL DEFAULT 0,
  UNIQUE(group_id, user_id, date)
);

-- 5. Create index for performance
CREATE INDEX IF NOT EXISTS idx_group_members_student ON group_members(student_id);
CREATE INDEX IF NOT EXISTS idx_group_daily_scores_group_date ON group_daily_scores(group_id, date);


