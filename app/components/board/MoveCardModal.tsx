'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown, Move, LayoutGrid, CheckCircle2 } from 'lucide-react';

interface MoveCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardId: string;
  cardTitle: string;
  currentListId: string;
  boardId: string;
  onMoveSuccess?: () => void;
}

interface ListOption {
  id: string;
  name: string;
  cards_count: number;
}

export function MoveCardModal({
  isOpen,
  onClose,
  cardId,
  cardTitle,
  currentListId,
  boardId,
  onMoveSuccess,
}: MoveCardModalProps) {
  const [isMovingCard, setIsMovingCard] = useState(false);
  const [availableLists, setAvailableLists] = useState<ListOption[]>([]);
  const [selectedListId, setSelectedListId] = useState('');
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [isListDropdownOpen, setIsListDropdownOpen] = useState(false);
  const dropdownButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch available lists when modal opens
  const fetchAvailableLists = async () => {
    setIsLoadingLists(true);
    try {
      console.log('Fetching lists for board:', boardId);
      console.log('Current list ID:', currentListId);

      const response = await fetch(`/api/lists?board_id=${boardId}`);
      if (response.ok) {
        const data = await response.json();
        console.log('API response:', data);

        // Extract lists from the response data structure
        const lists = data.lists || [];
        console.log('All lists received:', lists);

        // Filter out the current list and format for dropdown
        const filteredLists = lists
          .filter((list: any) => list.id !== currentListId)
          .map((list: any) => ({
            id: list.id,
            name: list.name,
            cards_count: list.cards?.length || 0,
          }));

        console.log('Filtered lists (excluding current):', filteredLists);

        setAvailableLists(filteredLists);

        // Auto-select first available list if any
        if (filteredLists.length > 0) {
          setSelectedListId(filteredLists[0].id);
        }
      } else {
        console.error('Failed to fetch lists. Status:', response.status);
        const errorData = await response.text();
        console.error('Error response:', errorData);
      }
    } catch (error) {
      console.error('Error fetching lists:', error);
    } finally {
      setIsLoadingLists(false);
    }
  };

  // Handle moving the card
  const handleMoveCard = async () => {
    console.log('Move card clicked. Selected list ID:', selectedListId);
    console.log('Card ID:', cardId);
    console.log('Is moving:', isMovingCard);

    if (!selectedListId || isMovingCard) {
      console.log('Cannot move: missing selectedListId or already moving');
      return;
    }

    setIsMovingCard(true);

    try {
      console.log('Making API call to move card...');
      const response = await fetch(`/api/cards/${cardId}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          list_id: selectedListId,
          position: 999999, // Move to end of list
        }),
      });

      const data = await response.json();
      console.log('Move API response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to move card');
      }

      console.log('Card moved successfully');
      // Close modal and trigger success callback
      onClose();
      if (onMoveSuccess) {
        onMoveSuccess();
      }
    } catch (error) {
      console.error('Error moving card:', error);
      // Handle error - could show a toast notification here
    } finally {
      setIsMovingCard(false);
    }
  };

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      fetchAvailableLists();
      setSelectedListId('');
      setIsListDropdownOpen(false);
    }
  }, [isOpen, boardId, currentListId]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isListDropdownOpen) {
          setIsListDropdownOpen(false);
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isListDropdownOpen, onClose]);

  // Handle click outside dropdown
  useEffect(() => {
    if (!isListDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownButtonRef.current &&
        !dropdownButtonRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsListDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isListDropdownOpen]);

  if (!isOpen) return null;

  const selectedList = availableLists.find(
    (list) => list.id === selectedListId
  );

  const modalContent = (
    <>
      {/* Backdrop */}
      <div
        className='fixed inset-0 bg-black/50 backdrop-blur-sm z-[70]'
        onClick={() => !isMovingCard && onClose()}
      />

      {/* Modal Container */}
      <div className='fixed inset-0 z-[80] flex items-center justify-center p-4 pointer-events-none'>
        <div className='bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200 pointer-events-auto'>
          {/* Header with Gradient */}
          <div className='bg-gradient-to-r from-primary to-primary/90 px-6 py-4'>
            <div className='flex items-center justify-between text-white'>
              <div className='flex items-center gap-3'>
                <div className='w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center'>
                  <Move className='w-4 h-4' />
                </div>
                <div>
                  <h3 className='text-lg font-semibold'>Move Card</h3>
                  <p className='text-sm text-white/80'>
                    Choose destination list
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className='p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200'
                title='Close modal'
                aria-label='Close modal'
                disabled={isMovingCard}
              >
                <X className='w-5 h-5' />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className='p-6'>
            {isLoadingLists ? (
              <div className='flex items-center justify-center py-12'>
                <div className='flex items-center gap-3'>
                  <div className='w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin' />
                  <span className='text-sm text-muted-foreground font-medium'>
                    Loading lists...
                  </span>
                </div>
              </div>
            ) : availableLists.length === 0 ? (
              <div className='text-center py-12'>
                <div className='w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4'>
                  <LayoutGrid className='w-8 h-8 text-muted-foreground' />
                </div>
                <p className='text-sm text-muted-foreground'>
                  No other lists available to move to
                </p>
              </div>
            ) : (
              <div className='space-y-4'>
                {/* Card Info */}
                <div className='text-sm text-muted-foreground'>
                  Moving card{' '}
                  <span className='font-medium text-foreground'>
                    "{cardTitle}"
                  </span>
                </div>

                {/* List Selection */}
                <div className='space-y-2'>
                  <label className='block text-sm font-medium text-foreground'>
                    Move to list
                  </label>

                  <div className='relative'>
                    <button
                      ref={dropdownButtonRef}
                      onClick={() =>
                        !isMovingCard &&
                        setIsListDropdownOpen(!isListDropdownOpen)
                      }
                      className='w-full bg-background border-2 border-border hover:border-primary/50 rounded-xl px-4 py-3 text-left flex items-center justify-between transition-all duration-200 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20 group'
                      disabled={isMovingCard}
                    >
                      <div className='flex items-center gap-3'>
                        {selectedListId ? (
                          <>
                            <div className='w-3 h-3 bg-gradient-to-r from-green-400 to-blue-500 rounded-full' />
                            <span className='font-medium text-foreground'>
                              {selectedList?.name}
                            </span>
                            <span className='text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full'>
                              {selectedList?.cards_count} cards
                            </span>
                          </>
                        ) : (
                          <>
                            <div className='w-3 h-3 bg-muted rounded-full' />
                            <span className='text-muted-foreground'>
                              Choose a list...
                            </span>
                          </>
                        )}
                      </div>
                      <ChevronDown
                        className={`w-5 h-5 text-muted-foreground transition-transform duration-200 group-hover:text-foreground ${
                          isListDropdownOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {availableLists.length > 0 && (
              <div className='flex gap-3 justify-end mt-8 pt-6 border-t border-border'>
                <button
                  onClick={onClose}
                  className='px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all duration-200'
                  disabled={isMovingCard}
                >
                  Cancel
                </button>
                <button
                  onClick={handleMoveCard}
                  disabled={!selectedListId || isMovingCard}
                  className='px-6 py-3 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2'
                >
                  {isMovingCard ? (
                    <>
                      <div className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                      Moving...
                    </>
                  ) : (
                    <>
                      <Move className='w-4 h-4' />
                      Move Card
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom Dropdown - positioned outside modal to avoid clipping */}
      {isListDropdownOpen && (
        <div
          ref={dropdownRef}
          className='fixed bg-card border-2 border-border rounded-xl shadow-2xl z-[150] overflow-hidden max-h-64 overflow-y-auto'
          style={{
            top: dropdownButtonRef.current
              ? `${
                  dropdownButtonRef.current.getBoundingClientRect().bottom + 8
                }px`
              : '50%',
            left: dropdownButtonRef.current
              ? `${dropdownButtonRef.current.getBoundingClientRect().left}px`
              : '50%',
            width: dropdownButtonRef.current
              ? `${dropdownButtonRef.current.getBoundingClientRect().width}px`
              : '300px',
          }}
        >
          {availableLists.map((list, index) => (
            <button
              key={list.id}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Selecting list:', list.name, list.id);
                setSelectedListId(list.id);
                setIsListDropdownOpen(false);
              }}
              className={`w-full px-4 py-3 text-left hover:bg-muted/80 transition-colors duration-200 flex items-center gap-3 border-b border-border/50 last:border-b-0 ${
                selectedListId === list.id
                  ? 'bg-primary/10 dark:bg-primary/10'
                  : ''
              }`}
              title={`Move card to ${list.name}`}
              type='button'
            >
              <div
                className={`w-3 h-3 rounded-full ${
                  index % 4 === 0
                    ? 'bg-gradient-to-r from-red-400 to-pink-500'
                    : index % 4 === 1
                    ? 'bg-gradient-to-r from-blue-400 to-purple-500'
                    : index % 4 === 2
                    ? 'bg-gradient-to-r from-green-400 to-blue-500'
                    : 'bg-gradient-to-r from-yellow-400 to-orange-500'
                }`}
              />
              <div className='flex-1'>
                <div className='font-medium text-foreground'>{list.name}</div>
              </div>
              <span className='text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full'>
                {list.cards_count} cards
              </span>
              {selectedListId === list.id && (
                <CheckCircle2 className='w-4 h-4 text-primary' />
              )}
            </button>
          ))}
        </div>
      )}
    </>
  );

  return typeof window !== 'undefined'
    ? createPortal(modalContent, document.body)
    : null;
}
