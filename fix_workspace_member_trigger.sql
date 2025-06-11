-- Fix workspace member trigger
-- Run this in your Supabase SQL Editor to ensure workspace creators are automatically added as members

-- First, let's verify the trigger exists
SELECT 
  schemaname, 
  tablename, 
  triggername, 
  enabled 
FROM pg_trigger pt
JOIN pg_class pc ON pt.tgrelid = pc.oid
JOIN pg_namespace pn ON pc.relnamespace = pn.oid
WHERE tablename = 'workspaces' AND triggername = 'on_workspace_created';

-- Recreate the trigger function with better error handling
CREATE OR REPLACE FUNCTION handle_new_workspace()
RETURNS TRIGGER AS $$
BEGIN
  -- Add the workspace owner as an admin member
  INSERT INTO workspace_members (workspace_id, profile_id, role, invited_by)
  VALUES (NEW.id, NEW.owner_id, 'admin', NEW.owner_id)
  ON CONFLICT (workspace_id, profile_id) DO UPDATE SET
    role = 'admin',
    updated_at = NOW();
  
  -- Add default workspace settings
  INSERT INTO workspace_settings (workspace_id, setting_type, setting_value, set_by)
  VALUES (
    NEW.id, 
    'membership_restriction', 
    '"anyone"',
    NEW.owner_id
  ) ON CONFLICT (workspace_id, setting_type) DO NOTHING;
  
  INSERT INTO workspace_settings (workspace_id, setting_type, setting_value, set_by)
  VALUES (
    NEW.id, 
    'board_creation_restriction', 
    '{"public_boards":"any_member","workspace_visible_boards":"any_member","private_boards":"any_member"}',
    NEW.owner_id
  ) ON CONFLICT (workspace_id, setting_type) DO NOTHING;
  
  INSERT INTO workspace_settings (workspace_id, setting_type, setting_value, set_by)
  VALUES (
    NEW.id, 
    'board_deletion_restriction', 
    '{"public_boards":"any_member","workspace_visible_boards":"any_member","private_boards":"any_member"}',
    NEW.owner_id
  ) ON CONFLICT (workspace_id, setting_type) DO NOTHING;
  
  INSERT INTO workspace_settings (workspace_id, setting_type, setting_value, set_by)
  VALUES (
    NEW.id, 
    'board_sharing_restriction', 
    '"anyone"',
    NEW.owner_id
  ) ON CONFLICT (workspace_id, setting_type) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the trigger to ensure it's active
DROP TRIGGER IF EXISTS on_workspace_created ON workspaces;
CREATE TRIGGER on_workspace_created
  AFTER INSERT ON workspaces
  FOR EACH ROW EXECUTE PROCEDURE handle_new_workspace();

-- Verify the trigger was created
SELECT 
  schemaname, 
  tablename, 
  triggername, 
  enabled 
FROM pg_trigger pt
JOIN pg_class pc ON pt.tgrelid = pc.oid
JOIN pg_namespace pn ON pc.relnamespace = pn.oid
WHERE tablename = 'workspaces' AND triggername = 'on_workspace_created';

-- Check for any workspaces missing their owner as a member
SELECT 
  w.id as workspace_id,
  w.name as workspace_name,
  w.owner_id,
  CASE 
    WHEN wm.profile_id IS NULL THEN 'MISSING MEMBER'
    ELSE 'MEMBER EXISTS'
  END as status,
  wm.role
FROM workspaces w
LEFT JOIN workspace_members wm ON w.id = wm.workspace_id AND w.owner_id = wm.profile_id
ORDER BY w.created_at DESC; 