import type OpenAI from 'openai';
import { parseDueDate } from '@/utils/parseDueDate';

// Shared by app/api/ai/chat/skeleton/route.ts (resolving a date phrase
// mentioned during task drafting) and app/api/ai/parse-date/route.ts
// (resolving one typed directly into the post-creation date picker) — one
// place for "try the cheap deterministic parser first, ask the LLM to
// normalize it only if that fails" instead of the skeleton flow only ever
// getting the deterministic pass and silently giving up on phrasings like
// "next week" or "the end of the month" that parseDueDate doesn't cover.
export async function resolveDueDatePhrase(
  client: OpenAI,
  model: string,
  phrase: string
): Promise<string | null> {
  const direct = parseDueDate(phrase);
  if (direct) return direct;

  const today = new Date().toISOString().slice(0, 10);
  try {
    const completion = await client.chat.completions.create({
      model,
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
      // Still routed through parseDueDate — trivial for it to handle a
      // plain YYYY-MM-DD, and keeps date math in one place rather than
      // trusting the model's own arithmetic.
      return parseDueDate(raw.date);
    }
  } catch (err) {
    console.error('AI date normalization failed:', err);
  }

  return null;
}
