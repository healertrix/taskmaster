'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';

interface AddListFormProps {
  onCreateList: (name: string) => Promise<boolean>;
  isCreating: boolean;
}

export function AddListForm({ onCreateList, isCreating }: AddListFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [listName, setListName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!listName.trim()) {
      setError('List name is required');
      return;
    }

    setError(null);
    const success = await onCreateList(listName.trim());

    if (success) {
      setListName('');
      setIsOpen(false);
    } else {
      setError('Failed to create list');
    }
  };

  const handleCancel = () => {
    setListName('');
    setError(null);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!isOpen) {
    return (
      <div className='flex-shrink-0 w-80'>
        <button
          onClick={() => setIsOpen(true)}
          className='w-full h-12 rounded-xl border-2 border-dashed border-border/50 hover:border-primary bg-card/30 hover:bg-card/50 flex items-center justify-center text-muted-foreground hover:text-primary transition-all group'
        >
          <div className='flex items-center gap-2'>
            <Plus className='w-4 h-4' />
            <span className='font-medium text-sm'>Add another list</span>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className='flex-shrink-0 w-80'>
      <div className='bg-card rounded-xl p-3 shadow-lg border border-border'>
        <form onSubmit={handleSubmit} className='space-y-3'>
          <div>
            <input
              ref={inputRef}
              type='text'
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='Enter list title...'
              className='w-full px-3 py-2 bg-background border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
              disabled={isCreating}
              maxLength={100}
            />
            {error && <p className='text-xs text-red-500 mt-1'>{error}</p>}
          </div>

          <div className='flex items-center gap-2'>
            <button
              type='submit'
              disabled={isCreating || !listName.trim()}
              className='flex-1 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2'
            >
              {isCreating ? (
                <>
                  <Loader2 className='w-4 h-4 animate-spin' />
                  Creating...
                </>
              ) : (
                'Add list'
              )}
            </button>

            <button
              type='button'
              onClick={handleCancel}
              disabled={isCreating}
              title='Cancel'
              className='p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors'
            >
              <X className='w-4 h-4' />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
