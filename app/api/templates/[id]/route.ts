import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  validateTemplateStructure,
  type TemplateStructure,
} from '@/utils/boardTemplates';

// GET /api/templates/[id] - a single template (used by the edit page and
// by "create board from template" to read the structure to apply).
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: template, error } = await supabase
      .from('board_templates')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Error in GET /api/templates/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/templates/[id] - edit a template. Fully editable at any
// time — templates are just personal data with no live link to any board
// created from them (applying one is a one-time copy), so there's no
// "affects other things" concern to gate this behind, unlike custom
// fields/labels.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, structure } = (await request.json()) as {
      name?: string;
      structure?: TemplateStructure;
    };

    if (structure) {
      try {
        validateTemplateStructure(structure);
      } catch (validationError) {
        return NextResponse.json(
          {
            error:
              validationError instanceof Error
                ? validationError.message
                : 'Invalid template structure',
          },
          { status: 400 }
        );
      }
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json(
          { error: 'Template name cannot be empty' },
          { status: 400 }
        );
      }
      updates.name = name.trim();
    }
    if (structure !== undefined) updates.structure = structure;

    const { data: template, error } = await supabase
      .from('board_templates')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating template:', error);
      return NextResponse.json(
        { error: 'Failed to update template' },
        { status: 500 }
      );
    }
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Error in PATCH /api/templates/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/templates/[id] - a plain hard delete, no affected-count
// warning needed (unlike custom fields) — nothing else holds a live
// reference to a template row, boards created from it are already fully
// independent by the time this could ever run.
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('board_templates')
      .delete()
      .eq('id', params.id);

    if (error) {
      console.error('Error deleting template:', error);
      return NextResponse.json(
        { error: 'Failed to delete template' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/templates/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
