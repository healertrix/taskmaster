'use client';

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, Trash2 } from 'lucide-react';

interface ListActionsMenuProps {
  listId: string;
  listName: string;
  cardCount?: number;
  onDeleteList?: (listId: string) => Promise<boolean>;
}

// Approximate on-screen sizes, kept in sync with the menu markup below —
// used to keep the menu on-screen and avoid overlapping the button.
const MENU_WIDTH = 176; // w-44
const MENU_HEIGHT = 44; // single row
const CONFIRM_HEIGHT = 108; // confirm copy + actions row

export function ListActionsMenu({
  listId,
  listName,
  cardCount = 0,
  onDeleteList,
}: ListActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Shared position math, used both synchronously on open (see the button's
  // onClick below) and by the layout effect as a fallback.
  const computeMenuPosition = (confirmView: boolean) => {
    if (!buttonRef.current) return null;
    const buttonRect = buttonRef.current.getBoundingClientRect();
    const viewport = { width: window.innerWidth, height: window.innerHeight };

    let top = buttonRect.bottom + 4;
    let left = buttonRect.left;

    if (left + MENU_WIDTH > viewport.width) {
      left = buttonRect.right - MENU_WIDTH;
    }

    const menuHeight = confirmView ? CONFIRM_HEIGHT : MENU_HEIGHT;
    if (top + menuHeight > viewport.height) {
      top = buttonRect.top - menuHeight - 4;
    }

    top = Math.max(8, Math.min(top, viewport.height - menuHeight - 8));
    left = Math.max(8, Math.min(left, viewport.width - MENU_WIDTH - 8));

    return { top, left };
  };

  // Fallback reposition (e.g. viewport resize while open, or the
  // confirm view changing the menu's height). The *initial* open is
  // positioned synchronously in the button's onClick instead of relying on
  // this effect — waiting for even a useLayoutEffect meant the menu's
  // first painted frame could still be the stale {top:0, left:0} default
  // (top-left corner), then it snapped to the real spot: a visible "flies
  // in from the corner" glitch on first open.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const position = computeMenuPosition(showDeleteConfirm);
    if (position) setMenuPosition(position);
  }, [isOpen, showDeleteConfirm]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setShowDeleteConfirm(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
        } else {
          setIsOpen(false);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, showDeleteConfirm]);

  const handleDelete = () => {
    if (!onDeleteList) return;

    // onDeleteList removes the list from the board optimistically, so
    // there's nothing to wait on here — close immediately rather than
    // blocking this menu on the round-trip. Failure is surfaced via the
    // board's toast notification, which also restores the list.
    setIsOpen(false);
    setShowDeleteConfirm(false);
    onDeleteList(listId);
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isOpen) {
      const position = computeMenuPosition(false);
      if (position) setMenuPosition(position);
    }
    setIsOpen(!isOpen);
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

      {/* Menu — only one action exists (delete), so this stays a single
          compact row rather than a full header+icon-square treatment. */}
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
            {onDeleteList && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className='w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors flex items-center gap-2'
              >
                <Trash2 className='w-3.5 h-3.5' />
                Delete list
              </button>
            )}
          </div>
        ) : (
          <div className='p-3'>
            <p className='text-xs text-foreground mb-3'>
              Delete "{listName}"
              {cardCount > 0
                ? ` and ${cardCount} card${cardCount === 1 ? '' : 's'}`
                : ''}
              ? This can't be undone.
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
        className='p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors relative z-20'
        aria-label='List actions'
        title='List actions'
      >
        <MoreHorizontal className='w-4 h-4' />
      </button>

      {isOpen &&
        typeof window !== 'undefined' &&
        createPortal(menuContent, document.body)}
    </div>
  );
}
