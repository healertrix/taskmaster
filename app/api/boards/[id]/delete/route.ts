import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// DELETE /api/boards/[id]/delete - Delete board and all related data
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const boardId = params.id;

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request body to verify board name
    const body = await request.json();
    const { boardName } = body;

    if (!boardName) {
      return NextResponse.json(
        { error: 'Board name confirmation is required' },
        { status: 400 }
      );
    }

    // Fetch the board to verify ownership/permissions and name
    const { data: board, error: boardError } = await supabase
      .from('boards')
      .select(
        `
        id, 
        name, 
        owner_id,
        workspace_id,
        workspaces!inner(id, name)
      `
      )
      .eq('id', boardId)
      .single();

    if (boardError || !board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // Check if user has permission to delete this board
    // This is purely based on workspace settings - no exceptions

    let canDelete = false;
    let userRole = null;

    // Get workspace info and user's workspace role
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('owner_id')
      .eq('id', board.workspace_id)
      .single();

    const { data: workspaceMember, error: workspaceMemberError } =
      await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', board.workspace_id)
        .eq('profile_id', user.id)
        .single();

    if (workspaceMemberError || !workspaceMember) {
      return NextResponse.json(
        { error: 'You are not a member of this workspace' },
        { status: 403 }
      );
    }

    // Determine user's role in workspace
    let userWorkspaceRole = workspaceMember.role;
    if (!workspaceError && workspace && workspace.owner_id === user.id) {
      userWorkspaceRole = 'owner'; // Workspace owner
    }

    // Get workspace deletion settings
    const { data: settings, error: settingsError } = await supabase
      .from('workspace_settings')
      .select('setting_value, setting_type')
      .eq('workspace_id', board.workspace_id)
      .in('setting_type', [
        'board_deletion_simplified',
        'board_deletion_restriction',
      ]);

    let boardDeletionPermission = 'any_member'; // default

    if (!settingsError && settings) {
      // Look for new simplified format first
      const simplifiedSetting = settings.find(
        (s) => s.setting_type === 'board_deletion_simplified'
      );
      if (simplifiedSetting) {
        try {
          boardDeletionPermission =
            typeof simplifiedSetting.setting_value === 'string'
              ? JSON.parse(simplifiedSetting.setting_value)
              : simplifiedSetting.setting_value;
        } catch (error) {
          boardDeletionPermission = 'any_member';
        }
      } else {
        // Fallback to old format
        const oldSetting = settings.find(
          (s) => s.setting_type === 'board_deletion_restriction'
        );
        if (oldSetting) {
          try {
            const oldValue =
              typeof oldSetting.setting_value === 'string'
                ? JSON.parse(oldSetting.setting_value)
                : oldSetting.setting_value;
            boardDeletionPermission =
              oldValue?.workspace_visible_boards || 'any_member';
          } catch (error) {
            boardDeletionPermission = 'any_member';
          }
        }
      }
    }

    // Check permission based on setting - NO EXCEPTIONS
    console.log('Delete permission debug:', {
      userWorkspaceRole,
      boardDeletionPermission,
      workspaceMemberRole: workspaceMember.role,
      isWorkspaceOwner: workspace?.owner_id === user.id,
    });

    switch (boardDeletionPermission) {
      case 'owner_only':
        canDelete = userWorkspaceRole === 'owner';
        userRole = userWorkspaceRole;
        break;
      case 'admins_only':
        canDelete =
          userWorkspaceRole === 'admin' || userWorkspaceRole === 'owner';
        userRole = userWorkspaceRole;
        break;
      case 'any_member':
        canDelete = ['admin', 'member', 'owner'].includes(userWorkspaceRole);
        userRole = userWorkspaceRole;
        break;
      default:
        canDelete = ['admin', 'member', 'owner'].includes(userWorkspaceRole);
        userRole = userWorkspaceRole;
    }

    console.log('Final permission result:', { canDelete, userRole });

    if (!canDelete) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this board' },
        { status: 403 }
      );
    }

    // Verify the board name matches
    if (board.name !== boardName) {
      return NextResponse.json(
        { error: 'Board name does not match' },
        { status: 400 }
      );
    }

    // Start the deletion process - count all related data before deletion
    let deletionStats = {
      board: 1,
      lists: 0,
      cards: 0,
      comments: 0,
      attachments: 0,
      activities: 0,
      members: 0,
      stars: 0,
    };

    // Count lists
    const { count: listCount } = await supabase
      .from('lists')
      .select('*', { count: 'exact', head: true })
      .eq('board_id', boardId);
    deletionStats.lists = listCount || 0;

    // Count cards
    const { count: cardCount } = await supabase
      .from('cards')
      .select('*', { count: 'exact', head: true })
      .eq('board_id', boardId);
    deletionStats.cards = cardCount || 0;

    // Count activities
    const { count: activityCount } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .eq('board_id', boardId);
    deletionStats.activities = activityCount || 0;

    // Count board members
    const { count: memberCount } = await supabase
      .from('board_members')
      .select('*', { count: 'exact', head: true })
      .eq('board_id', boardId);
    deletionStats.members = memberCount || 0;

    // Count board stars
    const { count: starCount } = await supabase
      .from('board_stars')
      .select('*', { count: 'exact', head: true })
      .eq('board_id', boardId);
    deletionStats.stars = starCount || 0;

    // Start deletion process (order matters to respect foreign key constraints)

    // Delete activities first (references boards, cards, etc.)
    const { error: activitiesError } = await supabase
      .from('activities')
      .delete()
      .eq('board_id', boardId);

    if (activitiesError) {
      console.error('Error deleting activities:', activitiesError);
    }

    // Delete card-related data
    // Delete card comments
    const { error: commentsError } = await supabase
      .from('card_comments')
      .delete()
      .eq('board_id', boardId);

    if (commentsError) {
      console.error('Error deleting card comments:', commentsError);
    }

    // Delete card attachments
    const { error: attachmentsError } = await supabase
      .from('card_attachments')
      .delete()
      .eq('board_id', boardId);

    if (attachmentsError) {
      console.error('Error deleting card attachments:', attachmentsError);
    }

    // Delete card members
    const { error: cardMembersError } = await supabase
      .from('card_members')
      .delete()
      .eq('board_id', boardId);

    if (cardMembersError) {
      console.error('Error deleting card members:', cardMembersError);
    }

    // Delete card labels
    const { error: cardLabelsError } = await supabase
      .from('card_labels')
      .delete()
      .eq('board_id', boardId);

    if (cardLabelsError) {
      console.error('Error deleting card labels:', cardLabelsError);
    }

    // Delete cards
    const { error: cardsError } = await supabase
      .from('cards')
      .delete()
      .eq('board_id', boardId);

    if (cardsError) {
      console.error('Error deleting cards:', cardsError);
      throw new Error('Failed to delete cards');
    }

    // Delete lists
    const { error: listsError } = await supabase
      .from('lists')
      .delete()
      .eq('board_id', boardId);

    if (listsError) {
      console.error('Error deleting lists:', listsError);
      throw new Error('Failed to delete lists');
    }

    // Delete board members
    const { error: boardMembersError } = await supabase
      .from('board_members')
      .delete()
      .eq('board_id', boardId);

    if (boardMembersError) {
      console.error('Error deleting board members:', boardMembersError);
      throw new Error('Failed to delete board members');
    }

    // Delete board stars
    const { error: boardStarsError } = await supabase
      .from('board_stars')
      .delete()
      .eq('board_id', boardId);

    if (boardStarsError) {
      console.error('Error deleting board stars:', boardStarsError);
    }

    // Finally, delete the board itself
    console.log('Attempting to delete board with ID:', boardId);
    const { data: deletedBoard, error: boardDeleteError } = await supabase
      .from('boards')
      .delete()
      .eq('id', boardId)
      .select();

    if (boardDeleteError) {
      console.error('Error deleting board:', boardDeleteError);
      console.error('Board deletion error details:', {
        code: boardDeleteError.code,
        message: boardDeleteError.message,
        details: boardDeleteError.details,
        hint: boardDeleteError.hint,
      });
      throw new Error(`Failed to delete board: ${boardDeleteError.message}`);
    }

    console.log('Board deletion result:', deletedBoard);

    if (!deletedBoard || deletedBoard.length === 0) {
      console.warn('Board deletion returned no deleted rows');
      // Check if board still exists
      const { data: remainingBoard } = await supabase
        .from('boards')
        .select('id, name')
        .eq('id', boardId)
        .single();

      if (remainingBoard) {
        console.error(
          'Board still exists after deletion attempt:',
          remainingBoard
        );
        throw new Error('Board deletion failed - board still exists');
      }
    }

    return NextResponse.json({
      message: 'Board and all related data deleted successfully',
      deletionStats,
      deletedBy: userRole,
    });
  } catch (error) {
    console.error('Error in board deletion:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to delete board',
        details:
          'An error occurred during the deletion process. Some data may have been partially deleted.',
      },
      { status: 500 }
    );
  }
}
