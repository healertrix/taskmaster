import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/ai/chat/confirm-lists - the "Approve" step for a
// list_setup_proposal: creates the lists for real (same next_list_number
// per-board counter as the normal /api/lists POST path, so these are
// indistinguishable from lists a user created by hand), then inserts a
// permanent list_setup_created resolution message. That message is what
// getListSetupState (server) and the frontend's resolution map both key
// off to know this exchange is done — not a text heuristic, an actual
// record, so it holds up across reloads exactly like skeleton approval
// already does.
//
// Body: { boardId, workspaceId?, listNames: string[] }
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

    const body = await request.json();
    const { boardId, workspaceId, listNames } = body as {
      boardId?: string;
      workspaceId?: string;
      listNames?: string[];
    };

    if (!boardId) {
      return NextResponse.json({ error: 'boardId is required' }, { status: 400 });
    }
    const names = (listNames || [])
      .map((n) => (typeof n === 'string' ? n.trim() : ''))
      .filter((n) => n.length > 0);
    if (names.length === 0) {
      return NextResponse.json({ error: 'At least one list name is required' }, { status: 400 });
    }

    // RLS-scoped — a board this user can't access simply won't be found.
    const { data: board } = await supabase
      .from('boards')
      .select('id, name')
      .eq('id', boardId)
      .single();
    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    const createdNames: string[] = [];
    for (let i = 0; i < names.length; i++) {
      const { data: listNumber, error: numberError } = await supabase.rpc(
        'next_list_number',
        { p_board_id: boardId }
      );
      if (numberError || listNumber == null) {
        console.error('List number assignment error:', numberError);
        continue;
      }
      const { error: insertError } = await supabase.from('lists').insert({
        name: names[i],
        board_id: boardId,
        position: i,
        number: listNumber,
      });
      if (insertError) {
        console.error('Error creating list from AI chat:', insertError);
        continue;
      }
      createdNames.push(names[i]);
    }

    if (createdNames.length === 0) {
      const { data: failureMessage } = await supabase
        .from('ai_chat_messages')
        .insert({
          profile_id: user.id,
          role: 'assistant',
          message_type: 'text',
          content: "Something went wrong creating those lists — try again?",
          resolved_workspace_id: workspaceId || null,
          resolved_board_id: boardId,
        })
        .select('*')
        .single();
      return NextResponse.json({ messages: [failureMessage] }, { status: 500 });
    }

    const { data: resolutionMessage } = await supabase
      .from('ai_chat_messages')
      .insert({
        profile_id: user.id,
        role: 'assistant',
        message_type: 'text',
        content: `✅ Created ${createdNames.length === 1 ? 'list' : 'lists'}: ${createdNames.join(
          ', '
        )}. ${board.name} is ready — continue describing your task, or hit "Create task" if you already did.`,
        metadata: {
          kind: 'list_setup_created',
          list_names: createdNames,
          board_id: boardId,
        },
        resolved_workspace_id: workspaceId || null,
        resolved_board_id: boardId,
      })
      .select('*')
      .single();

    return NextResponse.json({ messages: [resolutionMessage] });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
