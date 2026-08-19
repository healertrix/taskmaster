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
  Info,
  Shield,
  Crown,
  User,
  ChevronDown,
  Check,
  LayoutTemplate,
  LayoutGrid,
  Sparkles,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import {
  useWorkspacesWithPermissions,
  type WorkspaceWithPermissions,
} from '@/hooks/useWorkspacesWithPermissions';
import { colorForEntity } from '@/utils/idColor';
import { useTemplates, type BoardTemplate } from '@/hooks/useTemplates';

interface SiblingBoard {
  id: string;
  name: string;
  number?: number;
}

// A "source" is exactly one of: blank, an existing board in this workspace
// (copied live, not saved anywhere — see source_board_id in
// app/api/boards/route.ts), a personal template, or a shared starter
// template — encoded as one string key instead of juggling multiple ids
// that would otherwise have to be kept mutually exclusive by hand.
type SourceKey = '' | `board:${string}` | `template:${string}`;

function parseSource(key: SourceKey): { source_board_id?: string; template_id?: string } {
  if (key.startsWith('board:')) return { source_board_id: key.slice('board:'.length) };
  if (key.startsWith('template:')) return { template_id: key.slice('template:'.length) };
  return {};
}

// Board color is no longer user-picked here — it's derived from the
// board's own display number once it's created (see utils/idColor.ts).
// The API still requires a `color` value for the legacy column, so we
// just send a fixed placeholder; nothing reads it for display anymore.
const PLACEHOLDER_BOARD_COLOR = 'bg-blue-600';

type CreateBoardModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newBoardId: string) => void;
  // If workspace is provided, we're creating from a workspace page
  workspaceId?: string;
  workspaceName?: string;
  workspaceNumber?: number;
};

export type CreateBoardModalRef = {
  refetchWorkspaces: () => Promise<void>;
};

export const CreateBoardModal = forwardRef<CreateBoardModalRef, CreateBoardModalProps>(
  function CreateBoardModal(
    { isOpen, onClose, onSuccess, workspaceId, workspaceName, workspaceNumber },
    ref
  ) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(
      workspaceId || ''
    );
    const [selectedSourceKey, setSelectedSourceKey] = useState<SourceKey>('');
    const [siblingBoards, setSiblingBoards] = useState<SiblingBoard[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const router = useRouter();
    const { personalTemplates, starterTemplates } = useTemplates();

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
        setSelectedSourceKey('');

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

    // Other boards in whichever workspace is currently selected, for
    // "use an existing board as a template" — refetched whenever the
    // workspace changes, and the previous selection cleared, since a
    // board:<id> chosen for one workspace means nothing in another (a
    // template:<id> or blank selection carries over fine, since those
    // aren't workspace-scoped).
    useEffect(() => {
      if (!isOpen || !selectedWorkspaceId) {
        setSiblingBoards([]);
        return;
      }

      let cancelled = false;
      fetch(`/api/boards?workspace_id=${selectedWorkspaceId}`)
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          const boards = (data.boards || [])
            .filter((b: any) => !b.is_closed)
            .map((b: any) => ({ id: b.id, name: b.name, number: b.number }));
          setSiblingBoards(boards);
        })
        .catch((err) => console.error('Error fetching workspace boards:', err));

      setSelectedSourceKey((prev) => (prev.startsWith('board:') ? '' : prev));

      return () => {
        cancelled = true;
      };
    }, [isOpen, selectedWorkspaceId]);

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
        const response = await fetch('/api/boards', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            color: PLACEHOLDER_BOARD_COLOR,
            workspace_id: selectedWorkspaceId,
            visibility: 'workspace', // Default for workspace creation
            ...parseSource(selectedSourceKey),
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

    return (
      <div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-6'>
        <div className='bg-card/90 backdrop-blur-xl rounded-lg shadow-lg max-w-sm sm:max-w-md w-full max-h-[85vh] overflow-y-auto p-5 border border-border animate-in fade-in-50 zoom-in-95 duration-200'>
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
            {/* Start from — three possible sources, each shown only if it
                has anything to offer: other boards in this workspace
                (copied live, nothing saved — see source_board_id),
                personal templates (usable across any workspace), and the
                shared starter set. Always at least the starter section for
                a brand-new account with neither of the other two, which is
                the actual gap this replaced (the old template-only picker
                was hidden outright with zero saved templates). Selecting
                a source doesn't touch the board name below; the two are
                independent — there's no preview/customize step either,
                since anything the source gets wrong is trivially fixable
                on the real board afterward. */}
            {(siblingBoards.length > 0 ||
              personalTemplates.length > 0 ||
              starterTemplates.length > 0) && (
              <div>
                <label className='block text-sm font-medium text-foreground mb-1'>
                  Start from
                </label>
                <CustomSourceDropdown
                  siblingBoards={siblingBoards}
                  personalTemplates={personalTemplates}
                  starterTemplates={starterTemplates}
                  selectedSourceKey={selectedSourceKey}
                  onSelect={setSelectedSourceKey}
                  disabled={isLoading}
                />
              </div>
            )}

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
                  <div className='p-3 bg-amber-500/10 border border-amber-500/20 rounded-md'>
                    <div className='flex items-start gap-2'>
                      <Shield className='w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0' />
                      <div className='text-sm'>
                        <p className='font-medium text-amber-400 mb-1'>
                          No workspaces available for board creation
                        </p>
                        <p className='text-amber-400/80'>
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
                    className='w-4 h-4 rounded-full flex-shrink-0'
                    style={{
                      backgroundColor: workspaceId
                        ? colorForEntity(workspaceId, workspaceNumber)
                        : '#3B82F6',
                    }}
                  />
                  <span className='text-sm font-medium text-foreground'>
                    Creating in: {workspaceName}
                  </span>
                </div>
              </div>
            )}

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
              <div
                className='w-4 h-4 rounded-full'
                style={{
                  backgroundColor: colorForEntity(
                    selectedWorkspace.id,
                    selectedWorkspace.number
                  ),
                }}
              />
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
                    className='w-4 h-4 rounded-full'
                    style={{
                      backgroundColor: colorForEntity(
                        workspace.id,
                        workspace.number
                      ),
                    }}
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

