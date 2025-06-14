import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    // Get user to ensure they're authenticated
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if tables exist
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['checklists', 'checklist_items']);

    if (tablesError) {
      console.error('Error checking tables:', tablesError);
      return NextResponse.json(
        { error: 'Failed to check tables', details: tablesError },
        { status: 500 }
      );
    }

    const existingTables = tables?.map((t) => t.table_name) || [];

    // Try to get sample data from checklists table
    let checklistsData = null;
    let checklistsError = null;

    if (existingTables.includes('checklists')) {
      const { data, error } = await supabase
        .from('checklists')
        .select('*')
        .limit(5);
      checklistsData = data;
      checklistsError = error;
    }

    // Try to get sample data from checklist_items table
    let itemsData = null;
    let itemsError = null;

    if (existingTables.includes('checklist_items')) {
      const { data, error } = await supabase
        .from('checklist_items')
        .select('*')
        .limit(5);
      itemsData = data;
      itemsError = error;
    }

    return NextResponse.json({
      tablesExist: existingTables,
      missingTables: ['checklists', 'checklist_items'].filter(
        (table) => !existingTables.includes(table)
      ),
      sampleData: {
        checklists: {
          data: checklistsData,
          error: checklistsError,
        },
        checklist_items: {
          data: itemsData,
          error: itemsError,
        },
      },
    });
  } catch (error) {
    console.error('Error in debug route:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    );
  }
}
