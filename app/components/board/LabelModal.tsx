'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Edit2,
  Trash2,
  Check,
  Palette,
  Sparkles,
  Pipette,
  AlertTriangle,
} from 'lucide-react';

interface Label {
  id: string;
  name: string | null;
  color: string;
  board_id: string;
  created_at: string;
  updated_at: string;
}

interface CardLabel {
  id: string;
  created_at: string;
  labels: Label;
}

interface LabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardId: string;
  boardId: string;
  onLabelsUpdated?: (labelId?: string, labelData?: any) => void;
}

const LABEL_COLORS = [
  // Vibrant Colors
  { name: 'Emerald', value: '#10b981', category: 'vibrant' },
  { name: 'Blue', value: '#3b82f6', category: 'vibrant' },
  { name: 'Purple', value: '#8b5cf6', category: 'vibrant' },
  { name: 'Pink', value: '#ec4899', category: 'vibrant' },
  { name: 'Red', value: '#ef4444', category: 'vibrant' },
  { name: 'Orange', value: '#f97316', category: 'vibrant' },
  { name: 'Yellow', value: '#eab308', category: 'vibrant' },
  { name: 'Lime', value: '#84cc16', category: 'vibrant' },

  // Soft Colors
  { name: 'Soft Green', value: '#6ee7b7', category: 'soft' },
  { name: 'Soft Blue', value: '#93c5fd', category: 'soft' },
  { name: 'Soft Purple', value: '#c4b5fd', category: 'soft' },
  { name: 'Soft Pink', value: '#f9a8d4', category: 'soft' },
  { name: 'Soft Red', value: '#fca5a5', category: 'soft' },
  { name: 'Soft Orange', value: '#fed7aa', category: 'soft' },
  { name: 'Soft Yellow', value: '#fde047', category: 'soft' },
  { name: 'Soft Lime', value: '#bef264', category: 'soft' },

  // Dark Colors
  { name: 'Forest', value: '#065f46', category: 'dark' },
  { name: 'Navy', value: '#1e3a8a', category: 'dark' },
  { name: 'Indigo', value: '#3730a3', category: 'dark' },
  { name: 'Plum', value: '#7c2d12', category: 'dark' },
  { name: 'Crimson', value: '#991b1b', category: 'dark' },
  { name: 'Amber', value: '#92400e', category: 'dark' },
  { name: 'Slate', value: '#374151', category: 'dark' },
  { name: 'Stone', value: '#57534e', category: 'dark' },

  // Neutral Colors
  { name: 'Gray', value: '#6b7280', category: 'neutral' },
  { name: 'Cool Gray', value: '#64748b', category: 'neutral' },
  { name: 'Zinc', value: '#71717a', category: 'neutral' },
  { name: 'Neutral', value: '#737373', category: 'neutral' },
];

const COLOR_CATEGORIES = [
  { id: 'vibrant', name: 'Vibrant', icon: Sparkles },
  { id: 'soft', name: 'Soft', icon: Palette },
  { id: 'dark', name: 'Dark', icon: Palette },
  { id: 'neutral', name: 'Neutral', icon: Palette },
  { id: 'custom', name: 'Custom', icon: Pipette },
];

// Helper function to determine if a color is light (needs black text)
const isColorLight = (hexColor: string): boolean => {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128;
};

