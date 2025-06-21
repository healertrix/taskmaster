import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const cardId = params.id;

    // Get user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch checklists with their items
    const { data: checklists, error: checklistsError } = await supabase
      .from('checklists')
      .select(
        `
        id,
        title,
        created_at,
        updated_at,
        checklist_items (
          id,
          content,
          is_complete,
          position,
          created_at,
          updated_at
        )
      `
      )
      .eq('card_id', cardId)
      .order('created_at', { ascending: true });

    if (checklistsError) {
      console.error('Error fetching checklists:', checklistsError);
      return NextResponse.json(
        { error: 'Failed to fetch checklists' },
        { status: 500 }
      );
    }

    // Transform the data to match our interface
    const transformedChecklists =
      checklists?.map((checklist) => ({
        id: checklist.id,
        name: checklist.title,
        created_at: checklist.created_at,
        updated_at: checklist.updated_at,
        items:
          checklist.checklist_items
            ?.sort((a, b) => a.position - b.position)
            .map((item) => ({
              id: item.id,
              text: item.content,
              completed: item.is_complete,
              created_at: item.created_at,
              updated_at: item.updated_at,
            })) || [],
      })) || [];

    return NextResponse.json({ checklists: transformedChecklists });
  } catch (error) {
    console.error('Error in GET /api/cards/[id]/checklists:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const cardId = params.id;
    const { name, templateItems } = await request.json();

    // Get user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate input
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Checklist name is required' },
        { status: 400 }
      );
    }

    // Verify card exists and user has access
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, board_id')
      .eq('id', cardId)
      .single();

    if (cardError || !card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Get board details to check visibility and workspace
    const { data: board, error: boardError } = await supabase
      .from('boards')
      .select('id, workspace_id, visibility, owner_id')
      .eq('id', card.board_id)
      .single();

    if (boardError || !board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // Check access permissions (board membership OR workspace membership for workspace-visible boards)
    let hasAccess = false;

    // Check if user is board owner
    if (board.owner_id === user.id) {
      hasAccess = true;
    } else {
      // Check if user is a direct board member
      const { data: boardMembership, error: boardMemberError } = await supabase
        .from('board_members')
        .select('id')
        .eq('board_id', card.board_id)
        .eq('profile_id', user.id)
        .single();

      if (!boardMemberError && boardMembership) {
        hasAccess = true;
      } else if (board.visibility === 'workspace') {
        // Check if user is a workspace member for workspace-visible boards
        const { data: workspaceMembership, error: workspaceMemberError } =
          await supabase
            .from('workspace_members')
            .select('id')
            .eq('workspace_id', board.workspace_id)
            .eq('profile_id', user.id)
            .single();

        if (!workspaceMemberError && workspaceMembership) {
          hasAccess = true;
        }
      }
    }

    if (!hasAccess) {
      return NextResponse.json(
        {
          error:
            'Access denied: You must be a board member or workspace member',
        },
        { status: 403 }
      );
    }

    // Get the next position for the new checklist
    const { data: lastChecklist, error: positionError } = await supabase
      .from('checklists')
      .select('position')
      .eq('card_id', cardId)
      .order('position', { ascending: false })
      .limit(1)
      .single();

    const nextPosition = lastChecklist ? lastChecklist.position + 1 : 0;

    // Create checklist
    const { data: checklist, error: checklistError } = await supabase
      .from('checklists')
      .insert({
        card_id: cardId,
        title: name.trim(),
        position: nextPosition,
        created_by: user.id,
      })
      .select()
      .single();

    if (checklistError) {
      console.error('Error creating checklist:', checklistError);
      return NextResponse.json(
        { error: 'Failed to create checklist' },
        { status: 500 }
      );
    }

    // Create template items if provided
    let createdItems = [];
    if (
      templateItems &&
      Array.isArray(templateItems) &&
      templateItems.length > 0
    ) {
      const itemsToInsert = templateItems.map((itemText, index) => ({
        checklist_id: checklist.id,
        content: itemText.trim(),
        is_complete: false,
        position: index,
      }));

      const { data: items, error: itemsError } = await supabase
        .from('checklist_items')
        .insert(itemsToInsert)
        .select();

      if (itemsError) {
        console.error('Error creating template items:', itemsError);
        // Don't fail the whole request, just log the error
      } else {
        createdItems =
          items?.map((item) => ({
            id: item.id,
            text: item.content,
            completed: item.is_complete,
            created_at: item.created_at,
            updated_at: item.updated_at,
          })) || [];
      }
    }

    // Create activity record
    try {
      await supabase.from('activities').insert({
        profile_id: user.id,
        board_id: card.board_id,
        card_id: cardId,
        action_type: 'checklist_added',
        action_data: {
          checklist_title: checklist.title,
        },
      });
    } catch (activityError) {
      // Don't fail the main operation if activity logging fails
      console.error('Failed to log activity:', activityError);
    }

    // Return the created checklist with items
    const transformedChecklist = {
      id: checklist.id,
      name: checklist.title,
      created_at: checklist.created_at,
      updated_at: checklist.updated_at,
      items: createdItems,
    };

    return NextResponse.json(
      { checklist: transformedChecklist },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/cards/[id]/checklists:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
