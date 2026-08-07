-- Scoped, human-shareable display numbers for boards, lists, and cards.
--
-- Design (see conversation / teaching workspace for the full reasoning):
--   - Boards are numbered per WORKSPACE      -> boards.number      (e.g. board 3)
--   - Lists  are numbered per BOARD          -> lists.number       (e.g. 3.2)
--   - Cards  are numbered per BOARD          -> cards.number       (e.g. 3-15)
--
-- Numbers are assigned by a per-scope counter stored on the parent row
-- (workspaces.next_board_number, boards.next_list_number,
-- boards.next_card_number) and incremented atomically via a single
-- UPDATE ... RETURNING, the same mechanism Jira's own `pcounter` field
-- uses. Numbers are NEVER reused after a delete (see mission doc) — gaps
-- are expected and permanent, exactly like Jira/ADO.
--
-- The UUID `id` columns are untouched and remain the real primary keys /
-- foreign key targets everywhere. `number` is a pure display/lookup layer.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Counters on the parent rows
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS next_board_number integer NOT NULL DEFAULT 1;

ALTER TABLE boards
  ADD COLUMN IF NOT EXISTS next_list_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS next_card_number integer NOT NULL DEFAULT 1;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. The display number columns themselves (nullable for now — backfilled
--    in step 3, then locked down to NOT NULL in step 4)
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE boards ADD COLUMN IF NOT EXISTS number integer;
ALTER TABLE lists  ADD COLUMN IF NOT EXISTS number integer;
ALTER TABLE cards  ADD COLUMN IF NOT EXISTS number integer;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Backfill existing rows, oldest-first (created_at, then id as a
--    tiebreaker for rows created in the same instant)
-- ─────────────────────────────────────────────────────────────────────────

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY workspace_id ORDER BY created_at, id) AS rn
  FROM boards
)
UPDATE boards b
SET number = ranked.rn
FROM ranked
WHERE b.id = ranked.id;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY board_id ORDER BY created_at, id) AS rn
  FROM lists
)
UPDATE lists l
SET number = ranked.rn
FROM ranked
WHERE l.id = ranked.id;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY board_id ORDER BY created_at, id) AS rn
  FROM cards
)
UPDATE cards c
SET number = ranked.rn
FROM ranked
WHERE c.id = ranked.id;

-- Move each parent's counter past whatever it just handed out during
-- backfill, so the next real creation continues the sequence instead of
-- restarting at 1.

UPDATE workspaces w
SET next_board_number = sub.max_num + 1
FROM (
  SELECT workspace_id, MAX(number) AS max_num
  FROM boards
  GROUP BY workspace_id
) sub
WHERE w.id = sub.workspace_id;

UPDATE boards b
SET next_list_number = sub.max_num + 1
FROM (
  SELECT board_id, MAX(number) AS max_num
  FROM lists
  GROUP BY board_id
) sub
WHERE b.id = sub.board_id;

UPDATE boards b
SET next_card_number = sub.max_num + 1
FROM (
  SELECT board_id, MAX(number) AS max_num
  FROM cards
  GROUP BY board_id
) sub
WHERE b.id = sub.board_id;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Lock the columns down: required + unique within their scope
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE boards ALTER COLUMN number SET NOT NULL;
ALTER TABLE lists  ALTER COLUMN number SET NOT NULL;
ALTER TABLE cards  ALTER COLUMN number SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE boards ADD CONSTRAINT boards_workspace_number_uniq UNIQUE (workspace_id, number);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE lists ADD CONSTRAINT lists_board_number_uniq UNIQUE (board_id, number);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE cards ADD CONSTRAINT cards_board_number_uniq UNIQUE (board_id, number);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Atomic "increment and hand out" functions
--
-- SECURITY DEFINER: creating a board/list/card needs to bump a counter on
-- its *parent* row (workspace for boards, board for lists/cards), which
-- the calling member may not have direct UPDATE rights on under RLS (e.g.
-- a regular member creating a board isn't necessarily allowed to UPDATE
-- the workspace row otherwise). These functions are deliberately narrow —
-- parameterized only by uuid, they touch exactly one counter column, and
-- return only an integer — so running with elevated privilege here is a
-- contained, auditable exception, not a general RLS bypass.
-- `SET search_path = public` pins name resolution so a malicious search_path
-- can't hijack what these functions call.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION next_board_number(p_workspace_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number integer;
BEGIN
  UPDATE workspaces
  SET next_board_number = next_board_number + 1
  WHERE id = p_workspace_id
  RETURNING next_board_number - 1 INTO v_number;

  IF v_number IS NULL THEN
    RAISE EXCEPTION 'Workspace % not found', p_workspace_id;
  END IF;

  RETURN v_number;
END;
$$;

CREATE OR REPLACE FUNCTION next_list_number(p_board_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number integer;
BEGIN
  UPDATE boards
  SET next_list_number = next_list_number + 1
  WHERE id = p_board_id
  RETURNING next_list_number - 1 INTO v_number;

  IF v_number IS NULL THEN
    RAISE EXCEPTION 'Board % not found', p_board_id;
  END IF;

  RETURN v_number;
END;
$$;

CREATE OR REPLACE FUNCTION next_card_number(p_board_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number integer;
BEGIN
  UPDATE boards
  SET next_card_number = next_card_number + 1
  WHERE id = p_board_id
  RETURNING next_card_number - 1 INTO v_number;

  IF v_number IS NULL THEN
    RAISE EXCEPTION 'Board % not found', p_board_id;
  END IF;

  RETURN v_number;
END;
$$;

-- Only authenticated app users may call these — not the public/anon role.
GRANT EXECUTE ON FUNCTION next_board_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION next_list_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION next_card_number(uuid) TO authenticated;

COMMIT;