export default function LabelModal({
  isOpen,
  onClose,
  cardId,
  boardId,
  onLabelsUpdated,
}: LabelModalProps) {
  const [boardLabels, setBoardLabels] = useState<Label[]>([]);
  const [cardLabels, setCardLabels] = useState<CardLabel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLabels, setIsLoadingLabels] = useState(true);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(LABEL_COLORS[0].value);
  const [selectedCategory, setSelectedCategory] = useState('vibrant');
  const [customColor, setCustomColor] = useState('#3b82f6');
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    label: Label | null;
  }>({
    isOpen: false,
    label: null,
  });

  useEffect(() => {
    if (isOpen) {
      setIsLoadingLabels(true);
      Promise.all([fetchLabels(), fetchCardLabels()]).finally(() => {
        setIsLoadingLabels(false);
      });
    }
  }, [isOpen, cardId, boardId]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();

        if (deleteConfirm.isOpen) {
          setDeleteConfirm({ isOpen: false, label: null });
        } else if (editingLabel) {
          cancelEdit();
        } else if (isCreating) {
          cancelCreate();
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, editingLabel, isCreating, deleteConfirm.isOpen, onClose]);

  const fetchLabels = async () => {
    try {
      const response = await fetch(`/api/boards/${boardId}/labels`);
      if (response.ok) {
        const data = await response.json();
        setBoardLabels(data.labels || []);
      }
    } catch (error) {
      console.error('Failed to fetch labels:', error);
    }
  };

  const fetchCardLabels = async () => {
    try {
      const response = await fetch(`/api/cards/${cardId}/labels`);
      if (response.ok) {
        const data = await response.json();
        setCardLabels(data.labels || []);
      }
    } catch (error) {
      console.error('Failed to fetch card labels:', error);
    }
  };

  const createLabel = async () => {
    if (!newColor) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/boards/${boardId}/labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName || null, color: newColor }),
      });

      if (response.ok) {
        const data = await response.json();
        setBoardLabels((prev) => [...prev, data.label]);
        cancelCreate();

        // Notify parent components that labels have been updated (new label)
        onLabelsUpdated?.();
      } else {
        const errorData = await response.json();
        console.error('Failed to create label:', errorData);
        alert(`Failed to create label: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to create label:', error);
      alert(
        'Failed to create label. Please check your connection and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const updateLabel = async (labelId: string) => {
    if (!editColor) return;

    setIsLoading(true);
    try {
      // Store the old color before updating
      const oldLabel = boardLabels.find((label) => label.id === labelId);
      const oldColor = oldLabel?.color;

      const response = await fetch(`/api/boards/${boardId}/labels/${labelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName || null, color: editColor }),
      });

      if (response.ok) {
        const data = await response.json();
        setBoardLabels((prev) =>
          prev.map((label) => (label.id === labelId ? data.label : label))
        );
        cancelEdit();

        setCardLabels((prev) =>
          prev.map((cardLabel) =>
            cardLabel.labels.id === labelId
              ? { ...cardLabel, labels: data.label }
              : cardLabel
          )
        );

        // Notify parent components with specific label update info
        onLabelsUpdated?.(labelId, {
          id: labelId,
          color: data.label.color,
          name: data.label.name,
          oldColor: oldColor,
        });
      }
    } catch (error) {
      console.error('Failed to update label:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDeleteLabel = (label: Label) => {
    setDeleteConfirm({ isOpen: true, label });
  };

  const deleteLabel = async () => {
    if (!deleteConfirm.label) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/boards/${boardId}/labels/${deleteConfirm.label.id}`,
        {
          method: 'DELETE',
        }
      );

      if (response.ok) {
        setBoardLabels((prev) =>
          prev.filter((label) => label.id !== deleteConfirm.label!.id)
        );
        setCardLabels((prev) =>
          prev.filter(
            (cardLabel) => cardLabel.labels.id !== deleteConfirm.label!.id
          )
        );
        setDeleteConfirm({ isOpen: false, label: null });

        // Notify parent components that labels have been updated (deleted label)
        onLabelsUpdated?.();
      }
    } catch (error) {
      console.error('Failed to delete label:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCardLabel = async (labelId: string) => {
    const isAssigned = cardLabels.some(
      (cardLabel) => cardLabel.labels.id === labelId
    );

    setIsLoading(true);
    try {
      if (isAssigned) {
        const response = await fetch(`/api/cards/${cardId}/labels/${labelId}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setCardLabels((prev) =>
            prev.filter((cardLabel) => cardLabel.labels.id !== labelId)
          );
        }
      } else {
        const response = await fetch(`/api/cards/${cardId}/labels`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ labelId }),
        });

        if (response.ok) {
          const data = await response.json();
          setCardLabels((prev) => [...prev, data.cardLabel]);
        }
      }

      // Notify parent components that card labels have been updated (toggle)
      onLabelsUpdated?.();
    } catch (error) {
      console.error('Failed to toggle card label:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startEdit = (label: Label) => {
    setEditingLabel(label.id);
    setEditName(label.name || '');
    setEditColor(label.color);
    setSelectedCategory('vibrant');
  };

  const cancelEdit = () => {
    setEditingLabel(null);
    setEditName('');
    setEditColor('');
  };

  const cancelCreate = () => {
    setIsCreating(false);
    setNewName('');
    setNewColor(LABEL_COLORS[0].value);
    setSelectedCategory('vibrant');
    setCustomColor('#3b82f6');
  };

  const filteredColors =
    selectedCategory === 'custom'
      ? []
      : LABEL_COLORS.filter((color) => color.category === selectedCategory);

  if (!isOpen) return null;

  return (
    <>
      <div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4'>
        <div className='bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border overflow-hidden'>
          {/* Header */}
          <div className='relative bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border-b border-border'>
            <div className='flex items-center gap-3'>
              <div className='w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center'>
                <Palette className='w-5 h-5 text-primary' />
              </div>
              <div>
                <h2 className='text-xl font-semibold text-foreground'>
                  Labels
                </h2>
                <p className='text-sm text-muted-foreground'>
                  Organize your cards with colorful labels
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className='absolute top-4 right-4 p-2 hover:bg-muted rounded-xl transition-colors'
              title='Close labels modal'
            >
              <X className='w-5 h-5' />
            </button>
          </div>

          {/* Content */}
          <div className='flex flex-col h-full'>
            <div className='flex-1 max-h-[60vh] overflow-y-auto'>
              <div className='p-6 space-y-6'>
                {/* Existing Labels - Only show when not creating and not editing */}
                {!isCreating && !editingLabel && (
                  <div className='space-y-3'>
                    <h3 className='text-sm font-medium text-muted-foreground uppercase tracking-wider'>
                      Available Labels
                    </h3>
                    <div className='space-y-3'>
                      {isLoadingLabels ? (
                        // Skeleton loading state
                        <>
                          {Array.from({ length: 3 }).map((_, index) => (
                            <div
                              key={index}
                              className='group flex items-center gap-3'
                            >
                              <div className='flex-1 relative flex items-center justify-between px-4 py-3 rounded-xl min-h-[44px] bg-muted animate-pulse'>
                                <div className='h-4 bg-muted-foreground/20 rounded w-24'></div>
                              </div>
                              <div className='flex gap-1'>
                                <div className='w-8 h-8 bg-muted rounded-lg animate-pulse'></div>
                                <div className='w-8 h-8 bg-muted rounded-lg animate-pulse'></div>
                              </div>
                            </div>
                          ))}
                        </>
                      ) : boardLabels.length > 0 ? (
                        boardLabels.map((label) => {
                          const isAssigned = cardLabels.some(
                            (cardLabel) => cardLabel.labels.id === label.id
                          );
                          const isLight = isColorLight(label.color);

                          return (
                            <div
                              key={label.id}
                              className='group flex items-center gap-3'
                            >
                              {/* Label Display */}
                              <button
                                onClick={() => toggleCardLabel(label.id)}
                                disabled={isLoading}
                                className={`flex-1 relative flex items-center justify-between px-4 py-3 rounded-xl transition-all disabled:opacity-50 hover:scale-[1.02] shadow-sm min-h-[44px] ${
                                  isAssigned
                                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg'
                                    : 'hover:shadow-md'
                                }`}
                                style={{ backgroundColor: label.color }}
                              >
                                <span
                                  className={`font-medium text-sm ${
                                    isLight ? 'text-black' : 'text-white'
                                  }`}
                                >
                                  {label.name || ''}
                                </span>
                                {isAssigned && (
                                  <div className='flex items-center justify-center w-6 h-6 bg-white/20 backdrop-blur-sm rounded-full'>
                                    <Check
                                      className={`w-4 h-4 ${
                                        isLight ? 'text-black' : 'text-white'
                                      } drop-shadow-md`}
                                    />
                                  </div>
                                )}
                              </button>

                              {/* Action Buttons */}
                              <div className='flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                                <button
                                  onClick={() => startEdit(label)}
                                  className='p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground'
                                  title='Edit label'
                                >
                                  <Edit2 className='w-4 h-4' />
                                </button>
                                <button
                                  onClick={() => confirmDeleteLabel(label)}
                                  className='p-2 hover:bg-destructive/10 rounded-lg transition-colors text-muted-foreground hover:text-destructive'
                                  title='Delete label'
                                >
                                  <Trash2 className='w-4 h-4' />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className='text-center py-8'>
                          <div className='w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-3'>
                            <Palette className='w-8 h-8 text-muted-foreground' />
                          </div>
                          <p className='text-sm text-muted-foreground'>
                            No labels yet
                          </p>
                          <p className='text-xs text-muted-foreground mt-1'>
                            Create your first label to get started
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Edit Label */}
                {editingLabel && (
                  <div className='space-y-4'>
                    <div className='flex items-center justify-between'>
                      <h3 className='text-lg font-semibold text-foreground'>
                        Edit Label
                      </h3>
                      <button
                        onClick={cancelEdit}
                        className='p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground'
                        title='Cancel editing'
                      >
                        <X className='w-4 h-4' />
                      </button>
                    </div>

                    <div className='space-y-4'>
                      <input
                        type='text'
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder='Label name (optional)'
                        className='w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors'
                      />

                      {/* Color Categories */}
                      <div className='space-y-3'>
                        <div className='flex gap-2 flex-wrap'>
                          {COLOR_CATEGORIES.map((category) => {
                            const Icon = category.icon;
                            return (
                              <button
                                key={category.id}
                                onClick={() => setSelectedCategory(category.id)}
                                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                  selectedCategory === category.id
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                }`}
                              >
                                <Icon className='w-3 h-3' />
                                {category.name}
                              </button>
                            );
                          })}
                        </div>

                        {selectedCategory === 'custom' ? (
                          <div className='space-y-3'>
                            <div className='flex items-center gap-3'>
                              <div className='relative group'>
                                <input
                                  type='color'
                                  value={customColor}
                                  onChange={(e) => {
                                    setCustomColor(e.target.value);
                                    setEditColor(e.target.value);
                                  }}
                                  className='w-12 h-12 rounded-lg border-0 cursor-pointer opacity-0 absolute inset-0 z-10'
                                  title='Choose custom color'
                                />
                                <div
                                  className='w-12 h-12 rounded-lg border-2 border-border shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-200 relative overflow-hidden pointer-events-none'
                                  style={{ backgroundColor: customColor }}
                                >
                                  <div className='absolute bottom-1 right-1 w-3 h-3 bg-white/90 rounded-full flex items-center justify-center shadow-sm pointer-events-none'>
                                    <Pipette className='w-2 h-2 text-gray-600' />
                                  </div>
                                </div>
                              </div>
                              <div className='flex-1'>
                                <input
                                  type='text'
                                  value={customColor}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value.match(/^#[0-9A-Fa-f]{0,6}$/)) {
                                      setCustomColor(value);
                                      if (value.length === 7) {
                                        setEditColor(value);
                                      }
                                    }
                                  }}
                                  placeholder='#3b82f6'
                                  className='w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors font-mono text-sm tracking-wider'
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className='grid grid-cols-8 gap-2'>
                            {filteredColors.map((color) => (
                              <button
                                key={color.value}
                                onClick={() => setEditColor(color.value)}
                                className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 ${
                                  editColor === color.value
                                    ? 'border-white shadow-lg scale-110 ring-2 ring-primary/50'
                                    : 'border-transparent hover:border-white/50'
                                }`}
                                style={{ backgroundColor: color.value }}
                                title={color.name}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      <div className='flex gap-2'>
                        <button
                          onClick={() => updateLabel(editingLabel)}
                          disabled={isLoading}
                          className='flex-1 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50'
                        >
                          {isLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Create New Label */}
                {isCreating && (
                  <div className='space-y-4'>
                    <div className='flex items-center justify-between'>
                      <h3 className='text-lg font-semibold text-foreground'>
                        Create New Label
                      </h3>
                      <button
                        onClick={cancelCreate}
                        className='p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground'
                        title='Cancel creating label'
                      >
                        <X className='w-4 h-4' />
                      </button>
                    </div>

                    <input
                      type='text'
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder='Enter label name (optional)'
                      className='w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors'
                    />

                    {/* Color Categories */}
                    <div className='space-y-3'>
                      <div className='flex gap-2 flex-wrap'>
                        {COLOR_CATEGORIES.map((category) => {
                          const Icon = category.icon;
                          return (
                            <button
                              key={category.id}
                              onClick={() => setSelectedCategory(category.id)}
                              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                selectedCategory === category.id
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                              }`}
                            >
                              <Icon className='w-3 h-3' />
                              {category.name}
                            </button>
                          );
                        })}
                      </div>

                      {selectedCategory === 'custom' ? (
                        <div className='space-y-3'>
                          <div className='flex items-center gap-3'>
                            <div className='relative group'>
                              <input
                                type='color'
                                value={customColor}
                                onChange={(e) => {
                                  setCustomColor(e.target.value);
                                  setNewColor(e.target.value);
                                }}
                                className='w-16 h-16 rounded-lg border-0 cursor-pointer opacity-0 absolute inset-0 z-10'
                                title='Choose custom color'
                              />
                              <div
                                className='w-16 h-16 rounded-lg border-2 border-border shadow-xl group-hover:shadow-2xl group-hover:scale-105 transition-all duration-200 relative overflow-hidden pointer-events-none'
                                style={{ backgroundColor: customColor }}
                              >
                                <div className='absolute bottom-1 right-1 w-4 h-4 bg-white/90 rounded-full flex items-center justify-center shadow-md pointer-events-none'>
                                  <Pipette className='w-2.5 h-2.5 text-gray-600' />
                                </div>
                              </div>
                            </div>
                            <div className='flex-1'>
                              <input
                                type='text'
                                value={customColor}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value.match(/^#[0-9A-Fa-f]{0,6}$/)) {
                                    setCustomColor(value);
                                    if (value.length === 7) {
                                      setNewColor(value);
                                    }
                                  }
                                }}
                                placeholder='#3b82f6'
                                className='w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors font-mono text-base tracking-wider'
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className='grid grid-cols-8 gap-2'>
                          {filteredColors.map((color) => (
                            <button
                              key={color.value}
                              onClick={() => setNewColor(color.value)}
                              className={`w-10 h-10 rounded-lg border-2 transition-all hover:scale-110 ${
                                newColor === color.value
                                  ? 'border-white shadow-lg scale-110 ring-2 ring-primary/50'
                                  : 'border-transparent hover:border-white/50'
                              }`}
                              style={{ backgroundColor: color.value }}
                              title={color.name}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={createLabel}
                      disabled={isLoading || !newColor}
                      className='w-full py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      {isLoading ? 'Creating...' : 'Create Label'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Create Button - Only show when not creating and not editing */}
            {!isCreating && !editingLabel && (
              <div className='sticky bottom-0 bg-card border-t border-border p-4'>
                <button
                  onClick={() => setIsCreating(true)}
                  className='w-full flex items-center justify-center gap-3 py-3 bg-gradient-to-r from-primary/10 to-primary/5 hover:from-primary/15 hover:to-primary/10 rounded-xl border border-dashed border-primary/30 hover:border-primary/50 transition-all group'
                >
                  <div className='w-8 h-8 bg-primary/10 group-hover:bg-primary/20 rounded-lg flex items-center justify-center transition-colors'>
                    <Plus className='w-4 h-4 text-primary' />
                  </div>
                  <span className='text-sm font-medium text-primary'>
                    Create a new label
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && deleteConfirm.label && (
        <div className='fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4'>
          <div className='bg-card rounded-xl shadow-2xl border border-border max-w-md w-full'>
            <div className='p-6'>
              <div className='flex items-center gap-3 mb-4'>
                <div className='w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center'>
                  <Trash2 className='w-5 h-5 text-red-600 dark:text-red-400' />
                </div>
                <div>
                  <h3 className='text-lg font-semibold text-foreground'>
                    Delete Label
                  </h3>
                  <p className='text-sm text-muted-foreground'>
                    This action cannot be undone
                  </p>
                </div>
              </div>

              <p className='text-sm text-foreground mb-6'>
                Are you sure you want to delete{' '}
                <span
                  className='inline-flex items-center px-2 py-1 rounded text-xs font-medium'
                  style={{
                    backgroundColor: deleteConfirm.label.color,
                    color: isColorLight(deleteConfirm.label.color)
                      ? '#000'
                      : '#fff',
                  }}
                >
                  {deleteConfirm.label.name || 'this label'}
                </span>
                ? This will permanently remove the label from all cards.
              </p>

              <div className='flex gap-3 justify-end'>
                <button
                  onClick={() =>
                    setDeleteConfirm({ isOpen: false, label: null })
                  }
                  className='px-4 py-2 text-sm font-medium text-foreground bg-secondary hover:bg-secondary/80 rounded-md transition-colors'
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={deleteLabel}
                  disabled={isLoading}
                  className='flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors'
                >
                  {isLoading ? (
                    <>
                      <div className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className='w-4 h-4' />
                      Delete Label
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
