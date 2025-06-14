'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  CheckSquare,
  Square,
  Plus,
  X,
  Edit2,
  Trash2,
  MoreHorizontal,
  Check,
  Loader2,
} from 'lucide-react';

interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

interface ChecklistData {
  id: string;
  name: string;
  items: ChecklistItem[];
  created_at: string;
  updated_at: string;
}

interface ChecklistProps {
  checklist: ChecklistData;
  onUpdateChecklist: (
    checklistId: string,
    updates: Partial<ChecklistData>
  ) => Promise<boolean>;
  onDeleteChecklist: (checklistId: string) => Promise<boolean>;
  onAddItem: (checklistId: string, text: string) => Promise<boolean>;
  onUpdateItem: (
    checklistId: string,
    itemId: string,
    updates: Partial<ChecklistItem>
  ) => Promise<boolean>;
  onDeleteItem: (checklistId: string, itemId: string) => Promise<boolean>;
  isLoading?: boolean;
}

export function Checklist({
  checklist,
  onUpdateChecklist,
  onDeleteChecklist,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  isLoading = false,
}: ChecklistProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [checklistName, setChecklistName] = useState(checklist.name);
  const [newItemText, setNewItemText] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState('');
  const [originalItemText, setOriginalItemText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [deletingItemIds, setDeletingItemIds] = useState<Set<string>>(
    new Set()
  );
  const [isDeletingChecklist, setIsDeletingChecklist] = useState(false);

  // Item deletion confirmation
  const [showItemDeleteConfirm, setShowItemDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ChecklistItem | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  // New state for tracking saving items
  const [savingItemIds, setSavingItemIds] = useState<Set<string>>(new Set());

  // State for tracking checklist title saving
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [originalChecklistName, setOriginalChecklistName] = useState('');

  // Ref for the add input field
  const addInputRef = useRef<HTMLInputElement>(null);

  // Calculate progress
  const totalItems = checklist.items.length;
  const completedItems = checklist.items.filter(
    (item) => item.completed
  ).length;
  const progressPercentage =
    totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  // Sync checklistName with prop when it changes (e.g., from parent optimistic update)
  useEffect(() => {
    if (!isEditingName && !isSavingTitle) {
      setChecklistName(checklist.name);
    }
  }, [checklist.name, isEditingName, isSavingTitle]);

  // Handle ESC key for checklist delete confirmation modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showDeleteConfirm) {
        e.stopPropagation(); // Prevent parent modal from closing
        setShowDeleteConfirm(false);
      }
    };

    if (showDeleteConfirm) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [showDeleteConfirm]);

  // Handle ESC key for item delete confirmation modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showItemDeleteConfirm) {
        e.stopPropagation(); // Prevent parent modal from closing
        cancelDeleteItem();
      }
    };

    if (showItemDeleteConfirm) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [showItemDeleteConfirm]);

  // Remove the global event listener - we'll only use inline handlers like AddListForm does

  const handleSaveChecklistName = async () => {
    if (checklistName.trim() && checklistName !== checklist.name) {
      const nameToSave = checklistName.trim();

      // Close the input immediately (optimistic UI)
      setIsEditingName(false);

      // Set saving state
      setIsSavingTitle(true);

      const success = await onUpdateChecklist(checklist.id, {
        name: nameToSave,
      });

      // Remove saving state
      setIsSavingTitle(false);

      if (!success) {
        // On failure, revert to original name
        setChecklistName(originalChecklistName);
      }
    } else {
      setIsEditingName(false);
      setChecklistName(checklist.name);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newItemText.trim() && !isLoading) {
      const itemText = newItemText.trim();

      // Clear input immediately for continuous adding
      setNewItemText('');

      // Call onAddItem which will handle optimistic update
      const success = await onAddItem(checklist.id, itemText);

      if (!success) {
        // Restore text if adding failed
        setNewItemText(itemText);
      }

      // Keep focus on input for continuous adding
      setTimeout(() => {
        addInputRef.current?.focus();
      }, 0);

      // Keep the form open for continuous adding
      // Don't set setIsAddingItem(false) here
    }
  };

  const handleToggleItem = async (item: ChecklistItem) => {
    // Add optimistic update with saving state
    setSavingItemIds((prev) => new Set(prev).add(item.id));

    const success = await onUpdateItem(checklist.id, item.id, {
      completed: !item.completed,
    });

    // Remove saving state
    setSavingItemIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(item.id);
      return newSet;
    });
  };

  const handleEditItem = (item: ChecklistItem) => {
    const isSaving = savingItemIds.has(item.id) || item.id.startsWith('temp-');
    if (!isSaving) {
      setEditingItemId(item.id);
      setEditingItemText(item.text);
      setOriginalItemText(item.text);
    }
  };

  const handleSaveEditItem = async () => {
    if (editingItemText.trim() && editingItemId) {
      // Only proceed if text has actually changed
      if (editingItemText.trim() === originalItemText.trim()) {
        setEditingItemId(null);
        setEditingItemText('');
        setOriginalItemText('');
        return;
      }

      const itemIdToSave = editingItemId;
      const textToSave = editingItemText.trim();

      // Close the input immediately (optimistic UI)
      setEditingItemId(null);
      setEditingItemText('');
      setOriginalItemText('');

      // Add saving state
      setSavingItemIds((prev) => new Set(prev).add(itemIdToSave));

      const success = await onUpdateItem(checklist.id, itemIdToSave, {
        text: textToSave,
      });

      // Remove saving state
      setSavingItemIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(itemIdToSave);
        return newSet;
      });

      if (!success) {
        // On failure, we don't need to do anything special since onUpdateItem
        // will handle reverting the optimistic update in the parent component
      }
    } else {
      setEditingItemId(null);
      setEditingItemText('');
      setOriginalItemText('');
    }
  };

  const handleDeleteItem = (item: ChecklistItem) => {
    setItemToDelete(item);
    setShowItemDeleteConfirm(true);
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;

    setIsDeletingItem(true);

    // Add visual feedback for deletion
    setDeletingItemIds((prev) => new Set(prev).add(itemToDelete.id));

    const success = await onDeleteItem(checklist.id, itemToDelete.id);

    // Remove from deleting state regardless of success/failure
    setDeletingItemIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(itemToDelete.id);
      return newSet;
    });

    setIsDeletingItem(false);
    setShowItemDeleteConfirm(false);
    setItemToDelete(null);
  };

  const cancelDeleteItem = () => {
    setShowItemDeleteConfirm(false);
    setItemToDelete(null);
  };

  const handleDeleteChecklist = async () => {
    setIsDeletingChecklist(true);
    const success = await onDeleteChecklist(checklist.id);
    if (success) {
      setShowDeleteConfirm(false);
    }
    setIsDeletingChecklist(false);
  };

  return (
    <div className='bg-muted/30 rounded-xl p-4 border border-border/50'>
      {/* Checklist Header */}
      <div className='flex items-center justify-between mb-4'>
        <div className='flex items-center gap-3 flex-1'>
          <CheckSquare className='w-5 h-5 text-muted-foreground' />
          {isEditingName ? (
            <div className='flex items-center gap-2 flex-1'>
              <input
                type='text'
                value={checklistName}
                onChange={(e) => setChecklistName(e.target.value)}
                onBlur={handleSaveChecklistName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSaveChecklistName();
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    setChecklistName(originalChecklistName);
                    setIsEditingName(false);
                  }
                }}
                className='text-base font-semibold bg-transparent border-b-2 border-primary focus:outline-none flex-1'
                autoFocus
                disabled={isLoading || isSavingTitle}
                aria-label='Edit checklist name'
                placeholder='Checklist name'
              />
              {isSavingTitle && (
                <Loader2 className='w-4 h-4 animate-spin text-muted-foreground' />
              )}
            </div>
          ) : (
            <div className='flex items-center gap-2 flex-1'>
              <h4
                className={`text-base font-semibold text-foreground transition-colors ${
                  isSavingTitle
                    ? 'cursor-not-allowed'
                    : 'cursor-pointer hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 -my-1'
                }`}
                onClick={() => {
                  if (!isSavingTitle) {
                    setOriginalChecklistName(checklist.name);
                    setChecklistName(checklist.name);
                    setIsEditingName(true);
                  }
                }}
              >
                {checklistName}
              </h4>

              {/* Title saving indicator */}
              {isSavingTitle && (
                <div className='flex items-center gap-1 text-muted-foreground'>
                  <Loader2 className='w-3 h-3 animate-spin' />
                  <span className='text-xs'>Saving...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className='flex items-center gap-2'>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className='p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors'
            title='Delete checklist'
            disabled={isLoading}
          >
            <Trash2 className='w-4 h-4' />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {totalItems > 0 && (
        <div className='mb-4'>
          <div className='flex items-center justify-between mb-2'>
            <span className='text-sm font-medium text-foreground'>
              {completedItems}/{totalItems} completed
            </span>
            <span className='text-sm font-bold text-primary'>
              {progressPercentage}%
            </span>
          </div>
          <div className='w-full bg-muted rounded-full h-2'>
            <div
              className='bg-primary h-2 rounded-full transition-all duration-300 ease-out'
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Checklist Items */}
      <div className='space-y-2 mb-4'>
        {checklist.items.map((item) => {
          const isDeleting = deletingItemIds.has(item.id);
          const isSaving =
            savingItemIds.has(item.id) || item.id.startsWith('temp-');
          const isEditing = editingItemId === item.id;
          const isDisabled = isDeleting || isLoading;

          return (
            <div
              key={item.id}
              className={`flex items-center gap-3 p-2 rounded-lg border transition-all duration-200 ${
                isDeleting
                  ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800 opacity-50'
                  : item.completed
                  ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                  : 'bg-background border-border hover:bg-muted/50'
              }`}
              onMouseEnter={() =>
                !isDisabled && !isDeleting && setHoveredItemId(item.id)
              }
              onMouseLeave={() => setHoveredItemId(null)}
            >
              {/* Checkbox */}
              <button
                onClick={() => handleToggleItem(item)}
                className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                  item.completed
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-muted-foreground hover:border-primary'
                } ${
                  isDisabled
                    ? 'opacity-50 cursor-not-allowed'
                    : isSaving
                    ? 'cursor-not-allowed'
                    : ''
                }`}
                disabled={isDisabled || isSaving}
              >
                {item.completed && <Check className='w-3 h-3' />}
              </button>

              {/* Item Text */}
              {isEditing ? (
                <input
                  type='text'
                  value={editingItemText}
                  onChange={(e) => setEditingItemText(e.target.value)}
                  onBlur={handleSaveEditItem}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSaveEditItem();
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditingItemId(null);
                      setEditingItemText('');
                      setOriginalItemText('');
                    }
                  }}
                  className='flex-1 bg-background border border-border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'
                  autoFocus
                  disabled={isDisabled}
                  aria-label='Edit checklist item'
                  placeholder='Item text'
                />
              ) : (
                <span
                  className={`flex-1 text-sm transition-all duration-200 ${
                    isDeleting
                      ? 'text-red-500 line-through cursor-not-allowed'
                      : item.completed
                      ? 'text-muted-foreground line-through'
                      : 'text-foreground'
                  } ${
                    !isDisabled && !isSaving
                      ? 'cursor-pointer hover:text-primary'
                      : isSaving
                      ? 'cursor-not-allowed'
                      : 'cursor-not-allowed opacity-50'
                  }`}
                  onClick={() =>
                    !isDisabled && !isSaving && handleEditItem(item)
                  }
                >
                  {item.text}
                </span>
              )}

              {/* Saving indicator */}
              {isSaving && (
                <div className='flex items-center gap-2 text-muted-foreground'>
                  <Loader2 className='w-3 h-3 animate-spin' />
                  <span className='text-xs'>Saving...</span>
                </div>
              )}

              {/* Item Actions */}
              {!isEditing && !isSaving && !isDeleting && (
                <div
                  className={`flex items-center gap-1 transition-opacity duration-200 ${
                    hoveredItemId === item.id && !isDisabled
                      ? 'opacity-100'
                      : 'opacity-0'
                  }`}
                >
                  <button
                    onClick={() => handleEditItem(item)}
                    className='p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors'
                    title='Edit item'
                    disabled={isDisabled}
                  >
                    <Edit2 className='w-3 h-3' />
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item)}
                    className='p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors'
                    title='Delete item'
                    disabled={isDisabled}
                  >
                    <X className='w-3 h-3' />
                  </button>
                </div>
              )}

              {/* Deleting indicator */}
              {isDeleting && (
                <div className='flex items-center gap-2 text-red-500'>
                  <Loader2 className='w-3 h-3 animate-spin' />
                  <span className='text-xs'>Deleting...</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add New Item */}
      {isAddingItem ? (
        <div className='space-y-2'>
          <form onSubmit={handleAddItem} className='flex gap-2'>
            <input
              ref={addInputRef}
              type='text'
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder='Add an item...'
              className='flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'
              autoFocus
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsAddingItem(false);
                  setNewItemText('');
                }
              }}
            />
            <button
              type='submit'
              disabled={!newItemText.trim() || isLoading}
              className='px-3 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
            >
              Add
            </button>
          </form>
          <div className='flex justify-between items-center'>
            <p className='text-xs text-muted-foreground'>
              Press Enter to add, Escape to cancel
            </p>
            <button
              type='button'
              onClick={() => {
                setIsAddingItem(false);
                setNewItemText('');
              }}
              className='text-xs text-muted-foreground hover:text-foreground transition-colors'
              disabled={isLoading}
            >
              Done adding
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAddingItem(true)}
          className='w-full flex items-center gap-2 p-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors border-2 border-dashed border-muted-foreground/30 hover:border-primary/50'
          disabled={isLoading}
        >
          <Plus className='w-4 h-4' />
          Add an item
        </button>
      )}

      {/* Enhanced Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className='fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4'>
          <div className='bg-card rounded-xl shadow-2xl border border-border max-w-md w-full'>
            <div className='p-6'>
              <div className='flex items-center gap-3 mb-4'>
                <div className='w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center'>
                  <Trash2 className='w-5 h-5 text-red-600 dark:text-red-400' />
                </div>
                <div>
                  <h3 className='text-lg font-semibold text-foreground'>
                    Delete Checklist
                  </h3>
                  <p className='text-sm text-muted-foreground'>
                    This action cannot be undone
                  </p>
                </div>
              </div>

              <p className='text-sm text-foreground mb-6'>
                Are you sure you want to delete{' '}
                <span className='font-medium'>"{checklist.name}"</span>? This
                will permanently remove the checklist and all {totalItems} item
                {totalItems !== 1 ? 's' : ''} from this card.
              </p>

              <div className='flex gap-3 justify-end'>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className='px-4 py-2 text-sm font-medium text-foreground bg-secondary hover:bg-secondary/80 rounded-md transition-colors'
                  disabled={isDeletingChecklist}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteChecklist}
                  disabled={isDeletingChecklist}
                  className='flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors'
                >
                  {isDeletingChecklist ? (
                    <>
                      <Loader2 className='w-4 h-4 animate-spin' />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className='w-4 h-4' />
                      Delete Checklist
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Item Delete Confirmation Modal */}
      {showItemDeleteConfirm && itemToDelete && (
        <div className='fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4'>
          <div className='bg-card rounded-xl shadow-2xl border border-border max-w-md w-full'>
            <div className='p-6'>
              <div className='flex items-center gap-3 mb-4'>
                <div className='w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center'>
                  <Trash2 className='w-5 h-5 text-red-600 dark:text-red-400' />
                </div>
                <div>
                  <h3 className='text-lg font-semibold text-foreground'>
                    Delete Item
                  </h3>
                  <p className='text-sm text-muted-foreground'>
                    This action cannot be undone
                  </p>
                </div>
              </div>

              <p className='text-sm text-foreground mb-6'>
                Are you sure you want to delete{' '}
                <span className='font-medium'>"{itemToDelete.text}"</span>? This
                will permanently remove the item from this checklist.
              </p>

              <div className='flex gap-3 justify-end'>
                <button
                  onClick={cancelDeleteItem}
                  className='px-4 py-2 text-sm font-medium text-foreground bg-secondary hover:bg-secondary/80 rounded-md transition-colors'
                  disabled={isDeletingItem}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteItem}
                  disabled={isDeletingItem}
                  className='flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors'
                >
                  {isDeletingItem ? (
                    <>
                      <Loader2 className='w-4 h-4 animate-spin' />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className='w-4 h-4' />
                      Delete Item
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
