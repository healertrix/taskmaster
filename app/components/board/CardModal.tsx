'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Edit3,
  Calendar,
  User,
  Tag,
  Paperclip,
  CheckSquare,
  MessageSquare,
  Archive,
  Trash2,
  Plus,
  Eye,
  Clock,
  MapPin,
  Vote,
  Copy,
  Move,
  Share2,
  MoreHorizontal,
} from 'lucide-react';

interface Card {
  id: string;
  title: string;
  description?: string;
  position: number;
  created_at: string;
  updated_at: string;
  start_date?: string;
  due_date?: string;
  due_status?: 'due_soon' | 'overdue' | 'complete' | null;
  created_by: string;
  is_archived: boolean;
  is_watched: boolean;
  cover?: any;
  board_id: string;
  list_id: string;
  profiles?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

interface CardModalProps {
  card: Card;
  isOpen: boolean;
  onClose: () => void;
  onUpdateCard?: (cardId: string, updates: Partial<Card>) => Promise<boolean>;
  onDeleteCard?: (cardId: string) => Promise<boolean>;
  onArchiveCard?: (cardId: string) => Promise<boolean>;
  listName?: string;
  boardName?: string;
}

export function CardModal({
  card,
  isOpen,
  onClose,
  onUpdateCard,
  onDeleteCard,
  onArchiveCard,
  listName = 'List',
  boardName = 'Board',
}: CardModalProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description || '');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when card changes
  useEffect(() => {
    setTitle(card.title);
    setDescription(card.description || '');
  }, [card]);

  // Handle save title
  const handleSaveTitle = async () => {
    if (title.trim() && title !== card.title && onUpdateCard) {
      setIsSaving(true);
      const success = await onUpdateCard(card.id, { title: title.trim() });
      if (success) {
        setIsEditingTitle(false);
      }
      setIsSaving(false);
    } else {
      setIsEditingTitle(false);
    }
  };

  // Handle save description
  const handleSaveDescription = async () => {
    if (description !== card.description && onUpdateCard) {
      setIsSaving(true);
      const success = await onUpdateCard(card.id, {
        description: description.trim() || null,
      });
      if (success) {
        setIsEditingDescription(false);
      }
      setIsSaving(false);
    } else {
      setIsEditingDescription(false);
    }
  };

