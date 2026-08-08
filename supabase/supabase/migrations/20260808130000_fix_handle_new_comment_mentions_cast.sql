-- Fixes the actual root cause of "cannot cast type jsonb to uuid": the
-- pre-existing handle_new_comment() trigger function expected each
-- element of comments.mentions to be a bare UUID string
-- (mention_array->i)::UUID. The application now stores richer objects —
-- {"id": "<uuid>", "full_name": "..."} — so each element needs its "id"
-- key pulled out first: (mention_array->i->>'id')::UUID.
--
-- Denormalizing full_name into the stored mention (rather than just an
-- id) is deliberate — see the comment in
-- 20260808100000_add_comment_mentions.sql — so this fixes the trigger to
-- match that shape rather than flattening the app's storage back to bare
-- ids.
--
-- Everything else in this function (activity logging, watched-card
-- notifications, board last_activity_at bump) is untouched.

CREATE OR REPLACE FUNCTION handle_new_comment()
RETURNS TRIGGER AS $$
DECLARE
  board_id UUID;
  card_title TEXT;
  mentioned_user UUID;
  mention_array JSONB;
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

  IF NEW.mentions IS NOT NULL THEN
    mention_array := NEW.mentions;

    FOR i IN 0..jsonb_array_length(mention_array) - 1 LOOP
      -- Was: (mention_array->i)::UUID — tried to cast the whole
      -- {"id": ..., "full_name": ...} object to uuid. Pull the id out
      -- as text first (->>), then cast that.
      mentioned_user := (mention_array->i->>'id')::UUID;

      INSERT INTO notifications (
        profile_id,
        type,
        related_card_id,
        related_board_id,
        related_comment_id,
        content
      )
      VALUES (
        mentioned_user,
        'mention',
        NEW.card_id,
        board_id,
        NEW.id,
        'You were mentioned in a comment on "' || card_title || '"'
      );
    END LOOP;
  END IF;

  INSERT INTO notifications (
    profile_id,
    type,
    related_card_id,
    related_board_id,
    related_comment_id,
    content
  )
  SELECT
    cw.profile_id,
    'comment_on_watched_card',
    NEW.card_id,
    board_id,
    NEW.id,
    'New comment on card "' || card_title || '" you are watching'
  FROM card_watchers cw
  WHERE cw.card_id = NEW.card_id
  AND cw.profile_id != NEW.profile_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
