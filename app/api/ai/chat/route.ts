import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getActiveClientForUser } from '@/utils/ai/client';
import { getDraftMessages } from '@/utils/ai/chatDraft';
import { getBoardSuggestions } from '@/utils/ai/boardSuggestions';
import { getListSetupState, isBoardEmpty } from '@/utils/ai/listSetup';

const HISTORY_PAGE_SIZE = 5;

// Used only once a "want default lists?" nudge has already been sent for
// this board and the user has just replied — decides what they meant.
const LIST_NAMES_SYSTEM_PROMPT = `The user was just asked whether an empty board should get default lists (Todo, Doing, Done) set up, or their own custom list names instead. Read their reply and decide what to do.

Respond ONLY with JSON of this exact shape: {"declined": boolean, "listNames": string[]}.
- If they're declining / saying no / not now / skip it / maybe later: {"declined": true, "listNames": []}.
- If they accept the default (yes, sounds good, continue, use the default, sure, etc.): {"declined": false, "listNames": ["Todo", "Doing", "Done"]}.
- If they name their own lists (e.g. "make it Doing, QA and Archive"): {"declined": false, "listNames": [...]} with those exact names, in the order given, capitalized naturally. Always at least one name when not declining.`;

const CONVERSATION_SYSTEM_PROMPT = `You're the reply voice of a chat widget whose only purpose is helping someone describe ONE task before they click a separate "Create task" button — you never create anything yourself, you just talk with them while they describe it.

Reply in 1-2 short, plain-text sentences. Acknowledge what they said, and either ask one genuinely useful clarifying question about WHAT needs doing, or just encourage them to add more / hit "Create task" when ready. Never say you've created, added, or scheduled anything — that only happens when they click the button.

Never ask who should be assigned/responsible for the task, and don't bring up assigning people at all — that's handled separately, after the task is created, through its own step. Your only job here is helping flesh out the task's description.

Guardrail: if the message isn't about describing a task for this board (general knowledge questions, coding help, weather, jokes, anything off-topic), politely decline and steer back — e.g. "I can only help with creating a task here — what would you like done?" Don't answer the off-topic question even briefly.`;

// GET /api/ai/chat - this user's chat log, most recent page first (one
// continuous log per user, no threads). Paginated: only the last
// HISTORY_PAGE_SIZE messages load up front — the widget loads more as the
// user scrolls toward the top, via ?before=<created_at of oldest loaded>.
// Returns messages oldest-first within the page (ready to render/prepend
// directly) plus hasMore so the client knows whether to keep listening for
// scroll-up.
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const before = request.nextUrl.searchParams.get('before');

    let query = supabase
      .from('ai_chat_messages')
      .select('*')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })
      .limit(HISTORY_PAGE_SIZE + 1);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching chat history:', error);
      return NextResponse.json(
        { error: 'Failed to fetch chat history' },
        { status: 500 }
      );
    }

    const rows = data || [];
    const hasMore = rows.length > HISTORY_PAGE_SIZE;
    const page = hasMore ? rows.slice(0, HISTORY_PAGE_SIZE) : rows;

    return NextResponse.json({ messages: page.reverse(), hasMore });
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

    // Empty-board list setup — checked before the normal conversational
    // reply, so an empty board interrupts here rather than after a whole
    // task has already been drafted with nowhere to land (skeleton
    // generation checks emptiness too, but only after title/description
    // work has already happened).
    if (boardId) {
      const listSetupState = await getListSetupState(supabase, user.id, boardId);

      if (listSetupState.kind === 'nudge_pending') {
        // The nudge was already sent — this message is the user's answer,
        // not more task content. Decipher it instead of replying normally.
        const activeClient = await getActiveClientForUser(supabase, user.id);
        let declined = false;
        let listNames: string[] = ['Todo', 'Doing', 'Done'];
        if (activeClient) {
          try {
            const jsonContent = await activeClient.client.completeJson([
              { role: 'system', content: LIST_NAMES_SYSTEM_PROMPT },
              { role: 'user', content: content.trim() },
            ]);
            const raw = JSON.parse(jsonContent || '{}');
            declined = raw.declined === true;
            if (Array.isArray(raw.listNames) && raw.listNames.length > 0) {
              listNames = raw.listNames
                .filter((n: unknown) => typeof n === 'string' && n.trim())
                .map((n: string) => n.trim());
            }
          } catch (err) {
            console.error(
              'AI list-name deciphering failed, defaulting to Todo/Doing/Done:',
              err
            );
          }
        }

        if (declined) {
          const { data: declineMessage } = await supabase
            .from('ai_chat_messages')
            .insert({
              profile_id: user.id,
              role: 'assistant',
              message_type: 'text',
              content:
                "No problem — just say the word whenever you're ready to set up lists, or open the board and do it yourself.",
              metadata: { kind: 'list_setup_declined', board_id: boardId },
              resolved_workspace_id: workspaceId || null,
              resolved_board_id: boardId,
            })
            .select('*')
            .single();
          return NextResponse.json({ messages: [userMessage, declineMessage] });
        }

        const { data: proposalMessage } = await supabase
          .from('ai_chat_messages')
          .insert({
            profile_id: user.id,
            role: 'assistant',
            message_type: 'text',
            content: `Here's what I'll create: ${listNames.join(', ')}`,
            metadata: {
              kind: 'list_setup_proposal',
              list_names: listNames,
              board_id: boardId,
              workspace_id: workspaceId || null,
            },
            resolved_workspace_id: workspaceId || null,
            resolved_board_id: boardId,
          })
          .select('*')
          .single();
        return NextResponse.json({ messages: [userMessage, proposalMessage] });
      }

      if (listSetupState.kind === 'none') {
        const empty = await isBoardEmpty(supabase, boardId);
        if (empty) {
          const { data: nudgeMessage } = await supabase
            .from('ai_chat_messages')
            .insert({
              profile_id: user.id,
              role: 'assistant',
              message_type: 'text',
              content:
                "This board doesn't have any lists yet, so there's nowhere for a task to go. Want me to set up Todo / Doing / Done as a starting point? Just say yes, or tell me the list names you'd rather use — or open the board and set it up yourself.",
              metadata: {
                kind: 'list_setup_nudge',
                board_id: boardId,
                board_url: `/board/${boardId}`,
              },
              resolved_workspace_id: workspaceId || null,
              resolved_board_id: boardId,
            })
            .select('*')
            .single();
          return NextResponse.json({ messages: [userMessage, nudgeMessage] });
        }
      }
      // 'proposal_pending', or the board already has lists — fall through
      // to the normal conversational reply below.
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
      const reply = await activeClient.client.complete([
        { role: 'system', content: CONVERSATION_SYSTEM_PROMPT },
        ...draft.map((turn) => ({ role: turn.role, content: turn.content })),
      ]);
      replyText = reply.trim() || replyText;
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
