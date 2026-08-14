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
      template_id,
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

    // Claim this board's display number — atomic, per-workspace counter
    // (see supabase/supabase/migrations/20260807120000_add_scoped_display_numbers.sql).
    // Never reused after delete, same as Jira/ADO.
    const { data: boardNumber, error: numberError } = await supabase.rpc(
      'next_board_number',
      { p_workspace_id: workspace_id }
    );

    if (numberError || boardNumber == null) {
      console.error('Board number assignment error:', numberError);
      return NextResponse.json(
        { error: 'Failed to assign board number' },
        { status: 500 }
      );
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
        number: boardNumber,
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

    // Apply a template if one was chosen — a one-time copy, not a live
    // link: fresh rows with their own board-scoped ids/numbers, no
    // reference back to the template stored anywhere. Best-effort: if
    // this partially fails partway through, the board itself still
    // exists and is usable, just without the rest of the template's
    // contents, rather than failing board creation entirely over it.
    if (template_id) {
      try {
        // RLS (owner_id = auth.uid()) already scopes this to the
        // current user's own templates — a template_id belonging to
        // someone else simply won't be found.
        const { data: template } = await supabase
          .from('board_templates')
          .select('structure')
          .eq('id', template_id)
          .single();

        const structure = template?.structure as
          | {
              lists?: { name: string }[];
              labels?: { name: string; color: string }[];
              customFields?: { name: string; definition: unknown }[];
            }
          | undefined;

        if (structure?.lists?.length) {
          for (const list of structure.lists) {
            const { data: listNumber } = await supabase.rpc(
              'next_list_number',
              { p_board_id: board.id }
            );
            await supabase.from('lists').insert({
              name: list.name,
              board_id: board.id,
              position: 0, // set below, once all lists exist
              number: listNumber,
            });
          }
          // Positions assigned after insert, in the template's own
          // order — simpler than computing running positions inline
          // above while numbers are also being claimed one at a time.
          const { data: insertedLists } = await supabase
            .from('lists')
            .select('id')
            .eq('board_id', board.id)
            .order('number', { ascending: true });
          if (insertedLists) {
            await Promise.all(
              insertedLists.map((l, index) =>
                supabase.from('lists').update({ position: index }).eq('id', l.id)
              )
            );
          }
        }

        if (structure?.labels?.length) {
          await supabase.from('labels').insert(
            structure.labels.map((label) => ({
              name: label.name,
              color: label.color,
              board_id: board.id,
            }))
          );
        }

        if (structure?.customFields?.length) {
          await supabase.from('custom_fields').insert(
            structure.customFields.map((field, index) => ({
              name: field.name,
              definition: field.definition,
              board_id: board.id,
              position: index,
            }))
          );
        }
      } catch (templateError) {
        console.error('Error applying template:', templateError);
        // Board already exists and is returned below regardless.
      }
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
