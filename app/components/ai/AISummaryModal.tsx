'use client';

import { useEffect, useState } from 'react';
import {
  Loader2,
  Sparkles,
  X,
  RotateCcw,
  LayoutGrid,
  MessageSquare,
  CheckSquare,
  Tag,
  Users,
  CalendarClock,
  Paperclip,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import {
  SUMMARY_CATEGORIES,
  type ActivityStats,
  type SummaryCategory,
  type SummaryHighlight,
} from '@/utils/ai/activitySummary';

interface AISummaryModalProps {
  scope: 'board' | 'workspace';
  id: string;
  label: string; // board or workspace name, for the modal title
  onClose: () => void;
}

const REQUEST_TIMEOUT_MS = 25_000;

// One icon + color per category, so each kind of activity reads visually
// distinct at a glance instead of every line looking the same — this is
// the "little design" the flat bullet-list version was missing. Colors
// echo the app's existing rotating list-dot palette (Indigo/Teal/Rose/
// Amber/Slate) plus two more for the categories that palette doesn't cover.
// Classes are written out in full (not built via string interpolation) so
// Tailwind's content scanner actually picks them up at build time.
const CATEGORY_META: Record<SummaryCategory, { icon: LucideIcon; chipClasses: string; label: string }> = {
  cards: { icon: LayoutGrid, chipClasses: 'bg-indigo-500/15 text-indigo-400', label: 'cards' },
  comments: { icon: MessageSquare, chipClasses: 'bg-teal-500/15 text-teal-400', label: 'comments' },
  checklists: { icon: CheckSquare, chipClasses: 'bg-emerald-500/15 text-emerald-400', label: 'checklists' },
  labels: { icon: Tag, chipClasses: 'bg-rose-500/15 text-rose-400', label: 'labels' },
  members: { icon: Users, chipClasses: 'bg-amber-500/15 text-amber-400', label: 'members' },
  dates: { icon: CalendarClock, chipClasses: 'bg-sky-500/15 text-sky-400', label: 'dates' },
  attachments: { icon: Paperclip, chipClasses: 'bg-slate-500/15 text-slate-400', label: 'attachments' },
};

// Ephemeral, on-demand summary modal shared by the board and workspace
// headers — no caching, regenerates fresh on every open/Regenerate click.
// The result is a warm headline plus a short, category-tagged highlight
// list (see utils/ai/activitySummary.ts) — not a free-text paragraph
// (read differently every time, nobody read it end to end) and not an
// undifferentiated bullet dump either.
export function AISummaryModal({ scope, id, label, onClose }: AISummaryModalProps) {
  const [headline, setHeadline] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<SummaryHighlight[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noKey, setNoKey] = useState(false);

  const generate = () => {
    setIsLoading(true);
    setError(null);
    setNoKey(false);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    fetch(`/api/ai/summarize/${scope}/${id}`, { method: 'POST', signal: controller.signal })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (data.error === 'no_active_key') {
            setNoKey(true);
            return;
          }
          throw new Error(data.error || `Request failed with ${res.status}`);
        }
        setHeadline(data.headline || null);
        setHighlights(data.highlights || []);
        setStats(data.stats || null);
      })
      .catch((err) => {
        console.error('Error generating AI summary:', err);
        setError(
          err?.name === 'AbortError'
            ? 'Timed out — the request took too long.'
            : "Couldn't generate a summary."
        );
      })
      .finally(() => {
        clearTimeout(timer);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, id]);

  return (
    <div
      className='fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 animate-in fade-in-50 duration-200'
      onClick={onClose}
    >
      <div
        className='w-full max-w-xl bg-popover text-popover-foreground border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='flex items-center justify-between px-5 py-4 border-b border-border'>
          <div>
            <h3 className='text-sm font-semibold flex items-center gap-2'>
              <Sparkles className='w-4 h-4 text-primary' />
              {label}
            </h3>
            <p className='text-xs text-muted-foreground mt-0.5'>Last 7 days of activity</p>
          </div>
          <button
            onClick={onClose}
            className='p-1 -m-1 text-muted-foreground hover:text-foreground transition-colors'
            aria-label='Close'
          >
            <X className='w-4 h-4' />
          </button>
        </div>

        <div className='p-5 min-h-[10rem] max-h-[34rem] overflow-y-auto'>
          {isLoading ? (
            <div className='flex justify-center py-10'>
              <Loader2 className='w-5 h-5 animate-spin text-muted-foreground' />
            </div>
          ) : noKey ? (
            <p className='text-sm text-muted-foreground text-center py-6'>
              Add an OpenAI or DeepSeek API key in{' '}
              <Link href='/settings' onClick={onClose} className='text-primary hover:text-primary/80'>
                Settings
              </Link>{' '}
              to use AI features.
            </p>
          ) : error ? (
            <div className='flex flex-col items-center gap-2 py-6 text-center'>
              <p className='text-sm text-muted-foreground'>{error}</p>
              <button
                onClick={generate}
                className='flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors'
              >
                <RotateCcw className='w-3 h-3' /> Try again
              </button>
            </div>
          ) : (
            <div className='space-y-4'>
              {headline && (
                <p className='text-sm font-medium text-foreground leading-relaxed'>{headline}</p>
              )}

              {stats && stats.totalEvents > 0 && (
                <div className='flex flex-wrap gap-1.5'>
                  {SUMMARY_CATEGORIES.filter((c) => stats.counts[c] > 0).map((c) => {
                    const meta = CATEGORY_META[c];
                    const Icon = meta.icon;
                    return (
                      <span
                        key={c}
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${meta.chipClasses}`}
                      >
                        <Icon className='w-3 h-3' />
                        {stats.counts[c]} {meta.label}
                      </span>
                    );
                  })}
                  {stats.activeMembers > 0 && (
                    <span className='inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full bg-muted/60 text-muted-foreground'>
                      {stats.activeMembers} {stats.activeMembers === 1 ? 'person' : 'people'} active
                    </span>
                  )}
                </div>
              )}

              {highlights.length > 0 && (
                <ul className='space-y-2.5'>
                  {highlights.map((item, i) => {
                    const meta = CATEGORY_META[item.category];
                    const Icon = meta?.icon || Sparkles;
                    const chipClasses = meta?.chipClasses || 'bg-indigo-500/15 text-indigo-400';
                    return (
                      <li
                        key={i}
                        className='flex items-start gap-3 bg-muted/30 border border-border/40 rounded-xl px-3 py-2.5'
                      >
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${chipClasses}`}
                        >
                          <Icon className='w-3.5 h-3.5' />
                        </span>
                        <span className='text-sm text-foreground leading-relaxed pt-0.5'>
                          {item.text}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        {!isLoading && !noKey && (
          <div className='px-5 py-3 border-t border-border flex justify-end'>
            <button
              onClick={generate}
              className='flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors'
            >
              <RotateCcw className='w-3 h-3' /> Regenerate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
