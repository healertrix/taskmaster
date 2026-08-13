import type { createClient } from '@/utils/supabase/server';

// Shared by app/api/cards/route.ts (POST) and app/api/ai/chat/route.ts —
// extracted so the AI chat route can create a card without either
// duplicating this logic or making an API route call its own HTTP
// endpoint over fetch (which would need to forward auth cookies for no
// real benefit). Behavior is unchanged from the original inline version
// in app/api/cards/route.ts.
export interface CreateCardInput {
  title: string;
  description?: string | null;
  list_id: string;
  board_id: string;
  position?: number;
  due_date?: string | null;
  start_date?: string | null;
}

export type CreateCardResult =
  | { ok: true; card: any }
  | { ok: false; status: number; error: string; details?: string };

export async function createCard(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  input: CreateCardInput
): Promise<CreateCardResult> {
  const { title, description, list_id, board_id, position, due_date, start_date } = input;

  if (!title?.trim()) {
    return { ok: false, status: 400, error: 'Card title is required' };
  }

  if (!list_id) {
    return { ok: false, status: 400, error: 'List ID is required' };
  }

  if (!board_id) {
    return { ok: false, status: 400, error: 'Board ID is required' };
  }

  // Verify the list exists and belongs to the board
  const { data: listData, error: listError } = await supabase
    .from('lists')
    .select('id, board_id')
    .eq('id', list_id)
    .eq('board_id', board_id)
    .single();

  if (listError || !listData) {
    return {
      ok: false,
      status: 404,
      error: 'List not found or does not belong to this board',
    };
  }

  // Get the next position for the card if not provided
  let cardPosition = position;
  if (cardPosition === undefined || cardPosition === null) {
    const { data: positionData } = await supabase
      .from('cards')
      .select('position')
      .eq('list_id', list_id)
      .order('position', { ascending: false })
      .limit(1)
      .single();

    cardPosition = (positionData?.position || 0) + 1;
  }

  // Claim this card's display number — atomic, per-board counter (see
  // supabase/supabase/migrations/20260807120000_add_scoped_display_numbers.sql).
  const { data: cardNumber, error: numberError } = await supabase.rpc(
    'next_card_number',
    { p_board_id: board_id }
  );

  if (numberError || cardNumber == null) {
    console.error('Card number assignment error:', numberError);
    return { ok: false, status: 500, error: 'Failed to assign card number' };
  }

  // Create the card
  const { data: cardData, error: cardError } = await supabase
    .from('cards')
    .insert({
      title: title.trim(),
      description: description?.trim() || null,
      list_id,
      board_id,
      position: cardPosition,
      created_by: userId,
      number: cardNumber,
      due_date: due_date || null,
      start_date: start_date || null,
    })
    .select('*')
    .single();

  if (cardError) {
    console.error('Card creation error:', cardError);

    if (cardError.code === '42501') {
      return {
        ok: false,
        status: 403,
        error:
          'Permission denied: You are not authorized to create cards on this board',
        details: 'Make sure you are a member of this board',
      };
    }

    return {
      ok: false,
      status: 500,
      error: 'Failed to create card',
      details: cardError.message,
    };
  }

  return { ok: true, card: cardData };
}
