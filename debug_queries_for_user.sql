-- Debug queries for user: 5c8f55bd-3d30-4c38-8ebe-0eb10573f6b1
-- Copy and run these queries one by one in Supabase SQL Editor

-- 1. Check current user authentication
SELECT 
  auth.uid() as current_user_id,
  auth.email() as current_user_email,
  CASE 
    WHEN auth.uid() = '5c8f55bd-3d30-4c38-8ebe-0eb10573f6b1' THEN 'Correct user'
    ELSE 'Different user logged in'
  END as user_check;

-- 2. Check all boards you own
SELECT 
  id as board_id, 
  name as board_name, 
  owner_id, 
  visibility, 
  created_at,
  CASE WHEN owner_id = '5c8f55bd-3d30-4c38-8ebe-0eb10573f6b1' THEN 'You own this' ELSE 'Not your board' END as ownership
FROM boards 
WHERE owner_id = '5c8f55bd-3d30-4c38-8ebe-0eb10573f6b1' 
ORDER BY created_at DESC;

-- 3. Check all boards you're a member of
SELECT 
  bm.board_id, 
  bm.role, 
  bm.joined_at, 
  b.name as board_name,
  b.owner_id as board_owner,
  CASE WHEN b.owner_id = '5c8f55bd-3d30-4c38-8ebe-0eb10573f6b1' THEN 'You own this' ELSE 'Member only' END as relationship
FROM board_members bm
JOIN boards b ON b.id = bm.board_id
WHERE bm.profile_id = '5c8f55bd-3d30-4c38-8ebe-0eb10573f6b1';

-- 4. Check if board creation trigger exists and is working
SELECT 
  trigger_name, 
  event_manipulation, 
  action_statement,
  action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'boards'
AND trigger_name LIKE '%board%';

-- 5. Check if handle_new_board function exists
SELECT 
  routine_name, 
  routine_type,
  external_language
FROM information_schema.routines 
WHERE routine_name = 'handle_new_board';

-- 6. Find boards missing membership entries (boards you own but aren't a member of)
SELECT 
  b.id as board_id,
  b.name as board_name,
  b.created_at,
  'Missing membership entry' as issue
FROM boards b
WHERE b.owner_id = '5c8f55bd-3d30-4c38-8ebe-0eb10573f6b1'
AND NOT EXISTS (
  SELECT 1 FROM board_members bm 
  WHERE bm.board_id = b.id AND bm.profile_id = '5c8f55bd-3d30-4c38-8ebe-0eb10573f6b1'
);

-- 7. FIX: Add missing board memberships for boards you own
INSERT INTO board_members (board_id, profile_id, role)
SELECT 
  b.id as board_id,
  '5c8f55bd-3d30-4c38-8ebe-0eb10573f6b1' as profile_id,
  'admin' as role
FROM boards b
WHERE b.owner_id = '5c8f55bd-3d30-4c38-8ebe-0eb10573f6b1'
AND NOT EXISTS (
  SELECT 1 FROM board_members bm 
  WHERE bm.board_id = b.id AND bm.profile_id = '5c8f55bd-3d30-4c38-8ebe-0eb10573f6b1'
)
ON CONFLICT (board_id, profile_id) DO NOTHING;

-- 8. Verify the fix worked - check memberships again
SELECT 
  bm.board_id, 
  bm.role, 
  b.name as board_name,
  'Fixed membership' as status
FROM board_members bm
JOIN boards b ON b.id = bm.board_id
WHERE bm.profile_id = '5c8f55bd-3d30-4c38-8ebe-0eb10573f6b1'
AND b.owner_id = '5c8f55bd-3d30-4c38-8ebe-0eb10573f6b1';

-- 9. Check current cards RLS policy
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