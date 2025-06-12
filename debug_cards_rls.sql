-- Debug script to check RLS policies on cards table
SELECT 'CARDS TABLE RLS POLICIES:' as info;

-- Check all policies on cards table
SELECT 
  policyname,
  cmd as operation,
  roles,
  qual as condition
FROM pg_policies 
WHERE tablename = 'cards'
ORDER BY cmd, policyname;

-- Check if RLS is enabled on cards table
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'cards';

-- Show current user for reference
SELECT 'CURRENT AUTH CONTEXT:' as info;
SELECT auth.uid() as current_user_id;

-- Test queries to see what cards the current user can see/modify
SELECT 'CARDS ACCESSIBLE TO CURRENT USER:' as info;
SELECT 
  id,
  title,
  board_id,
  list_id,
  created_by
FROM cards 
LIMIT 5;

-- Count total cards (should work if SELECT policy allows)
SELECT 'TOTAL CARDS COUNT:' as info;
SELECT COUNT(*) as total_cards FROM cards; 