'use client';

import { useEffect, useState } from 'react';
import { GitCommitHorizontal, GitPullRequest, GitMerge, GitPullRequestClosed } from 'lucide-react';

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

// Read-only summary of commits/PRs that mention this card (e.g. "#3-12")
// on GitHub — see app/api/github/webhook/route.ts for how these get
// created, and app/api/cards/[id]/github-links/route.ts for this fetch.
// Deliberately just links out to GitHub rather than mirroring PR
// conversation content — see the design conversation for why.
export function CardDevelopmentPanel({ cardId }: { cardId: string }) {
  const [links, setLinks] = useState<GithubLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetch(`/api/cards/${cardId}/github-links`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (!cancelled) setLinks(data.links || []);
      })
      .catch((error) => console.error('Error fetching GitHub links:', error))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cardId]);

  // Nothing to show and nothing loading — this card has no GitHub
  // activity, so the section just doesn't render at all rather than
  // permanently taking up space on every card.
  if (!isLoading && links.length === 0) return null;

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
      <div className='flex items-center gap-2 mb-4'>
        <GitPullRequest className='w-4 h-4 text-muted-foreground' />
        <h3 className='text-sm font-medium text-foreground'>Development</h3>
      </div>

      {isLoading ? (
        <div className='space-y-2 py-1'>
          {[0, 1].map((i) => (
            <div key={i} className='h-9 bg-muted/40 rounded-lg animate-pulse' />
          ))}
        </div>
      ) : (
        <div className='space-y-1.5'>
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
        </div>
      )}
    </div>
  );
}
