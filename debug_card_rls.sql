-- Debug Card RLS Policy Failure
-- Run these queries step by step to identify the issue

-- 1. Check current user authentication
SELECT 
  auth.uid() as current_user_id,
  auth.email() as current_user_email;

-- 2. Check what boards exist and their ownership
-- Replace with actual board ID you're testing with
SELECT 
  b.id,
  b.name,
  b.owner_id,
  b.visibility,
  (b.owner_id = auth.uid()) as am_i_owner
FROM boards b
WHERE b.id = 'YOUR_BOARD_ID';

-- 3. Check if current user is in board_members table for this board
-- Replace with actual board ID
SELECT 
  bm.board_id,
  bm.profile_id,
  bm.role,
  bm.joined_at,
  (bm.profile_id = auth.uid()) as is_me
FROM board_members bm
WHERE bm.board_id = 'YOUR_BOARD_ID';

-- 4. Check if current user can read from board_members table at all
SELECT COUNT(*) as total_board_memberships_i_can_see
FROM board_members bm
WHERE bm.profile_id = auth.uid();

-- 5. Test the cards RLS policy condition manually
-- Replace with actual board ID
SELECT 
  'Can I see board members?' as test,
  EXISTS (
    SELECT 1 FROM board_members
    WHERE board_members.board_id = 'YOUR_BOARD_ID' 
    AND board_members.profile_id = auth.uid()
  ) as result;

-- 6. Check current cards RLS policy details
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual as condition
FROM pg_policies 
WHERE tablename = 'cards'
ORDER BY cmd, policyname;

-- 7. Check if the lists table is accessible
-- Replace with actual list ID
SELECT 
  l.id,
  l.name,
  l.board_id,
  l.position
FROM lists l
WHERE l.id = 'YOUR_LIST_ID';

-- 8. Check board_members table RLS policies
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual as condition
FROM pg_policies 
WHERE tablename = 'board_members'
ORDER BY cmd, policyname;

-- 9. Test board access through the boards table
-- Replace with actual board ID
SELECT 
  b.id,
  b.name,
  b.visibility,
  CASE 
    WHEN b.visibility = 'public' THEN 'Public - should have access'
    WHEN b.visibility = 'workspace' THEN 'Workspace - need workspace membership'
    WHEN b.visibility = 'private' THEN 'Private - need board membership'
    ELSE 'Unknown visibility'
  END as access_requirement,
  (b.owner_id = auth.uid()) as am_i_owner
FROM boards b
WHERE b.id = 'YOUR_BOARD_ID';

-- 10. If board is workspace visibility, check workspace membership
-- Replace with actual board ID
SELECT 
  wm.workspace_id,
  wm.profile_id,
  wm.role as workspace_role,
  (wm.profile_id = auth.uid()) as is_me
FROM workspace_members wm
JOIN boards b ON b.workspace_id = wm.workspace_id
WHERE b.id = 'YOUR_BOARD_ID'; 