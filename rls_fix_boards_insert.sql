-- Fix RLS policy for boards table - add missing INSERT policy
-- This allows workspace members to create boards in workspaces they belong to

CREATE POLICY "Workspace members can create boards"
  ON boards FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = boards.workspace_id
      AND workspace_members.profile_id = auth.uid()
      AND workspace_members.role IN ('admin', 'member')
    )
  ); 