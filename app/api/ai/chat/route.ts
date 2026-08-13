import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getActiveClientForUser } from '@/utils/ai/client';
import { getDraftMessages } from '@/utils/ai/chatDraft';
import { getBoardSuggestions } from '@/utils/ai/boardSuggestions';

const HISTORY_LIMIT = 100;

const CONVERSATION_SYSTEM_PROMPT = `You're the reply voice of a chat widget whose only purpose is helping someone describe ONE task before they click a separate "Create task" button — you never create anything yourself, you just talk with them while they describe it.

Reply in 1-2 short, plain-text sentences. Acknowledge what they said, and either ask one genuinely useful clarifying question about WHAT needs doing, or just encourage them to add more / hit "Create task" when ready. Never say you've created, added, or scheduled anything — that only happens when they click the button.

Never ask who should be assigned/responsible for the task, and don't bring up assigning people at all — that's handled separately, after the task is created, through its own step. Your only job here is helping flesh out the task's description.

Guardrail: if the message isn't about describing a task for this board (general knowledge questions, coding help, weather, jokes, anything off-topic), politely decline and steer back — e.g. "I can only help with creating a task here — what would you like done?" Don't answer the off-topic question even briefly.`;

// GET /api/ai/chat - this user's chat log, oldest first (one continuous
// log per user, no threads).
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

    const { data, error } = await supabase
      .from('ai_chat_messages')
      .select('*')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT);

    if (error) {
      console.error('Error fetching chat history:', error);
      return NextResponse.json(
        { error: 'Failed to fetch chat history' },
        { status: 500 }
      );
    }

    return NextResponse.json({ messages: (data || []).reverse() });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/ai/chat - logs one turn. No LLM call happens here — every
// message just accumulates as context in the current draft (see
// utils/ai/chatDraft.ts) until the user explicitly clicks "Create task"
// (POST /api/ai/chat/skeleton). Board/workspace are resolved entirely
// client-side by the persistent picker pills, not guessed here.
//
// Body: { action?: 'message' | 'discard' | 'complete', content?, workspaceId?, boardId? }
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
    const { action = 'message', content, workspaceId, boardId } = body;

    if (action === 'discard' || action === 'complete') {
      // Both insert the same kind of boundary marker (metadata.kind:
      // 'draft_reset' — see utils/ai/chatDraft.ts) so the next message
      // starts a clean draft either way; only the wording differs.
      const { data: message, error } = await supabase
        .from('ai_chat_messages')
        .insert({
          profile_id: user.id,
          role: 'assistant',
          message_type: 'text',
          content:
            action === 'complete'
              ? "✅ All set — ready for the next task whenever you are."
              : 'Draft discarded — starting fresh.',
          metadata: { kind: 'draft_reset' },
        })
        .select('*')
        .single();

      if (error) {
        console.error('Error resetting draft:', error);
        return NextResponse.json({ error: 'Failed to reset draft' }, { status: 500 });
      }

      return NextResponse.json({ messages: [message] });
    }

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const { data: userMessage, error } = await supabase
      .from('ai_chat_messages')
      .insert({
        profile_id: user.id,
        role: 'user',
        message_type: 'text',
        content: content.trim(),
        resolved_workspace_id: workspaceId || null,
        resolved_board_id: boardId || null,
      })
      .select('*')
      .single();

    if (error || !userMessage) {
      console.error('Error inserting user chat message:', error);
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }

    // A real back-and-forth needs a reply to each turn, not silence until
    // "Create task" — this is that reply (also carries the off-topic
    // guardrail). It never creates anything; only the skeleton/confirm
    // endpoints do that.
    const activeClient = await getActiveClientForUser(supabase, user.id);
    if (!activeClient) {
      return NextResponse.json({ messages: [userMessage] });
    }

    let replyText = "Got it — keep going, or hit \"Create task\" when you're ready.";
    try {
      const draft = await getDraftMessages(supabase, user.id);
      const completion = await activeClient.client.chat.completions.create({
        model: activeClient.model,
        messages: [
          { role: 'system', content: CONVERSATION_SYSTEM_PROMPT },
          ...draft.map((turn) => ({ role: turn.role, content: turn.content })),
        ],
      });
      replyText = completion.choices[0]?.message?.content?.trim() || replyText;
    } catch (err) {
      console.error('AI conversational reply failed:', err);
    }

    // No board picked yet — attach a few quick-pick suggestions to this
    // same reply instead of a separate nagging message.
    let metadata: any = null;
    if (!boardId) {
      const suggestions = await getBoardSuggestions(supabase, user.id, workspaceId || null);
      if (suggestions.length > 0) {
        metadata = { kind: 'board_suggest', boards: suggestions };
      }
    }

    const { data: assistantMessage } = await supabase
      .from('ai_chat_messages')
      .insert({
        profile_id: user.id,
        role: 'assistant',
        message_type: 'text',
        content: replyText,
        metadata,
        resolved_workspace_id: workspaceId || null,
        resolved_board_id: boardId || null,
      })
      .select('*')
      .single();

    return NextResponse.json({ messages: [userMessage, assistantMessage] });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
