'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Clock, LayoutGrid, List, Plus, Search, Settings, Users } from 'lucide-react';
import { DashboardHeader } from '@/app/components/dashboard/header';
import { CreateWorkspaceModal } from '@/app/components/workspace/CreateWorkspaceModal';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { colorForEntity } from '@/utils/idColor';

// Same admin-or-owner rule the workspace settings page itself gates on
// (see canManageSettings in app/workspace/[id]/settings/page.tsx) — kept
// consistent here so the Settings shortcut only ever appears where it
// would actually be usable.
const canManageWorkspace = (role: string) => role === 'admin' || role === 'owner';

const WORKSPACES_VIEW_STORAGE_KEY = 'workspaces-page-view';

// One grid template shared by the list view's header row and every data
// row — same idea as ROW_GRID_COLS in ListView.tsx (the board task list):
// a single source of truth for column widths so header labels and row
// data always land in the exact same place instead of two hand-tuned
// flex layouts drifting apart. Workspace name flexes; every other column
// (including both action-icon slots, reserved individually so Settings
// being hidden for non-admins never shifts Members over) is a fixed width.
//
// Below lg the grid gives way to a plain flex row (name + always-visible
// action icons only — see the `hidden lg:flex` stat cells below) since six
// fixed-width columns don't fit a phone screen; the header row stays
// hidden below lg entirely, matching ListView's own breakpoint. Written as
// complete literal class strings (not built from a shared bracket-value
// constant + a separately-interpolated "lg:" prefix) because Tailwind's
// build-time scanner only generates a variant for a class it finds as one
// unbroken token in the source — `` `lg:${X}` `` would never actually match.
const LIST_HEADER_ROW_CLASSES = 'hidden lg:grid lg:grid-cols-[1fr_5rem_5rem_9rem_2.25rem_2.25rem]';
const LIST_DATA_ROW_CLASSES = 'flex lg:grid lg:grid-cols-[1fr_5rem_5rem_9rem_2.25rem_2.25rem]';

interface WorkspaceSummary {
  id: string;
  name: string;
  number?: number;
  role: string;
  boardCount: number;
  memberCount: number;
  lastActivityAt: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
};

