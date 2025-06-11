-- Add description field to workspaces table
-- Run this in your Supabase SQL editor

-- Add the description column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'workspaces' 
        AND column_name = 'description'
    ) THEN
        ALTER TABLE workspaces ADD COLUMN description TEXT;
    END IF;
END $$;

-- Optional: Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'workspaces' 
ORDER BY ordinal_position; 