import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createCard } from '@/utils/cards/createCard';

// POST /api/ai/chat/confirm - the "Approve" step: creates the card from a
// (possibly user-edited) skeleton. No LLM call — the title/description
// were already decided by /api/ai/chat/skeleton or edited by hand: this
// route just does the deterministic part.
//
// Body: { title, description, boardId, workspaceId, listId, dueDate?, startDate? }
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
    const { title, description, boardId, workspaceId, listId, dueDate, startDate } = body;

    if (!title?.trim() || !boardId) {
      return NextResponse.json({ error: 'title and boardId are required' }, { status: 400 });
    }

    let resolvedListId = listId;
    if (!resolvedListId) {
      const { data: firstList } = await supabase
        .from('lists')
        .select('id')
        .eq('board_id', boardId)
        .order('position', { ascending: true })
        .limit(1)
        .single();
      resolvedListId = firstList?.id;
    }

    if (!resolvedListId) {
      const { data: message } = await supabase
        .from('ai_chat_messages')
        .insert({
          profile_id: user.id,
          role: 'assistant',
          message_type: 'text',
          content: "That board doesn't have any lists yet — add one first.",
          resolved_workspace_id: workspaceId || null,
          resolved_board_id: boardId,
        })
        .select('*')
        .single();

      return NextResponse.json({ messages: [message] });
    }

    const result = await createCard(supabase, user.id, {
      title,
      description,
      list_id: resolvedListId,
      board_id: boardId,
      due_date: dueDate || null,
      start_date: startDate || null,
    });

    if (!result.ok) {
      const { data: message } = await supabase
        .from('ai_chat_messages')
        .insert({
          profile_id: user.id,
          role: 'assistant',
          message_type: 'text',
          content: result.error,
          resolved_workspace_id: workspaceId || null,
          resolved_board_id: boardId,
        })
        .select('*')
        .single();

      return NextResponse.json({ messages: [message] });
    }

    const { data: confirmationMessage } = await supabase
      .from('ai_chat_messages')
      .insert({
        profile_id: user.id,
        role: 'assistant',
        message_type: 'confirmation',
        content: `Created "${title}"`,
        metadata: {
          card_id: result.card.id,
          card_number: result.card.number,
          board_id: boardId,
          title,
          start_date: result.card.start_date,
          due_date: result.card.due_date,
        },
        resolved_workspace_id: workspaceId || null,
        resolved_board_id: boardId,
      })
      .select('*')
      .single();

    // Plain bot follow-up, not an LLM call — offers the obvious next steps
    // (assign someone, set/change the due date) right where the task was
    // just created.
    const { data: actionsMessage } = await supabase
      .from('ai_chat_messages')
      .insert({
        profile_id: user.id,
        role: 'assistant',
        message_type: 'text',
        content: 'Want to assign people or set a due date?',
        metadata: {
          kind: 'post_create_actions',
          card_id: result.card.id,
          board_id: boardId,
          workspace_id: workspaceId || null,
          start_date: result.card.start_date,
          due_date: result.card.due_date,
        },
        resolved_workspace_id: workspaceId || null,
        resolved_board_id: boardId,
      })
      .select('*')
      .single();

    return NextResponse.json({
      messages: [confirmationMessage, actionsMessage],
      card: result.card,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
