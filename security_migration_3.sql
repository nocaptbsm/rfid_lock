-- ═══════════════════════════════════════════════════════════════════════
-- Security Migration 3 — Add password to students table
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE students ADD COLUMN IF NOT EXISTS password TEXT;
