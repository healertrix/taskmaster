import type { AiClient } from '@/utils/ai/client';
import { parseDueDate, parseDateRange } from '@/utils/parseDueDate';

// Shared by app/api/ai/chat/skeleton/route.ts (resolving a date phrase
// mentioned during task drafting) and app/api/ai/parse-date/route.ts
// (resolving one typed directly into the post-creation date picker) — one
// place for "try the cheap deterministic parser first, ask the LLM to
// normalize it only if that fails" instead of the skeleton flow only ever
// getting the deterministic pass and silently giving up on phrasings like
// "next week" or "the end of the month" that parseDueDate doesn't cover.
export async function resolveDueDatePhrase(
  client: AiClient,
  phrase: string
): Promise<string | null> {
  const direct = parseDueDate(phrase);
  if (direct) return direct;

  const today = new Date().toISOString().slice(0, 10);
  try {
    const content = await client.completeJson([
      {
        role: 'system',
        content: `Today's date is ${today}. Convert the given phrase into an absolute calendar date. Respond ONLY with JSON {"date": "YYYY-MM-DD"} — or {"date": null} if the phrase genuinely doesn't describe a date. Do not explain, just the JSON.`,
      },
      { role: 'user', content: phrase },
    ]);
    const raw = JSON.parse(content || '{}');
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

// Same idea as resolveDueDatePhrase, but for phrases naming both ends of a
// range ("start today and end in one month") — used by the post-creation
// date picker's free-text field. Tries the deterministic parser first;
// only asks the LLM when it found neither date.
export async function resolveDateRangePhrase(
  client: AiClient,
  phrase: string
): Promise<{ startDate: string | null; dueDate: string | null }> {
  const direct = parseDateRange(phrase);
  if (direct.startDate || direct.dueDate) return direct;

  const today = new Date().toISOString().slice(0, 10);
  try {
    const content = await client.completeJson([
      {
        role: 'system',
        content: `Today's date is ${today}. The phrase may describe a start date, a due/end date, or both. Respond ONLY with JSON {"startDate": "YYYY-MM-DD" | null, "dueDate": "YYYY-MM-DD" | null} — null for whichever end isn't mentioned. Do not explain, just the JSON.`,
      },
      { role: 'user', content: phrase },
    ]);
    const raw = JSON.parse(content || '{}');
    const startDate =
      typeof raw.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.startDate)
        ? parseDueDate(raw.startDate)
        : null;
    const dueDate =
      typeof raw.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.dueDate)
        ? parseDueDate(raw.dueDate)
        : null;
    return { startDate, dueDate };
  } catch (err) {
    console.error('AI date range normalization failed:', err);
  }

  return { startDate: null, dueDate: null };
}

// Resolves two already-separated phrases (the skeleton endpoint's
// start_date_phrase/due_date_phrase, extracted independently by the LLM)
// with at most ONE extra LLM call total, not one per phrase — two
// separate resolveDueDatePhrase calls would each fall back to their own
// LLM request when the deterministic parser misses, doubling the number
// of round trips a single "Create task" click makes and made it
// noticeably more likely to hit the request timeout. Whatever the
// deterministic parser already handles doesn't need the LLM at all.
export async function resolveTwoDatePhrases(
  client: AiClient,
  startPhrase: string,
  duePhrase: string
): Promise<{ startDate: string | null; dueDate: string | null }> {
  const directStart = startPhrase ? parseDueDate(startPhrase) : null;
  const directDue = duePhrase ? parseDueDate(duePhrase) : null;

  const needsStart = !!startPhrase && !directStart;
  const needsDue = !!duePhrase && !directDue;

  if (!needsStart && !needsDue) {
    return { startDate: directStart, dueDate: directDue };
  }

  const today = new Date().toISOString().slice(0, 10);
  try {
    const parts: string[] = [];
    if (needsStart) parts.push(`start phrase: "${startPhrase}"`);
    if (needsDue) parts.push(`due phrase: "${duePhrase}"`);

    const content = await client.completeJson([
      {
        role: 'system',
        content: `Today's date is ${today}. Convert the given phrase(s) into absolute calendar dates. Respond ONLY with JSON {"startDate": "YYYY-MM-DD" | null, "dueDate": "YYYY-MM-DD" | null} — null for whichever phrase wasn't given. Do not explain, just the JSON.`,
      },
      { role: 'user', content: parts.join('\n') },
    ]);
    const raw = JSON.parse(content || '{}');
    const startDate =
      needsStart && typeof raw.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.startDate)
        ? parseDueDate(raw.startDate)
        : directStart;
    const dueDate =
      needsDue && typeof raw.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.dueDate)
        ? parseDueDate(raw.dueDate)
        : directDue;
    return { startDate, dueDate };
  } catch (err) {
    console.error('AI dual date normalization failed:', err);
  }

  return { startDate: directStart, dueDate: directDue };
}
