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
    const { name, board_id, position } = body;

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'List name is required' },
        { status: 400 }
      );
    }

    if (!board_id) {
      return NextResponse.json(
        { error: 'Board ID is required' },
        { status: 400 }
      );
    }

    // Verify user has access to this board by trying to fetch it
    // This will automatically respect RLS policies
    const { data: boardData, error: boardError } = await supabase
      .from('boards')
      .select('id, name')
      .eq('id', board_id)
      .single();

    if (boardError || !boardData) {
      console.error('Board access error:', boardError);
      return NextResponse.json(
        { error: 'Board not found or access denied' },
        { status: 403 }
      );
    }

    // If no position provided, get the next position
    let listPosition = position;
    if (typeof listPosition !== 'number') {
      const { data: lastList } = await supabase
        .from('lists')
        .select('position')
        .eq('board_id', board_id)
        .eq('is_archived', false)
        .order('position', { ascending: false })
        .limit(1)
        .single();

      listPosition = lastList ? lastList.position + 1 : 1;
    }

    // Create the list
    const { data: list, error: listError } = await supabase
      .from('lists')
      .insert({
        name: name.trim(),
        board_id,
        position: listPosition,
      })
      .select()
      .single();

    if (listError) {
      console.error('List creation error:', listError);
      console.error('Error details:', {
        code: listError.code,
        message: listError.message,
        details: listError.details,
        hint: listError.hint,
      });

      // Check if it's a policy violation
      if (listError.code === '42501' || listError.message?.includes('policy')) {
        return NextResponse.json(
          { error: 'Permission denied: Cannot create lists on this board' },
          { status: 403 }
        );
      }

      // Check if it's a table not found error
      if (
        listError.code === '42P01' ||
        listError.message?.includes('relation') ||
        listError.message?.includes('does not exist')
      ) {
        return NextResponse.json(
          { error: 'Lists table not found. Please check database setup.' },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: `Failed to create list: ${listError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ list }, { status: 201 });
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
    const boardId = searchParams.get('board_id');

    if (!boardId) {
      return NextResponse.json(
        { error: 'Board ID is required' },
        { status: 400 }
      );
    }

    // Verify user has access to this board by trying to fetch it
    // This will automatically respect RLS policies
    const { data: boardData, error: boardError } = await supabase
      .from('boards')
      .select('id, name')
      .eq('id', boardId)
      .single();

    if (boardError || !boardData) {
      return NextResponse.json(
        { error: 'Board not found or access denied' },
        { status: 403 }
      );
    }

    // Fetch lists with their cards
    const { data: lists, error: listsError } = await supabase
      .from('lists')
      .select(
        `
        id,
        name,
        position,
        created_at,
        updated_at,
        cards (
          id,
          title,
          description,
          position,
          created_at,
          updated_at,
          start_date,
          due_date,
          due_status,
          created_by,
          profiles:created_by (
            id,
            full_name,
            avatar_url
          ),
          card_members(
            id,
            created_at,
            profiles:profile_id(id, full_name, avatar_url, email)
          ),
          card_labels(
            id,
            labels(id, name, color)
          )
        )
      `
      )
      .eq('board_id', boardId)
      .eq('is_archived', false)
      .order('position', { ascending: true });

    if (listsError) {
      console.error('Error fetching lists:', listsError);
      return NextResponse.json(
        { error: 'Failed to fetch lists' },
        { status: 500 }
      );
    }

    // Sort cards within each list by position
    const listsWithSortedCards =
      lists?.map((list) => ({
        ...list,
        cards: list.cards?.sort((a, b) => a.position - b.position) || [],
      })) || [];

    // Get attachment and comment counts for all cards
    const allCardIds = listsWithSortedCards.flatMap((list) =>
      list.cards.map((card) => card.id)
    );

    if (allCardIds.length > 0) {
      // Get attachment counts
      const { data: attachmentCounts } = await supabase
        .from('card_attachments')
        .select('card_id')
        .in('card_id', allCardIds);

      // Get comment counts
      const { data: commentCounts } = await supabase
        .from('comments')
        .select('card_id')
        .in('card_id', allCardIds);

      // Create count maps
      const attachmentCountMap = new Map();
      const commentCountMap = new Map();

      attachmentCounts?.forEach((attachment) => {
        const count = attachmentCountMap.get(attachment.card_id) || 0;
        attachmentCountMap.set(attachment.card_id, count + 1);
      });

      commentCounts?.forEach((comment) => {
        const count = commentCountMap.get(comment.card_id) || 0;
        commentCountMap.set(comment.card_id, count + 1);
      });

      // Add counts to cards
      listsWithSortedCards.forEach((list) => {
        list.cards.forEach((card) => {
          const attachmentCount = attachmentCountMap.get(card.id);
          const commentCount = commentCountMap.get(card.id);

          // Only set the count if it's greater than 0
          if (attachmentCount && attachmentCount > 0) {
            (card as any).attachments = attachmentCount;
          }
          if (commentCount && commentCount > 0) {
            (card as any).comments = commentCount;
          }
        });
      });
    }

    return NextResponse.json({ lists: listsWithSortedCards });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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
    const { id, name } = body;

    // Validate required fields
    if (!id) {
      return NextResponse.json(
        { error: 'List ID is required' },
        { status: 400 }
      );
    }

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'List name is required' },
        { status: 400 }
      );
    }

    // Update the list name
    const { data: list, error: updateError } = await supabase
      .from('lists')
      .update({ name: name.trim() })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('List update error:', updateError);
      return NextResponse.json(
        { error: `Failed to update list: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ list });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
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
    const { id, is_archived } = body;

    // Validate required fields
    if (!id) {
      return NextResponse.json(
        { error: 'List ID is required' },
        { status: 400 }
      );
    }

    if (typeof is_archived !== 'boolean') {
      return NextResponse.json(
        { error: 'Archive status must be a boolean' },
        { status: 400 }
      );
    }

    // Archive/unarchive the list
    const { data: list, error: updateError } = await supabase
      .from('lists')
      .update({ is_archived })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('List archive error:', updateError);
      return NextResponse.json(
        {
          error: `Failed to ${is_archived ? 'archive' : 'unarchive'} list: ${
            updateError.message
          }`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ list });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
    const listId = searchParams.get('id');

    // Validate required fields
    if (!listId) {
      return NextResponse.json(
        { error: 'List ID is required' },
        { status: 400 }
      );
    }

    // Verify user has access to this list by checking board access
    const { data: listData, error: listError } = await supabase
      .from('lists')
      .select('board_id, name')
      .eq('id', listId)
      .single();

    if (listError || !listData) {
      return NextResponse.json(
        { error: 'List not found or access denied' },
        { status: 403 }
      );
    }

    // Verify user has access to the board
    const { data: boardData, error: boardError } = await supabase
      .from('boards')
      .select('id, name')
      .eq('id', listData.board_id)
      .single();

    if (boardError || !boardData) {
      return NextResponse.json(
        { error: 'Board not found or access denied' },
        { status: 403 }
      );
    }

    // Delete the list (this will cascade delete all cards due to foreign key constraints)
    const { error: deleteError } = await supabase
      .from('lists')
      .delete()
      .eq('id', listId);

    if (deleteError) {
      console.error('List delete error:', deleteError);
      return NextResponse.json(
        { error: `Failed to delete list: ${deleteError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
