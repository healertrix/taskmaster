-- Add missing DELETE policy for boards table
-- This follows the same pattern as the existing UPDATE policy

-- Create DELETE policy that matches the UPDATE policy logic
CREATE POLICY "Users can delete boards they own or are admins of"
  ON boards FOR DELETE
  USING (
    -- Board owner can delete the board
    owner_id = auth.uid()
    OR
    -- Board admins can delete the board (same as UPDATE policy)
    EXISTS (
      SELECT 1 FROM board_members
      WHERE board_members.board_id = boards.id
      AND board_members.profile_id = auth.uid()
      AND board_members.role = 'admin'
    )
  );

-- Verify the policy was created
SELECT 
  'NEW DELETE POLICY CREATED:' as info;

SELECT 
  policyname,
  cmd as operation,
  qual as policy_condition
FROM pg_policies 
WHERE tablename = 'boards'
AND cmd = 'DELETE';

-- Show all board policies now
SELECT 
  'ALL BOARD POLICIES NOW:' as info;

SELECT 
  policyname,
  cmd as operation
FROM pg_policies 
WHERE tablename = 'boards'
ORDER BY cmd, policyname; 