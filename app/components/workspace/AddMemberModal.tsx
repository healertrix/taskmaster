import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import { UserPlus, X, Check, Shield, User, Loader2, Search } from 'lucide-react';
import {
  useProfileSearch,
  useAddMember,
} from '@/hooks/queries/useWorkspaceMembersQuery';
import { useMembersStore } from '@/lib/stores/useMembersStore';

interface AddMemberModalProps {
  workspaceId: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
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

export const AddMemberModal = React.memo<AddMemberModalProps>(
  ({ workspaceId, onSuccess, onError }) => {
    const {
      showAddMemberModal,
      selectedMember,
      addMemberRole,
      searchQuery,
      isSearching,
      isAddingMember,
      setShowAddMemberModal,
      setSelectedMember,
      setAddMemberRole,
      setSearchQuery,
      setIsSearching,
      setIsAddingMember,
      resetAddMemberState,
    } = useMembersStore();

    const searchInputRef = useRef<HTMLInputElement>(null);

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
        setSelectedMember(null);
      },
      [setSearchQuery, setSelectedMember]
    );

    const handleClearSearch = useCallback(() => {
      setSearchQuery('');
      setSelectedMember(null);
    }, [setSearchQuery, setSelectedMember]);

    const handleMemberSelect = useCallback(
      (member: SearchProfile) => {
        setSelectedMember(
          selectedMember?.id === member.id ? null : (member as any)
        );
      },
      [setSelectedMember, selectedMember]
    );

    const handleRoleChange = useCallback(
      (role: 'admin' | 'member') => {
        setAddMemberRole(role);
      },
      [setAddMemberRole]
    );

    const handleAddMember = useCallback(async () => {
      if (!selectedMember) return;

      setIsAddingMember(true);
      try {
        await addMemberMutation.mutateAsync({
          workspaceId,
          profileId: selectedMember.id,
          role: addMemberRole,
        });

        onSuccess(
          `${(selectedMember as unknown as SearchProfile).name} has been added to the workspace`
        );
        setShowAddMemberModal(false);
        resetAddMemberState();
      } catch (error) {
        onError(
          error instanceof Error ? error.message : 'Failed to add member'
        );
      } finally {
        setIsAddingMember(false);
      }
    }, [
      selectedMember,
      workspaceId,
      addMemberRole,
      addMemberMutation,
      onSuccess,
      onError,
      setShowAddMemberModal,
      resetAddMemberState,
      setIsAddingMember,
    ]);

    const handleClose = useCallback(() => {
      setShowAddMemberModal(false);
      resetAddMemberState();
    }, [setShowAddMemberModal, resetAddMemberState]);

    const selected = selectedMember as unknown as SearchProfile | null;

    const searchContent = useMemo(() => {
      if (isSearchLoading) {
        return (
          <div className='p-6 flex items-center justify-center gap-2 text-sm text-muted-foreground'>
            <Loader2 className='w-4 h-4 animate-spin' />
            Searching...
          </div>
        );
      }

      if (searchResults.length > 0) {
        return (
          <div className='max-h-52 overflow-y-auto py-1'>
            {searchResults.map((profile) => {
              const isSelected = selected?.id === profile.id;
              return (
                <button
                  key={profile.id}
                  onClick={() => handleMemberSelect(profile)}
                  className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors ${
                    isSelected ? 'bg-primary/10' : 'hover:bg-muted/40'
                  }`}
                >
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.name}
                      className='w-8 h-8 rounded-full object-cover flex-shrink-0'
                    />
                  ) : (
                    <div className='w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium flex-shrink-0'>
                      {profile.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className='min-w-0 flex-1'>
                    <div className='text-sm font-medium text-foreground truncate'>
                      {profile.name}
                    </div>
                    <div className='text-xs text-muted-foreground truncate'>
                      {profile.email}
                    </div>
                  </div>
                  {isSelected && (
                    <Check className='w-4 h-4 text-primary flex-shrink-0' />
                  )}
                </button>
              );
            })}
          </div>
        );
      }

      if (searchQuery.length >= 2) {
        return (
          <div className='p-6 text-center text-sm text-muted-foreground'>
            No users found for &ldquo;{searchQuery}&rdquo;
          </div>
        );
      }

      return null;
    }, [isSearchLoading, searchResults, selected, searchQuery, handleMemberSelect]);

    if (!showAddMemberModal) return null;

    return (
      <div className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'>
        <div className='bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200'>
          {/* Header */}
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
            >
              <X className='w-4 h-4' />
            </button>
          </div>

          {/* Content */}
          <div className='p-5 space-y-4'>
            {/* Search */}
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none' />
              <input
                ref={searchInputRef}
                type='text'
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder='Type at least 2 characters...'
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

            {searchQuery.length >= 2 && (
              <div className='border border-border/50 rounded-lg overflow-hidden bg-muted/10'>
                {searchContent}
              </div>
            )}

            {/* Role selection — only once a member is picked */}
            {selected && (
              <div className='space-y-2 pt-1'>
                <div className='flex items-center gap-3 p-2.5 bg-primary/5 border border-primary/20 rounded-lg'>
                  {selected.avatar_url ? (
                    <img
                      src={selected.avatar_url}
                      alt={selected.name}
                      className='w-8 h-8 rounded-full object-cover flex-shrink-0'
                    />
                  ) : (
                    <div className='w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium flex-shrink-0'>
                      {selected.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className='min-w-0 flex-1'>
                    <div className='text-sm font-medium text-foreground truncate'>
                      {selected.name}
                    </div>
                    <div className='text-xs text-muted-foreground truncate'>
                      {selected.email}
                    </div>
                  </div>
                </div>

                <div className='grid grid-cols-2 gap-2'>
                  {(['member', 'admin'] as const).map((role) => (
                    <button
                      key={role}
                      onClick={() => handleRoleChange(role)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        addMemberRole === role
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border/50 text-muted-foreground hover:bg-muted/40'
                      }`}
                    >
                      {role === 'admin' ? (
                        <Shield className='w-3.5 h-3.5' />
                      ) : (
                        <User className='w-3.5 h-3.5' />
                      )}
                      {role === 'admin' ? 'Admin' : 'Member'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer — just the one primary action; closing is the X in the
              header, not a second "Cancel" button competing with it. */}
          <div className='flex justify-end p-5 pt-0'>
            <button
              onClick={handleAddMember}
              disabled={isAddingMember || !selected}
              className='btn btn-primary px-4 py-2 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {isAddingMember ? (
                <>
                  <Loader2 className='w-4 h-4 animate-spin' />
                  Adding...
                </>
              ) : (
                <>
                  <UserPlus className='w-4 h-4' />
                  Add member
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
