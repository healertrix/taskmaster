import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/workspaces - Fetch all user workspaces with board creation permissions
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch workspaces where user is a member (owner or regular member)
    const { data: workspaceData, error: workspaceError } = await supabase
      .from('workspace_members')
      .select(
        `
        workspace_id,
        role,
        workspaces (
          id,
          name,
          color,
          owner_id,
          visibility
        )
      `
      )
      .eq('profile_id', user.id);

    if (workspaceError) {
      console.error('Error fetching workspaces:', workspaceError);
      return NextResponse.json(
        { error: 'Failed to fetch workspaces' },
        { status: 500 }
      );
    }

    if (!workspaceData || workspaceData.length === 0) {
      return NextResponse.json({ workspaces: [] });
    }

    // Get workspace IDs to fetch settings
    const workspaceIds = workspaceData.map((wm) => wm.workspaces.id);

    // Fetch workspace settings for board creation permissions
    const { data: settingsData, error: settingsError } = await supabase
      .from('workspace_settings')
      .select('workspace_id, setting_type, setting_value')
      .in('workspace_id', workspaceIds)
      .eq('setting_type', 'board_creation_restriction');

    if (settingsError) {
      console.error('Error fetching workspace settings:', settingsError);
      return NextResponse.json(
        { error: 'Failed to fetch workspace settings' },
        { status: 500 }
      );
    }

    // Process workspaces with permissions
    const workspacesWithPermissions = workspaceData
      .map((wm) => {
        const workspace = wm.workspaces;
        const userRole = wm.role;
        const isOwner = workspace.owner_id === user.id;

        // Find board creation settings for this workspace
        const boardCreationSettings = settingsData?.find(
          (setting) => setting.workspace_id === workspace.id
        );

        // Default settings if not found
        const defaultBoardCreationSettings = {
          public_boards: 'any_member',
          workspace_visible_boards: 'any_member',
          private_boards: 'any_member',
        };

        const boardCreationRestriction =
          boardCreationSettings?.setting_value || defaultBoardCreationSettings;

        // Determine if user can create boards
        let canCreateBoards = false;
        let boardCreationInfo = {
          canCreatePublic: false,
          canCreateWorkspaceVisible: false,
          canCreatePrivate: false,
          reason: '',
        };

        if (isOwner) {
          // Owners can always create boards
          canCreateBoards = true;
          boardCreationInfo = {
            canCreatePublic: true,
            canCreateWorkspaceVisible: true,
            canCreatePrivate: true,
            reason: 'Owner',
          };
        } else {
          // Check permissions based on role and settings
          const checkPermission = (setting: string) => {
            switch (setting) {
              case 'any_member':
                return ['admin', 'member'].includes(userRole);
              case 'admin_only':
                return userRole === 'admin';
              case 'nobody':
                return false;
              default:
                return false;
            }
          };

          boardCreationInfo.canCreatePublic = checkPermission(
            boardCreationRestriction.public_boards
          );
          boardCreationInfo.canCreateWorkspaceVisible = checkPermission(
            boardCreationRestriction.workspace_visible_boards
          );
          boardCreationInfo.canCreatePrivate = checkPermission(
            boardCreationRestriction.private_boards
          );

          canCreateBoards =
            boardCreationInfo.canCreatePublic ||
            boardCreationInfo.canCreateWorkspaceVisible ||
            boardCreationInfo.canCreatePrivate;

          if (!canCreateBoards) {
            if (userRole === 'guest') {
              boardCreationInfo.reason = 'Guests cannot create boards';
            } else {
              boardCreationInfo.reason = 'No board creation permissions';
            }
          } else {
            boardCreationInfo.reason =
              userRole === 'admin' ? 'Admin' : 'Member';
          }
        }

        return {
          id: workspace.id,
          name: workspace.name,
          color: workspace.color,
          visibility: workspace.visibility,
          userRole,
          isOwner,
          canCreateBoards,
          boardCreationInfo,
        };
      })
      .filter((workspace) => workspace.canCreateBoards); // Only return workspaces where user can create boards

    return NextResponse.json({ workspaces: workspacesWithPermissions });
  } catch (error) {
    console.error('Error in GET /api/workspaces:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
