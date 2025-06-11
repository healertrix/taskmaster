'use client';

import { useState, useRef, useEffect } from 'react';
import {
  X,
  Loader2,
  Palette,
  ArrowRight,
  FileText,
  LayoutTemplate,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

// Board colors matching workspace modal pattern
const boardColors = [
  { name: 'Blue', value: 'bg-blue-600' },
  { name: 'Purple', value: 'bg-purple-600' },
  { name: 'Green', value: 'bg-green-600' },
  { name: 'Red', value: 'bg-red-600' },
  { name: 'Yellow', value: 'bg-yellow-600' },
  { name: 'Orange', value: 'bg-orange-600' },
  { name: 'Pink', value: 'bg-pink-600' },
  { name: 'Indigo', value: 'bg-indigo-600' },
];

type Workspace = {
  id: string;
  name: string;
  color: string;
};

type CreateBoardModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newBoardId: string) => void;
  // If workspace is provided, we're creating from a workspace page
  workspaceId?: string;
  workspaceName?: string;
  workspaceColor?: string;
  // If not provided, we're creating from top-level and need workspace selection
  userWorkspaces?: Workspace[];
};

export function CreateBoardModal({
  isOpen,
  onClose,
  onSuccess,
  workspaceId,
  workspaceName,
  workspaceColor,
  userWorkspaces = [],
}: CreateBoardModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(boardColors[0].value);
  const [customColor, setCustomColor] = useState('#3B82F6');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(
    workspaceId || ''
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const colorPickerRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Determine if we're creating from workspace page
  const isFromWorkspacePage = !!workspaceId;

  // Reset form values when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setSelectedColor(boardColors[0].value);
      setCustomColor('#3B82F6');
      setSelectedWorkspaceId(workspaceId || userWorkspaces[0]?.id || '');
      setError(null);
    }
  }, [isOpen, workspaceId, userWorkspaces]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCustomColorClick = () => {
    if (colorPickerRef.current) {
      colorPickerRef.current.click();
    }
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomColor(e.target.value);
    setSelectedColor('custom');
  };

  const customColorStyle = {
    backgroundColor: customColor,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Board name is required');
      return;
    }

    if (!selectedWorkspaceId) {
      setError('Please select a workspace');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const colorValue =
        selectedColor === 'custom' ? customColor : selectedColor;

      const response = await fetch('/api/boards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          color: colorValue,
          workspace_id: selectedWorkspaceId,
          visibility: 'workspace', // Default for workspace creation
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create board');
      }

      // Close modal
      onClose();

      // Navigate to the new board
      if (data.board?.id) {
        router.push(`/board/${data.board.id}`);

        // Call success callback if provided
        if (onSuccess) {
          onSuccess(data.board.id);
        }
      }
    } catch (err) {
      console.error('Error creating board:', err);
      setError(err instanceof Error ? err.message : 'Failed to create board');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6'>
      <div className='bg-card rounded-lg shadow-lg max-w-md w-full p-5 border border-border'>
        <div className='flex justify-between items-center mb-4'>
          <h3 className='text-xl font-bold text-foreground'>Create Board</h3>
          <button
            onClick={onClose}
            className='text-muted-foreground hover:text-foreground transition-colors'
            aria-label='Close modal'
            disabled={isLoading}
          >
            <X className='w-5 h-5' />
          </button>
        </div>

        {error && (
          <div className='mb-4 p-3 bg-red-500/20 text-red-600 rounded-md text-sm'>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className='space-y-4'>
          {/* Board Name */}
          <div>
            <label
              htmlFor='board-name'
              className='block text-sm font-medium text-foreground mb-1'
            >
              Board Name *
            </label>
            <input
              id='board-name'
              type='text'
              value={name}
              onChange={(e) => setName(e.target.value)}
              className='w-full p-2 bg-input border border-border rounded-md text-foreground'
              placeholder='My Board'
              disabled={isLoading}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor='board-description'
              className='block text-sm font-medium text-foreground mb-1'
            >
              Description
            </label>
            <textarea
              id='board-description'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className='w-full p-2 bg-input border border-border rounded-md text-foreground resize-none'
              placeholder='What is this board about?'
              rows={3}
              disabled={isLoading}
            />
          </div>

          {/* Workspace Selection (only show if not from workspace page) */}
          {!isFromWorkspacePage && (
            <div>
              <label
                htmlFor='board-workspace'
                className='block text-sm font-medium text-foreground mb-1'
              >
                Workspace *
              </label>
              <select
                id='board-workspace'
                value={selectedWorkspaceId}
                onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                className='w-full p-2 bg-input border border-border rounded-md text-foreground'
                disabled={isLoading}
              >
                <option value=''>Select a workspace</option>
                {userWorkspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Workspace indicator (when creating from workspace page) */}
          {isFromWorkspacePage && (
            <div className='p-3 bg-muted/30 rounded-md border border-border/50'>
              <div className='flex items-center gap-2'>
                <div
                  className={`w-4 h-4 rounded-full ${
                    workspaceColor || 'bg-blue-600'
                  }`}
                />
                <span className='text-sm font-medium text-foreground'>
                  Creating in: {workspaceName}
                </span>
              </div>
            </div>
          )}

          {/* Board Color */}
          <div>
            <label className='block text-sm font-medium text-foreground mb-2'>
              Board Color
            </label>
            <div className='mb-3 flex flex-wrap gap-2'>
              {boardColors.map((color) => (
                <button
                  key={color.value}
                  type='button'
                  onClick={() => setSelectedColor(color.value)}
                  className={`w-8 h-8 rounded-full ${
                    color.value
                  } flex items-center justify-center transition-all ${
                    selectedColor === color.value
                      ? 'ring-2 ring-ring ring-offset-2 ring-offset-background'
                      : 'hover:ring-1 hover:ring-ring hover:ring-offset-1 hover:ring-offset-background'
                  }`}
                  title={color.name}
                  aria-label={`Select ${color.name} color`}
                  disabled={isLoading}
                >
                  {selectedColor === color.value && (
                    <div className='w-2 h-2 bg-white rounded-full'></div>
                  )}
                </button>
              ))}

              {/* Custom color button */}
              <button
                type='button'
                onClick={handleCustomColorClick}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border-2 border-dashed ${
                  selectedColor === 'custom'
                    ? 'ring-2 ring-ring ring-offset-2 ring-offset-background'
                    : 'hover:border-primary border-border'
                }`}
                style={selectedColor === 'custom' ? customColorStyle : {}}
                title='Choose custom color'
                aria-label='Choose custom color'
                disabled={isLoading}
              >
                {selectedColor !== 'custom' ? (
                  <Palette className='w-4 h-4 text-muted-foreground' />
                ) : (
                  <div className='w-2 h-2 bg-white rounded-full'></div>
                )}
                <input
                  ref={colorPickerRef}
                  type='color'
                  value={customColor}
                  onChange={handleColorChange}
                  className='sr-only'
                  aria-label='Choose custom color'
                />
              </button>
            </div>

            {selectedColor === 'custom' && (
              <div className='mt-2 p-2 border border-border rounded-md bg-muted/30 flex items-center'>
                <div
                  className='w-4 h-4 rounded mr-2 border border-border/50'
                  style={customColorStyle}
                ></div>
                <span className='text-sm font-medium'>{customColor}</span>
                <span className='ml-auto text-xs text-muted-foreground'>
                  Custom color
                </span>
              </div>
            )}
          </div>

          {/* Start with Template - Placeholder */}
          <div className='p-3 bg-muted/20 rounded-md border border-border/30'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <LayoutTemplate className='w-4 h-4 text-muted-foreground' />
                <span className='text-sm font-medium text-muted-foreground'>
                  Start with template
                </span>
              </div>
              <span className='text-xs text-muted-foreground bg-muted px-2 py-1 rounded'>
                Coming soon
              </span>
            </div>
          </div>

          {/* Form Actions */}
          <div className='flex justify-between items-center pt-2'>
            <p className='text-xs text-muted-foreground'>Press Esc to cancel</p>
            <div className='flex space-x-2'>
              <button
                type='button'
                onClick={onClose}
                className='btn btn-ghost px-4 py-2'
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type='submit'
                className='btn bg-primary text-white hover:bg-primary/90 px-4 py-2 flex items-center'
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                    Creating...
                  </>
                ) : (
                  <>
                    Create Board
                    <ArrowRight className='w-4 h-4 ml-2' />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
