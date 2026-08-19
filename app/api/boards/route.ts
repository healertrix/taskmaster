import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

type StructureLike = {
  lists?: { name: string }[];
  labels?: { name: string; color: string }[];
  customFields?: { name: string; definition: unknown }[];
};

// Shared by both sourcing paths below — a saved template's `structure`
// column, and a live read of another board's current lists/labels/fields
// (see source_board_id) — end up as the exact same shape, so both apply
// through this one function. A one-time copy, not a live link: fresh rows
// with their own board-scoped ids/numbers, no reference back to whatever
// it was copied from. Best-effort: if this partially fails partway
// through, the board itself still exists and is usable, just without the
// rest of the structure, rather than failing board creation entirely
// over it.
async function applyStructureToBoard(
  supabase: ReturnType<typeof createClient>,
  boardId: string,
  structure: StructureLike | undefined
) {
  try {
    if (structure?.lists?.length) {
      for (const list of structure.lists) {
        const { data: listNumber } = await supabase.rpc('next_list_number', {
          p_board_id: boardId,
        });
        await supabase.from('lists').insert({
          name: list.name,
          board_id: boardId,
          position: 0, // set below, once all lists exist
          number: listNumber,
        });
      }
      // Positions assigned after insert, in the source's own order —
      // simpler than computing running positions inline above while
      // numbers are also being claimed one at a time.
      const { data: insertedLists } = await supabase
        .from('lists')
        .select('id')
        .eq('board_id', boardId)
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
          board_id: boardId,
        }))
      );
    }

    if (structure?.customFields?.length) {
      await supabase.from('custom_fields').insert(
        structure.customFields.map((field, index) => ({
          name: field.name,
          definition: field.definition,
          board_id: boardId,
          position: index,
        }))
      );
    }
  } catch (structureError) {
    console.error('Error applying board structure:', structureError);
    // Board already exists and is returned regardless by the caller.
  }
}

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
      // Copy another board's current lists/labels/custom fields instead of
      // a saved template — mutually exclusive with template_id in the UI
      // (CreateBoardModal only ever sends one), source_board_id wins if
      // both somehow arrive together.
      source_board_id,
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

    // The creator is added as a board admin automatically — see the
    // on_board_created trigger (handle_new_board(), AFTER INSERT ON
    // boards), which inserts into board_members as part of the same
    // insert. Doing it again here was a duplicate: same (board_id,
    // profile_id) pair the trigger already claimed, which always violated
    // board_members' unique constraint and logged a scary-looking error
    // on every single board creation (harmlessly swallowed below, but
    // still wrong — nothing here needs to touch board_members at all).

    // Seed the new board's structure, if a source was chosen — from
    // another board in the same workspace (live read, no saved template
    // involved) or from a saved template. source_board_id wins if both
    // are somehow present; see applyStructureToBoard's own comment for why
    // this is best-effort rather than failing board creation over it.
    if (source_board_id) {
      // Scoped to this workspace, not just "any board the user can see" —
      // matches what the picker actually offers (see CreateBoardModal),
      // and keeps a crafted source_board_id from another workspace from
      // pulling in structure the requester wasn't shown as an option.
      const { data: sourceBoard } = await supabase
        .from('boards')
        .select('id')
        .eq('id', source_board_id)
        .eq('workspace_id', workspace_id)
        .maybeSingle();

      if (sourceBoard) {
        const [{ data: sourceLists }, { data: sourceLabels }, { data: sourceFields }] =
          await Promise.all([
            supabase
              .from('lists')
              .select('name')
              .eq('board_id', source_board_id)
              .order('position', { ascending: true }),
            supabase.from('labels').select('name, color').eq('board_id', source_board_id),
            supabase
              .from('custom_fields')
              .select('name, definition')
              .eq('board_id', source_board_id)
              .order('position', { ascending: true }),
          ]);

        await applyStructureToBoard(supabase, board.id, {
          lists: sourceLists || [],
          labels: sourceLabels || [],
          customFields: sourceFields || [],
        });
      }
    } else if (template_id) {
      // RLS already scopes this to templates the caller can actually
      // read — their own, plus the shared starter set (is_system = true,
      // see the starter_board_templates migration) — a template_id
      // belonging to someone else's personal library simply won't be
      // found.
      const { data: template } = await supabase
        .from('board_templates')
        .select('structure')
        .eq('id', template_id)
        .single();

      await applyStructureToBoard(supabase, board.id, template?.structure as StructureLike | undefined);
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
        owner:profiles!boards_owner_id_fkey(id, full_name),
        board_members(
          profile:profiles!board_members_profile_id_fkey(id, full_name, avatar_url),
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
