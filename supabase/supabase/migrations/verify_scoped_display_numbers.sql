-- Verification only — safe to run anytime, changes nothing except the
-- final block (which creates+deletes a throwaway workspace to prove the
-- counter function actually increments, then cleans up after itself).

-- 1. Columns exist with the right types/defaults
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE (table_name = 'workspaces' AND column_name = 'next_board_number')
   OR (table_name = 'boards' AND column_name IN ('number', 'next_list_number', 'next_card_number'))
   OR (table_name = 'lists' AND column_name = 'number')
   OR (table_name = 'cards' AND column_name = 'number')
ORDER BY table_name, column_name;

-- 2. The three functions exist
SELECT routine_name, security_type
FROM information_schema.routines
WHERE routine_name IN ('next_board_number', 'next_list_number', 'next_card_number');

-- 3. Backfill sanity check — every board/list/card should now have a
--    non-null number, and per-scope numbers should look like 1,2,3...
--    with no duplicates.
SELECT 'boards' AS table_name, count(*) AS total, count(number) AS numbered
FROM boards
UNION ALL
SELECT 'lists', count(*), count(number) FROM lists
UNION ALL
SELECT 'cards', count(*), count(number) FROM cards;

-- Duplicate check (should return ZERO rows if the unique constraints hold)
SELECT workspace_id, number, count(*) FROM boards GROUP BY workspace_id, number HAVING count(*) > 1;
SELECT board_id, number, count(*) FROM lists GROUP BY board_id, number HAVING count(*) > 1;
SELECT board_id, number, count(*) FROM cards GROUP BY board_id, number HAVING count(*) > 1;

-- Spot-check one real workspace: its boards' numbers vs. its stored counter
SELECT w.id, w.name, w.next_board_number,
       array_agg(b.number ORDER BY b.number) AS board_numbers
FROM workspaces w
LEFT JOIN boards b ON b.workspace_id = w.id
GROUP BY w.id, w.name, w.next_board_number
ORDER BY w.created_at
LIMIT 10;

-- 4. Live functional test of next_board_number(), using a throwaway
--    workspace so it can't collide with your real data. Replace
--    'YOUR_USER_ID' with your own profile id (SELECT id FROM profiles
--    LIMIT 1; if unsure) — owner_id is NOT NULL on workspaces.
DO $$
DECLARE
  v_workspace_id uuid;
  v_first integer;
  v_second integer;
  v_owner_id uuid;
BEGIN
  SELECT id INTO v_owner_id FROM profiles LIMIT 1;

  INSERT INTO workspaces (name, color, owner_id)
  VALUES ('__verify_scoped_numbers__', 'bg-blue-600', v_owner_id)
  RETURNING id INTO v_workspace_id;

  v_first := next_board_number(v_workspace_id);
  v_second := next_board_number(v_workspace_id);

  RAISE NOTICE 'First call returned %, second call returned % (expect 1 then 2)', v_first, v_second;

  IF v_first != 1 OR v_second != 2 THEN
    RAISE EXCEPTION 'UNEXPECTED: next_board_number did not increment as expected (got % then %)', v_first, v_second;
  END IF;

  -- Clean up the throwaway workspace
  DELETE FROM workspaces WHERE id = v_workspace_id;

  RAISE NOTICE 'next_board_number() verified OK, throwaway workspace cleaned up.';
END $$;
