-- Cleanup script to revert all overcomplicated activity triggers
-- Run this to clean up the session-variable based implementation

-- ==========================================
-- DROP ALL TRIGGERS
-- ==========================================

-- Drop label triggers
DROP TRIGGER IF EXISTS on_label_added_to_card ON card_labels;
DROP TRIGGER IF EXISTS on_label_removed_from_card ON card_labels;

-- Drop attachment triggers for both possible table names
DROP TRIGGER IF EXISTS on_card_attachment_removed ON card_attachments;
DROP TRIGGER IF EXISTS on_card_attachment_updated ON card_attachments;
DROP TRIGGER IF EXISTS on_card_attachment_created ON card_attachments;
DROP TRIGGER IF EXISTS on_attachment_removed ON attachments;
DROP TRIGGER IF EXISTS on_attachment_updated ON attachments;
DROP TRIGGER IF EXISTS on_attachment_created ON attachments;

-- ==========================================
-- DROP ALL FUNCTIONS
-- ==========================================

-- Drop label functions
DROP FUNCTION IF EXISTS handle_label_added();
DROP FUNCTION IF EXISTS handle_label_removed();

-- Drop attachment functions
DROP FUNCTION IF EXISTS handle_card_attachment_removed();
DROP FUNCTION IF EXISTS handle_card_attachment_updated();
DROP FUNCTION IF EXISTS handle_card_attachment_created();
DROP FUNCTION IF EXISTS handle_attachment_removed();
DROP FUNCTION IF EXISTS handle_attachment_updated();

-- Drop session variable helper functions
DROP FUNCTION IF EXISTS set_current_user_for_activity(UUID);
DROP FUNCTION IF EXISTS clear_current_user_context();

-- ==========================================
-- VERIFY CLEANUP
-- ==========================================

-- Check that all triggers are removed
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND (trigger_name LIKE '%label%' OR trigger_name LIKE '%attachment%')
ORDER BY event_object_table, trigger_name;

-- Check that all functions are removed
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (routine_name LIKE '%label%' OR routine_name LIKE '%attachment%' OR routine_name LIKE '%current_user%')
ORDER BY routine_name;

-- ==========================================
-- COMPLETION MESSAGE
-- ==========================================

DO $$
BEGIN
  RAISE NOTICE '=== CLEANUP COMPLETED ===';
  RAISE NOTICE 'Removed all overcomplicated triggers and functions';
  RAISE NOTICE 'Ready for simple implementation following comment pattern';
END
$$; 