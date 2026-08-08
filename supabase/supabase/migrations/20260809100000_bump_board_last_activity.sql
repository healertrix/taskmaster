-- boards.last_activity_at was only ever bumped by the handle_new_comment()
-- trigger — creating, editing, moving, or deleting a card (or a list)
-- never touched it, on any board, ever. That's why "last updated" on a
-- board looked stale even right after moving a card: the UI reads
-- last_activity_at (correctly — see the app-code changes alongside this
-- migration), but nothing was writing to it for the vast majority of
-- actual activity.
--
-- Fixed at the database level with a trigger, not scattered across every
-- mutating API route — that's exactly the kind of thing that's easy to
-- add to 3 routes and forget on the 4th (which is what happened here).
-- Any INSERT/UPDATE/DELETE on cards or lists now bumps their board's
-- last_activity_at automatically, no matter which code path caused it.

CREATE OR REPLACE FUNCTION bump_board_last_activity()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cards_bump_board_activity ON cards;
CREATE TRIGGER cards_bump_board_activity
  AFTER INSERT OR UPDATE OR DELETE ON cards
  FOR EACH ROW EXECUTE FUNCTION bump_board_last_activity();

DROP TRIGGER IF EXISTS lists_bump_board_activity ON lists;
CREATE TRIGGER lists_bump_board_activity
  AFTER INSERT OR UPDATE OR DELETE ON lists
  FOR EACH ROW EXECUTE FUNCTION bump_board_last_activity();
