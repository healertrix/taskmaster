-- Add description field to workspaces table
-- This enables rich workspace descriptions similar to boards

ALTER TABLE workspaces ADD COLUMN description TEXT;

-- Update the trigger function to ensure updated_at is properly maintained
-- (The existing trigger should handle this automatically)

-- Verify the change by checking the table structure
-- You can run this query to confirm:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'workspaces' AND column_name = 'description'; 