  // Handle key presses
  const handleTitleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setTitle(card.title);
      setIsEditingTitle(false);
    }
  };

  const handleDescriptionKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setDescription(card.description || '');
      setIsEditingDescription(false);
    }
    // Ctrl+Enter to save
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSaveDescription();
    }
  };

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4'>
      <div className='bg-card rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] border border-border overflow-hidden flex flex-col'>
        {/* Header */}
        <div className='flex items-start gap-4 p-6 border-b border-border bg-muted/30 flex-shrink-0'>
          <div className='flex-1'>
            {/* Card Title */}
            <div className='flex items-center gap-2 mb-2'>
              <Edit3 className='w-5 h-5 text-muted-foreground' />
              {isEditingTitle ? (
                <input
                  type='text'
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={handleTitleKeyPress}
                  className='flex-1 text-lg font-semibold bg-background text-foreground border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary'
                  autoFocus
                  disabled={isSaving}
                  title='Edit card title'
                />
              ) : (
                <h2
                  className='text-lg font-semibold text-foreground cursor-pointer hover:bg-muted/50 rounded-md px-3 py-2 -mx-3 -my-2 transition-colors'
                  onClick={() => setIsEditingTitle(true)}
                >
                  {card.title}
                </h2>
              )}
            </div>

            {/* Breadcrumb */}
            <p className='text-sm text-muted-foreground'>
              in list{' '}
              <span className='font-medium text-foreground'>{listName}</span> on{' '}
              <span className='font-medium text-foreground'>{boardName}</span>
            </p>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className='p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors'
            title='Close modal'
          >
            <X className='w-5 h-5' />
          </button>
        </div>

        <div className='flex gap-6 p-6 flex-1 overflow-hidden'>
          {/* Main Content - Scrollable */}
          <div className='flex-1 space-y-6 overflow-y-auto pr-2'>
            {/* Description */}
            <div>
              <div className='flex items-center gap-2 mb-3'>
                <MessageSquare className='w-5 h-5 text-muted-foreground' />
                <h3 className='text-base font-medium text-foreground'>
                  Description
                </h3>
              </div>

              {isEditingDescription ? (
                <div className='space-y-3'>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onKeyDown={handleDescriptionKeyPress}
                    className='w-full min-h-[120px] bg-background text-foreground border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none'
                    placeholder='Add a more detailed description...'
                    disabled={isSaving}
                  />
                  <div className='flex gap-2'>
                    <button
                      onClick={handleSaveDescription}
                      disabled={isSaving}
                      className='px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-md transition-colors disabled:opacity-50'
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setDescription(card.description || '');
                        setIsEditingDescription(false);
                      }}
                      disabled={isSaving}
                      className='px-3 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-medium rounded-md transition-colors'
                    >
                      Cancel
                    </button>
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Press Ctrl+Enter to save quickly
                  </p>
                </div>
              ) : (
                <div
                  className='min-h-[80px] bg-muted/50 border border-border rounded-md px-3 py-2 cursor-pointer hover:bg-muted transition-colors'
                  onClick={() => setIsEditingDescription(true)}
                >
                  {card.description ? (
                    <p className='text-sm text-foreground whitespace-pre-wrap'>
                      {card.description}
                    </p>
                  ) : (
                    <p className='text-sm text-muted-foreground'>
                      Add a more detailed description...
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Comments and Activity */}
            <div>
              <div className='flex items-center gap-2 mb-3'>
                <MessageSquare className='w-5 h-5 text-muted-foreground' />
                <h3 className='text-base font-medium text-foreground'>
                  Comments and activity
                </h3>
                <button className='ml-auto text-sm text-muted-foreground hover:text-foreground transition-colors'>
                  Hide details
                </button>
              </div>

              {/* Comment Input */}
              <div className='bg-muted/50 border border-border rounded-md p-3 mb-4'>
                <textarea
                  placeholder='Write a comment...'
                  className='w-full bg-transparent text-foreground placeholder-muted-foreground resize-none focus:outline-none'
                  rows={2}
                />
              </div>

              {/* Activity Feed */}
              <div className='space-y-3'>
                {/* Example activity items */}
                <div className='flex items-start gap-3'>
                  <div className='w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-bold'>
                    H
                  </div>
                  <div className='flex-1'>
                    <div className='flex items-center gap-2 text-sm'>
                      <span className='font-medium text-foreground'>
                        healertrix
                      </span>
                      <span className='text-muted-foreground'>
                        marked this card as complete
                      </span>
                      <span className='text-muted-foreground/70 text-xs'>
                        {formatDate(card.updated_at)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className='flex items-start gap-3'>
                  <div className='w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-bold'>
                    H
                  </div>
                  <div className='flex-1'>
                    <div className='flex items-center gap-2 text-sm'>
                      <span className='font-medium text-foreground'>
                        healertrix
                      </span>
                      <span className='text-muted-foreground'>
                        added this card to {listName}
                      </span>
                      <span className='text-muted-foreground/70 text-xs'>
                        {formatDate(card.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className='w-64 space-y-4 flex-shrink-0'>
            {/* Add to card */}
            <div>
              <h4 className='text-sm font-medium text-foreground mb-3'>
                Add to card
              </h4>
              <div className='space-y-2'>
                <button className='w-full flex items-center gap-3 px-3 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm rounded-md transition-colors'>
                  <User className='w-4 h-4' />
                  Members
                </button>
                <button className='w-full flex items-center gap-3 px-3 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm rounded-md transition-colors'>
                  <Tag className='w-4 h-4' />
                  Labels
                </button>
                <button className='w-full flex items-center gap-3 px-3 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm rounded-md transition-colors'>
                  <CheckSquare className='w-4 h-4' />
                  Checklist
                </button>
                <button className='w-full flex items-center gap-3 px-3 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm rounded-md transition-colors'>
                  <Calendar className='w-4 h-4' />
                  Dates
                </button>
                <button className='w-full flex items-center gap-3 px-3 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm rounded-md transition-colors'>
                  <Paperclip className='w-4 h-4' />
                  Attachment
                </button>
                <button className='w-full flex items-center gap-3 px-3 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm rounded-md transition-colors'>
                  <MapPin className='w-4 h-4' />
                  Location
                </button>
                <button className='w-full flex items-center gap-3 px-3 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm rounded-md transition-colors'>
                  <Vote className='w-4 h-4' />
                  Voting
                </button>
              </div>
            </div>

            {/* Actions */}
            <div>
              <h4 className='text-sm font-medium text-foreground mb-3'>
                Actions
              </h4>
              <div className='space-y-2'>
                <button className='w-full flex items-center gap-3 px-3 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm rounded-md transition-colors'>
                  <Move className='w-4 h-4' />
                  Move
                </button>
                <button className='w-full flex items-center gap-3 px-3 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm rounded-md transition-colors'>
                  <Copy className='w-4 h-4' />
                  Copy
                </button>
                <button className='w-full flex items-center gap-3 px-3 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm rounded-md transition-colors'>
                  <Share2 className='w-4 h-4' />
                  Share
                </button>
                <button className='w-full flex items-center gap-3 px-3 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm rounded-md transition-colors'>
                  <Eye className='w-4 h-4' />
                  Watch
                </button>
                {onArchiveCard && (
                  <button
                    onClick={() => onArchiveCard(card.id)}
                    className='w-full flex items-center gap-3 px-3 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm rounded-md transition-colors'
                  >
                    <Archive className='w-4 h-4' />
                    Archive
                  </button>
                )}
                {onDeleteCard && (
                  <button
                    onClick={() => onDeleteCard(card.id)}
                    className='w-full flex items-center gap-3 px-3 py-2.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm rounded-md transition-colors'
                  >
                    <Trash2 className='w-4 h-4' />
                    Delete
                  </button>
                )}
                <button className='w-full flex items-center gap-3 px-3 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-sm rounded-md transition-colors'>
                  <MoreHorizontal className='w-4 h-4' />
                  More actions
                </button>
              </div>
            </div>

            {/* Due Date (if exists) */}
            {card.due_date && (
              <div>
                <h4 className='text-sm font-medium text-foreground mb-3'>
                  Due Date
                </h4>
                <div
                  className={`px-3 py-2 rounded-md text-sm ${
                    card.due_status === 'complete'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : card.due_status === 'overdue'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}
                >
                  <div className='flex items-center gap-2'>
                    <Clock className='w-4 h-4' />
                    {formatDate(card.due_date)}
                  </div>
                  {card.due_status && (
                    <div className='text-xs mt-1 capitalize'>
                      {card.due_status.replace('_', ' ')}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Created info */}
            <div className='text-xs text-muted-foreground space-y-1 pt-4 border-t border-border'>
              <div>Created {formatDate(card.created_at)}</div>
              <div>Updated {formatDate(card.updated_at)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
