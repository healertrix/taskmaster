'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';

interface AddCardFormProps {
  columnId: string;
  onAddCard: (columnId: string, cardTitle: string) => Promise<boolean>;
  isAdding?: boolean;
}

export function AddCardForm({
  columnId,
  onAddCard,
  isAdding = false,
}: AddCardFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [cardTitle, setCardTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when form opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  // Close form when adding prop changes
  useEffect(() => {
    if (!isAdding) {
      setIsSubmitting(false);
    }
  }, [isAdding]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = cardTitle.trim();

    if (!trimmedTitle) {
      setError('Card title is required');
      textareaRef.current?.focus();
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const success = await onAddCard(columnId, trimmedTitle);
      if (success) {
        setCardTitle('');
        // Keep form open for adding multiple cards
        textareaRef.current?.focus();
      } else {
        setError('Failed to create card');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    setCardTitle('');
    setError(null);
    setIsSubmitting(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className='w-full h-10 rounded-lg border-2 border-dashed border-border/50 hover:border-primary bg-card/30 hover:bg-card/50 flex items-center justify-center text-muted-foreground hover:text-primary transition-all group'
      >
        <div className='flex items-center gap-2'>
          <Plus className='w-4 h-4' />
          <span className='font-medium text-sm'>Add a card</span>
        </div>
      </button>
    );
  }

  return (
    <div className='bg-card rounded-lg p-2.5 shadow-lg border border-border'>
      <form onSubmit={handleSubmit} className='space-y-2.5'>
        <div>
          <textarea
            ref={textareaRef}
            value={cardTitle}
            onChange={(e) => setCardTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Enter a title for this card...'
            className='w-full px-2.5 py-2 bg-background border border-border rounded-md text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none'
            disabled={isSubmitting}
            rows={2}
            maxLength={500}
          />
          {error && <p className='text-xs text-red-500 mt-1'>{error}</p>}
        </div>

        <div className='flex items-center gap-2'>
          <button
            type='submit'
            disabled={isSubmitting || !cardTitle.trim()}
            className='flex-1 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2'
          >
            {isSubmitting ? (
              <>
                <Loader2 className='w-3.5 h-3.5 animate-spin' />
                Adding...
              </>
            ) : (
              'Add card'
            )}
          </button>

          <button
            type='button'
            onClick={handleCancel}
            disabled={isSubmitting}
            title='Cancel (Esc)'
            className='p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors'
          >
            <X className='w-4 h-4' />
          </button>
        </div>
      </form>
    </div>
  );
}
