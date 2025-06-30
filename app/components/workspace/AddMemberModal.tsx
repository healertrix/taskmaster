import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import { UserPlus, Users, X, Check, Shield, User, Loader2 } from 'lucide-react';
import {
  useProfileSearch,
  useAddMember,
} from '@/hooks/queries/useWorkspaceMembersQuery';
import { useMembersStore } from '@/lib/stores/useMembersStore';
import { SearchResultSkeleton } from '@/app/components/ui/MembersSkeleton';
import type { Profile } from '@/hooks/queries/useWorkspaceMembersQuery';

interface AddMemberModalProps {
  workspaceId: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
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
    } = useProfileSearch(searchQuery, workspaceId);

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
        const query = e.target.value;
        setSearchQuery(query);
      },
      [setSearchQuery]
    );

    const handleClearSearch = useCallback(() => {
      setSearchQuery('');
      setSelectedMember(null);
    }, [setSearchQuery, setSelectedMember]);

    const handleMemberSelect = useCallback(
      (member: Profile) => {
        setSelectedMember(member);
      },
      [setSelectedMember]
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

        onSuccess(`${selectedMember.name} has been added to the workspace`);
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

    const searchContent = useMemo(() => {
      if (isSearchLoading) {
        return (
          <div className='p-8 text-center'>
            <div className='flex flex-col items-center gap-3'>
              <div className='w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center'>
                <Loader2 className='w-5 h-5 animate-spin text-primary' />
              </div>
              <p className='text-sm text-muted-foreground'>
                Searching for users...
              </p>
            </div>
          </div>
        );
      }

      if (searchResults.length > 0) {
        return (
          <div className='max-h-64 overflow-y-auto'>
            <div className='p-2 space-y-1'>
              {searchResults.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => handleMemberSelect(profile)}
                  className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${
                    selectedMember?.id === profile.id
                      ? 'bg-primary/10 border-2 border-primary/30 shadow-sm'
                      : 'hover:bg-muted/30 border-2 border-transparent'
                  }`}
                >
                  <div className='flex items-center gap-3'>
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile.name}
                        className='w-10 h-10 rounded-full object-cover border-2 border-border/20'
                      />
                    ) : (
                      <div className='w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground font-medium'>
                        {profile.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className='flex-1 min-w-0'>
                      <div className='font-medium text-foreground truncate'>
                        {profile.name}
                      </div>
                      <div className='text-sm text-muted-foreground truncate'>
                        {profile.email}
                      </div>
                    </div>
                    {selectedMember?.id === profile.id && (
                      <div className='w-5 h-5 rounded-full bg-primary flex items-center justify-center'>
                        <Check className='w-3 h-3 text-primary-foreground' />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      }

      if (searchQuery.length >= 2) {
        return (
          <div className='p-8 text-center'>
            <div className='flex flex-col items-center gap-3'>
              <div className='w-12 h-12 rounded-full bg-muted/20 flex items-center justify-center'>
                <Users className='w-6 h-6 text-muted-foreground' />
              </div>
              <div>
                <p className='font-medium text-foreground'>No users found</p>
                <p className='text-sm text-muted-foreground'>
                  Try adjusting your search terms
                </p>
              </div>
            </div>
          </div>
        );
      }

      return null;
    }, [
      isSearchLoading,
      searchResults,
      selectedMember,
      searchQuery,
      handleMemberSelect,
    ]);

    if (!showAddMemberModal) return null;

    return (
      <div className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'>
        <div className='bg-gradient-to-br from-background via-background to-background/95 border border-border/50 rounded-2xl shadow-2xl w-full max-w-2xl h-[600px] mx-4 overflow-hidden flex flex-col'>
          {/* Header */}
          <div className='relative bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border-b border-border/50'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-3'>
                <div className='w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center'>
                  <UserPlus className='w-5 h-5 text-primary' />
                </div>
                <div>
                  <h3 className='text-xl font-semibold text-foreground'>
                    Add Member
                  </h3>
                  <p className='text-sm text-muted-foreground'>
                    Search and add existing users to your workspace
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className='w-8 h-8 rounded-full bg-muted/50 hover:bg-muted/80 flex items-center justify-center transition-colors'
                aria-label='Close modal'
              >
                <X className='w-4 h-4' />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className='flex-1 p-6 space-y-6 overflow-y-auto'>
            {/* Search Section */}
            <div className='space-y-3'>
              <label className='text-sm font-medium text-foreground flex items-center gap-2'>
                <Users className='w-4 h-4' />
                Search for users
              </label>
              <div className='relative'>
                <input
                  ref={searchInputRef}
                  type='text'
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder='Type name or email to search...'
                  className='w-full px-4 py-3 pl-11 border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 bg-background/50 backdrop-blur-sm transition-all duration-200'
                />
                <div className='absolute left-3 top-1/2 -translate-y-1/2'>
                  {isSearching ? (
                    <Loader2 className='w-5 h-5 animate-spin text-muted-foreground' />
                  ) : (
                    <Users className='w-5 h-5 text-muted-foreground' />
                  )}
                </div>
                {searchQuery && (
                  <button
                    onClick={handleClearSearch}
                    className='absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors'
                    aria-label='Clear search'
                  >
                    <X className='w-3 h-3' />
                  </button>
                )}
              </div>

              {/* Search Results */}
              {searchQuery.length >= 2 && (
                <div className='mt-4 border border-border/50 rounded-xl overflow-hidden bg-background/30 backdrop-blur-sm'>
                  {searchContent}
                </div>
              )}
            </div>

            {/* Selected Member Preview */}
            {selectedMember && (
              <div className='bg-gradient-to-r from-primary/5 to-transparent border border-primary/20 rounded-xl p-4'>
                <div className='flex items-center gap-3 mb-4'>
                  <div className='w-2 h-2 rounded-full bg-primary animate-pulse'></div>
                  <span className='text-sm font-medium text-primary'>
                    Selected Member
                  </span>
                </div>
                <div className='flex items-center gap-3 mb-4'>
                  {selectedMember.avatar_url ? (
                    <img
                      src={selectedMember.avatar_url}
                      alt={selectedMember.name}
                      className='w-12 h-12 rounded-full object-cover border-2 border-primary/20'
                    />
                  ) : (
                    <div className='w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground font-medium text-lg'>
                      {selectedMember.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className='font-medium text-foreground'>
                      {selectedMember.name}
                    </div>
                    <div className='text-sm text-muted-foreground'>
                      {selectedMember.email}
                    </div>
                  </div>
                </div>

                {/* Role Selection */}
                <div className='space-y-4'>
                  <div className='flex items-center gap-2'>
                    <div className='w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center'>
                      <Shield className='w-4 h-4 text-primary' />
                    </div>
                    <label className='text-base font-semibold text-foreground'>
                      Select Role
                    </label>
                  </div>
                  <div className='grid grid-cols-2 gap-4'>
                    {(['member', 'admin'] as const).map((role) => (
                      <button
                        key={role}
                        onClick={() => handleRoleChange(role)}
                        className={`group relative p-4 rounded-xl border-2 transition-all duration-300 text-left ${
                          addMemberRole === role
                            ? 'border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-lg shadow-primary/20'
                            : 'border-border/50 hover:border-border bg-background/50 hover:bg-background/80 hover:shadow-md'
                        }`}
                      >
                        <div className='flex flex-col items-center text-center space-y-3'>
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                              addMemberRole === role
                                ? 'bg-primary/20 text-primary'
                                : 'bg-muted/50 text-muted-foreground group-hover:bg-muted/80'
                            }`}
                          >
                            {role === 'admin' ? (
                              <Shield className='w-6 h-6' />
                            ) : (
                              <User className='w-6 h-6' />
                            )}
                          </div>
                          <div>
                            <div
                              className={`font-semibold text-base transition-colors ${
                                addMemberRole === role
                                  ? 'text-primary'
                                  : 'text-foreground'
                              }`}
                            >
                              {role === 'admin' ? 'Admin' : 'Member'}
                            </div>
                            <div
                              className={`text-xs transition-colors ${
                                addMemberRole === role
                                  ? 'text-primary/80'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {role === 'admin'
                                ? 'Full access'
                                : 'Basic access'}
                            </div>
                          </div>
                          {addMemberRole === role && (
                            <div className='absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center'>
                              <Check className='w-3 h-3 text-primary-foreground' />
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className='flex-shrink-0 bg-gradient-to-r from-muted/20 to-transparent p-6 border-t border-border/50'>
            <div className='flex justify-end gap-3'>
              <button
                onClick={handleClose}
                className='px-6 py-2.5 text-muted-foreground hover:text-foreground transition-colors font-medium'
              >
                Cancel
              </button>
              <button
                onClick={handleAddMember}
                disabled={isAddingMember || !selectedMember}
                className={`px-6 py-2.5 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-medium rounded-lg flex items-center gap-2 transition-all duration-200 ${
                  isAddingMember || !selectedMember
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:from-primary/90 hover:to-primary hover:shadow-lg hover:shadow-primary/25 active:scale-95'
                }`}
              >
                {isAddingMember ? (
                  <>
                    <Loader2 className='w-4 h-4 animate-spin' />
                    <span>Adding...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className='w-4 h-4' />
                    <span>Add Member</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

AddMemberModal.displayName = 'AddMemberModal';