// All workspaces you belong to, with the at-a-glance facts the capped
// sidebar list can't show — board count, member count, your role, and how
// recently anything happened. Reached via the "View all workspaces" link
// in the sidebar (app/page.tsx) once you have more than fit there; the
// sidebar's own inline filter still handles the fast "find one now" case
// without leaving the home page, so this page is for browsing, not the
// only way to find a workspace.
export default function WorkspacesPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  // Grid/list toggle, remembered the same way the per-workspace boards page
  // remembers its own (see workspace-boards-view-${id} in
  // app/boards/[id]/page.tsx) — lazy initializer so the first render
  // already reflects it instead of flashing grid then flipping.
  const [view, setView] = useState<'grid' | 'list'>(() => {
    if (typeof window === 'undefined') return 'grid';
    return window.localStorage.getItem(WORKSPACES_VIEW_STORAGE_KEY) === 'list' ? 'list' : 'grid';
  });

  const handleSetView = useCallback((next: 'grid' | 'list') => {
    setView(next);
    window.localStorage.setItem(WORKSPACES_VIEW_STORAGE_KEY, next);
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      const { data: memberships, error: membershipsError } = await supabase
        .from('workspace_members')
        .select(
          `
          role,
          workspaces (
            id,
            name,
            number,
            created_at
          )
        `
        )
        .eq('profile_id', user.id);

      if (membershipsError) throw membershipsError;

      const rows = (memberships || []).filter((m: any) => m.workspaces !== null);
      const workspaceIds = rows.map((m: any) => m.workspaces.id);

      if (workspaceIds.length === 0) {
        setWorkspaces([]);
        return;
      }

      // Board count + most recent activity per workspace, and member count
      // per workspace — both computed client-side from a flat fetch rather
      // than a second API route, matching how this same data is gathered
      // for the home page (see useWorkspaceBoardsForHome / the workspace
      // sections in app/page.tsx).
      const [{ data: boardsData, error: boardsError }, { data: memberRows, error: memberRowsError }] =
        await Promise.all([
          supabase
            .from('boards')
            .select('workspace_id, last_activity_at')
            .in('workspace_id', workspaceIds),
          supabase.from('workspace_members').select('workspace_id').in('workspace_id', workspaceIds),
        ]);

      if (boardsError) throw boardsError;
      if (memberRowsError) throw memberRowsError;

      const boardCountByWorkspace = new Map<string, number>();
      const lastActivityByWorkspace = new Map<string, string>();
      (boardsData || []).forEach((b) => {
        boardCountByWorkspace.set(b.workspace_id, (boardCountByWorkspace.get(b.workspace_id) || 0) + 1);
        if (b.last_activity_at) {
          const current = lastActivityByWorkspace.get(b.workspace_id);
          if (!current || b.last_activity_at > current) {
            lastActivityByWorkspace.set(b.workspace_id, b.last_activity_at);
          }
        }
      });

      const memberCountByWorkspace = new Map<string, number>();
      (memberRows || []).forEach((m) => {
        memberCountByWorkspace.set(m.workspace_id, (memberCountByWorkspace.get(m.workspace_id) || 0) + 1);
      });

      const summaries: WorkspaceSummary[] = rows.map((m: any) => ({
        id: m.workspaces.id,
        name: m.workspaces.name,
        number: m.workspaces.number,
        role: m.role || 'member',
        boardCount: boardCountByWorkspace.get(m.workspaces.id) || 0,
        memberCount: memberCountByWorkspace.get(m.workspaces.id) || 0,
        lastActivityAt:
          lastActivityByWorkspace.get(m.workspaces.id) || m.workspaces.created_at || null,
      }));

      // Most-recently-active first — same signal used for the sidebar/home
      // content ordering, so this page's order matches what you'd expect
      // coming from there.
      summaries.sort(
        (a, b) => new Date(b.lastActivityAt || '').getTime() - new Date(a.lastActivityAt || '').getTime()
      );

      setWorkspaces(summaries);
    } catch (err: any) {
      console.error('Error loading workspaces:', err);
      setError('Could not load your workspaces.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    load();
  }, [authLoading, load]);

  const filteredWorkspaces = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return workspaces;
    return workspaces.filter((w) => w.name.toLowerCase().includes(query));
  }, [workspaces, searchQuery]);

  return (
    <div className='min-h-screen dot-pattern-dark'>
      <DashboardHeader />

      <main className='container mx-auto max-w-7xl px-3 sm:px-4 pt-20 sm:pt-24 pb-8 sm:pb-16'>
        <div className='flex items-center gap-3 mb-6 sm:mb-8'>
          <Link
            href='/'
            className='p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors flex-shrink-0'
            aria-label='Back to home'
          >
            <ArrowLeft className='w-5 h-5' />
          </Link>
          <div className='flex-1 min-w-0'>
            <h1 className='text-xl sm:text-2xl font-bold text-foreground'>Workspaces</h1>
            <p className='text-sm text-muted-foreground'>
              {isLoading ? 'Loading…' : `${workspaces.length} workspace${workspaces.length === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>

        <div className='flex items-center gap-2 mb-5 sm:mb-6'>
          <div className='relative flex-1 max-w-sm'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground' />
            <input
              type='text'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Search workspaces...'
              className='w-full pl-9 pr-3 py-2 text-sm bg-muted/40 border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all'
            />
          </div>

          <div className='flex items-center gap-0.5 p-0.5 bg-muted/40 border border-border/50 rounded-lg flex-shrink-0'>
            <button
              onClick={() => handleSetView('grid')}
              title='Grid view'
              aria-pressed={view === 'grid'}
              className={`p-1.5 rounded-md transition-colors ${
                view === 'grid' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className='w-4 h-4' />
            </button>
            <button
              onClick={() => handleSetView('list')}
              title='List view'
              aria-pressed={view === 'list'}
              className={`p-1.5 rounded-md transition-colors ${
                view === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className='w-4 h-4' />
            </button>
          </div>
        </div>

        {error ? (
          <div className='p-8 text-center text-muted-foreground'>
            <p className='mb-2'>{error}</p>
            <button onClick={load} className='text-sm font-medium text-primary hover:text-primary/80'>
              Try again
            </button>
          </div>
        ) : isLoading ? (
          view === 'list' ? (
            <div className='bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl overflow-hidden divide-y divide-border/40'>
              <div className={`${LIST_HEADER_ROW_CLASSES} gap-2 px-4 py-2.5`}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className='h-3 bg-muted/50 rounded animate-pulse' />
                ))}
              </div>
              {[...Array(6)].map((_, i) => (
                <div key={i} className='h-14 bg-card/50 animate-pulse' />
              ))}
            </div>
          ) : (
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5'>
              {[...Array(8)].map((_, i) => (
                <div key={i} className='h-36 rounded-2xl bg-card/50 backdrop-blur-xl animate-pulse' />
              ))}
            </div>
          )
        ) : view === 'list' ? (
          <div className='bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl overflow-hidden divide-y divide-border/40'>
            {/* Column headings — hidden below lg, same breakpoint ListView
                (the board task list) hides its own header at, and the same
                grid template every row below uses, so labels always sit
                directly above their column's data. */}
            <div
              className={`${LIST_HEADER_ROW_CLASSES} gap-2 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide`}
            >
              <div>Workspace</div>
              <div className='text-center'>Boards</div>
              <div className='text-center'>Members</div>
              <div>Last Activity</div>
              <div className='col-span-2 text-right pr-1'>Actions</div>
            </div>

            {!searchQuery.trim() && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className='w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-muted-foreground hover:text-primary'
              >
                <Plus className='w-4 h-4' />
                <span className='text-sm font-medium'>Create Workspace</span>
              </button>
            )}

            {filteredWorkspaces.map((workspace) => (
              <Link
                key={workspace.id}
                href={`/boards/${workspace.id}`}
                className={`${LIST_DATA_ROW_CLASSES} items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors group`}
              >
                <div className='flex flex-1 items-center gap-2.5 min-w-0'>
                  <div
                    className='w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-md flex-shrink-0'
                    style={{ backgroundColor: colorForEntity(workspace.id, workspace.number) }}
                  >
                    {workspace.name.charAt(0).toUpperCase()}
                  </div>
                  <p className='text-sm font-medium text-foreground truncate min-w-0'>{workspace.name}</p>
                  <span className='flex-shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5'>
                    {ROLE_LABEL[workspace.role] || workspace.role}
                  </span>
                </div>

                {/* Stat columns: grid cells at lg+ (right under their
                    header label), not rendered at all below lg — a phone
                    screen can't fit six fixed columns, so the mobile row
                    is just avatar/name/role plus the always-visible action
                    icons at the end. */}
                <div
                  className='hidden lg:flex items-center justify-center gap-1 text-xs text-muted-foreground'
                  title='Boards'
                >
                  <LayoutGrid className='w-3.5 h-3.5 flex-shrink-0' />
                  {workspace.boardCount}
                </div>

                <div
                  className='hidden lg:flex items-center justify-center gap-1 text-xs text-muted-foreground'
                  title='Members'
                >
                  <Users className='w-3.5 h-3.5 flex-shrink-0' />
                  {workspace.memberCount}
                </div>

                <div
                  className='hidden lg:flex items-center gap-1 text-xs text-muted-foreground truncate'
                  title='Last activity'
                >
                  {workspace.lastActivityAt && (
                    <>
                      <Clock className='w-3.5 h-3.5 flex-shrink-0' />
                      <span className='truncate'>
                        {formatDistanceToNow(new Date(workspace.lastActivityAt), { addSuffix: true })}
                      </span>
                    </>
                  )}
                </div>

                {/* Each action gets its own fixed-width slot (matching the
                    two 2.25rem columns in LIST_ROW_GRID_COLS) so Members
                    always lands in the same place whether or not Settings
                    is shown next to it — an empty placeholder holds that
                    slot's width for non-admins instead of letting Members
                    slide over into it. */}
                <div className='flex items-center justify-center'>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      router.push(`/workspace/${workspace.id}/members`);
                    }}
                    className='p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors'
                    aria-label='Workspace members'
                    title='Members'
                  >
                    <Users className='w-3.5 h-3.5' />
                  </button>
                </div>
                <div className='flex items-center justify-center'>
                  {canManageWorkspace(workspace.role) ? (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        router.push(`/workspace/${workspace.id}/settings`);
                      }}
                      className='p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors'
                      aria-label='Workspace settings'
                      title='Settings'
                    >
                      <Settings className='w-3.5 h-3.5' />
                    </button>
                  ) : (
                    <div className='w-[1.875rem] h-[1.875rem]' aria-hidden='true' />
                  )}
                </div>
              </Link>
            ))}

            {searchQuery.trim() && filteredWorkspaces.length === 0 && (
              <div className='px-4 py-8 text-center text-sm text-muted-foreground'>
                No workspaces match &ldquo;{searchQuery.trim()}&rdquo;
              </div>
            )}
          </div>
        ) : (
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5'>
            {!searchQuery.trim() && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className='h-36 rounded-2xl border-2 border-dashed border-border/50 hover:border-primary bg-card/30 backdrop-blur-xl hover:bg-card/50 flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition-all group'
              >
                <div className='w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors'>
                  <Plus className='w-5 h-5 text-primary' />
                </div>
                <span className='font-medium text-sm'>Create Workspace</span>
              </button>
            )}

            {filteredWorkspaces.map((workspace) => (
              <Link
                key={workspace.id}
                href={`/boards/${workspace.id}`}
                className='group relative block h-36 rounded-2xl border border-border bg-card/70 backdrop-blur-xl overflow-hidden p-4
                  transition-all duration-300 ease-out
                  hover:-translate-y-1 hover:border-muted-foreground/40 hover:bg-card/85 hover:shadow-2xl hover:shadow-black/40'
              >
                <div className='flex items-start justify-between gap-2'>
                  <div className='flex items-center gap-2.5 min-w-0'>
                    <div
                      className='w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white shadow-md flex-shrink-0'
                      style={{ backgroundColor: colorForEntity(workspace.id, workspace.number) }}
                    >
                      {workspace.name.charAt(0).toUpperCase()}
                    </div>
                    <div className='min-w-0'>
                      <h3 className='font-semibold text-foreground text-sm line-clamp-1 leading-tight'>
                        {workspace.name}
                      </h3>
                      <span className='inline-block mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5'>
                        {ROLE_LABEL[workspace.role] || workspace.role}
                      </span>
                    </div>
                  </div>

                  <div className='flex items-center gap-0.5 flex-shrink-0'>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        router.push(`/workspace/${workspace.id}/members`);
                      }}
                      className='p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors'
                      aria-label='Workspace members'
                      title='Members'
                    >
                      <Users className='w-3.5 h-3.5' />
                    </button>
                    {canManageWorkspace(workspace.role) && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          router.push(`/workspace/${workspace.id}/settings`);
                        }}
                        className='p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors'
                        aria-label='Workspace settings'
                        title='Settings'
                      >
                        <Settings className='w-3.5 h-3.5' />
                      </button>
                    )}
                  </div>
                </div>

                <div className='absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-muted-foreground'>
                  <div className='flex items-center gap-3'>
                    <span className='flex items-center gap-1' title='Boards'>
                      <LayoutGrid className='w-3.5 h-3.5' />
                      {workspace.boardCount}
                    </span>
                    <span className='flex items-center gap-1' title='Members'>
                      <Users className='w-3.5 h-3.5' />
                      {workspace.memberCount}
                    </span>
                  </div>
                  {workspace.lastActivityAt && (
                    <span className='flex items-center gap-1' title='Last activity'>
                      <Clock className='w-3.5 h-3.5' />
                      {formatDistanceToNow(new Date(workspace.lastActivityAt), { addSuffix: true })}
                    </span>
                  )}
                </div>
              </Link>
            ))}

            {searchQuery.trim() && filteredWorkspaces.length === 0 && (
              <div className='col-span-full p-8 text-center text-muted-foreground'>
                No workspaces match &ldquo;{searchQuery.trim()}&rdquo;
              </div>
            )}
          </div>
        )}
      </main>

      <CreateWorkspaceModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          setIsCreateModalOpen(false);
          load();
        }}
      />
    </div>
  );
}
