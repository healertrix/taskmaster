-- The bump_board_last_activity() trigger from 20260809100000 was created
-- WITHOUT `SECURITY DEFINER`. It ran with the calling user's own RLS
-- permissions, so its own `UPDATE boards ...` was silently blocked by
-- boards' RLS policy for anyone who isn't the board owner — 0 rows
-- affected, no error thrown, nothing visibly wrong. That's why moving a
-- card as a board member (not the owner) never actually bumped
-- last_activity_at. Every other cross-row trigger in this app
-- (next_board_number, next_list_number, next_card_number — see
-- 20260807120000) already uses SECURITY DEFINER for exactly this reason.

DROP TRIGGER IF EXISTS cards_bump_board_activity ON cards;
DROP TRIGGER IF EXISTS lists_bump_board_activity ON lists;
DROP FUNCTION IF EXISTS bump_board_last_activity();

CREATE FUNCTION bump_board_last_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_board_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    affected_board_id := OLD.board_id;
  ELSE
    affected_board_id := NEW.board_id;
  END IF;

  UPDATE boards SET last_activity_at = NOW() WHERE id = affected_board_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER cards_bump_board_activity
  AFTER INSERT OR UPDATE OR DELETE ON cards
  FOR EACH ROW EXECUTE FUNCTION bump_board_last_activity();

CREATE TRIGGER lists_bump_board_activity
  AFTER INSERT OR UPDATE OR DELETE ON lists
  FOR EACH ROW EXECUTE FUNCTION bump_board_last_activity();
