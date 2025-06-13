-- Fix foreign key constraint for activities.comment_id
-- This allows comments to be deleted while preserving activity history

-- Drop the existing constraint
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_comment_id_fkey;

-- Add new constraint with SET NULL on delete
ALTER TABLE activities 
ADD CONSTRAINT activities_comment_id_fkey 
FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE SET NULL;

-- This means when a comment is deleted:
-- 1. The comment row is removed
-- 2. activity.comment_id becomes NULL 
-- 3. Activity record is preserved with action_data containing the original comment content
-- 4. Historical audit trail remains intact 