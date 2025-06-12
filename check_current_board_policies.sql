-- Check current RLS policies on boards table
-- This will help us understand why workspace deletion works but board deletion doesn't

SELECT 
  'CURRENT BOARD POLICIES:' as info;

SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd,
  qual as policy_condition
FROM pg_policies 
WHERE tablename = 'boards'
ORDER BY cmd, policyname;

-- Check if there are any policies that specifically allow deletion by workspace_id
SELECT 
  'CHECKING FOR WORKSPACE-BASED DELETE POLICIES:' as info;

SELECT 
  policyname,
  cmd,
  qual as policy_condition
FROM pg_policies 
WHERE tablename = 'boards'
AND cmd = 'DELETE'
AND qual LIKE '%workspace_id%';

-- Test both query patterns to see which one works
SELECT 'TESTING WORKSPACE-BASED DELETE ACCESS:' as info;

-- This should work (like workspace deletion)
EXPLAIN (ANALYZE false) 
SELECT * FROM boards 
WHERE workspace_id = 'test-workspace-id';

SELECT 'TESTING ID-BASED DELETE ACCESS:' as info;

-- This might not work (like board deletion)
EXPLAIN (ANALYZE false)
SELECT * FROM boards 
WHERE id = 'test-board-id'; 