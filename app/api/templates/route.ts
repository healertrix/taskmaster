import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  validateTemplateStructure,
  EMPTY_TEMPLATE_STRUCTURE,
  type TemplateStructure,
} from '@/utils/boardTemplates';

// GET /api/templates - list the current user's own templates. No
// board/workspace-membership check needed — templates are personal, RLS
// (owner_id = auth.uid()) already scopes this to "mine" at the DB level.
export async function GET() {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: templates, error } = await supabase
      .from('board_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching templates:', error);
      return NextResponse.json(
        { error: 'Failed to fetch templates' },
        { status: 500 }
      );
    }

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Error in GET /api/templates:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/templates - create a new template, from scratch (empty
// structure by default) or with an initial structure already filled in
// (used by "save this board as a template", which builds the structure
// client-side from the board's current lists/labels/fields and posts it
// here same as a from-scratch save would).
export async function POST(request: NextRequest) {
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

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Template name is required' },
        { status: 400 }
      );
    }

    const finalStructure = structure || EMPTY_TEMPLATE_STRUCTURE;
    try {
      validateTemplateStructure(finalStructure);
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

    const { data: template, error } = await supabase
      .from('board_templates')
      .insert({
        owner_id: user.id,
        name: name.trim(),
        structure: finalStructure,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating template:', error);
      return NextResponse.json(
        { error: 'Failed to create template' },
        { status: 500 }
      );
    }

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/templates:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
