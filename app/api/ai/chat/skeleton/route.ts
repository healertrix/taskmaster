import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getActiveClientForUser } from '@/utils/ai/client';
import { getDraftMessages } from '@/utils/ai/chatDraft';
import { resolveDueDatePhrase } from '@/utils/ai/resolveDate';

// Note: no "is this actually a task?" gate here anymore. That check
// belongs to the per-message conversational reply (see app/api/ai/chat/
// route.ts's CONVERSATION_SYSTEM_PROMPT), which runs on every message and
// can decline off-topic ones. This endpoint only runs when the user
// explicitly clicks "Create task" — at that point the decision has
// already been made; asking "can you tell me more?" instead of just
// creating something from whatever's there second-guesses an explicit
// command and was the "why does it keep asking for more detail" bug.
const SYSTEM_PROMPT = `You read a back-and-forth chat conversation where someone is describing a task they want created on a project board. They have just explicitly clicked "Create task" — always produce one from whatever is in the conversation, using your best judgment, even if it's brief or sparse. Never ask a clarifying question and never refuse; make a reasonable task out of what's there.

Respond ONLY with JSON of this exact shape: {"title": string, "description": string, "due_date_phrase": string}.

- "title": short and clear (max 8 words), summarizing the task.
- "description": a clean, well-written synthesis of everything relevant said across the whole conversation — combine details from multiple messages into one coherent description, don't just repeat the last message. If the conversation is very sparse, just clean up what was said rather than inventing detail that wasn't there.
- "due_date_phrase": if a deadline/due date was mentioned anywhere in the conversation (e.g. "by 6th oct", "due in 2 weeks", "30 days from now", "next friday"), copy that phrase out verbatim (just the date part, e.g. "6th oct", "30 days from now", "next friday") — do not do any date math yourself, just extract the phrase. If no date was mentioned, set this to "".`;

// POST /api/ai/chat/skeleton - the "Create task" button. Synthesizes one
// task (title + description) from the entire current draft (see
// utils/ai/chatDraft.ts for what counts as "current draft"), not just the
// latest message — this is the multi-turn context the old per-message
// flow deliberately avoided, safe here because the draft boundary is
// explicit (resets only on a created task or a manual discard) instead of
// an unbounded tail of chat history.
//
// Body: { workspaceId, boardId, workspaceName?, boardName? }
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
    const { workspaceId, boardId, workspaceName, boardName } = body;

    if (!boardId) {
      return NextResponse.json({ error: 'A board must be selected first' }, { status: 400 });
    }

    const draft = await getDraftMessages(supabase, user.id);
    if (draft.length === 0) {
      return NextResponse.json(
        { error: 'empty_draft', message: "Tell me what you'd like to create first." },
        { status: 400 }
      );
    }

    const activeClient = await getActiveClientForUser(supabase, user.id);
    if (!activeClient) {
      return NextResponse.json(
        { error: 'no_active_key', message: 'Add an API key in Settings to use AI features.' },
        { status: 400 }
      );
    }

    // Verify the board (RLS-scoped) and grab its first list up front — no
    // point proposing a skeleton for a board that has nowhere to put it.
    const { data: board } = await supabase
      .from('boards')
      .select('id, name')
      .eq('id', boardId)
      .single();

    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    const { data: firstList } = await supabase
      .from('lists')
      .select('id')
      .eq('board_id', boardId)
      .order('position', { ascending: true })
      .limit(1)
      .single();

    if (!firstList) {
      const { data: message } = await supabase
        .from('ai_chat_messages')
        .insert({
          profile_id: user.id,
          role: 'assistant',
          message_type: 'text',
          content: `${board.name} doesn't have any lists yet — add one first.`,
          resolved_workspace_id: workspaceId || null,
          resolved_board_id: boardId,
        })
        .select('*')
        .single();

      return NextResponse.json({ messages: [message] });
    }

    // Fallback if the LLM call fails entirely: still create *something*
    // rather than blocking — a truncated version of the last thing the
    // user said, which is always at least as good as asking them to
    // repeat themselves.
    const lastUserTurn = [...draft].reverse().find((t) => t.role === 'user');
    let parsed: { title: string; description: string; due_date_phrase: string } = {
      title: (lastUserTurn?.content || 'New task').slice(0, 60),
      description: lastUserTurn?.content || '',
      due_date_phrase: '',
    };
    try {
      const completion = await activeClient.client.chat.completions.create({
        model: activeClient.model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...draft.map((turn) => ({ role: turn.role, content: turn.content })),
          {
            role: 'system',
            content: 'Now respond with the JSON described above, based on the conversation above.',
          },
        ],
      });
      const raw = JSON.parse(completion.choices[0]?.message?.content || '{}');
      if (typeof raw.title === 'string' && raw.title.trim()) {
        parsed = {
          title: raw.title.trim(),
          description: typeof raw.description === 'string' ? raw.description.trim() : parsed.description,
          due_date_phrase: typeof raw.due_date_phrase === 'string' ? raw.due_date_phrase.trim() : '',
        };
      }
    } catch (err) {
      console.error('AI skeleton generation failed, using fallback title:', err);
    }

    // Deterministic parsing first (see parseDueDate.ts — reliable "same
    // year unless it's already passed" rollover isn't something to trust
    // an LLM's own arithmetic for); only asks the LLM to normalize the
    // phrase if that fails, so uncommon phrasings ("next week", "the end
    // of the month") still resolve here instead of surfacing the "couldn't
    // resolve it" warning for anything the deterministic patterns miss.
    const dueDate = parsed.due_date_phrase
      ? await resolveDueDatePhrase(activeClient.client, activeClient.model, parsed.due_date_phrase)
      : null;

    const { data: message } = await supabase
      .from('ai_chat_messages')
      .insert({
        profile_id: user.id,
        role: 'assistant',
        message_type: 'text',
        content: `Here's what I'll create: "${parsed.title}"`,
        metadata: {
          kind: 'skeleton_proposal',
          title: parsed.title,
          description: parsed.description,
          due_date: dueDate,
          // Kept even when dueDate resolution failed, so the preview can
          // show what was said and let the user confirm/fix it manually
          // instead of the phrase just silently vanishing.
          due_date_phrase: !dueDate && parsed.due_date_phrase ? parsed.due_date_phrase : null,
          list_id: firstList.id,
          board_id: boardId,
          board_name: board.name,
          workspace_id: workspaceId || null,
          workspace_name: workspaceName || null,
        },
        resolved_workspace_id: workspaceId || null,
        resolved_board_id: boardId,
      })
      .select('*')
      .single();

    return NextResponse.json({ messages: [message] });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
