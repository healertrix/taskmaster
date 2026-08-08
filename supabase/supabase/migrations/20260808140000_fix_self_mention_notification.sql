-- Fixes: mentioning yourself in a comment notified you about your own
-- comment. The mention loop in handle_new_comment() never excluded the
-- comment's own author (NEW.profile_id) from mentioned_user — unlike the
-- watched-card block right below it in the same function, which already
-- does `WHERE cw.profile_id != NEW.profile_id`. Bringing the mention loop
-- in line with that same convention: you never get notified about your
-- own action.

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
      mentioned_user := (mention_array->i->>'id')::UUID;

      -- Don't notify yourself for mentioning yourself.
      IF mentioned_user != NEW.profile_id THEN
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
      END IF;
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
