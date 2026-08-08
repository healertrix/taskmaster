'use client';

import React, { useMemo, useRef, useState } from 'react';

export interface MentionableMember {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  members: MentionableMember[];
  // Fired every time a mention is inserted via the dropdown — the caller
  // is responsible for tracking which mentions are "live" in the current
  // draft (see filterMentionsStillPresent below for pruning on submit).
  onMentionInsert?: (member: MentionableMember) => void;
  onSubmit?: () => void; // Ctrl+Enter, matching the rest of this app's comment boxes
  placeholder?: string;
  className?: string;
  rows?: number;
  autoFocus?: boolean;
  disabled?: boolean;
}

const getInitials = (name: string | null, email: string) => {
  if (name) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  return email.charAt(0).toUpperCase();
};

// A comment/description textarea with @ autocomplete. Typing "@" and then
// any run of non-whitespace characters opens a dropdown of matching
// workspace members (filtered by name/email); picking one replaces the
// "@partial" text with "@Full Name " and reports the pick via
// onMentionInsert so the caller can track it as a real mention (as
// opposed to a literal "@" a user just typed and never resolved).
export function MentionInput({
  value,
  onChange,
  members,
  onMentionInsert,
  onSubmit,
  placeholder,
  className,
  rows = 1,
  autoFocus,
  disabled,
}: MentionInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const filteredMembers = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return members
      .filter(
        (m) =>
          (m.full_name || '').toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [mentionQuery, members]);

  const isOpen = mentionQuery !== null && filteredMembers.length > 0;

  // Detects "@word-being-typed" immediately before the cursor. Only a run
  // of non-whitespace right after an "@" counts — "email@x.com" doesn't
  // trigger it because the "@" there isn't preceded by a word boundary
  // (start of string or whitespace), and a completed "@word " (trailing
  // space already typed) doesn't either, since the match stops at the
  // cursor.
  const detectMention = (text: string, cursor: number) => {
    const upToCursor = text.slice(0, cursor);
    const match = upToCursor.match(/(?:^|\s)@(\S*)$/);
    if (!match) {
      setMentionQuery(null);
      setMentionStart(null);
      return;
    }
    setMentionQuery(match[1]);
    setMentionStart(cursor - match[1].length - 1);
    setHighlightedIndex(0);
  };

  const insertMention = (member: MentionableMember) => {
    if (mentionStart === null || !textareaRef.current) return;
    const el = textareaRef.current;
    const cursor = el.selectionStart;
    const name = member.full_name || member.email;
    const before = value.slice(0, mentionStart);
    const after = value.slice(cursor);
    const insertion = `@${name} `;
    const nextValue = `${before}${insertion}${after}`;

    onChange(nextValue);
    onMentionInsert?.(member);
    setMentionQuery(null);
    setMentionStart(null);

    // Restore focus + caret position after the inserted mention — has to
    // wait a tick for the controlled value to actually reach the DOM.
    requestAnimationFrame(() => {
      const pos = before.length + insertion.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className='relative'>
      <textarea
        ref={textareaRef}
        value={value}
        placeholder={placeholder}
        className={className}
        rows={rows}
        autoFocus={autoFocus}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          detectMention(e.target.value, e.target.selectionStart);
          // Auto-resize, matching the textarea's existing behavior
          e.currentTarget.style.height = 'auto';
          e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
        }}
        onClick={(e) =>
          detectMention(value, e.currentTarget.selectionStart)
        }
        onKeyDown={(e) => {
          if (isOpen) {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlightedIndex((i) => (i + 1) % filteredMembers.length);
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlightedIndex(
                (i) => (i - 1 + filteredMembers.length) % filteredMembers.length
              );
              return;
            }
            if (e.key === 'Enter' && !e.ctrlKey) {
              e.preventDefault();
              insertMention(filteredMembers[highlightedIndex]);
              return;
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              setMentionQuery(null);
              setMentionStart(null);
              return;
            }
          }

          if (e.key === 'Enter' && e.ctrlKey) {
            onSubmit?.();
          }
        }}
      />

      {isOpen && (
        <div className='absolute left-0 bottom-full mb-1 w-64 max-h-56 overflow-y-auto bg-popover text-popover-foreground border border-border rounded-lg shadow-2xl z-50 py-1'>
          {filteredMembers.map((member, index) => (
            <button
              key={member.id}
              type='button'
              // Mousedown (not click) fires before the textarea's blur,
              // so the caret position read at insert time is still valid.
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(member);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-sm transition-colors ${
                index === highlightedIndex
                  ? 'bg-primary/10 text-foreground'
                  : 'text-foreground hover:bg-muted/50'
              }`}
            >
              {member.avatar_url ? (
                <img
                  src={member.avatar_url}
                  alt=''
                  className='w-6 h-6 rounded-full object-cover flex-shrink-0'
                />
              ) : (
                <div className='w-6 h-6 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground flex-shrink-0'>
                  {getInitials(member.full_name, member.email)}
                </div>
              )}
              <div className='min-w-0'>
                <div className='truncate font-medium'>
                  {member.full_name || member.email}
                </div>
                {member.full_name && (
                  <div className='truncate text-xs text-muted-foreground'>
                    {member.email}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Prunes mentions whose "@Full Name" text no longer actually appears in
// the content — e.g. the user selected someone, then deleted or edited
// that part of the text before submitting. Keeps the stored mentions
// array honest about who's really tagged in the final text.
export function filterMentionsStillPresent<
  M extends { id: string; full_name: string | null }
>(content: string, mentions: M[]): M[] {
  return mentions.filter((m) => {
    const name = m.full_name;
    return !!name && content.includes(`@${name}`);
  });
}
