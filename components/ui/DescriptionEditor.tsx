'use client';

import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Bold, Highlighter, Italic } from 'lucide-react';

// The formatting toolbar + textarea shared by every description editor in
// the app (board/workspace via EntityInfoModal, card via CardModal).
// Extracted so the three formatting rules (bold/italic/highlight) and the
// selection-wrapping behavior live in exactly one place — see
// DescriptionText.tsx for how this markup is read back on display.

interface DescriptionEditorProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export interface DescriptionEditorHandle {
  focus: () => void;
}

export const DescriptionEditor = forwardRef<
  DescriptionEditorHandle,
  DescriptionEditorProps
>(function DescriptionEditor(
  { value, onChange, onKeyDown, placeholder, disabled, autoFocus, className },
  ref
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  // Wraps the current selection in `marker` on both sides (e.g. "**" for
  // bold, "_" for italic, "==" for highlight). With no selection, inserts
  // an empty pair and places the cursor between them so typing continues
  // right into the markup.
  const wrapSelection = (marker: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { selectionStart, selectionEnd, value: current } = textarea;
    const selected = current.slice(selectionStart, selectionEnd);
    const next =
      current.slice(0, selectionStart) +
      marker +
      selected +
      marker +
      current.slice(selectionEnd);

    onChange(next);

    // Restore focus + selection after React re-renders the textarea's value.
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = selectionStart + marker.length;
      textarea.setSelectionRange(cursor, cursor + selected.length);
    });
  };

  return (
    <div className='space-y-2'>
      {/* Links need no markup at all — pasted/typed URLs are auto-linked
          on display. */}
      <div className='flex items-center gap-1'>
        <button
          type='button'
          onClick={() => wrapSelection('**')}
          className='p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors'
          title='Bold (wrap selection with **)'
          disabled={disabled}
        >
          <Bold className='w-3.5 h-3.5' />
        </button>
        <button
          type='button'
          onClick={() => wrapSelection('_')}
          className='p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors'
          title='Italic (wrap selection with _)'
          disabled={disabled}
        >
          <Italic className='w-3.5 h-3.5' />
        </button>
        <button
          type='button'
          onClick={() => wrapSelection('==')}
          className='p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors'
          title='Highlight (wrap selection with ==)'
          disabled={disabled}
        >
          <Highlighter className='w-3.5 h-3.5' />
        </button>
        <span className='text-xs text-muted-foreground ml-1'>
          Links are auto-detected
        </span>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        className={
          className ||
          'w-full h-32 p-3 bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none text-sm'
        }
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
      />
    </div>
  );
});
