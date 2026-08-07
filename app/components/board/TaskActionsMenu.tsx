'use client';

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, Trash2, ArrowRight } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  labels?: { color: string; text: string }[];
  assignees?: { initials: string; color: string }[];
  attachments?: number;
  comments?: number;
}

interface TaskActionsMenuProps {
  task: Task;
  onMoveTask?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => Promise<boolean>;
}

// Approximate on-screen sizes, kept in sync with the menu markup below —
// used to keep the menu on-screen and to avoid it overlapping the button.
const MENU_WIDTH = 176; // w-44
const MENU_HEIGHT = 84; // two compact rows
const CONFIRM_HEIGHT = 108; // confirm copy + actions row

export function TaskActionsMenu({
  task,
  onMoveTask,
  onDeleteTask,
}: TaskActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Shared position math, used both synchronously on open (see
  // handleButtonClick) and by the layout effect below (which only has to
  // handle *re*-positioning once already open, e.g. when the delete-confirm
  // view changes the menu's height).
  const computeMenuPosition = (confirmView: boolean) => {
    if (!buttonRef.current) return null;
    const buttonRect = buttonRef.current.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    // Default position: below and to the right of the button
    let top = buttonRect.bottom + 4;
    let left = buttonRect.left;

    // Check if menu would overflow horizontally
    if (left + MENU_WIDTH > viewport.width) {
      // Position to the left of the button
      left = buttonRect.right - MENU_WIDTH;
    }

    // Check if menu would overflow vertically
    const menuHeight = confirmView ? CONFIRM_HEIGHT : MENU_HEIGHT;
    if (top + menuHeight > viewport.height) {
      // Position above the button
      top = buttonRect.top - menuHeight - 4;
    }

    // Ensure menu doesn't go off-screen
    top = Math.max(8, Math.min(top, viewport.height - menuHeight - 8));
    left = Math.max(8, Math.min(left, viewport.width - MENU_WIDTH - 8));

    return { top, left };
  };

  // Reposition once already open (e.g. delete-confirm view changes the
  // menu's height). The *initial* open is positioned synchronously in
  // handleButtonClick instead of here — waiting for this effect, even a
  // useLayoutEffect, meant the very first commit of the portaled menu could
  // still be measured against a buttonRef that React hadn't finished
  // attaching yet in some cases, so the menu's first painted frame was the
  // stale {top: 0, left: 0} default (top-left corner), then snapped to the
  // real spot — a visible "flies in from the corner" glitch on first open.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const position = computeMenuPosition(showDeleteConfirm);
    if (position) setMenuPosition(position);
  }, [isOpen, showDeleteConfirm]);

  // Close menu on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setShowDeleteConfirm(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const handleDelete = () => {
    if (!onDeleteTask) return;

    // onDeleteTask removes the card from the board optimistically, so
    // there's nothing to wait on here — close immediately rather than
    // blocking this menu on the round-trip. Failure is surfaced via the
    // board's toast notification, which also restores the card.
    setIsOpen(false);
    setShowDeleteConfirm(false);
    onDeleteTask(task.id);
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isOpen) {
      // Compute position now, synchronously, from the click itself — rather
      // than relying on an effect to measure buttonRef after the menu
      // mounts. React batches this with setIsOpen below into one render, so
      // the menu's very first painted frame already has the right
      // top/left, instead of the {0,0} default the layout effect would
      // otherwise (briefly) render first.
      const position = computeMenuPosition(false);
      if (position) setMenuPosition(position);
    }
    setIsOpen(!isOpen);
  };

  const handleMenuAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  const menuContent = (
    <>
      {/* Backdrop */}
      <div
        className='fixed inset-0 z-[10000]'
        onClick={() => {
          setIsOpen(false);
          setShowDeleteConfirm(false);
        }}
      />

      {/* Menu */}
      <div
        ref={menuRef}
        className='fixed w-44 bg-card/95 backdrop-blur-lg border border-border/50 rounded-lg shadow-xl z-[10001] overflow-hidden'
        style={{
          top: `${menuPosition.top}px`,
          left: `${menuPosition.left}px`,
        }}
      >
        {!showDeleteConfirm ? (
          <div className='py-1'>
            {onMoveTask && (
              <button
                onClick={() => handleMenuAction(() => onMoveTask(task.id))}
                className='w-full px-3 py-2 text-left text-sm text-foreground hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-2'
              >
                <ArrowRight className='w-3.5 h-3.5 text-muted-foreground' />
                Move card
              </button>
            )}

            {onDeleteTask && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className='w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors flex items-center gap-2'
              >
                <Trash2 className='w-3.5 h-3.5' />
                Delete
              </button>
            )}
          </div>
        ) : (
          <div className='p-3'>
            <p className='text-xs text-foreground mb-3'>
              Delete "{task.title}"? This can't be undone.
            </p>
            <div className='flex gap-2 justify-end'>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className='px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors'
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className='px-2.5 py-1.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-medium rounded-md transition-colors'
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className='relative z-20'>
      <button
        ref={buttonRef}
        onClick={handleButtonClick}
        className='p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors opacity-0 group-hover:opacity-100'
        aria-label='Card actions'
        title='Card actions'
      >
        <MoreHorizontal className='w-4 h-4' />
      </button>

      {isOpen &&
        typeof window !== 'undefined' &&
        createPortal(menuContent, document.body)}
    </div>
  );
}
