import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const {
      name,
      description,
      color,
      workspace_id,
      visibility = 'workspace',
    } = body;

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Board name is required' },
        { status: 400 }
      );
    }

    if (!workspace_id) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      );
    }

    // Verify user has permission to create boards in this workspace
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('profile_id', user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: 'Not a member of this workspace' },
        { status: 403 }
      );
    }

    // Check workspace owner
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspace_id)
      .single();

    const isWorkspaceOwner = workspace && workspace.owner_id === user.id;

    // If not workspace owner, check board creation restrictions
    if (!isWorkspaceOwner) {
      // Get workspace board creation settings
      const { data: settings, error: settingsError } = await supabase
        .from('workspace_settings')
        .select('setting_value, setting_type')
        .eq('workspace_id', workspace_id)
        .in('setting_type', [
          'board_creation_simplified',
          'board_creation_restriction',
        ]);

      let boardCreationPermission = 'any_member'; // default

      if (!settingsError && settings) {
        // Look for new simplified format first
        const simplifiedSetting = settings.find(
          (s) => s.setting_type === 'board_creation_simplified'
        );
        if (simplifiedSetting) {
          try {
            boardCreationPermission =
              typeof simplifiedSetting.setting_value === 'string'
                ? JSON.parse(simplifiedSetting.setting_value)
                : simplifiedSetting.setting_value;
          } catch (error) {
            boardCreationPermission = 'any_member';
          }
        } else {
          // Fallback to old format
          const oldSetting = settings.find(
            (s) => s.setting_type === 'board_creation_restriction'
          );
          if (oldSetting) {
            try {
              const oldValue =
                typeof oldSetting.setting_value === 'string'
                  ? JSON.parse(oldSetting.setting_value)
                  : oldSetting.setting_value;
              boardCreationPermission =
                oldValue?.workspace_visible_boards || 'any_member';
            } catch (error) {
              boardCreationPermission = 'any_member';
            }
          }
        }
      }

      // Check permissions based on setting
      let canCreate = false;
      switch (boardCreationPermission) {
        case 'any_member':
          canCreate = ['admin', 'member'].includes(membership.role);
          break;
        case 'admins_only':
          canCreate = membership.role === 'admin';
          break;
        case 'owner_only':
          canCreate = false; // Only workspace owner can create
          break;
        default:
          canCreate = ['admin', 'member'].includes(membership.role);
      }

      if (!canCreate) {
        return NextResponse.json(
          {
            error:
              'You do not have permission to create boards in this workspace',
          },
          { status: 403 }
        );
      }
    }

    // Create the board
    const { data: board, error: boardError } = await supabase
      .from('boards')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        color: color || 'bg-blue-600',
        workspace_id,
        owner_id: user.id,
        visibility,
      })
      .select()
      .single();

    if (boardError) {
      console.error('Board creation error:', boardError);
      return NextResponse.json(
        { error: 'Failed to create board' },
        { status: 500 }
      );
    }

    // Add the creator as an admin of the board
    const { error: memberError } = await supabase.from('board_members').insert({
      board_id: board.id,
      profile_id: user.id,
      role: 'admin',
    });

    if (memberError) {
      console.error('Board member creation error:', memberError);
      // Continue anyway as the board was created successfully
    }

    return NextResponse.json({ board }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    let query = supabase
      .from('boards')
      .select(
        `
        *,
        workspace:workspaces(id, name),
        owner:profiles(id, full_name),
        board_members(
          profile:profiles(id, full_name, avatar_url),
          role
        )
      `
      )
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }

    const { data: boards, error } = await query;

    if (error) {
      console.error('Error fetching boards:', error);
      return NextResponse.json(
        { error: 'Failed to fetch boards' },
        { status: 500 }
      );
    }

    return NextResponse.json({ boards });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
