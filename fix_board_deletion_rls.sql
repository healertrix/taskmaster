-- Fix Board Deletion RLS Policy
-- The boards table is missing a DELETE policy, which prevents board deletion

-- Check current policies on boards table
SELECT 
  schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'boards'
ORDER BY cmd, policyname;

-- Add DELETE policy for boards table
CREATE POLICY "Users can delete boards they own or are admins of"
  ON boards FOR DELETE
  USING (
    -- Board owner can delete the board
    owner_id = auth.uid()
    OR
    -- Board admins can delete the board
    EXISTS (
      SELECT 1 FROM board_members
      WHERE board_id = boards.id
      AND profile_id = auth.uid()
      AND role = 'admin'
    )
    OR
    -- Workspace owner can delete any board in their workspace
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = boards.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  );

-- Also ensure there's a proper INSERT policy for boards
CREATE POLICY "Workspace members can create boards" 
  ON boards FOR INSERT
  WITH CHECK (
    -- User must be a member of the workspace
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = boards.workspace_id
      AND workspace_members.profile_id = auth.uid()
      AND workspace_members.role IN ('admin', 'member')
    )
    AND
    -- User must be the owner of the board they're creating
    owner_id = auth.uid()
  );

-- Check the new policies
SELECT 'UPDATED POLICIES:' as info;
SELECT 
  schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'boards'
ORDER BY cmd, policyname; 