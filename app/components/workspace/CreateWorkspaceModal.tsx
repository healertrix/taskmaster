'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Loader2, Plus, Palette } from 'lucide-react';
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
  const [selectedColor, setSelectedColor] = useState(workspaceColors[0].value);
  const [customColor, setCustomColor] = useState('#3B82F6'); // Default custom color (blue)
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const colorPickerRef = useRef<HTMLInputElement>(null);

  // Reset form values when modal closes and reopens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setSelectedColor(workspaceColors[0].value);
      setCustomColor('#3B82F6');
      setError(null);
    }
  }, [isOpen]);

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
          color: colorValue,
          owner_id: user.id,
          visibility: 'private', // Default to private for now
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      // Manually insert the workspace member record instead of relying on the trigger
      if (workspace) {
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
          // Continue anyway as the workspace was created successfully
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
    <div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6'>
      <div className='bg-card rounded-lg shadow-lg max-w-md w-full p-5 border border-border'>
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
              Workspace Name
            </label>
            <input
              id='workspace-name'
              type='text'
              value={name}
              onChange={(e) => setName(e.target.value)}
              className='w-full p-2 bg-input border border-border rounded-md text-foreground'
              placeholder='My Workspace'
              disabled={isLoading}
              autoFocus
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

          <div className='flex justify-end space-x-2'>
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
                'Create Workspace'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
