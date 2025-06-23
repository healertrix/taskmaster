'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, Trash2, X, ArrowRight } from 'lucide-react';

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

export function TaskActionsMenu({
  task,
  onMoveTask,
  onDeleteTask,
}: TaskActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Handle menu positioning
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };

      // Default position: below and to the right of the button
      let top = buttonRect.bottom + 8;
      let left = buttonRect.left;

      // Check if menu would overflow horizontally
      const menuWidth = 280; // Approximate menu width
      if (left + menuWidth > viewport.width) {
        // Position to the left of the button
        left = buttonRect.right - menuWidth;
      }

      // Check if menu would overflow vertically
      const menuHeight = showDeleteConfirm ? 200 : 160; // Reduced height for fewer options
      if (top + menuHeight > viewport.height) {
        // Position above the button
        top = buttonRect.top - menuHeight - 8;
      }

      // Ensure menu doesn't go off-screen
      top = Math.max(8, Math.min(top, viewport.height - menuHeight - 8));
      left = Math.max(8, Math.min(left, viewport.width - menuWidth - 8));

      setMenuPosition({ top, left });
    }
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

  const handleDelete = async () => {
    if (!onDeleteTask) return;

    setIsDeleting(true);
    const success = await onDeleteTask(task.id);
    setIsDeleting(false);

    if (success) {
      setIsOpen(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
        className='fixed w-72 bg-card/95 backdrop-blur-lg border border-border/50 rounded-xl shadow-2xl z-[10001] py-3 overflow-hidden'
        style={{
          top: `${menuPosition.top}px`,
          left: `${menuPosition.left}px`,
        }}
      >
        {!showDeleteConfirm ? (
          <>
            {/* Header with gradient */}
            <div className='flex items-center justify-between px-5 py-3 bg-gradient-to-r from-primary/10 to-accent/10 border-b border-border/30'>
              <span className='text-sm font-semibold text-foreground flex items-center gap-2'>
                <div className='w-2 h-2 bg-primary rounded-full'></div>
                Card actions
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className='p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all duration-200'
                title='Close menu'
              >
                <X className='w-4 h-4' />
              </button>
            </div>

            {/* Card Info */}
            <div className='px-5 py-3 border-b border-border/30 bg-muted/20'>
              <p
                className='text-xs text-muted-foreground font-medium truncate'
                title={task.title}
              >
                {task.title}
              </p>
            </div>

            {/* Actions */}
            <div className='py-2'>
              {onMoveTask && (
                <button
                  onClick={() => handleMenuAction(() => onMoveTask(task.id))}
                  className='w-full px-5 py-3 text-left text-sm text-foreground hover:bg-primary/10 hover:text-primary transition-all duration-200 flex items-center gap-3 group'
                >
                  <div className='w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors'>
                    <ArrowRight className='w-4 h-4 text-primary' />
                  </div>
                  <span className='font-medium'>Move card</span>
                </button>
              )}

              {onDeleteTask && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className='w-full px-5 py-3 text-left text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200 flex items-center gap-3 group'
                >
                  <div className='w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center group-hover:bg-red-500/20 transition-colors'>
                    <Trash2 className='w-4 h-4 text-red-400 group-hover:text-red-300' />
                  </div>
                  <span className='font-medium'>Delete</span>
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
                    Delete card?
                  </h3>
                  <p className='text-xs text-red-300/80'>
                    This action cannot be undone
                  </p>
                </div>
              </div>
              <p className='text-xs text-muted-foreground mb-6'>
                This action will permanently delete "{task.title}" and cannot be
                undone.
              </p>
              <div className='flex gap-3 justify-between'>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className='px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all duration-200 disabled:opacity-50'
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className='px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm hover:shadow-md'
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
        onClick={handleButtonClick}
        className='p-1 text-white/60 hover:text-white hover:bg-white/20 rounded transition-colors opacity-0 group-hover:opacity-100'
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
