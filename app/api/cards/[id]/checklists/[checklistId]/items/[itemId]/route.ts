import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; checklistId: string; itemId: string } }
) {
  try {
    const supabase = createClient();
    const cardId = params.id;
    const checklistId = params.checklistId;
    const itemId = params.itemId;
    const body = await request.json();

    // Get user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // Validate and add fields to update
    if (body.text !== undefined) {
      if (typeof body.text !== 'string' || body.text.trim().length === 0) {
        return NextResponse.json(
          { error: 'Item text cannot be empty' },
          { status: 400 }
        );
      }
      updateData.content = body.text.trim();
    }

    if (body.completed !== undefined) {
      if (typeof body.completed !== 'boolean') {
        return NextResponse.json(
          { error: 'Completed must be a boolean' },
          { status: 400 }
        );
      }
      updateData.is_complete = body.completed;
      if (body.completed) {
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by = user.id;
      } else {
        updateData.completed_at = null;
        updateData.completed_by = null;
      }
    }

    // Update item directly - RLS policies will handle permissions
    const { data: updatedItem, error: updateError } = await supabase
      .from('checklist_items')
      .update(updateData)
      .eq('id', itemId)
      .eq('checklist_id', checklistId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating checklist item:', updateError);
      return NextResponse.json(
        { error: 'Failed to update checklist item' },
        { status: 500 }
      );
    }

    // Transform the item to match our interface
    const transformedItem = {
      id: updatedItem.id,
      text: updatedItem.content,
      completed: updatedItem.is_complete,
      created_at: updatedItem.created_at,
      updated_at: updatedItem.updated_at,
    };

    return NextResponse.json({ item: transformedItem });
  } catch (error) {
    console.error(
      'Error in PUT /api/cards/[id]/checklists/[checklistId]/items/[itemId]:',
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
  { params }: { params: { id: string; checklistId: string; itemId: string } }
) {
  try {
    const supabase = createClient();
    const cardId = params.id;
    const checklistId = params.checklistId;
    const itemId = params.itemId;

    // Get user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete item directly - RLS policies will handle permissions
    const { error: deleteError } = await supabase
      .from('checklist_items')
      .delete()
      .eq('id', itemId)
      .eq('checklist_id', checklistId);

    if (deleteError) {
      console.error('Error deleting checklist item:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete checklist item' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      'Error in DELETE /api/cards/[id]/checklists/[checklistId]/items/[itemId]:',
      error
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
