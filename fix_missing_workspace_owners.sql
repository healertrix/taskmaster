-- Fix missing workspace owners as members
-- Run this in your Supabase SQL Editor to fix any existing workspaces

-- Insert missing workspace owners as admin members
INSERT INTO workspace_members (workspace_id, profile_id, role, invited_by, created_at)
SELECT 
  w.id as workspace_id,
  w.owner_id as profile_id,
  'admin' as role,
  w.owner_id as invited_by,
  w.created_at
FROM workspaces w
LEFT JOIN workspace_members wm ON w.id = wm.workspace_id AND w.owner_id = wm.profile_id
WHERE wm.profile_id IS NULL  -- Only insert where owner is not already a member
ON CONFLICT (workspace_id, profile_id) DO UPDATE SET
  role = 'admin',
  updated_at = NOW();

-- Verify the fix worked
SELECT 
  w.id as workspace_id,
  w.name as workspace_name,
  w.owner_id,
  CASE 
    WHEN wm.profile_id IS NULL THEN 'STILL MISSING!'
    ELSE 'FIXED ✅'
  END as status,
  wm.role,
  wm.created_at
FROM workspaces w
LEFT JOIN workspace_members wm ON w.id = wm.workspace_id AND w.owner_id = wm.profile_id
ORDER BY w.created_at DESC; 