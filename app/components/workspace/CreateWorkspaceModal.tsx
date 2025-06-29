'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Loader2, Plus, Palette, Info } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

// Reduced list of predefined workspace colors - just 5 basic colors
const workspaceColors = [
  { name: 'Blue', value: 'bg-blue-600' },
  { name: 'Purple', value: 'bg-purple-600' },
  { name: 'Green', value: 'bg-green-600' },
  { name: 'Red', value: 'bg-red-600' },
  { name: 'Yellow', value: 'bg-yellow-600' },
];

type CreateWorkspaceModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newWorkspaceId: string) => void;
};

export function CreateWorkspaceModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateWorkspaceModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(workspaceColors[0].value);
  const [customColor, setCustomColor] = useState('#3B82F6'); // Default custom color (blue)
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const colorPickerRef = useRef<HTMLInputElement>(null);

  // Reset form values when modal closes and reopens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setSelectedColor(workspaceColors[0].value);
      setCustomColor('#3B82F6');
      setError(null);
    }
  }, [isOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if (!isOpen) return;

      // ESC to close modal
      if (e.key === 'Escape') {
        onClose();
      }

      // Ctrl+Enter to save/submit form
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        if (name.trim()) {
          // Create a synthetic form event to trigger handleSubmit
          const syntheticEvent = new Event('submit', {
            bubbles: true,
            cancelable: true,
          });
          Object.defineProperty(syntheticEvent, 'preventDefault', {
            value: () => e.preventDefault(),
            writable: false,
          });
          handleSubmit(syntheticEvent as any);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyboard);
      return () => document.removeEventListener('keydown', handleKeyboard);
    }
  }, [isOpen, onClose, name]);

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

  // For displaying custom color in the grid
  const customColorStyle = {
    backgroundColor: customColor,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Workspace name is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Get the current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('You must be logged in to create a workspace');
      }

      // Prepare the color value
      const colorValue =
        selectedColor === 'custom'
          ? customColor // Store the hex value directly for custom colors
          : selectedColor; // Store the Tailwind class for predefined colors

      // Insert the new workspace
      const { data: workspace, error: insertError } = await supabase
        .from('workspaces')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          color: colorValue,
          owner_id: user.id,
          visibility: 'private', // Default to private for now
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      // Ensure the workspace creator is added as an admin member
      // The database trigger should handle this, but we'll add a fallback
      if (workspace) {
        // First check if the member already exists (from the trigger)
        const { data: existingMember } = await supabase
          .from('workspace_members')
          .select('id')
          .eq('workspace_id', workspace.id)
          .eq('profile_id', user.id)
          .single();

        if (!existingMember) {
          // If trigger didn't work, manually insert the member
          const { error: memberError } = await supabase
            .from('workspace_members')
            .insert({
              workspace_id: workspace.id,
              profile_id: user.id,
              role: 'admin',
              invited_by: user.id,
            });

          if (memberError) {
            console.error('Error creating workspace member:', memberError);
            throw new Error('Failed to add workspace member');
          }
        }
      }

      // Clear form and close modal
      onClose();

      // Call success callback if provided
      if (onSuccess && workspace) {
        onSuccess(workspace.id);
      }
    } catch (err) {
      console.error('Error creating workspace:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to create workspace'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-6'>
      <div className='bg-card rounded-lg shadow-lg max-w-sm sm:max-w-md w-full max-h-[85vh] overflow-y-auto p-5 border border-border'>
        <div className='flex justify-between items-center mb-4'>
          <h3 className='text-xl font-bold text-foreground'>
            Create Workspace
          </h3>
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

        <form onSubmit={handleSubmit}>
          <div className='mb-4'>
            <label
              htmlFor='workspace-name'
              className='block text-sm font-medium text-foreground mb-1'
            >
              Workspace Name *
            </label>
            <input
              id='workspace-name'
              type='text'
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.ctrlKey) {
                  e.preventDefault(); // Prevent form submission on Enter
                }
              }}
              className='w-full p-3 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
              placeholder='My Workspace'
              disabled={isLoading}
              autoFocus
              style={{ backgroundColor: 'var(--background)' }}
            />
          </div>

          {/* Description */}
          <div className='mb-4'>
            <label
              htmlFor='workspace-description'
              className='block text-sm font-medium text-foreground mb-1'
            >
              Description
            </label>
            <textarea
              id='workspace-description'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
                  e.preventDefault(); // Prevent form submission on Enter (allow Shift+Enter for new lines)
                }
              }}
              className='w-full p-3 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none'
              placeholder='What is this workspace about?'
              rows={3}
              disabled={isLoading}
              style={{ backgroundColor: 'var(--background)' }}
            />
          </div>

          <div className='mb-6'>
            <label className='block text-sm font-medium text-foreground mb-2'>
              Workspace Color
            </label>
            <div className='mb-3 flex flex-wrap gap-3'>
              {/* Standard color circles */}
              {workspaceColors.map((color) => (
                <button
                  key={color.value}
                  type='button'
                  onClick={() => setSelectedColor(color.value)}
                  className={`w-10 h-10 rounded-full ${
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

              {/* Custom color button - distinct design */}
              <button
                type='button'
                onClick={handleCustomColorClick}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border-2 border-dashed ${
                  selectedColor === 'custom'
                    ? 'ring-2 ring-ring ring-offset-2 ring-offset-background'
                    : 'hover:border-primary'
                }`}
                style={selectedColor === 'custom' ? customColorStyle : {}}
                title='Choose custom color'
                aria-label='Choose custom color'
                disabled={isLoading}
              >
                {selectedColor !== 'custom' ? (
                  <Palette className='w-5 h-5 text-muted-foreground' />
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
                  className='w-6 h-6 rounded-md mr-2 border border-border/50'
                  style={customColorStyle}
                ></div>
                <span className='text-sm font-medium'>{customColor}</span>
                <span className='ml-auto text-xs text-muted-foreground'>
                  Custom color
                </span>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className='flex justify-between items-center pt-2'>
            <div className='relative group'>
              <button
                type='button'
                className='w-6 h-6 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-all duration-200'
                aria-label='Keyboard shortcuts'
              >
                <Info className='w-3.5 h-3.5' />
              </button>
              {/* Tooltip */}
              <div className='absolute bottom-full left-0 mb-2 hidden group-hover:block z-10'>
                <div className='bg-popover text-popover-foreground text-xs rounded-lg shadow-lg p-2 border border-border whitespace-nowrap'>
                  <div className='space-y-1'>
                    <div>
                      <kbd className='px-1 py-0.5 bg-muted border border-border rounded text-[10px]'>
                        Esc
                      </kbd>{' '}
                      Cancel
                    </div>
                    <div>
                      <kbd className='px-1 py-0.5 bg-muted border border-border rounded text-[10px]'>
                        Ctrl
                      </kbd>
                      +
                      <kbd className='px-1 py-0.5 bg-muted border border-border rounded text-[10px]'>
                        Enter
                      </kbd>{' '}
                      Save
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className='flex space-x-3'>
              <button
                type='button'
                onClick={onClose}
                className='px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background'
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type='submit'
                className='px-6 py-2.5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-sm hover:shadow-md'
                disabled={isLoading || !name.trim()}
              >
                {isLoading ? (
                  <div className='flex items-center gap-2'>
                    <Loader2 className='w-4 h-4 animate-spin' />
                    <span>Creating...</span>
                  </div>
                ) : (
                  'Create Workspace'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
