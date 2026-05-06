-- ═══════════════════════════════════════════════════════════════════════
-- Security Migration 2 — Add Role column to students
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Add role column to students table (STUDENT / MASTER)
ALTER TABLE students ADD COLUMN IF NOT EXISTS role TEXT 
  DEFAULT 'STUDENT' CHECK (role IN ('STUDENT', 'MASTER'));

-- 2. Index for fast lookup by role
CREATE INDEX IF NOT EXISTS idx_students_role ON students(role);
