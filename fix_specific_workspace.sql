-- Fix specific workspace: "Ninja the goat"
-- Run this in your Supabase SQL Editor

-- First, let's see the current state
SELECT 'BEFORE FIX - Workspace Info:' as step;
SELECT 
  id, 
  name, 
  owner_id,
  created_at
FROM workspaces 
WHERE id = '9efaf78a-34f6-49fa-835a-d7201fe44958';

SELECT 'BEFORE FIX - Members Info:' as step;
SELECT 
  wm.id,
  wm.workspace_id,
  wm.profile_id,
  wm.role,
  p.email,
  p.full_name
FROM workspace_members wm
LEFT JOIN profiles p ON wm.profile_id = p.id
WHERE wm.workspace_id = '9efaf78a-34f6-49fa-835a-d7201fe44958';

-- Fix this specific workspace by adding the owner as admin
INSERT INTO workspace_members (workspace_id, profile_id, role, invited_by, created_at)
VALUES (
  '9efaf78a-34f6-49fa-835a-d7201fe44958',
  '5c8f55bd-3d30-4c38-8ebe-0eb10573f6b1', 
  'admin',
  '5c8f55bd-3d30-4c38-8ebe-0eb10573f6b1',
  NOW()
)
ON CONFLICT (workspace_id, profile_id) DO UPDATE SET
  role = 'admin',
  updated_at = NOW();

-- Verify the fix
SELECT 'AFTER FIX - Members Info:' as step;
SELECT 
  wm.id,
  wm.workspace_id,
  wm.profile_id,
  wm.role,
  wm.created_at,
  p.email,
  p.full_name
FROM workspace_members wm
LEFT JOIN profiles p ON wm.profile_id = p.id
WHERE wm.workspace_id = '9efaf78a-34f6-49fa-835a-d7201fe44958';

-- Check if there are other workspaces with the same issue
SELECT 'OTHER WORKSPACES NEEDING FIX:' as step;
SELECT 
  w.id as workspace_id,
  w.name as workspace_name,
  w.owner_id,
  CASE 
    WHEN wm.profile_id IS NULL THEN 'NEEDS FIX ❌'
    ELSE 'OK ✅'
  END as status
FROM workspaces w
LEFT JOIN workspace_members wm ON w.id = wm.workspace_id AND w.owner_id = wm.profile_id
WHERE w.owner_id = '5c8f55bd-3d30-4c38-8ebe-0eb10573f6b1'
ORDER BY w.created_at DESC; 