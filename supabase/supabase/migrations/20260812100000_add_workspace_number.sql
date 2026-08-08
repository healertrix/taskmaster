-- colorForKey(workspace.id) is stable (same workspace = same color
-- everywhere, permanent regardless of rename) but is still just a hash —
-- for a small set of real workspace ids, there's no guarantee they land
-- far apart on the color wheel (documented in utils/idColor.ts as the
-- "all my workspaces look green" problem). Boards/lists/cards already
-- solved this correctly with a real, persistent, scoped sequential number
-- fed through colorForNumber() (golden-angle spacing — GUARANTEED spread
-- for any run of N numbers, not just probable). This gives workspaces the
-- same treatment: numbered per OWNER (each user's own workspaces are
-- 1, 2, 3, ...), assigned once at creation and never reused — exactly
-- like 20260807120000's boards/lists/cards numbers. Permanent (like id),
-- consistent everywhere (like id), but also guaranteed to spread out.

BEGIN;

-- Per-owner counter. Lives on profiles since a workspace's natural
-- "parent" for numbering purposes is its owner, not another workspace row.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS next_workspace_number integer NOT NULL DEFAULT 1;

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS number integer;

-- Backfill existing workspaces, oldest-first per owner.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY owner_id ORDER BY created_at, id) AS rn
  FROM workspaces
)
UPDATE workspaces w
SET number = ranked.rn
FROM ranked
WHERE w.id = ranked.id;

-- Move each owner's counter past whatever backfill just handed out.
UPDATE profiles p
SET next_workspace_number = sub.max_num + 1
FROM (
  SELECT owner_id, MAX(number) AS max_num
  FROM workspaces
  GROUP BY owner_id
) sub
WHERE p.id = sub.owner_id;

ALTER TABLE workspaces ALTER COLUMN number SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE workspaces ADD CONSTRAINT workspaces_owner_number_uniq UNIQUE (owner_id, number);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Assigns the next number automatically on insert — every existing
-- "create workspace" code path (CreateWorkspaceModal's client-side insert,
-- /api/create-workspace) gets a number with no app-code changes needed.
-- SECURITY DEFINER so the counter bump on `profiles` isn't silently
-- blocked by RLS for whichever role ends up not matching that row's own
-- UPDATE policy — see 20260810100000's postmortem on exactly that failure
-- mode (a trigger without SECURITY DEFINER silently updating 0 rows).
CREATE OR REPLACE FUNCTION assign_workspace_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number integer;
BEGIN
  IF NEW.number IS NULL THEN
    UPDATE profiles
    SET next_workspace_number = next_workspace_number + 1
    WHERE id = NEW.owner_id
    RETURNING next_workspace_number - 1 INTO v_number;

    NEW.number := COALESCE(v_number, 1);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workspaces_assign_number ON workspaces;
CREATE TRIGGER workspaces_assign_number
  BEFORE INSERT ON workspaces
  FOR EACH ROW EXECUTE FUNCTION assign_workspace_number();

COMMIT;
