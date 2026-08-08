-- 20260812100000 scoped workspace numbers PER OWNER (workspace #1, #2, ...
-- for each owner independently) — but pages showing workspace colors
-- (home page, search, etc.) show a mix of workspaces you own AND
-- workspaces you're just a member of, owned by other people. Two
-- different owners' workspaces can both legitimately be "#1", and
-- colorForNumber(1) is identical regardless of whose workspace it is —
-- that's why colors were still colliding after the per-owner migration.
-- Fixed by numbering workspaces GLOBALLY instead: one shared sequence
-- across every workspace in the app, so no two workspaces — regardless of
-- owner — ever share a number, and therefore never share a color.

BEGIN;

-- Global sequence, backed by the range of numbers already handed out.
CREATE SEQUENCE IF NOT EXISTS workspace_number_seq;

-- Drop the per-owner uniqueness constraint and counter — no longer used.
ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_owner_number_uniq;
ALTER TABLE profiles DROP COLUMN IF EXISTS next_workspace_number;

-- Renumber every workspace globally, oldest-first.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM workspaces
)
UPDATE workspaces w
SET number = ranked.rn
FROM ranked
WHERE w.id = ranked.id;

-- Move the sequence past whatever was just handed out.
SELECT setval('workspace_number_seq', COALESCE((SELECT MAX(number) FROM workspaces), 0) + 1, false);

DO $$ BEGIN
  ALTER TABLE workspaces ADD CONSTRAINT workspaces_number_uniq UNIQUE (number);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION assign_workspace_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.number IS NULL THEN
    NEW.number := nextval('workspace_number_seq');
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger itself is unchanged (already BEFORE INSERT from 20260812100000)
-- — only the function body changed, CREATE OR REPLACE above covers it.

COMMIT;