// Custom Source Dropdown — same visual pattern as CustomWorkspaceDropdown
// above, not the bare native <select> this replaced. Groups its options
// under up to three headed sections instead of one flat list mixing three
// different kinds of thing (a live board's current structure, a saved
// personal template, a shared starter template) with no way to tell them
// apart.
const CustomSourceDropdown = ({
  siblingBoards,
  personalTemplates,
  starterTemplates,
  selectedSourceKey,
  onSelect,
  disabled,
}: {
  siblingBoards: SiblingBoard[];
  personalTemplates: BoardTemplate[];
  starterTemplates: BoardTemplate[];
  selectedSourceKey: SourceKey;
  onSelect: (key: SourceKey) => void;
  disabled: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = selectedSourceKey.startsWith('board:')
    ? siblingBoards.find((b) => `board:${b.id}` === selectedSourceKey)?.name
    : selectedSourceKey.startsWith('template:')
    ? [...personalTemplates, ...starterTemplates].find(
        (t) => `template:${t.id}` === selectedSourceKey
      )?.name
    : null;

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  // Fresh search each time it opens, and focused immediately — a
  // workspace with a lot of boards is exactly the case this is for, so
  // typing should work the instant the dropdown appears, not require an
  // extra click into the box first.
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      searchInputRef.current?.focus();
    }
  }, [isOpen]);

  const select = (key: SourceKey) => {
    onSelect(key);
    setIsOpen(false);
  };

  // Matches a board's name, or its display number — "12", "#12", and
  // "board 12" all match board #12, same shorthand used by the board's
  // own in-page card search (see app/boards/[id]/page.tsx).
  const query = search.trim().toLowerCase();
  const matchesBoard = (board: SiblingBoard) => {
    if (!query) return true;
    if (board.name.toLowerCase().includes(query)) return true;
    if (board.number == null) return false;
    const numberQuery = query.replace(/^#/, '').replace(/^board\s*/, '');
    return String(board.number).includes(numberQuery) && numberQuery.length > 0;
  };
  const matchesTemplate = (template: BoardTemplate) =>
    !query || template.name.toLowerCase().includes(query);

  const filteredBoards = siblingBoards.filter(matchesBoard);
  const filteredPersonalTemplates = personalTemplates.filter(matchesTemplate);
  const filteredStarterTemplates = starterTemplates.filter(matchesTemplate);
  const hasAnyMatch =
    filteredBoards.length > 0 ||
    filteredPersonalTemplates.length > 0 ||
    filteredStarterTemplates.length > 0;

  const SectionHeading = ({ children }: { children: React.ReactNode }) => (
    <div className='px-3 pt-2.5 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide'>
      {children}
    </div>
  );

  return (
    <div className='relative' ref={dropdownRef}>
      <button
        type='button'
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className='w-full p-3 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed hover:bg-background/80 transition-colors'
      >
        <div className='flex items-center gap-2 min-w-0'>
          <LayoutTemplate className='w-4 h-4 text-muted-foreground flex-shrink-0' />
          <span className='truncate'>{selectedLabel || 'Blank board'}</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className='absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-lg z-10 overflow-hidden'>
          {/* Search — a workspace can have far more boards than fit in a
              scrollable list comfortably, so this isn't optional past a
              certain size. Matches by name or board number (see
              matchesBoard above), same shorthand the board's own in-page
              search uses. Outside the scrolling results below so it stays
              put while you scroll through matches. */}
          <div className='p-2 border-b border-border/50'>
            <input
              ref={searchInputRef}
              type='text'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Search boards and templates...'
              className='w-full px-2.5 py-1.5 text-sm bg-muted/40 border border-border/50 rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50'
            />
          </div>

          <div className='max-h-72 overflow-y-auto'>
            {!query && (
              <button
                type='button'
                onClick={() => select('')}
                className={`w-full p-3 text-left hover:bg-muted/50 flex items-center gap-2 transition-colors ${
                  !selectedSourceKey ? 'bg-muted/30' : ''
                }`}
              >
                <span className='flex-1'>Blank board</span>
                {!selectedSourceKey && <Check className='w-4 h-4 text-primary' />}
              </button>
            )}

            {!hasAnyMatch && (
              <p className='px-3 py-4 text-sm text-muted-foreground text-center'>
                No boards or templates match &ldquo;{search.trim()}&rdquo;
              </p>
            )}

          {filteredBoards.length > 0 && (
            <>
              <SectionHeading>This workspace</SectionHeading>
              {filteredBoards.map((board) => {
                const key: SourceKey = `board:${board.id}`;
                const isSelected = key === selectedSourceKey;
                return (
                  <button
                    key={board.id}
                    type='button'
                    onClick={() => select(key)}
                    className={`w-full p-3 text-left hover:bg-muted/50 flex items-center gap-2 transition-colors ${
                      isSelected ? 'bg-muted/30' : ''
                    }`}
                  >
                    <LayoutGrid className='w-4 h-4 text-muted-foreground flex-shrink-0' />
                    <span className='flex-1 truncate'>
                      {board.name}
                      {board.number != null && (
                        <span className='text-muted-foreground'> #{board.number}</span>
                      )}
                    </span>
                    {isSelected && <Check className='w-4 h-4 text-primary' />}
                  </button>
                );
              })}
            </>
          )}

          {filteredPersonalTemplates.length > 0 && (
            <>
              <SectionHeading>Your templates</SectionHeading>
              {filteredPersonalTemplates.map((template) => {
                const key: SourceKey = `template:${template.id}`;
                const isSelected = key === selectedSourceKey;
                return (
                  <button
                    key={template.id}
                    type='button'
                    onClick={() => select(key)}
                    className={`w-full p-3 text-left hover:bg-muted/50 flex items-center gap-2 transition-colors ${
                      isSelected ? 'bg-muted/30' : ''
                    }`}
                  >
                    <LayoutTemplate className='w-4 h-4 text-muted-foreground flex-shrink-0' />
                    <span className='flex-1 truncate'>{template.name}</span>
                    {isSelected && <Check className='w-4 h-4 text-primary' />}
                  </button>
                );
              })}
            </>
          )}

          {filteredStarterTemplates.length > 0 && (
            <>
              <SectionHeading>Starter templates</SectionHeading>
              {filteredStarterTemplates.map((template) => {
                const key: SourceKey = `template:${template.id}`;
                const isSelected = key === selectedSourceKey;
                return (
                  <button
                    key={template.id}
                    type='button'
                    onClick={() => select(key)}
                    className={`w-full p-3 text-left hover:bg-muted/50 flex items-center gap-2 transition-colors ${
                      isSelected ? 'bg-muted/30' : ''
                    }`}
                  >
                    <Sparkles className='w-4 h-4 text-muted-foreground flex-shrink-0' />
                    <span className='flex-1 truncate'>{template.name}</span>
                    {isSelected && <Check className='w-4 h-4 text-primary' />}
                  </button>
                );
              })}
            </>
          )}
          </div>
        </div>
      )}
    </div>
  );
};
