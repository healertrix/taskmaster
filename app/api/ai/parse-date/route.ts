import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getActiveClientForUser } from '@/utils/ai/client';
import { parseDueDate } from '@/utils/parseDueDate';

// POST /api/ai/parse-date - fallback for date phrases the deterministic
// parser (utils/parseDueDate.ts) doesn't recognize. That parser covers the
// common shapes cheaply with no network call; this only runs when it
// returns null, asking the active LLM to normalize the phrase into a
// plain YYYY-MM-DD first, then still running that through parseDueDate
// (which trivially handles that format) rather than trusting the model's
// own date math.
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

    const today = new Date().toISOString().slice(0, 10);

    let normalized: string | null = null;
    try {
      const completion = await activeClient.client.chat.completions.create({
        model: activeClient.model,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Today's date is ${today}. Convert the given phrase into an absolute calendar date. Respond ONLY with JSON {"date": "YYYY-MM-DD"} — or {"date": null} if the phrase genuinely doesn't describe a date. Do not explain, just the JSON.`,
          },
          { role: 'user', content: phrase },
        ],
      });
      const raw = JSON.parse(completion.choices[0]?.message?.content || '{}');
      if (typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)) {
        normalized = raw.date;
      }
    } catch (err) {
      console.error('AI date normalization failed:', err);
    }

    const resolved = normalized ? parseDueDate(normalized) : null;

    if (!resolved) {
      return NextResponse.json(
        { error: 'unresolved', message: `Couldn't figure out a date from "${phrase}".` },
        { status: 400 }
      );
    }

    return NextResponse.json({ date: resolved });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
