'use client';

import { useState } from 'react';
import { X, Copy, Check, Github, Link2, GitMerge, Bot } from 'lucide-react';

// The exact convention the webhook parser expects — see
// utils/github/parseReferences.ts. Kept here as one literal string (not
// reconstructed from pieces) so what a developer copies is guaranteed to
// exactly match what the parser accepts.
const AGENT_SNIPPET = `This repository is connected to Taskmaster's GitHub integration. When working here:

- Every card in Taskmaster has an id shown as "#board-card" (e.g. #3-12). Include that id in a commit message, PR title, PR description, or PR comment to automatically link that commit/PR to the card.
- To move the card to the board's Done list when the PR merges, write "Closes #3-12" (or "Fixes"/"Resolves", case-insensitive) in the PR title or description — NOT in a comment, and NOT in a plain commit pushed without a PR. Only an actual merged PR triggers the move.
- To move it to a specific list instead of the default Done list, add an arrow with the list name in quotes: Closes #3-12 -> "QA"
- A PR/commit can reference multiple cards — just include each #board-card id.

Example commit message:
Fix null pointer in checkout flow (#3-12)

Example PR description:
This PR fixes the checkout crash reported in testing.

Closes #3-12`;

function InfoRow({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Link2;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className='flex items-start gap-3 p-3 rounded-lg border border-border/50'>
      <div className='w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0'>
        <Icon className='w-4 h-4 text-muted-foreground' />
      </div>
      <div className='min-w-0 flex-1'>
        <div className='text-sm font-medium text-foreground mb-1'>{title}</div>
        <div className='text-xs text-muted-foreground leading-relaxed space-y-1'>
          {children}
        </div>
      </div>
    </div>
  );
}

export function GithubHowToModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(AGENT_SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'>
      <div className='bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200 max-h-[85vh] flex flex-col'>
        <div className='flex items-center justify-between p-5 border-b border-border/50 flex-shrink-0'>
          <div className='flex items-center gap-3'>
            <div className='w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center'>
              <Github className='w-4 h-4 text-primary' />
            </div>
            <h3 className='text-base font-semibold text-foreground'>
              How GitHub linking works
            </h3>
          </div>
          <button
            onClick={onClose}
            className='p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
            aria-label='Close'
          >
            <X className='w-4 h-4' />
          </button>
        </div>

        <div className='p-5 space-y-2.5 overflow-y-auto'>
          <InfoRow icon={Link2} title='Link a commit or PR to a card'>
            <p>
              Mention a card's id —{' '}
              <code className='px-1 py-0.5 bg-muted rounded'>#board-card</code>{' '}
              (e.g. <code className='px-1 py-0.5 bg-muted rounded'>#3-12</code>) —
              anywhere in a commit message, PR title, PR description, or PR
              comment. It links automatically, no per-card setup needed.
            </p>
          </InfoRow>

          <InfoRow icon={GitMerge} title='Auto-move a card on merge'>
            <p>
              Include{' '}
              <code className='px-1 py-0.5 bg-muted rounded'>
                Closes #3-12
              </code>{' '}
              in the PR's title or description. Only fires on an actual merge —
              never from a comment, never from a direct push.
            </p>
            <p>
              Want a specific list instead of the default Done list?{' '}
              <code className='px-1 py-0.5 bg-muted rounded'>
                Closes #3-12 -&gt; "QA"
              </code>
            </p>
          </InfoRow>

          <div className='flex items-center gap-3 p-3 rounded-lg border border-border/50'>
            <div className='w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0'>
              <Bot className='w-4 h-4 text-muted-foreground' />
            </div>
            <div className='min-w-0 flex-1'>
              <div className='text-sm font-medium text-foreground'>
                For AI coding agents
              </div>
              <div className='text-xs text-muted-foreground'>
                Copy ready-made instructions to paste into your agent's prompt
              </div>
            </div>
            <button
              onClick={handleCopy}
              className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex-shrink-0'
            >
              {copied ? (
                <>
                  <Check className='w-3.5 h-3.5' />
                  Copied
                </>
              ) : (
                <>
                  <Copy className='w-3.5 h-3.5' />
                  Copy
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
