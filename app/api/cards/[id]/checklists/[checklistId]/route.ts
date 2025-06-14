import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; checklistId: string } }
) {
  try {
    const supabase = createClient();
    const cardId = params.id;
    const checklistId = params.checklistId;
    const { name } = await request.json();

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

    // Verify checklist exists and user has access (RLS will handle permissions)
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

    // Update checklist
    const { data: updatedChecklist, error: updateError } = await supabase
      .from('checklists')
      .update({
        title: name.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', checklistId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating checklist:', updateError);
      return NextResponse.json(
        { error: 'Failed to update checklist' },
        { status: 500 }
      );
    }

    return NextResponse.json({ checklist: updatedChecklist });
  } catch (error) {
    console.error(
      'Error in PUT /api/cards/[id]/checklists/[checklistId]:',
      error
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; checklistId: string } }
) {
  try {
    const supabase = createClient();
    const cardId = params.id;
    const checklistId = params.checklistId;

    // Get user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify checklist exists and user has access (RLS will handle permissions)
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

    // Delete checklist (this will cascade delete checklist items)
    const { error: deleteError } = await supabase
      .from('checklists')
      .delete()
      .eq('id', checklistId);

    if (deleteError) {
      console.error('Error deleting checklist:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete checklist' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      'Error in DELETE /api/cards/[id]/checklists/[checklistId]:',
      error
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
