'use client';

import React, { useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Layers, Trello, Star } from 'lucide-react';

export interface MentionableItem {
  id: string;
  name: string;
  kind: 'workspace' | 'board';
  workspaceId?: string; // boards only
  workspaceName?: string; // boards only, shown as a subtitle
  number?: number; // boards only — the shareable per-workspace board key (e.g. #12)
  starred?: boolean; // boards only — for quick-pick ordering
  lastActivityAt?: string; // boards only — for quick-pick ordering
}

interface WorkspaceBoardMentionInputProps {
  value: string;
  onChange: (value: string) => void;
  items: MentionableItem[];
  onMentionInsert?: (item: MentionableItem) => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  rows?: number;
}

// Matches by name, or — for boards — by their shareable key/number
// ("#12" or bare "12").
function matchesQuery(item: MentionableItem, q: string): boolean {
  if (item.name.toLowerCase().includes(q)) return true;
  if (item.kind === 'board' && item.number != null) {
    return String(item.number) === q.replace(/^#/, '');
  }
  return false;
}

// Sibling to app/components/board/MentionInput.tsx — same controlled,
// options-in/callback-out shape and "@word-being-typed" detection, but
// mentioning workspaces/boards (real entities the user belongs to, picked
// from a dropdown) instead of members. Used by AIChatWidget so a board is
// always resolved to a real id, never fuzzy-matched from free text.
//
// Forwards a ref to the underlying textarea so the parent can refocus it
// after an async action completes — disabling a focused textarea (e.g.
// while a message is sending) forces a browser blur that isn't restored
// automatically, which was the "focus keeps leaving the compose box" bug.
export const WorkspaceBoardMentionInput = React.forwardRef<
  HTMLTextAreaElement,
  WorkspaceBoardMentionInputProps
>(function WorkspaceBoardMentionInput(
  {
    value,
    onChange,
    items,
    onMentionInsert,
    onSubmit,
    placeholder,
    className,
    disabled,
    autoFocus,
    rows = 1,
  },
  forwardedRef
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(forwardedRef, () => textareaRef.current as HTMLTextAreaElement);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const filteredItems = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return items.filter((i) => matchesQuery(i, q)).slice(0, 8);
  }, [mentionQuery, items]);

  const isOpen = mentionQuery !== null && filteredItems.length > 0;

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

  const insertMention = (item: MentionableItem) => {
    if (mentionStart === null || !textareaRef.current) return;
    const el = textareaRef.current;
    const cursor = el.selectionStart;
    const before = value.slice(0, mentionStart);
    const after = value.slice(cursor);
    const insertion = `@${item.name} `;
    const nextValue = `${before}${insertion}${after}`;

    onChange(nextValue);
    onMentionInsert?.(item);
    setMentionQuery(null);
    setMentionStart(null);

    requestAnimationFrame(() => {
      const pos = before.length + insertion.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className='relative w-full'>
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
          e.currentTarget.style.height = 'auto';
          e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
        }}
        onClick={(e) => detectMention(value, e.currentTarget.selectionStart)}
        onKeyDown={(e) => {
          if (isOpen) {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlightedIndex((i) => (i + 1) % filteredItems.length);
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlightedIndex(
                (i) => (i - 1 + filteredItems.length) % filteredItems.length
              );
              return;
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              insertMention(filteredItems[highlightedIndex]);
              return;
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              setMentionQuery(null);
              setMentionStart(null);
              return;
            }
          }

          if (e.key === 'Enter' && !e.shiftKey && !isOpen) {
            e.preventDefault();
            onSubmit?.();
          }
        }}
      />

      {isOpen && (
        <div className='absolute left-0 bottom-full mb-1 w-72 max-h-56 overflow-y-auto bg-popover text-popover-foreground border border-border rounded-lg shadow-2xl z-50 py-1'>
          {filteredItems.map((item, index) => {
            const Icon = item.kind === 'workspace' ? Layers : Trello;
            return (
              <button
                key={`${item.kind}-${item.id}`}
                type='button'
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(item);
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-sm transition-colors ${
                  index === highlightedIndex
                    ? 'bg-primary/10 text-foreground'
                    : 'text-foreground hover:bg-muted/50'
                }`}
              >
                <Icon className='w-3.5 h-3.5 text-muted-foreground flex-shrink-0' />
                <div className='min-w-0'>
                  <div className='truncate font-medium flex items-center gap-1'>
                    {item.name}
                    {item.number != null && (
                      <span className='text-muted-foreground font-normal'>#{item.number}</span>
                    )}
                    {item.starred && <Star className='w-3 h-3 text-yellow-400 fill-current flex-shrink-0' />}
                  </div>
                  {item.workspaceName && (
                    <div className='truncate text-xs text-muted-foreground'>
                      {item.workspaceName}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});
