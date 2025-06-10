-- Debug Description Issue
-- Run these commands in Supabase SQL Editor to troubleshoot

-- 1. Check if description column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'boards' AND column_name = 'description';

-- 2. If no results above, run this migration:
-- ALTER TABLE boards ADD COLUMN description TEXT;

-- 3. Check current board data (replace 'your-board-id' with actual board ID)
SELECT id, name, description, created_at 
FROM boards 
WHERE id = 'your-board-id';

-- 4. Test setting a description (replace 'your-board-id' with actual board ID)
-- UPDATE boards SET description = 'Test description' WHERE id = 'your-board-id';

-- 5. Verify the update worked
-- SELECT id, name, description FROM boards WHERE id = 'your-board-id'; 