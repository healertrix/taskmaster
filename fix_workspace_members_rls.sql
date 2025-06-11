-- Fix RLS policies for workspace_members table
-- Run this in your Supabase SQL Editor

-- First, check current policies
SELECT 
  schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'workspace_members';

-- Enable RLS on workspace_members if not already enabled
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Drop existing problematic policies (if any)
DROP POLICY IF EXISTS "Users can view workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Workspace members can view members" ON workspace_members;

-- Create a comprehensive policy for reading workspace members
CREATE POLICY "Users can view workspace members they belong to"
  ON workspace_members FOR SELECT
  USING (
    -- User can see members of workspaces they are a member of
    EXISTS (
      SELECT 1 FROM workspace_members wm2
      WHERE wm2.workspace_id = workspace_members.workspace_id
      AND wm2.profile_id = auth.uid()
    )
    OR
    -- User can see members of workspaces they own
    EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.id = workspace_members.workspace_id
      AND w.owner_id = auth.uid()
    )
  );

-- Allow workspace owners and admins to insert/update/delete members
CREATE POLICY "Workspace owners and admins can manage members"
  ON workspace_members FOR ALL
  USING (
    -- Workspace owner can manage all members
    EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.id = workspace_members.workspace_id
      AND w.owner_id = auth.uid()
    )
    OR
    -- Admin members can manage members
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.profile_id = auth.uid()
      AND wm.role = 'admin'
    )
  );

-- Check the new policies
SELECT 'NEW POLICIES CREATED:' as info;
SELECT 
  schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'workspace_members';

-- Test the fix by checking if you can now see the workspace members
SELECT 'TESTING ACCESS FOR YOUR USER:' as info;
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