import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/boards/[id]/labels - Get all labels for a board
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    // Get the user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: boardId } = params;

    // Verify user has access to the board
    const { data: boardAccess, error: boardError } = await supabase
      .from('board_members')
      .select('id')
      .eq('board_id', boardId)
      .eq('profile_id', user.id)
      .single();

    if (boardError || !boardAccess) {
      return NextResponse.json(
        { error: 'Board not found or access denied' },
        { status: 403 }
      );
    }

    // Get all labels for the board
    const { data: labels, error: labelsError } = await supabase
      .from('labels')
      .select('*')
      .eq('board_id', boardId)
      .order('created_at', { ascending: true });

    if (labelsError) {
      console.error('Error fetching labels:', labelsError);
      return NextResponse.json(
        { error: 'Failed to fetch labels' },
        { status: 500 }
      );
    }

    return NextResponse.json({ labels });
  } catch (error) {
    console.error('Error in GET /api/boards/[id]/labels:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/boards/[id]/labels - Create a new label
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    // Get the user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: boardId } = params;
    const { name, color } = await request.json();

    // Validate input
    if (!color) {
      return NextResponse.json({ error: 'Color is required' }, { status: 400 });
    }

    // Verify user has access to the board
    const { data: boardAccess, error: boardError } = await supabase
      .from('board_members')
      .select('id')
      .eq('board_id', boardId)
      .eq('profile_id', user.id)
      .single();

    if (boardError || !boardAccess) {
      return NextResponse.json(
        { error: 'Board not found or access denied' },
        { status: 403 }
      );
    }

    // Create the label
    const { data: label, error: createError } = await supabase
      .from('labels')
      .insert({
        name: name || null,
        color,
        board_id: boardId,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating label:', createError);
      return NextResponse.json(
        { error: 'Failed to create label' },
        { status: 500 }
      );
    }

    return NextResponse.json({ label }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/boards/[id]/labels:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
