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

    // Filter out any workspace memberships where the workspace is null (orphaned data)
    const validWorkspaceData = workspaceData.filter(
      (wm) => wm.workspaces !== null
    );

    if (validWorkspaceData.length === 0) {
      return NextResponse.json({ workspaces: [] });
    }

    // Get workspace IDs to fetch settings
    const workspaceIds = validWorkspaceData.map((wm) => wm.workspaces.id);

    // Fetch workspace settings for board creation permissions
    const { data: settingsData, error: settingsError } = await supabase
      .from('workspace_settings')
      .select('workspace_id, setting_type, setting_value')
      .in('workspace_id', workspaceIds)
      .in('setting_type', [
        'board_creation_simplified',
        'board_creation_restriction',
      ]);

    if (settingsError) {
      console.error('Error fetching workspace settings:', settingsError);
      return NextResponse.json(
        { error: 'Failed to fetch workspace settings' },
        { status: 500 }
      );
    }

    // Process workspaces with permissions
    const workspacesWithPermissions = validWorkspaceData.map((wm) => {
      const workspace = wm.workspaces;
      const userRole = wm.role;
      const isOwner = workspace.owner_id === user.id;

      // Find board creation settings for this workspace (prefer new format)
      const newFormatSetting = settingsData?.find(
        (setting) =>
          setting.workspace_id === workspace.id &&
          setting.setting_type === 'board_creation_simplified'
      );
      const oldFormatSetting = settingsData?.find(
        (setting) =>
          setting.workspace_id === workspace.id &&
          setting.setting_type === 'board_creation_restriction'
      );

      // Use new format if available, otherwise fall back to old format
      let boardCreationSetting: string;
      if (newFormatSetting) {
        try {
          boardCreationSetting =
            typeof newFormatSetting.setting_value === 'string'
              ? JSON.parse(newFormatSetting.setting_value)
              : newFormatSetting.setting_value;
        } catch {
          boardCreationSetting = 'any_member';
        }
      } else if (oldFormatSetting) {
        try {
          const oldValue =
            typeof oldFormatSetting.setting_value === 'string'
              ? JSON.parse(oldFormatSetting.setting_value)
              : oldFormatSetting.setting_value;
          // Extract workspace visible boards setting from old format
          boardCreationSetting =
            oldValue?.workspace_visible_boards || 'any_member';
        } catch {
          boardCreationSetting = 'any_member';
        }
      } else {
        boardCreationSetting = 'any_member'; // Default
      }

      // Determine if user can create boards
      let canCreateBoards = false;
      let boardCreationInfo = {
        canCreatePublic: false,
        canCreateWorkspaceVisible: false,
        canCreatePrivate: false,
        reason: '',
      };

      // Check if user can create boards based on the simplified settings
      switch (boardCreationSetting) {
        case 'owner_only':
          canCreateBoards = isOwner;
          break;
        case 'admins_only':
          canCreateBoards = isOwner || userRole === 'admin';
          break;
        case 'any_member':
          canCreateBoards =
            isOwner || userRole === 'admin' || userRole === 'member';
          break;
        default:
          canCreateBoards = isOwner || userRole === 'admin';
          break;
      }

      // Set board creation info (simplified for the new format)
      boardCreationInfo = {
        canCreatePublic: canCreateBoards,
        canCreateWorkspaceVisible: canCreateBoards,
        canCreatePrivate: canCreateBoards,
        reason: canCreateBoards
          ? isOwner
            ? 'Owner'
            : userRole === 'admin'
            ? 'Admin'
            : 'Member'
          : `Only ${
              boardCreationSetting === 'owner_only'
                ? 'workspace owners'
                : 'admins'
            } can create boards`,
      };

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
    });

    return NextResponse.json({ workspaces: workspacesWithPermissions });
  } catch (error) {
    console.error('Error in GET /api/workspaces:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
