import type { createClient } from '@/utils/supabase/server';
import type { AiClient } from '@/utils/ai/client';

const LOOKBACK_DAYS = 7;
// Cap even within the lookback window — a very active board could have
// hundreds of rows in 7 days, which bloats the prompt for little benefit
// (see plan discussion: 100 is generous headroom for this app's actual
// scale of solo founders/small teams, without feeding the LLM a wall of
// low-signal rows).
const ROW_LIMIT = 100;

// The fixed set of categories both a highlight and a raw action_type can
// be tagged with — a closed enum (not free text) so the UI can reliably
// map each one to its own icon/color, and so the stats row below can be
// computed deterministically from the same taxonomy the LLM highlights
// use. See AISummaryModal for the icon/color mapping.
export const SUMMARY_CATEGORIES = [
  'cards',
  'comments',
  'checklists',
  'labels',
  'members',
  'dates',
  'attachments',
] as const;
export type SummaryCategory = (typeof SUMMARY_CATEGORIES)[number];

const ACTION_LABELS: Record<string, string> = {
  card_created: 'created card',
  card_updated: 'updated card',
  card_moved: 'moved card',
  comment_added: 'commented on',
  label_added: 'added a label to',
  label_removed: 'removed a label from',
  member_added: 'added a member to',
  member_removed: 'removed a member from',
  attachment_added: 'added an attachment to',
  attachment_removed: 'removed an attachment from',
  checklist_added: 'added a checklist to',
  checklist_updated: 'updated a checklist on',
  checklist_removed: 'removed a checklist from',
  due_date_set: 'set a due date on',
  due_date_removed: 'removed the due date from',
  start_date_set: 'set a start date on',
  start_date_removed: 'removed the start date from',
  timeline_updated: 'updated the timeline on',
};

const ACTION_CATEGORY: Record<string, SummaryCategory> = {
  card_created: 'cards',
  card_updated: 'cards',
  card_moved: 'cards',
  comment_added: 'comments',
  label_added: 'labels',
  label_removed: 'labels',
  member_added: 'members',
  member_removed: 'members',
  attachment_added: 'attachments',
  attachment_removed: 'attachments',
  checklist_added: 'checklists',
  checklist_updated: 'checklists',
  checklist_removed: 'checklists',
  due_date_set: 'dates',
  due_date_removed: 'dates',
  start_date_set: 'dates',
  start_date_removed: 'dates',
  timeline_updated: 'dates',
};

const timeAgo = (iso: string) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

// Computed directly from the raw activity rows, not the LLM — a count row
// should always be exactly right, never an approximation the model made up.
export interface ActivityStats {
  counts: Record<SummaryCategory, number>;
  activeMembers: number;
  totalEvents: number;
}

export interface RecentActivity {
  lines: string[];
  stats: ActivityStats;
}

// Fetches the last 7 days of activity (capped at ROW_LIMIT most recent
// rows) for one or more boards, both as plain-English lines for the LLM
// prompt and as deterministic stats for the summary's stats row. Used for
// both the board-scoped and workspace-scoped ("all its boards") summary —
// when more than one board is in scope, each line names its board so the
// model (and a human skimming the raw lines) can tell them apart.
export async function fetchRecentActivity(
  supabase: ReturnType<typeof createClient>,
  boardIds: string[]
): Promise<RecentActivity> {
  const emptyStats: ActivityStats = {
    counts: Object.fromEntries(SUMMARY_CATEGORIES.map((c) => [c, 0])) as Record<SummaryCategory, number>,
    activeMembers: 0,
    totalEvents: 0,
  };

  if (boardIds.length === 0) return { lines: [], stats: emptyStats };

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const includeBoardName = boardIds.length > 1;

  const { data, error } = await supabase
    .from('activities')
    .select(
      `
      action_type,
      created_at,
      profile_id,
      profiles:profile_id(full_name, email),
      cards:card_id(title),
      boards:board_id(name)
    `
    )
    .in('board_id', boardIds)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(ROW_LIMIT);

  if (error || !data) {
    console.error('Error fetching activities for summary:', error);
    return { lines: [], stats: emptyStats };
  }

  const counts = { ...emptyStats.counts };
  const actors = new Set<string>();

  const lines = data.map((row: any) => {
    const actor = row.profiles?.full_name || row.profiles?.email || 'Someone';
    const label = ACTION_LABELS[row.action_type] || row.action_type;
    const target = row.cards?.title ? ` "${row.cards.title}"` : '';
    const board = includeBoardName && row.boards?.name ? ` on board "${row.boards.name}"` : '';

    if (row.profile_id) actors.add(row.profile_id);
    const category = ACTION_CATEGORY[row.action_type];
    if (category) counts[category] += 1;

    return `${actor} ${label}${target}${board}, ${timeAgo(row.created_at)}`;
  });

  return {
    lines,
    stats: { counts, activeMembers: actors.size, totalEvents: data.length },
  };
}

