-- Adds what the notification-detail redesign needs on top of the existing
-- live `notifications` table (profile_id, type, related_card_id,
-- related_board_id, related_comment_id, content, is_read, created_at — see
-- utils/notifications.ts for how that shape was discovered):
--
-- 1. `actor_id` — who did the thing. Never existed on the live table (the
--    repo's own earlier migration assumed it would, but the real
--    pre-existing table + trigger never had it). Nullable: existing rows
--    just render without an actor.
-- 2. `notification_preferences` — per-profile, per-type opt-out. Mention
--    is deliberately NOT representable here (no row = always on) — see the
--    two-tier priority design already noted in
--    20260808110000_add_notifications.sql.
-- 3. handle_new_comment() updated to set actor_id on both notification
--    types it creates, include a short comment excerpt on mentions (the
--    'comment' type already gets this via the app-level excerpt built in
--    app/api/cards/[id]/comments/route.ts — mentions never had it), and
--    skip recipients who've turned that type off in preferences.

BEGIN;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (
    type IN ('comment', 'comment_on_watched_card', 'due_date_changed', 'moved_list')
  ),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, type)
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- A user only ever sees/manages their own preferences. No delete policy —
-- there's nothing to delete; a user re-enables a type by upserting
-- enabled = true instead of removing the row.
DO $$ BEGIN
  CREATE POLICY notification_preferences_select_own ON notification_preferences
    FOR SELECT TO authenticated
    USING (profile_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY notification_preferences_insert_own ON notification_preferences
    FOR INSERT TO authenticated
    WITH CHECK (profile_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY notification_preferences_update_own ON notification_preferences
    FOR UPDATE TO authenticated
    USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION handle_new_comment()
RETURNS TRIGGER AS $$
DECLARE
  board_id UUID;
  card_title TEXT;
  mentioned_user UUID;
  mention_array JSONB;
  comment_excerpt TEXT;
BEGIN
  SELECT c.board_id, c.title INTO board_id, card_title
  FROM cards c WHERE c.id = NEW.card_id;

  UPDATE boards SET last_activity_at = NOW() WHERE id = board_id;

  INSERT INTO activities (
    profile_id,
    board_id,
    card_id,
    comment_id,
    action_type,
    action_data
  )
  VALUES (
    NEW.profile_id,
    board_id,
    NEW.card_id,
    NEW.id,
    'comment_added',
    jsonb_build_object(
      'comment_content', NEW.content,
      'card_title', card_title
    )
  );

  -- Same 140-char excerpt convention already used for the 'comment' type's
  -- content in app/api/cards/[id]/comments/route.ts — snapshotted here too
  -- so it survives the comment being later edited/deleted.
  comment_excerpt := CASE
    WHEN length(trim(NEW.content)) > 140
      THEN left(trim(NEW.content), 140) || '…'
    ELSE trim(NEW.content)
  END;

  IF NEW.mentions IS NOT NULL THEN
    mention_array := NEW.mentions;

    FOR i IN 0..jsonb_array_length(mention_array) - 1 LOOP
      mentioned_user := (mention_array->i->>'id')::UUID;

      -- Mentions are never gated by notification_preferences — always on,
      -- by design (see the two-tier priority comment referenced above) —
      -- and never notify yourself for mentioning yourself.
      IF mentioned_user != NEW.profile_id THEN
        INSERT INTO notifications (
          profile_id,
          type,
          actor_id,
          related_card_id,
          related_board_id,
          related_comment_id,
          content
        )
        VALUES (
          mentioned_user,
          'mention',
          NEW.profile_id,
          NEW.card_id,
          board_id,
          NEW.id,
          'You were mentioned in a comment on "' || card_title || '": ' || comment_excerpt
        );
      END IF;
    END LOOP;
  END IF;

  INSERT INTO notifications (
    profile_id,
    type,
    actor_id,
    related_card_id,
    related_board_id,
    related_comment_id,
    content
  )
  SELECT
    cw.profile_id,
    'comment_on_watched_card',
    NEW.profile_id,
    NEW.card_id,
    board_id,
    NEW.id,
    'New comment on card "' || card_title || '" you are watching: ' || comment_excerpt
  FROM card_watchers cw
  WHERE cw.profile_id != NEW.profile_id
    AND NOT EXISTS (
      SELECT 1 FROM notification_preferences np
      WHERE np.profile_id = cw.profile_id
        AND np.type = 'comment_on_watched_card'
        AND np.enabled = false
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
