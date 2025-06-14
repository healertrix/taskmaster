import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; checklistId: string } }
) {
  try {
    const supabase = createClient();
    const cardId = params.id;
    const checklistId = params.checklistId;
    const { text } = await request.json();

    // Get user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate input
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Item text is required' },
        { status: 400 }
      );
    }

    // Verify checklist exists (RLS will handle permissions)
    const { data: checklist, error: checklistError } = await supabase
      .from('checklists')
      .select('id, card_id')
      .eq('id', checklistId)
      .eq('card_id', cardId)
      .single();

    if (checklistError || !checklist) {
      console.error('Checklist verification error:', checklistError);
      return NextResponse.json(
        { error: 'Checklist not found or access denied' },
        { status: 404 }
      );
    }

    // Use current timestamp as position to avoid additional query
    const nextPosition = Date.now();

    // Create checklist item
    const { data: item, error: itemError } = await supabase
      .from('checklist_items')
      .insert({
        checklist_id: checklistId,
        content: text.trim(),
        is_complete: false,
        position: nextPosition,
      })
      .select()
      .single();

    if (itemError) {
      console.error('Error creating checklist item:', itemError);
      return NextResponse.json(
        { error: 'Failed to create checklist item' },
        { status: 500 }
      );
    }

    // Transform the item to match our interface
    const transformedItem = {
      id: item.id,
      text: item.content,
      completed: item.is_complete,
      created_at: item.created_at,
      updated_at: item.updated_at,
    };

    return NextResponse.json({ item: transformedItem }, { status: 201 });
  } catch (error) {
    console.error(
      'Error in POST /api/cards/[id]/checklists/[checklistId]/items:',
      error
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
