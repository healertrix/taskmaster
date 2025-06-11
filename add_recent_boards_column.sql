-- Add recent_boards column to profiles table
-- This will store an array of the 6 most recently accessed board IDs for each user
ALTER TABLE profiles 
ADD COLUMN recent_boards UUID[] DEFAULT '{}';

-- Add comment to document the column
COMMENT ON COLUMN profiles.recent_boards IS 'Array of the 6 most recently accessed board IDs for this user, ordered by most recent first'; 