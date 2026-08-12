'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GitCommitHorizontal,
  GitPullRequest,
  GitMerge,
  GitPullRequestClosed,
  Search,
  X,
} from 'lucide-react';

interface GithubLink {
  id: string;
  link_type: 'commit' | 'pull_request';
  external_id: string;
  url: string;
  title: string | null;
  author_login: string | null;
  author_avatar_url: string | null;
  status: string | null;
  created_at: string;
  github_repos: { full_name: string } | null;
}

const PAGE_SIZE = 5;
// The scroll window is sized to exactly PAGE_SIZE rows — anything beyond
// that scrolls, triggering infinite-scroll pagination (see the sentinel
// below) rather than growing the card modal itself.
const SCROLL_WINDOW_HEIGHT = '19rem';

// Live-updates while the card modal is open, no manual refresh control —
// polls the first page on the same cadence as the notification bell
// (hooks/... — 45s) and silently prepends anything not already in the
// list. Existing rows (including ones loaded further down via
// infinite-scroll) never move or flash; this is meant to be invisible
// unless something genuinely new shows up.
const POLL_INTERVAL_MS = 45_000;

// Read-only summary of commits/PRs that mention this card (e.g. "#3-12")
// on GitHub — see app/api/github/webhook/route.ts for how these get
// created, and app/api/cards/[id]/github-links/route.ts for this fetch.
// Deliberately just links out to GitHub rather than mirroring PR
// conversation content — see the design conversation for why.
export function CardDevelopmentPanel({ cardId }: { cardId: string }) {
  const [links, setLinks] = useState<GithubLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  // null = "don't know yet, first fetch hasn't resolved" — keeps the whole
  // section hidden without briefly flashing "no activity" before the
  // first response comes back.
  const [hasAnyLinks, setHasAnyLinks] = useState<boolean | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  // Mirrors `links` for the poll tick's dedupe check without making that
  // effect depend on (and re-run/re-schedule for) every links change.
  const linksRef = useRef<GithubLink[]>([]);
  linksRef.current = links;

  const fetchPage = useCallback(
    async (opts: { offset: number; mode: 'reset' | 'append' | 'poll' }) => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(opts.offset),
      });
      if (search.trim()) params.set('search', search.trim());

      try {
        const res = await fetch(`/api/cards/${cardId}/github-links?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        const fresh: GithubLink[] = data.links || [];

        if (opts.mode === 'reset') {
          setLinks(fresh);
          // Only an unfiltered fetch tells us the true "does this card have
          // any GitHub activity at all" — a search-triggered reset's
          // `fresh` is filtered, so a zero-match search must not flip this
          // to false.
          if (!search.trim()) setHasAnyLinks(fresh.length > 0);
        } else if (opts.mode === 'append') {
          setLinks((prev) => [...prev, ...fresh]);
        } else {
          // poll: silently prepend anything not already present, leave
          // everything else exactly where it is.
          const existingIds = new Set(linksRef.current.map((l) => l.id));
          const newOnes = fresh.filter((l) => !existingIds.has(l.id));
          if (newOnes.length > 0) {
            setLinks((prev) => [...newOnes, ...prev]);
            setHasAnyLinks(true);
          }
        }
        setHasMore(fresh.length === PAGE_SIZE);
      } catch (error) {
        console.error('Error fetching GitHub links:', error);
      }
    },
    [cardId, search]
  );

  // Initial load + reload whenever the search term changes.
  useEffect(() => {
    setIsLoading(true);
    fetchPage({ offset: 0, mode: 'reset' }).finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, search]);

  // Debounce the search input into `search` (which the effect above reacts
  // to) — same 300ms convention used elsewhere in this app (e.g. the
  // profile Activity feed's search).
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(value), 300);
  };

  // Background poll — keeps running even while the section is visually
  // hidden (hasAnyLinks === false), so a card with no GitHub activity yet
  // can still come alive the moment its first commit/PR lands, without
  // needing to close and reopen the card.
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPage({ offset: 0, mode: 'poll' });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchPage]);

  // Infinite scroll — the sentinel sits at the bottom of the fixed-height
  // scroll window itself (root), not the page viewport, since this list
  // scrolls independently of the card modal.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollContainerRef.current;
    if (!sentinel || !root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          setIsLoadingMore(true);
          fetchPage({ offset: links.length, mode: 'append' }).finally(() =>
            setIsLoadingMore(false)
          );
        }
      },
      { root, rootMargin: '100px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isLoading, links.length, fetchPage]);

  // Hidden entirely until we know there's at least one link, ever — same
  // "don't clutter every card with an empty section" behavior as before,
  // just now poll-aware instead of a one-shot check. `hasAnyLinks === null`
  // means the very first fetch hasn't resolved yet — render nothing rather
  // than flash the empty state before we know either way.
  if (hasAnyLinks === null || (hasAnyLinks === false && !search)) return null;

  const icon = (link: GithubLink) => {
    if (link.link_type === 'commit') return GitCommitHorizontal;
    if (link.status === 'merged') return GitMerge;
    if (link.status === 'closed') return GitPullRequestClosed;
    return GitPullRequest;
  };

  const iconColor = (link: GithubLink) => {
    if (link.link_type === 'commit') return 'text-muted-foreground';
    if (link.status === 'merged') return 'text-purple-500';
    if (link.status === 'closed') return 'text-destructive';
    return 'text-success';
  };

  return (
    <div className='mb-6'>
      <div className='flex items-center justify-between gap-2 mb-3'>
        <div className='flex items-center gap-2'>
          <GitPullRequest className='w-4 h-4 text-muted-foreground' />
          <h3 className='text-sm font-medium text-foreground'>Development</h3>
        </div>
        <div className='relative w-40'>
          <Search className='absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none' />
          <input
            type='text'
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder='Search...'
            className='w-full pl-6 pr-6 py-1 text-xs bg-muted/40 border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all'
          />
          {searchInput && (
            <button
              onClick={() => handleSearchChange('')}
              className='absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
              aria-label='Clear search'
            >
              <X className='w-3 h-3' />
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className='space-y-2 py-1'>
          {[0, 1, 2].map((i) => (
            <div key={i} className='h-9 bg-muted/40 rounded-lg animate-pulse' />
          ))}
        </div>
      ) : links.length === 0 ? (
        <div className='py-6 text-center text-xs text-muted-foreground'>
          No matches for "{search}"
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          className='space-y-1.5 overflow-y-auto pr-0.5'
          style={{ maxHeight: SCROLL_WINDOW_HEIGHT }}
        >
          {links.map((link) => {
            const Icon = icon(link);
            return (
              <a
                key={link.id}
                href={link.url}
                target='_blank'
                rel='noopener noreferrer'
                className='flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-border/50 hover:bg-muted/40 hover:border-primary/40 transition-colors group'
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${iconColor(link)}`} />
                <div className='flex-1 min-w-0'>
                  <p className='text-sm text-foreground truncate group-hover:text-primary transition-colors'>
                    {link.title ||
                      (link.link_type === 'commit'
                        ? link.external_id.slice(0, 7)
                        : `PR #${link.external_id}`)}
                  </p>
                  <p className='text-xs text-muted-foreground truncate'>
                    {link.github_repos?.full_name}
                    {link.link_type === 'commit' && ` · ${link.external_id.slice(0, 7)}`}
                    {link.link_type === 'pull_request' && ` · #${link.external_id}`}
                    {link.author_login && ` · ${link.author_login}`}
                  </p>
                </div>
                {link.status && (
                  <span
                    className={`flex-shrink-0 text-[10px] font-medium uppercase px-1.5 py-0.5 rounded-full ${
                      link.status === 'merged'
                        ? 'bg-purple-500/10 text-purple-500'
                        : link.status === 'closed'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-success/10 text-success'
                    }`}
                  >
                    {link.status}
                  </span>
                )}
              </a>
            );
          })}

          {hasMore && (
            <div ref={sentinelRef} className='py-2 text-center'>
              {isLoadingMore && (
                <div className='h-9 bg-muted/40 rounded-lg animate-pulse' />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
