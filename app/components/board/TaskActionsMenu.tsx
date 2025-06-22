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
        className='fixed w-72 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-[10001] py-2'
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
                Card actions
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className='p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors'
                title='Close menu'
              >
                <X className='w-4 h-4' />
              </button>
            </div>

            {/* Card Info */}
            <div className='px-4 py-2 border-b border-slate-700'>
              <p className='text-xs text-slate-400 truncate' title={task.title}>
                {task.title}
              </p>
            </div>

            {/* Actions */}
            <div className='py-2'>
              {onMoveTask && (
                <button
                  onClick={() => handleMenuAction(() => onMoveTask(task.id))}
                  className='w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 transition-colors flex items-center gap-3'
                >
                  <ArrowRight className='w-4 h-4' />
                  Move card
                </button>
              )}

              {onDeleteTask && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className='w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-900/20 transition-colors flex items-center gap-3'
                >
                  <Trash2 className='w-4 h-4' />
                  Delete
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Delete Confirmation */}
            <div className='px-4 py-3'>
              <h3 className='text-sm font-medium text-slate-200 mb-2'>
                Delete card?
              </h3>
              <p className='text-xs text-slate-400 mb-4'>
                This action will permanently delete "{task.title}" and cannot be
                undone.
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
