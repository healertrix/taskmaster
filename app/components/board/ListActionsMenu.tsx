'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Archive, X } from 'lucide-react';

interface ListActionsMenuProps {
  listId: string;
  listName: string;
  onArchiveList: (listId: string) => Promise<boolean>;
}

export function ListActionsMenu({
  listId,
  listName,
  onArchiveList,
}: ListActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const handleArchive = async () => {
    if (isArchiving) return;

    setIsArchiving(true);
    const success = await onArchiveList(listId);
    setIsArchiving(false);

    if (success) {
      setIsOpen(false);
    }
  };

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

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className='fixed inset-0 z-40'
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div
            ref={menuRef}
            className='absolute right-0 top-full mt-1 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-[100] py-2'
          >
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
            </div>
          </div>
        </>
      )}
    </div>
  );
}
