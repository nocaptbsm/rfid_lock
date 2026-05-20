-- ═══════════════════════════════════════════════════════════════════════
-- G-5: Enforce max 5 members per group at the database level
-- Run this in Supabase SQL Editor after the group_system_migration.sql
-- ═══════════════════════════════════════════════════════════════════════

-- Function: raises an exception if the group already has 5 members
CREATE OR REPLACE FUNCTION check_group_member_limit()
RETURNS TRIGGER AS $$
DECLARE
  member_count INT;
BEGIN
  SELECT COUNT(*) INTO member_count
  FROM group_members
  WHERE group_id = NEW.group_id;

  IF member_count >= 5 THEN
    RAISE EXCEPTION 'GROUP_FULL: Group already has the maximum of 5 members.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: fires BEFORE INSERT so the row is blocked before it lands
DROP TRIGGER IF EXISTS trg_group_member_limit ON group_members;
CREATE TRIGGER trg_group_member_limit
  BEFORE INSERT ON group_members
  FOR EACH ROW
  EXECUTE FUNCTION check_group_member_limit();
