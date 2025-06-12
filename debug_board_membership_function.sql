-- Create a debug function to check board membership
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION check_board_membership(
  check_board_id UUID,
  check_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'board_exists', EXISTS(SELECT 1 FROM boards WHERE id = check_board_id),
    'user_is_board_owner', EXISTS(
      SELECT 1 FROM boards 
      WHERE id = check_board_id AND owner_id = check_user_id
    ),
    'user_is_board_member', EXISTS(
      SELECT 1 FROM board_members 
      WHERE board_id = check_board_id AND profile_id = check_user_id
    ),
    'board_visibility', (
      SELECT visibility FROM boards WHERE id = check_board_id
    ),
    'board_workspace_id', (
      SELECT workspace_id FROM boards WHERE id = check_board_id
    ),
    'user_workspace_member', EXISTS(
      SELECT 1 FROM workspace_members wm
      JOIN boards b ON b.workspace_id = wm.workspace_id
      WHERE b.id = check_board_id AND wm.profile_id = check_user_id
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_board_membership(UUID, UUID) TO authenticated; 