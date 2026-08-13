import { addDays, addWeeks, addMonths, isBefore, isValid, startOfDay } from 'date-fns';

// Pragmatic natural-language date parsing for phrases like "6th oct",
// "30 days from now", "next monday" — not a full NLP date library, just
// the shapes this app's AI task-creation flow actually needs to support.
// Pure date-fns logic, no server-only imports — safe to use from both
// client components and API routes.
const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

function monthIndex(name: string): number {
  const n = name.toLowerCase();
  return MONTH_NAMES.findIndex((m) => m.startsWith(n) && n.length >= 3);
}

// If no year was given and the resulting date has already passed this
// year, roll over to next year — "6th oct" said in November means next
// October, not a date in the past.
function resolveYear(day: number, month: number, explicitYear: number | undefined, today: Date): Date {
  const year = explicitYear ?? today.getFullYear();
  let candidate = new Date(year, month, day);
  if (!explicitYear && isBefore(candidate, today)) {
    candidate = new Date(year + 1, month, day);
  }
  return candidate;
}

export function parseDueDate(phrase: string, now: Date = new Date()): string | null {
  if (!phrase?.trim()) return null;
  const today = startOfDay(now);

  // Real phrases (typed by a user, or extracted by the LLM) rarely arrive
  // as the bare, clean shapes the patterns below expect — strip the filler
  // words and trailing punctuation that would otherwise make an otherwise-
  // matchable phrase like "due by 10 days from now." fail outright.
  const p = phrase
    .trim()
    .toLowerCase()
    .replace(/^(due\s+|by\s+|on\s+|before\s+)+/, '')
    .replace(/[.!?,;]+$/, '')
    .trim();

  if (p === 'today') return today.toISOString();
  if (p === 'tomorrow') return addDays(today, 1).toISOString();
  if (p === 'next week') return addWeeks(today, 1).toISOString();
  if (p === 'next month') return addMonths(today, 1).toISOString();

  // "in N days/weeks/months", "N days/weeks/months from now", or the same
  // with a word standing in for the number ("a week from now", "in one
  // month", "in two weeks").
  let m = p.match(/^(?:in\s+)?(\d+|[a-z]+)\s*(day|week|month)s?(?:\s+from\s+now)?$/);
  if (m) {
    const n = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : WORD_NUMBERS[m[1]];
    if (n === undefined) return null;
    const unit = m[2];
    if (unit === 'day') return addDays(today, n).toISOString();
    if (unit === 'week') return addWeeks(today, n).toISOString();
    if (unit === 'month') return addMonths(today, n).toISOString();
  }

  // "next <weekday>"
  m = p.match(/^next\s+([a-z]+)$/);
  if (m) {
    const targetDay = WEEKDAYS.indexOf(m[1]);
    if (targetDay !== -1) {
      let d = addDays(today, 1);
      while (d.getDay() !== targetDay) d = addDays(d, 1);
      return d.toISOString();
    }
  }

  // "<day>[st/nd/rd/th] <month>[ <year>]" e.g. "6th oct", "6 october 2027"
  m = p.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{4}))?$/);
  if (m) {
    const day = parseInt(m[1], 10);
    const mi = monthIndex(m[2]);
    if (mi !== -1 && day >= 1 && day <= 31) {
      const candidate = resolveYear(day, mi, m[3] ? parseInt(m[3], 10) : undefined, today);
      if (isValid(candidate)) return candidate.toISOString();
    }
  }

  // "<month> <day>[ <year>]" e.g. "oct 6", "october 6th 2027"
  m = p.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?$/);
  if (m) {
    const mi = monthIndex(m[1]);
    const day = parseInt(m[2], 10);
    if (mi !== -1 && day >= 1 && day <= 31) {
      const candidate = resolveYear(day, mi, m[3] ? parseInt(m[3], 10) : undefined, today);
      if (isValid(candidate)) return candidate.toISOString();
    }
  }

  // Plain yyyy-mm-dd fallback
  m = p.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const candidate = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    if (isValid(candidate)) return candidate.toISOString();
  }

  return null;
}

const START_KEYWORDS = /\b(start(?:s|ing)?|begin(?:s|ning)?|from)\b/i;
const DUE_KEYWORDS = /\b(due|end(?:s|ing)?|by|until|deadline)\b/i;
// Matches whichever of the two keyword groups comes first, so a phrase
// can be split at each one in turn.
const RANGE_KEYWORD_RE = new RegExp(
  `${START_KEYWORDS.source}|${DUE_KEYWORDS.source}`,
  'gi'
);

// "start today and end in one month", "from tomorrow until next friday",
// "starting the 6th oct, due 20th oct" — a single phrase naming both ends
// of a range. Splits the phrase at each start/due keyword and parses the
// text between them independently; a phrase with only one recognized
// keyword (or none) resolves to just that one date, same as parseDueDate.
export function parseDateRange(
  phrase: string,
  now: Date = new Date()
): { startDate: string | null; dueDate: string | null } {
  const trimmed = phrase?.trim();
  if (!trimmed) return { startDate: null, dueDate: null };

  const matches = [...trimmed.matchAll(RANGE_KEYWORD_RE)];
  if (matches.length < 2) {
    // Nothing (or only one keyword) to split on — a start-only phrase
    // ("starting next monday") resolves as a start date; everything else,
    // including plain phrases with no keyword at all, resolves as a due
    // date (parseDueDate's existing behavior).
    const isStartOnly = START_KEYWORDS.test(trimmed) && !DUE_KEYWORDS.test(trimmed);
    const date = parseDueDate(trimmed, now);
    return isStartOnly ? { startDate: date, dueDate: null } : { startDate: null, dueDate: date };
  }

  let startDate: string | null = null;
  let dueDate: string | null = null;

  for (let i = 0; i < matches.length; i++) {
    const isStart = START_KEYWORDS.test(matches[i][0]);
    const segStart = (matches[i].index ?? 0) + matches[i][0].length;
    const segEnd = i + 1 < matches.length ? matches[i + 1].index ?? trimmed.length : trimmed.length;
    const segment = trimmed
      .slice(segStart, segEnd)
      .replace(/^\s*(?:and|,|;|:)+\s*/i, '')
      .replace(/\s*(?:and|,|;)+\s*$/i, '')
      .trim();
    if (!segment) continue;
    const date = parseDueDate(segment, now);
    if (!date) continue;
    if (isStart && !startDate) startDate = date;
    if (!isStart && !dueDate) dueDate = date;
  }

  return { startDate, dueDate };
}
