'use client';

import {
  useState,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from 'react';
import {
  X,
  Loader2,
  Palette,
  ArrowRight,
  FileText,
  LayoutTemplate,
  Info,
  Shield,
  Crown,
  User,
  Users,
  ChevronDown,
  Check,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import {
  useWorkspacesWithPermissions,
  type WorkspaceWithPermissions,
} from '@/hooks/useWorkspacesWithPermissions';

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

type CreateBoardModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newBoardId: string) => void;
  // If workspace is provided, we're creating from a workspace page
  workspaceId?: string;
  workspaceName?: string;
  workspaceColor?: string;
};

export type CreateBoardModalRef = {
  refetchWorkspaces: () => Promise<void>;
};

export const CreateBoardModal = forwardRef<CreateBoardModalRef, CreateBoardModalProps>(
  function CreateBoardModal(
    { isOpen, onClose, onSuccess, workspaceId, workspaceName, workspaceColor },
    ref
  ) {
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

    // Use the new hook to get workspaces with permissions
    const {
      workspaces: allWorkspaces,
      loading: workspacesLoading,
      error: workspacesError,
      refetch: refetchWorkspaces,
    } = useWorkspacesWithPermissions();

    // Filter workspaces to only show ones where user can create boards
    const availableWorkspaces = allWorkspaces.filter(
      (workspace) => workspace.canCreateBoards
    );

    // Determine if we're creating from workspace page
    const isFromWorkspacePage = !!workspaceId;

    // Expose refetch function to parent component
    useImperativeHandle(
      ref,
      () => ({
        refetchWorkspaces,
      }),
      [refetchWorkspaces]
    );

    // Reset form values when modal opens (only when modal actually opens)
    useEffect(() => {
      if (isOpen) {
        // Form reset on modal open
        setName('');
        setDescription('');
        setSelectedColor(boardColors[0].value);
        setCustomColor('#3B82F6');

        // Set default workspace
        if (workspaceId) {
          setSelectedWorkspaceId(workspaceId);
        }

        setError(null);

        // Refetch workspaces when modal opens to ensure we have the latest data
        refetchWorkspaces();
      }
    }, [isOpen, workspaceId, refetchWorkspaces]);

    // Update workspace ID when workspaceId prop changes (but don't reset entire form)
    useEffect(() => {
      if (isOpen && workspaceId) {
        setSelectedWorkspaceId(workspaceId);
      }
    }, [workspaceId, isOpen]);

    // Set default workspace when workspaces are loaded (only if no workspace selected and not from workspace page)
    useEffect(() => {
      if (
        isOpen &&
        !isFromWorkspacePage &&
        !selectedWorkspaceId &&
        availableWorkspaces.length > 0
      ) {
        setSelectedWorkspaceId(availableWorkspaces[0].id);
      }
    }, [isOpen, isFromWorkspacePage, selectedWorkspaceId, availableWorkspaces]);

    // Handle mobile back button
    useEffect(() => {
      if (!isOpen) return;

      const handlePopState = () => {
        onClose();
      };

      // Add history state when modal opens
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', handlePopState);

      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }, [isOpen, onClose]);

    // Handle keyboard shortcuts (desktop only)
    useEffect(() => {
      if (!isOpen) return;

      const handleKeyboard = (e: KeyboardEvent) => {
        if (
          e.key === 'Escape' &&
          !window.matchMedia('(max-width: 640px)').matches
        ) {
          onClose();
        }
      };

      document.addEventListener('keydown', handleKeyboard);
      return () => {
        document.removeEventListener('keydown', handleKeyboard);
      };
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

    const getRoleIcon = (workspace: WorkspaceWithPermissions) => {
      if (workspace.isOwner) {
        return <Crown className='w-4 h-4 text-yellow-500' />;
      } else if (workspace.userRole === 'admin') {
        return <Shield className='w-4 h-4 text-blue-500' />;
      } else {
        return <User className='w-4 h-4 text-green-500' />;
      }
    };

    const getRoleText = (workspace: WorkspaceWithPermissions) => {
      if (workspace.isOwner) return 'Owner';
      if (workspace.userRole === 'admin') return 'Admin';
      return 'Member';
    };

    const getColorDisplay = (color: string) => {
      // Handle both hex colors and Tailwind classes
      if (color.startsWith('#')) {
        return { backgroundColor: color };
      } else if (color.startsWith('bg-')) {
        return { className: color };
      }
      return { backgroundColor: '#3B82F6' }; // fallback
    };

    return (
      <div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-6'>
        <div className='bg-card rounded-lg shadow-lg max-w-sm sm:max-w-md w-full max-h-[85vh] overflow-y-auto p-5 border border-border'>
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

          {workspacesError && (
            <div className='mb-4 p-3 bg-red-500/20 text-red-600 rounded-md text-sm'>
              Failed to load workspaces: {workspacesError}
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
                className='w-full p-3 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
                placeholder='My Board'
                disabled={isLoading}
                autoFocus
                style={{ backgroundColor: 'var(--background)' }}
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
                className='w-full p-3 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none'
                placeholder='What is this board about?'
                rows={3}
                disabled={isLoading}
                style={{ backgroundColor: 'var(--background)' }}
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
                  {workspacesLoading && (
                    <span className='ml-2 text-xs text-muted-foreground'>
                      <Loader2 className='w-3 h-3 animate-spin inline mr-1' />
                      Loading...
                    </span>
                  )}
                </label>

                {/* Show message if no workspaces available for board creation */}
                {!workspacesLoading && availableWorkspaces.length === 0 ? (
                  <div className='p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md'>
                    <div className='flex items-start gap-2'>
                      <Shield className='w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0' />
                      <div className='text-sm'>
                        <p className='font-medium text-yellow-800 dark:text-yellow-200 mb-1'>
                          No workspaces available for board creation
                        </p>
                        <p className='text-yellow-700 dark:text-yellow-300'>
                          You don't have permission to create boards in any
                          workspace. Contact a workspace admin to grant you
                          board creation permissions.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <CustomWorkspaceDropdown
                    availableWorkspaces={availableWorkspaces}
                    selectedWorkspaceId={selectedWorkspaceId}
                    onSelect={setSelectedWorkspaceId}
                    disabled={isLoading}
                    getRoleText={getRoleText}
                    getRoleIcon={getRoleIcon}
                    loading={workspacesLoading}
                  />
                )}
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
                  disabled={
                    isLoading ||
                    !name.trim() ||
                    !selectedWorkspaceId ||
                    (!isFromWorkspacePage && availableWorkspaces.length === 0)
                  }
                >
                  {isLoading ? (
                    <div className='flex items-center gap-2'>
                      <Loader2 className='w-4 h-4 animate-spin' />
                      <span>Creating...</span>
                    </div>
                  ) : (
                    'Create Board'
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }
);

// Custom Workspace Dropdown Component
const CustomWorkspaceDropdown = ({
  availableWorkspaces,
  selectedWorkspaceId,
  onSelect,
  disabled,
  getRoleText,
  getRoleIcon,
  loading,
}: {
  availableWorkspaces: WorkspaceWithPermissions[];
  selectedWorkspaceId: string;
  onSelect: (id: string) => void;
  disabled: boolean;
  getRoleText: (workspace: WorkspaceWithPermissions) => string;
  getRoleIcon: (workspace: WorkspaceWithPermissions) => JSX.Element;
  loading: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedWorkspace = availableWorkspaces.find(
    (w) => w.id === selectedWorkspaceId
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const getColorDisplay = (color: string) => {
    if (color.startsWith('#')) {
      return { backgroundColor: color };
    } else if (color.startsWith('bg-')) {
      return { className: color };
    }
    return { backgroundColor: '#3B82F6' };
  };

  return (
    <div className='relative' ref={dropdownRef}>
      <button
        type='button'
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className='w-full p-3 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed hover:bg-background/80 transition-colors'
      >
        <div className='flex items-center gap-2'>
          {selectedWorkspace ? (
            <>
              {(() => {
                const colorStyle = getColorDisplay(selectedWorkspace.color);
                return (
                  <div
                    className={`w-4 h-4 rounded-full ${
                      colorStyle.className || ''
                    }`}
                    style={
                      colorStyle.backgroundColor
                        ? { backgroundColor: colorStyle.backgroundColor }
                        : {}
                    }
                  />
                );
              })()}
              <span>{selectedWorkspace.name}</span>
              <span className='text-muted-foreground'>•</span>
              <div className='flex items-center gap-1'>
                {getRoleIcon(selectedWorkspace)}
                <span className='text-xs text-muted-foreground'>
                  {getRoleText(selectedWorkspace)}
                </span>
              </div>
            </>
          ) : (
            <span className='text-muted-foreground'>
              {loading ? 'Loading workspaces...' : 'Select a workspace'}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className='absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-lg z-10 max-h-60 overflow-y-auto'>
          {availableWorkspaces.length === 0 ? (
            <div className='p-3 text-muted-foreground text-sm'>
              {loading ? 'Loading workspaces...' : 'No workspaces available'}
            </div>
          ) : (
            availableWorkspaces.map((workspace) => {
              const colorStyle = getColorDisplay(workspace.color);
              const isSelected = workspace.id === selectedWorkspaceId;

              return (
                <button
                  key={workspace.id}
                  type='button'
                  onClick={() => {
                    onSelect(workspace.id);
                    setIsOpen(false);
                  }}
                  className={`w-full p-3 text-left hover:bg-muted/50 flex items-center gap-2 transition-colors ${
                    isSelected ? 'bg-muted/30' : ''
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full ${
                      colorStyle.className || ''
                    }`}
                    style={
                      colorStyle.backgroundColor
                        ? { backgroundColor: colorStyle.backgroundColor }
                        : {}
                    }
                  />
                  <span className='flex-1'>{workspace.name}</span>
                  <div className='flex items-center gap-1'>
                    {getRoleIcon(workspace)}
                    <span className='text-xs text-muted-foreground'>
                      {getRoleText(workspace)}
                    </span>
                  </div>
                  {isSelected && <Check className='w-4 h-4 text-primary' />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
