-- Fix profiles table access for workspace member management
-- Enable RLS on profiles table if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "Authenticated users can read profiles for workspace management" ON profiles;

-- Create a policy that allows authenticated users to read all profiles
-- This is needed for workspace admins to search and add members
CREATE POLICY "Authenticated users can read profiles for workspace management"
ON profiles
FOR SELECT
TO authenticated
USING (true);

-- Grant necessary permissions
GRANT SELECT ON profiles TO authenticated;
GRANT SELECT ON profiles TO anon;

-- Fix workspace settings issue by creating default settings for workspaces without them
-- First, let's create a function to set up default workspace settings
CREATE OR REPLACE FUNCTION setup_default_workspace_settings(workspace_id_param UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert default membership_restriction setting if it doesn't exist
  INSERT INTO workspace_settings (workspace_id, setting_type, setting_value)
  SELECT workspace_id_param, 'membership_restriction', '"admins_only"'
  WHERE NOT EXISTS (
    SELECT 1 FROM workspace_settings 
    WHERE workspace_id = workspace_id_param 
    AND setting_type = 'membership_restriction'
  );
END;
$$;

-- Set up default settings for all existing workspaces that don't have them
DO $$
DECLARE
    workspace_record RECORD;
BEGIN
    FOR workspace_record IN SELECT id FROM workspaces LOOP
        PERFORM setup_default_workspace_settings(workspace_record.id);
    END LOOP;
END $$;

-- Create a trigger to automatically set up default settings for new workspaces
CREATE OR REPLACE FUNCTION trigger_setup_default_workspace_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM setup_default_workspace_settings(NEW.id);
  RETURN NEW;
END;
$$;

-- Drop trigger if it exists and create new one
DROP TRIGGER IF EXISTS setup_workspace_settings_trigger ON workspaces;
CREATE TRIGGER setup_workspace_settings_trigger
  AFTER INSERT ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION trigger_setup_default_workspace_settings();

-- Verify the setup
SELECT 'Setup complete!' as status; 