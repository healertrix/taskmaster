import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// DELETE /api/workspaces/[id]/delete - Delete workspace and all related data
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const workspaceId = params.id;

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request body to verify workspace name
    const body = await request.json();
    const { workspaceName } = body;

    if (!workspaceName) {
      return NextResponse.json(
        { error: 'Workspace name confirmation is required' },
        { status: 400 }
      );
    }

    // Fetch the workspace to verify ownership and name
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name, owner_id')
      .eq('id', workspaceId)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Only the owner can delete the workspace
    if (workspace.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the workspace owner can delete the workspace' },
        { status: 403 }
      );
    }

    // Verify the workspace name matches
    if (workspace.name !== workspaceName) {
      return NextResponse.json(
        { error: 'Workspace name does not match' },
        { status: 400 }
      );
    }

    // Start the deletion process - we'll use database cascading where possible
    // but also explicitly delete to ensure cleanup and get counts

    // 1. Get all boards in this workspace first (for counting)
    const { data: boards } = await supabase
      .from('boards')
      .select('id')
      .eq('workspace_id', workspaceId);

    const boardIds = boards?.map((b) => b.id) || [];

    // 2. Count all related data before deletion (for reporting)
    let deletionStats = {
      workspace: 1,
      boards: boardIds.length,
      lists: 0,
      cards: 0,
      comments: 0,
      attachments: 0,
      activities: 0,
      members: 0,
      settings: 0,
    };

    if (boardIds.length > 0) {
      // Count lists
      const { count: listCount } = await supabase
        .from('lists')
        .select('*', { count: 'exact', head: true })
        .in('board_id', boardIds);
      deletionStats.lists = listCount || 0;

      // Count cards
      const { count: cardCount } = await supabase
        .from('cards')
        .select('*', { count: 'exact', head: true })
        .in('board_id', boardIds);
      deletionStats.cards = cardCount || 0;

      // Count activities
      const { count: activityCount } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .in('board_id', boardIds);
      deletionStats.activities = activityCount || 0;
    }

    // Count workspace members
    const { count: memberCount } = await supabase
      .from('workspace_members')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId);
    deletionStats.members = memberCount || 0;

    // Count workspace settings
    const { count: settingsCount } = await supabase
      .from('workspace_settings')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId);
    deletionStats.settings = settingsCount || 0;

    // 3. Start deletion process (order matters to respect foreign key constraints)

    // Delete activities first (references boards, cards, etc.)
    if (boardIds.length > 0) {
      const { error: activitiesError } = await supabase
        .from('activities')
        .delete()
        .in('board_id', boardIds);

      if (activitiesError) {
        console.error('Error deleting activities:', activitiesError);
      }
    }

    // Delete card-related data. comments/card_attachments/card_members/
    // card_labels/checklists are all scoped by card_id, not board_id (they
    // have no board_id column at all) — .in('board_id', boardIds) against
    // any of them is a genuine schema error, not a permissions issue (see
    // the matching fix/comment in boards/[id]/delete/route.ts, which this
    // mirrors). Left as .in('board_id', ...), card_members/card_labels
    // deletes failed silently (error logged, not thrown) and those rows
    // survived past this point. Deleting `cards` further down then cascaded
    // into those still-present card_members rows via FK, and
    // handle_card_member_removed() (an AFTER DELETE trigger on
    // card_members) tries to look up the just-deleted card's board_id to
    // log a 'member_removed' activity — finding nothing, since the card is
    // already gone by then, which left board_id NULL and violated
    // activities.board_id's NOT NULL constraint, aborting the whole DELETE
    // FROM cards statement (and, from there, lists/boards too, each
    // re-triggering the same cascade on whatever was left). Table is also
    // `comments`, not `card_comments` — that table doesn't exist. Get this
    // workspace's card ids first so all of these can be scoped correctly
    // via .in('card_id', cardIds).
    if (boardIds.length > 0) {
      const { data: workspaceCards } = await supabase
        .from('cards')
        .select('id')
        .in('board_id', boardIds);
      const cardIds = (workspaceCards || []).map((c) => c.id);

      if (cardIds.length > 0) {
        // Delete checklist items, then checklists.
        const { data: workspaceChecklists } = await supabase
          .from('checklists')
          .select('id')
          .in('card_id', cardIds);
        const checklistIds = (workspaceChecklists || []).map((c) => c.id);

        if (checklistIds.length > 0) {
          const { error: checklistItemsError } = await supabase
            .from('checklist_items')
            .delete()
            .in('checklist_id', checklistIds);

          if (checklistItemsError) {
            console.error('Error deleting checklist items:', checklistItemsError);
          }
        }

        const { error: checklistsError } = await supabase
          .from('checklists')
          .delete()
          .in('card_id', cardIds);

        if (checklistsError) {
          console.error('Error deleting checklists:', checklistsError);
        }

        // Delete card comments (table is `comments`, not `card_comments`)
        const { error: commentsError } = await supabase
          .from('comments')
          .delete()
          .in('card_id', cardIds);

        if (commentsError) {
          console.error('Error deleting card comments:', commentsError);
        }

        // Delete card attachments
        const { error: attachmentsError } = await supabase
          .from('card_attachments')
          .delete()
          .in('card_id', cardIds);

        if (attachmentsError) {
          console.error('Error deleting card attachments:', attachmentsError);
        }

        // Delete card members
        const { error: cardMembersError } = await supabase
          .from('card_members')
          .delete()
          .in('card_id', cardIds);

        if (cardMembersError) {
          console.error('Error deleting card members:', cardMembersError);
        }

        // Delete card labels
        const { error: cardLabelsError } = await supabase
          .from('card_labels')
          .delete()
          .in('card_id', cardIds);

        if (cardLabelsError) {
          console.error('Error deleting card labels:', cardLabelsError);
        }
      }

      // Delete cards
      const { error: cardsError } = await supabase
        .from('cards')
        .delete()
        .in('board_id', boardIds);

      if (cardsError) {
        console.error('Error deleting cards:', cardsError);
        throw new Error('Failed to delete cards');
      }

      // Delete lists
      const { error: listsError } = await supabase
        .from('lists')
        .delete()
        .in('board_id', boardIds);

      if (listsError) {
        console.error('Error deleting lists:', listsError);
      }

      // Delete board members
      const { error: boardMembersError } = await supabase
        .from('board_members')
        .delete()
        .in('board_id', boardIds);

      if (boardMembersError) {
        console.error('Error deleting board members:', boardMembersError);
      }

      // Delete board stars
      const { error: boardStarsError } = await supabase
        .from('board_stars')
        .delete()
        .in('board_id', boardIds);

      if (boardStarsError) {
        console.error('Error deleting board stars:', boardStarsError);
      }

      // Delete boards
      const { error: boardsError } = await supabase
        .from('boards')
        .delete()
        .eq('workspace_id', workspaceId);

      if (boardsError) {
        console.error('Error deleting boards:', boardsError);
        throw new Error('Failed to delete boards');
      }
    }

    // Delete workspace members
    const { error: membersError } = await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId);

    if (membersError) {
      console.error('Error deleting workspace members:', membersError);
      throw new Error('Failed to delete workspace members');
    }

    // Delete workspace settings
    const { error: settingsError } = await supabase
      .from('workspace_settings')
      .delete()
      .eq('workspace_id', workspaceId);

    if (settingsError) {
      console.error('Error deleting workspace settings:', settingsError);
    }

    // Finally, delete the workspace itself
    const { error: workspaceDeleteError } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', workspaceId);

    if (workspaceDeleteError) {
      console.error('Error deleting workspace:', workspaceDeleteError);
      throw new Error('Failed to delete workspace');
    }

    return NextResponse.json({
      message: 'Workspace and all related data deleted successfully',
      deletionStats,
    });
  } catch (error) {
    console.error('Error in workspace deletion:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to delete workspace',
        details:
          'An error occurred during the deletion process. Some data may have been partially deleted.',
      },
      { status: 500 }
    );
  }
}
