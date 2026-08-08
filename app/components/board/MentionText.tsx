'use client';

import React from 'react';

export interface Mention {
  id: string;
  full_name: string | null;
}

interface MentionTextProps {
  text: string;
  mentions?: Mention[];
  className?: string;
}

// Renders comment/description text with @mentions highlighted. Only
// highlights names that are actually in `mentions` (the record of who was
// really tagged, stored alongside the comment) — a literal "@" typed by a
// user that never resolved to a real mention is left as plain text, not
// guessed at from the raw string.
export function MentionText({ text, mentions, className }: MentionTextProps) {
  if (!mentions || mentions.length === 0) {
    return <span className={className}>{text}</span>;
  }

  // Longest name first, so "Jane" doesn't shadow-match inside "Jane Smith"
  // when both happen to be mentioned in the same comment.
  const names = mentions
    .map((m) => m.full_name)
    .filter((n): n is string => !!n && n.trim().length > 0)
    .sort((a, b) => b.length - a.length);

  if (names.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const pattern = new RegExp(
    `(@(?:${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}))\\b`,
    'g'
  );

  const parts = text.split(pattern);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.startsWith('@') && names.includes(part.slice(1)) ? (
          <span
            key={i}
            className='text-primary font-medium bg-primary/10 rounded px-1'
          >
            {part}
          </span>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </span>
  );
}
