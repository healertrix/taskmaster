-- Simple Activity Triggers following EXACT comment pattern
-- Only for card_attachments table (no attachments table)
-- No session variables - direct user references like comments

-- ==========================================
-- CARD_ATTACHMENTS TRIGGERS (following comment pattern exactly)
-- ==========================================

-- CREATE trigger for attachment removal (like comment deletion)
CREATE OR REPLACE FUNCTION handle_card_attachment_removed()
RETURNS TRIGGER AS $$
DECLARE
  board_id UUID;
  card_title TEXT;
BEGIN
  -- Get card information (same as comments)
  SELECT c.board_id, c.title INTO board_id, card_title
  FROM cards c WHERE c.id = OLD.card_id;
  
  -- Update board's last activity (same as comments)
  UPDATE boards SET last_activity_at = NOW() WHERE id = board_id;
  
  -- Create activity record (same pattern as comments)
  INSERT INTO activities (
    profile_id, 
    board_id, 
    card_id,
    action_type, 
    action_data
  )
  VALUES (
    OLD.created_by, -- Direct reference like comments use NEW.profile_id
    board_id,
    OLD.card_id,
    'attachment_removed',
    jsonb_build_object(
      'attachment_name', COALESCE(OLD.filename, 'Attachment'),
      'card_title', card_title
    )
  );
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- CREATE trigger for attachment updates
CREATE OR REPLACE FUNCTION handle_card_attachment_updated()
RETURNS TRIGGER AS $$
DECLARE
  board_id UUID;
  card_title TEXT;
BEGIN
  -- Only track meaningful changes
  IF OLD.filename = NEW.filename AND OLD.file_url = NEW.file_url THEN
    RETURN NEW;
  END IF;
  
  -- Get card information (same as comments)
  SELECT c.board_id, c.title INTO board_id, card_title
  FROM cards c WHERE c.id = NEW.card_id;
  
  -- Update board's last activity (same as comments)
  UPDATE boards SET last_activity_at = NOW() WHERE id = board_id;
  
  -- Create activity record (same pattern as comments)
  INSERT INTO activities (
    profile_id, 
    board_id, 
    card_id,
    action_type, 
    action_data
  )
  VALUES (
    NEW.created_by, -- Direct reference like comments use NEW.profile_id
    board_id,
    NEW.card_id,
    'attachment_updated',
    jsonb_build_object(
      'attachment_name', COALESCE(NEW.filename, 'Attachment'),
      'old_name', COALESCE(OLD.filename, 'Attachment'),
      'card_title', card_title
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- CREATE trigger for attachment creation
CREATE OR REPLACE FUNCTION handle_card_attachment_created()
RETURNS TRIGGER AS $$
DECLARE
  board_id UUID;
  card_title TEXT;
BEGIN
  -- Get card information (same as comments)
  SELECT c.board_id, c.title INTO board_id, card_title
  FROM cards c WHERE c.id = NEW.card_id;
  
  -- Update board's last activity (same as comments)
  UPDATE boards SET last_activity_at = NOW() WHERE id = board_id;
  
  -- Create activity record (same pattern as comments)
  INSERT INTO activities (
    profile_id, 
    board_id, 
    card_id,
    action_type, 
    action_data
  )
  VALUES (
    NEW.created_by, -- Direct reference like comments use NEW.profile_id
    board_id,
    NEW.card_id,
    'attachment_added',
    jsonb_build_object(
      'attachment_name', COALESCE(NEW.filename, 'Attachment'),
      'card_title', card_title
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- LABEL TRIGGERS (but we need to modify API first)
-- ==========================================

-- NOTE: Labels are more complex because card_labels doesn't have user info
-- We'll handle labels in the API routes for now, not triggers
-- The issue is card_labels table doesn't have user information

-- ==========================================
-- CREATE THE TRIGGERS
-- ==========================================

-- Create triggers for card_attachments (following comment pattern)
CREATE TRIGGER on_card_attachment_created
  AFTER INSERT ON card_attachments
  FOR EACH ROW EXECUTE PROCEDURE handle_card_attachment_created();

CREATE TRIGGER on_card_attachment_updated
  AFTER UPDATE ON card_attachments
  FOR EACH ROW EXECUTE PROCEDURE handle_card_attachment_updated();

CREATE TRIGGER on_card_attachment_removed
  AFTER DELETE ON card_attachments
  FOR EACH ROW EXECUTE PROCEDURE handle_card_attachment_removed();

-- ==========================================
-- VERIFICATION
-- ==========================================

-- Check which triggers were created
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE '%attachment%'
ORDER BY event_object_table, trigger_name;

-- ==========================================
-- COMPLETION MESSAGE
-- ==========================================

DO $$
BEGIN
  RAISE NOTICE '=== SIMPLE TRIGGERS CREATED ===';
  RAISE NOTICE 'Following EXACT comment pattern!';
  RAISE NOTICE '';
  RAISE NOTICE 'Created triggers for card_attachments:';
  RAISE NOTICE '- on_card_attachment_created (INSERT)';
  RAISE NOTICE '- on_card_attachment_updated (UPDATE)';  
  RAISE NOTICE '- on_card_attachment_removed (DELETE)';
  RAISE NOTICE '';
  RAISE NOTICE 'These work exactly like comment triggers:';
  RAISE NOTICE '- Use NEW.created_by/OLD.created_by directly';
  RAISE NOTICE '- No session variables';
  RAISE NOTICE '- Simple and reliable';
  RAISE NOTICE '';
  RAISE NOTICE 'For labels: handle in API routes (card_labels has no user info)';
END
$$; 