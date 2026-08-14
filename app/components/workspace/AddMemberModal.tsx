import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UserPlus, X, Plus, Shield, User, Loader2, Search } from 'lucide-react';
import {
  useProfileSearch,
  useAddMember,
} from '@/hooks/queries/useWorkspaceMembersQuery';
import { useMembersStore } from '@/lib/stores/useMembersStore';

interface AddMemberModalProps {
  workspaceId: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  // Whether the current user is allowed to grant the 'admin' role (i.e.
  // they're themselves an owner/admin of this workspace) — the server
  // already rejects an unauthorized 'admin' grant (see
  // app/api/workspaces/[id]/add-member/route.ts), this just keeps the
  // option from being offered to someone it would only fail for. Defaults
  // to false (member-only) so a caller that forgets to pass this doesn't
  // silently expose an option that always errors.
  canGrantAdmin?: boolean;
}

// Shape actually returned by GET /api/profiles/search — distinct from the
// `Profile` type in useWorkspaceMembersQuery.ts (which uses `full_name` and
// backs the *members list*, a separate query). The search endpoint maps its
// row to `name` before responding, so this modal needs its own type rather
// than importing that unrelated one — using it caused `.name` to read as
// `undefined` per TypeScript even though the real API response has always
// had `name` (a type-only mismatch, not a runtime bug, but worth a correct
// type instead of the wrong imported one).
interface SearchProfile {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

const Avatar = ({
  profile,
  size = 32,
}: {
  profile: { name: string; avatar_url?: string };
  size?: number;
}) =>
  profile.avatar_url ? (
    <img
      src={profile.avatar_url}
      alt={profile.name}
      className='rounded-full object-cover flex-shrink-0'
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className='rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium flex-shrink-0'
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {profile.name.charAt(0).toUpperCase()}
    </div>
  );

export const AddMemberModal = React.memo<AddMemberModalProps>(
  ({ workspaceId, onSuccess, onError, canGrantAdmin = false }) => {
    const {
      showAddMemberModal,
      searchQuery,
      setShowAddMemberModal,
      setSearchQuery,
      setIsSearching,
      resetAddMemberState,
    } = useMembersStore();

    const searchInputRef = useRef<HTMLInputElement>(null);

    // Staged selection — picking someone from search only adds them here;
    // nothing is written to the DB until "Add N member(s)" is clicked, so
    // a wrong pick can just be removed from this list first. Chip UI
    // mirrors CardMemberPicker's "On this card" row, but there it reflects
    // real committed members — here it's a pending list, not yet real.
    const [selected, setSelected] = useState<SearchProfile[]>([]);
    const [selectedRoles, setSelectedRoles] = useState<
      Record<string, 'admin' | 'member'>
    >({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const selectedIds = useMemo(
      () => new Set(selected.map((p) => p.id)),
      [selected]
    );

    // Use TanStack Query for search
    const {
      data: searchResults = [],
      isLoading: isSearchLoading,
      error: searchError,
    } = useProfileSearch(searchQuery, workspaceId) as {
      data: SearchProfile[];
      isLoading: boolean;
      error: Error | null;
    };

    // Don't show someone in results who's already staged for adding
    const filteredResults = searchResults.filter((p) => !selectedIds.has(p.id));

    // Add member mutation
    const addMemberMutation = useAddMember();

    // Update loading states
    useEffect(() => {
      setIsSearching(isSearchLoading);
    }, [isSearchLoading, setIsSearching]);

    // Handle search errors
    useEffect(() => {
      if (searchError) {
        onError(searchError.message);
      }
    }, [searchError, onError]);

    // Focus search input when modal opens
    useEffect(() => {
      if (showAddMemberModal && searchInputRef.current) {
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
    }, [showAddMemberModal]);

    const handleSearchChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
      },
      [setSearchQuery]
    );

    const handleClearSearch = useCallback(() => {
      setSearchQuery('');
    }, [setSearchQuery]);

    const handleSelect = useCallback((profile: SearchProfile) => {
      setSelected((prev) => [...prev, profile]);
    }, []);

    const handleDeselect = useCallback((profileId: string) => {
      setSelected((prev) => prev.filter((p) => p.id !== profileId));
      setSelectedRoles((prev) => {
        const next = { ...prev };
        delete next[profileId];
        return next;
      });
    }, []);

    const handleRoleToggle = useCallback(
      (profileId: string, role: 'admin' | 'member') => {
        setSelectedRoles((prev) => ({ ...prev, [profileId]: role }));
      },
      []
    );

    const reset = useCallback(() => {
      setSelected([]);
      setSelectedRoles({});
      resetAddMemberState();
    }, [resetAddMemberState]);

    // The only place that actually writes anything — everything up to
    // this point was local state.
    const handleConfirm = useCallback(async () => {
      if (selected.length === 0) return;

      setIsSubmitting(true);
      const succeeded: SearchProfile[] = [];
      const failed: { profile: SearchProfile; message: string }[] = [];

      for (const profile of selected) {
        try {
          await addMemberMutation.mutateAsync({
            workspaceId,
            profileId: profile.id,
            role: selectedRoles[profile.id] || 'member',
          });
          succeeded.push(profile);
        } catch (error) {
          failed.push({
            profile,
            message: error instanceof Error ? error.message : 'failed to add',
          });
        }
      }

      setIsSubmitting(false);

      if (succeeded.length > 0) {
        onSuccess(
          succeeded.length === 1
            ? `${succeeded[0].name} has been added to the workspace`
            : `${succeeded.length} members have been added to the workspace`
        );
      }
      if (failed.length > 0) {
        onError(failed.map((f) => `${f.profile.name}: ${f.message}`).join('; '));
      }

      // Close only once everything's settled, and only if nothing failed —
      // a failure leaves the modal open with just that person still
      // staged, so it's obvious who didn't go through instead of silently
      // losing them once the modal closes.
      if (failed.length === 0) {
        setShowAddMemberModal(false);
        reset();
      } else {
        const failedIds = new Set(failed.map((f) => f.profile.id));
        setSelected((prev) => prev.filter((p) => failedIds.has(p.id)));
      }
    }, [
      selected,
      selectedRoles,
      addMemberMutation,
      workspaceId,
      onSuccess,
      onError,
      setShowAddMemberModal,
      reset,
    ]);

    const handleClose = useCallback(() => {
      setShowAddMemberModal(false);
      reset();
    }, [setShowAddMemberModal, reset]);

    if (!showAddMemberModal) return null;

    return (
      <div className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'>
        <div className='bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col animate-in fade-in-50 zoom-in-95 duration-200'>
          {/* Header — X cancels and discards the whole staged selection,
              nothing gets written unless "Add" below is clicked. */}
          <div className='flex items-center justify-between p-5 border-b border-border/50'>
            <div className='flex items-center gap-3'>
              <div className='w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center'>
                <UserPlus className='w-4 h-4 text-primary' />
              </div>
              <div>
                <h3 className='text-base font-semibold text-foreground'>
                  Add member
                </h3>
                <p className='text-xs text-muted-foreground'>
                  Search by name or email
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className='p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
              aria-label='Close modal'
              disabled={isSubmitting}
            >
              <X className='w-4 h-4' />
            </button>
          </div>

          {/* Content */}
          <div className='p-5 overflow-y-auto'>
            {/* Staged selection — visible up front, same idea as the card
                picker's "On this card" row, except these aren't committed
                yet: removing one here just drops it from the list. */}
            {selected.length > 0 && (
              <div className='mb-4'>
                <p className='text-xs font-medium text-muted-foreground mb-2'>
                  To add ({selected.length})
                </p>
                <div className='space-y-1.5'>
                  {selected.map((profile) => {
                    const role = selectedRoles[profile.id] || 'member';
                    return (
                      <div
                        key={profile.id}
                        className='flex items-center gap-2.5 pl-1.5 pr-2 py-1.5 bg-primary/5 border border-primary/20 rounded-lg'
                      >
                        <Avatar profile={profile} size={26} />
                        <div className='min-w-0 flex-1'>
                          <p className='text-xs font-medium text-foreground truncate'>
                            {profile.name}
                          </p>
                        </div>
                        {canGrantAdmin && (
                          <div className='flex items-center rounded-md border border-border/50 overflow-hidden flex-shrink-0'>
                            {(['member', 'admin'] as const).map((r) => (
                              <button
                                key={r}
                                type='button'
                                onClick={() => handleRoleToggle(profile.id, r)}
                                disabled={isSubmitting}
                                title={r === 'admin' ? 'Add as admin' : 'Add as member'}
                                className={`p-1 transition-colors ${
                                  role === r
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:bg-muted/60'
                                }`}
                              >
                                {r === 'admin' ? (
                                  <Shield className='w-3 h-3' />
                                ) : (
                                  <User className='w-3 h-3' />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                        <button
                          type='button'
                          onClick={() => handleDeselect(profile.id)}
                          disabled={isSubmitting}
                          title={`Remove ${profile.name} from this batch`}
                          className='p-1 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0'
                        >
                          <X className='w-3.5 h-3.5' />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Search */}
            <div className='relative mb-3'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none' />
              <input
                ref={searchInputRef}
                type='text'
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder='Type at least 2 characters...'
                disabled={isSubmitting}
                className='w-full pl-9 pr-9 py-2.5 text-sm border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 bg-muted/30 transition-all'
              />
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className='absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground rounded-full transition-colors'
                  aria-label='Clear search'
                >
                  <X className='w-3.5 h-3.5' />
                </button>
              )}
            </div>

            {/* Results — clicking one only stages it above, no request
                fires yet. */}
            {searchQuery.length >= 2 && (
              <div className='space-y-1 max-h-56 overflow-y-auto'>
                {isSearchLoading ? (
                  <div className='flex items-center justify-center py-8'>
                    <div className='w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin' />
                  </div>
                ) : filteredResults.length > 0 ? (
                  filteredResults.map((profile, index) => (
                    <button
                      key={profile.id}
                      type='button'
                      onClick={() => handleSelect(profile)}
                      disabled={isSubmitting}
                      className='w-full flex items-center gap-3 p-2 rounded-xl hover:bg-muted/40 transition-colors duration-200 text-left animate-slide-in-right disabled:cursor-not-allowed'
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <Avatar profile={profile} size={32} />
                      <div className='min-w-0 flex-1'>
                        <p className='text-sm font-medium text-foreground truncate'>
                          {profile.name}
                        </p>
                        <p className='text-xs text-muted-foreground truncate'>
                          {profile.email}
                        </p>
                      </div>
                      <Plus className='w-4 h-4 text-muted-foreground flex-shrink-0' />
                    </button>
                  ))
                ) : (
                  <div className='p-6 text-center text-sm text-muted-foreground'>
                    No users found for &ldquo;{searchQuery}&rdquo;
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer — the one action that actually writes anything. */}
          <div className='flex justify-end gap-2 p-5 pt-0 border-t border-border/50 mt-auto'>
            <button
              onClick={handleConfirm}
              disabled={isSubmitting || selected.length === 0}
              className='btn btn-primary px-4 py-2 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {isSubmitting ? (
                <>
                  <Loader2 className='w-4 h-4 animate-spin' />
                  Adding...
                </>
              ) : (
                <>
                  <UserPlus className='w-4 h-4' />
                  {selected.length > 0
                    ? `Add ${selected.length} member${selected.length > 1 ? 's' : ''}`
                    : 'Add member'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }
);

AddMemberModal.displayName = 'AddMemberModal';
