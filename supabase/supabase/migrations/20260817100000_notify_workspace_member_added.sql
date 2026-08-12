-- Adds a notification when someone's added as a workspace member — this
-- never existed; app/api/workspaces/[id]/add-member/route.ts only ever
-- wrote an `activities` row (visible in the team activity feed, but that's
-- opt-in browsing, not a ping to the person actually affected).
--
-- The real `notifications` table predates every migration in this repo
-- (discovered mid-build — see utils/notifications.ts for the full story),
-- so the exact name of its `type` CHECK constraint is unknown. This finds
-- whatever it's actually called and replaces it with one that also allows
-- 'workspace_member_added', rather than guessing a name that might not
-- match and silently no-op.

-- The table only has related_card_id/related_board_id/related_comment_id —
-- nothing to link a workspace-level notification (no card, no board) back
-- to anything clickable. Added here, nullable (every other notification
-- type leaves it null).
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS related_workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;

DO $$
DECLARE
  existing_constraint text;
BEGIN
  SELECT con.conname INTO existing_constraint
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'notifications'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%type%IN%';

  IF existing_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE notifications DROP CONSTRAINT %I', existing_constraint);
  END IF;
END $$;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (
    type IN (
      'mention',
      'comment',
      'comment_on_watched_card',
      'due_date_changed',
      'moved_list',
      'workspace_member_added'
    )
  );
