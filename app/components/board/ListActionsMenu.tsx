'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, Archive, X, Trash2 } from 'lucide-react';

interface ListActionsMenuProps {
  listId: string;
  listName: string;
  onArchiveList: (listId: string) => Promise<boolean>;
  onDeleteList?: (listId: string) => Promise<boolean>;
}

export function ListActionsMenu({
  listId,
  listName,
  onArchiveList,
  onDeleteList,
}: ListActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
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

  const handleArchive = async () => {
    if (isArchiving) return;

    setIsArchiving(true);
    const success = await onArchiveList(listId);
    setIsArchiving(false);

    if (success) {
      setIsOpen(false);
    }
  };

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
        className='fixed inset-0 z-[9990]'
        onClick={() => {
          setIsOpen(false);
          setShowDeleteConfirm(false);
        }}
      />

      {/* Menu */}
      <div
        ref={menuRef}
        className='fixed w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-[9999] py-2'
        style={{
          top: `${menuPosition.top}px`,
          left: `${menuPosition.left}px`,
        }}
      >
        {!showDeleteConfirm ? (
          <>
            {/* Header */}
            <div className='flex items-center justify-between px-4 py-2 border-b border-slate-700'>
              <span className='text-sm font-medium text-slate-200'>
                List actions
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className='p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors'
                title='Close menu'
              >
                <X className='w-4 h-4' />
              </button>
            </div>

            {/* Actions */}
            <div className='py-2'>
              <button
                onClick={handleArchive}
                disabled={isArchiving}
                className='w-full px-4 py-2 text-left text-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                <Archive className='w-4 h-4' />
                {isArchiving ? 'Archiving...' : 'Archive this list'}
              </button>

              {onDeleteList && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className='w-full px-4 py-2 text-left text-sm text-slate-300 hover:text-red-400 hover:bg-red-900/20 transition-colors flex items-center gap-3'
                >
                  <Trash2 className='w-4 h-4' />
                  Delete this list
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Delete Confirmation */}
            <div className='px-4 py-3'>
              <h3 className='text-sm font-medium text-slate-200 mb-2'>
                Delete "{listName}"?
              </h3>
              <p className='text-xs text-slate-400 mb-4'>
                This action will permanently delete the list and all its cards.
                This cannot be undone.
              </p>
              <div className='flex gap-2'>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className='flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 px-3 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className='flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium py-2 px-3 rounded transition-colors disabled:opacity-50'
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
