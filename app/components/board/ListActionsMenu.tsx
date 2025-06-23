'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, X, Trash2 } from 'lucide-react';

interface ListActionsMenuProps {
  listId: string;
  listName: string;
  onDeleteList?: (listId: string) => Promise<boolean>;
}

export function ListActionsMenu({
  listId,
  listName,
  onDeleteList,
}: ListActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [menuPosition, setMenuPosition] = useState({
    top: 0,
    left: 0,
    position: 'right' as 'right' | 'left' | 'bottom',
  });
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Calculate optimal menu position based on available space
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const button = buttonRef.current;
      const buttonRect = button.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const menuWidth = 256; // w-64 = 16rem = 256px
      const menuHeight = 120; // Approximate menu height

      const spaceOnRight = viewportWidth - buttonRect.right;
      const spaceOnLeft = buttonRect.left;
      const spaceBelow = viewportHeight - buttonRect.bottom;

      let position: 'right' | 'left' | 'bottom' = 'right';
      let top = buttonRect.top;
      let left = buttonRect.right + 4; // 4px spacing

      // Try right first (preferred)
      if (spaceOnRight >= menuWidth + 20) {
        position = 'right';
        left = buttonRect.right + 4;
        top = buttonRect.top;
      }
      // Try left if not enough space on right
      else if (spaceOnLeft >= menuWidth + 20) {
        position = 'left';
        left = buttonRect.left - menuWidth - 4;
        top = buttonRect.top;
      }
      // Fall back to bottom if neither side has enough space
      else {
        position = 'bottom';
        left = Math.max(8, buttonRect.right - menuWidth); // Ensure 8px from left edge
        top = buttonRect.bottom + 4;

        // If menu would go below viewport, position it above the button
        if (top + menuHeight > viewportHeight) {
          top = buttonRect.top - menuHeight - 4;
        }
      }

      // Ensure menu doesn't go off screen
      left = Math.max(8, Math.min(left, viewportWidth - menuWidth - 8));
      top = Math.max(8, Math.min(top, viewportHeight - menuHeight - 8));

      setMenuPosition({ top, left, position });
    }
  }, [isOpen]);

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

  const handleDelete = async () => {
    if (isDeleting || !onDeleteList) return;

    setIsDeleting(true);
    const success = await onDeleteList(listId);
    setIsDeleting(false);

    if (success) {
      setIsOpen(false);
      setShowDeleteConfirm(false);
    }
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
        className='fixed w-64 bg-card/95 backdrop-blur-lg border border-border/50 rounded-xl shadow-2xl z-[10001] py-3 overflow-hidden'
        style={{
          top: `${menuPosition.top}px`,
          left: `${menuPosition.left}px`,
        }}
      >
        {!showDeleteConfirm ? (
          <>
            {/* Header with gradient */}
            <div className='flex items-center justify-between px-5 py-3 bg-gradient-to-r from-secondary/10 to-accent/10 border-b border-border/30'>
              <span className='text-sm font-semibold text-foreground flex items-center gap-2'>
                <div className='w-2 h-2 bg-secondary rounded-full'></div>
                List actions
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className='p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all duration-200'
                title='Close menu'
              >
                <X className='w-4 h-4' />
              </button>
            </div>

            {/* Actions */}
            <div className='py-2'>
              {onDeleteList && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className='w-full px-5 py-3 text-left text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200 flex items-center gap-3 group'
                >
                  <div className='w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center group-hover:bg-red-500/20 transition-colors'>
                    <Trash2 className='w-4 h-4 text-red-400 group-hover:text-red-300' />
                  </div>
                  <span className='font-medium'>Delete this list</span>
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Delete Confirmation */}
            <div className='px-5 py-4'>
              <div className='flex items-center gap-3 mb-4'>
                <div className='w-10 h-10 bg-red-500/15 rounded-full flex items-center justify-center'>
                  <Trash2 className='w-5 h-5 text-red-400' />
                </div>
                <div>
                  <h3 className='text-sm font-semibold text-foreground'>
                    Delete "{listName}"?
                  </h3>
                  <p className='text-xs text-red-300/80'>
                    This action cannot be undone
                  </p>
                </div>
              </div>
              <p className='text-xs text-muted-foreground mb-6'>
                This action will permanently delete the list and all its cards.
                This cannot be undone.
              </p>
              <div className='flex gap-3'>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className='flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:shadow-md'
                >
                  {isDeleting ? (
                    <>
                      <div className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className='w-4 h-4' />
                      Delete
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className='flex-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 shadow-sm hover:shadow-md'
                >
                  Cancel
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );

  return (
    <div className='relative z-20'>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className='p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors relative z-20'
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
