import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getActiveClientForUser } from '@/utils/ai/client';
import { resolveDateRangePhrase } from '@/utils/ai/resolveDate';

// POST /api/ai/parse-date - fallback for date phrases the deterministic
// parser (utils/parseDueDate.ts) doesn't recognize, used by the
// post-creation date picker's free-text field. Resolves both ends of a
// range at once ("start today and end in one month") — a phrase naming
// only one end comes back with the other as null. See
// utils/ai/resolveDate.ts for the shared "deterministic parser first, LLM
// normalization as fallback" logic.
//
// Body: { phrase: string }
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
    const phrase: string = body.phrase;

    if (!phrase?.trim()) {
      return NextResponse.json({ error: 'phrase is required' }, { status: 400 });
    }

    const activeClient = await getActiveClientForUser(supabase, user.id);
    if (!activeClient) {
      return NextResponse.json(
        { error: 'no_active_key', message: 'Add an API key in Settings to use AI features.' },
        { status: 400 }
      );
    }

    const resolved = await resolveDateRangePhrase(activeClient.client, phrase);

    if (!resolved.startDate && !resolved.dueDate) {
      return NextResponse.json(
        { error: 'unresolved', message: `Couldn't figure out a date from "${phrase}".` },
        { status: 400 }
      );
    }

    return NextResponse.json(resolved);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
