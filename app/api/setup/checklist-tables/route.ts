import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
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
        { error: 'Failed to check tables' },
        { status: 500 }
      );
    }

    const existingTables = tables?.map((t) => t.table_name) || [];
    const missingTables = ['checklists', 'checklist_items'].filter(
      (table) => !existingTables.includes(table)
    );

    let results = {
      tablesExist: existingTables,
      missingTables,
      tablesCreated: [] as string[],
      errors: [] as string[],
    };

    // Create missing tables
    if (missingTables.length > 0) {
      // Create checklists table
      if (missingTables.includes('checklists')) {
        try {
          const { error: checklistTableError } = await supabase.rpc(
            'exec_sql',
            {
              sql: `
              CREATE TABLE IF NOT EXISTS checklists (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                card_id UUID REFERENCES cards(id) ON DELETE CASCADE NOT NULL,
                title TEXT NOT NULL,
                position FLOAT NOT NULL DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
              );
              
              CREATE TRIGGER IF NOT EXISTS update_checklists_updated_at
                BEFORE UPDATE ON checklists
                FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
            `,
            }
          );

          if (checklistTableError) {
            results.errors.push(
              `Failed to create checklists table: ${checklistTableError.message}`
            );
          } else {
            results.tablesCreated.push('checklists');
          }
        } catch (err) {
          results.errors.push(`Error creating checklists table: ${err}`);
        }
      }

      // Create checklist_items table
      if (missingTables.includes('checklist_items')) {
        try {
          const { error: itemsTableError } = await supabase.rpc('exec_sql', {
            sql: `
              CREATE TABLE IF NOT EXISTS checklist_items (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                checklist_id UUID REFERENCES checklists(id) ON DELETE CASCADE NOT NULL,
                content TEXT NOT NULL,
                is_complete BOOLEAN DEFAULT FALSE,
                position FLOAT NOT NULL DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                completed_at TIMESTAMP WITH TIME ZONE,
                completed_by UUID REFERENCES profiles(id)
              );
              
              CREATE TRIGGER IF NOT EXISTS update_checklist_items_updated_at
                BEFORE UPDATE ON checklist_items
                FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
            `,
          });

          if (itemsTableError) {
            results.errors.push(
              `Failed to create checklist_items table: ${itemsTableError.message}`
            );
          } else {
            results.tablesCreated.push('checklist_items');
          }
        } catch (err) {
          results.errors.push(`Error creating checklist_items table: ${err}`);
        }
      }
    }

    // Enable RLS and create policies
    const rlsQueries = [
      'ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;',

      // Drop existing policies if they exist
      'DROP POLICY IF EXISTS "Users can view checklists on cards they can access" ON checklists;',
      'DROP POLICY IF EXISTS "Board members can create checklists" ON checklists;',
      'DROP POLICY IF EXISTS "Board members can update checklists" ON checklists;',
      'DROP POLICY IF EXISTS "Board members can delete checklists" ON checklists;',

      'DROP POLICY IF EXISTS "Users can view checklist items on cards they can access" ON checklist_items;',
      'DROP POLICY IF EXISTS "Board members can create checklist items" ON checklist_items;',
      'DROP POLICY IF EXISTS "Board members can update checklist items" ON checklist_items;',
      'DROP POLICY IF EXISTS "Board members can delete checklist items" ON checklist_items;',

      // Create new policies for checklists
      `CREATE POLICY "Users can view checklists on cards they can access"
        ON checklists FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM cards
            JOIN board_members ON board_members.board_id = cards.board_id
            WHERE cards.id = checklists.card_id
            AND board_members.profile_id = auth.uid()
          )
        );`,

      `CREATE POLICY "Board members can create checklists"
        ON checklists FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM cards
            JOIN board_members ON board_members.board_id = cards.board_id
            WHERE cards.id = checklists.card_id
            AND board_members.profile_id = auth.uid()
          )
        );`,

      `CREATE POLICY "Board members can update checklists"
        ON checklists FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM cards
            JOIN board_members ON board_members.board_id = cards.board_id
            WHERE cards.id = checklists.card_id
            AND board_members.profile_id = auth.uid()
          )
        );`,

      `CREATE POLICY "Board members can delete checklists"
        ON checklists FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM cards
            JOIN board_members ON board_members.board_id = cards.board_id
            WHERE cards.id = checklists.card_id
            AND board_members.profile_id = auth.uid()
          )
        );`,

      // Create new policies for checklist items
      `CREATE POLICY "Users can view checklist items on cards they can access"
        ON checklist_items FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM checklists
            JOIN cards ON cards.id = checklists.card_id
            JOIN board_members ON board_members.board_id = cards.board_id
            WHERE checklists.id = checklist_items.checklist_id
            AND board_members.profile_id = auth.uid()
          )
        );`,

      `CREATE POLICY "Board members can create checklist items"
        ON checklist_items FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM checklists
            JOIN cards ON cards.id = checklists.card_id
            JOIN board_members ON board_members.board_id = cards.board_id
            WHERE checklists.id = checklist_items.checklist_id
            AND board_members.profile_id = auth.uid()
          )
        );`,

      `CREATE POLICY "Board members can update checklist items"
        ON checklist_items FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM checklists
            JOIN cards ON cards.id = checklists.card_id
            JOIN board_members ON board_members.board_id = cards.board_id
            WHERE checklists.id = checklist_items.checklist_id
            AND board_members.profile_id = auth.uid()
          )
        );`,

      `CREATE POLICY "Board members can delete checklist items"
        ON checklist_items FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM checklists
            JOIN cards ON cards.id = checklists.card_id
            JOIN board_members ON board_members.board_id = cards.board_id
            WHERE checklists.id = checklist_items.checklist_id
            AND board_members.profile_id = auth.uid()
          )
        );`,
    ];

    // Execute RLS queries
    for (const query of rlsQueries) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: query });
        if (error) {
          results.errors.push(`RLS Query failed: ${error.message}`);
        }
      } catch (err) {
        results.errors.push(`RLS Query error: ${err}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Checklist tables and policies setup completed',
      results,
    });
  } catch (error) {
    console.error('Error in setup:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    );
  }
}