export interface SummaryHighlight {
  category: SummaryCategory;
  text: string;
}

// A headline (the "cheerful, insight" framing) plus a longer, still-scannable
// list of highlights each tagged with a category — this is what lets the UI
// draw a small designed insight view (stats row + colored icon per category)
// instead of either a wall of prose or a too-short bullet dump that leaves
// things out.
export interface ActivitySummaryResult {
  headline: string;
  highlights: SummaryHighlight[];
}

const SYSTEM_PROMPT = `You turn a raw project-activity log into a short, warm status update — the kind a supportive teammate would give, not a dry system log.

Respond ONLY with JSON of this exact shape: {"headline": string, "highlights": [{"category": string, "text": string}]}. No other keys, no prose outside the JSON.

"headline": one upbeat, specific sentence (max 22 words) capturing the overall shape of the period — energy/momentum, not a generic "here is your summary" line. Ground it in what actually happened; don't invent enthusiasm the data doesn't support (a quiet period gets an honest, still-friendly line, not fake excitement).

"highlights": as many entries as the activity actually supports, up to 12 — don't leave real, distinct things out just to keep the list short, but don't pad it with filler either. Each entry:
- "category" must be exactly one of: cards, comments, checklists, labels, members, dates, attachments — pick whichever the item is mostly about. Only include categories that actually had activity.
- "text" is one specific, plain-text sentence (max 24 words, no markdown) naming who did what, using only names/titles present in the input — never invent people, cards, or details.
- You may group a few closely related events into one entry (e.g. "Priya moved 3 cards into Done"), but keep it specific — if there's room, name the cards/people involved rather than just a count. Don't over-group distinct pieces of work into one vague line just to shorten the list.
- Order by importance/recency, most notable first.`;

export async function summarizeActivity(
  client: AiClient,
  scopeLabel: string,
  lines: string[]
): Promise<ActivitySummaryResult> {
  if (lines.length === 0) {
    return {
      headline: `It's been quiet on ${scopeLabel} this week — nothing logged in the last 7 days.`,
      highlights: [],
    };
  }

  try {
    const content = await client.completeJson([
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Recent activity on "${scopeLabel}" (last 7 days, most recent first):\n${lines.join('\n')}`,
      },
    ]);

    const parsed = JSON.parse(content || '{}');
    const highlights: SummaryHighlight[] = Array.isArray(parsed.highlights)
      ? parsed.highlights
          .filter(
            (h: any) =>
              h &&
              typeof h.text === 'string' &&
              h.text.trim() &&
              SUMMARY_CATEGORIES.includes(h.category)
          )
          .map((h: any) => ({ category: h.category as SummaryCategory, text: h.text.trim() }))
      : [];

    return {
      headline:
        typeof parsed.headline === 'string' && parsed.headline.trim()
          ? parsed.headline.trim()
          : `Here's what happened on ${scopeLabel} this week.`,
      highlights,
    };
  } catch (err) {
    console.error('Error generating structured activity summary:', err);
    return { headline: 'Could not generate a summary — try again.', highlights: [] };
  }
}
