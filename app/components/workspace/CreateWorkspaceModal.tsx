'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Plus, Info } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

// Workspace color is no longer user-picked here — it's derived from the
// workspace's own id once it's created (see utils/idColor.ts). The API
// still requires a `color` value for the legacy column, so we just send a
// fixed placeholder; nothing reads it for display anymore.
const PLACEHOLDER_WORKSPACE_COLOR = 'bg-blue-600';

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form values when modal closes and reopens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
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

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      onClose();
      // Push a new state to maintain history
      window.history.pushState(null, '', window.location.href);
    };

    if (isOpen) {
      // Add state to history when opening modal
      window.history.pushState(null, '', window.location.href);
      document.addEventListener('keydown', handleKeyboard);
      window.addEventListener('popstate', handlePopState);
      return () => {
        document.removeEventListener('keydown', handleKeyboard);
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [isOpen, onClose, name]);

  if (!isOpen) return null;

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

      // Insert the new workspace
      const { data: workspace, error: insertError } = await supabase
        .from('workspaces')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          color: PLACEHOLDER_WORKSPACE_COLOR,
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
      <div className='bg-card/90 backdrop-blur-xl rounded-lg shadow-lg max-w-sm sm:max-w-md w-full max-h-[85vh] overflow-y-auto p-5 border border-border animate-in fade-in-50 zoom-in-95 duration-200'>
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
