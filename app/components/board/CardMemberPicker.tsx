'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, User, Search, Check } from 'lucide-react';
import { useAppStore } from '@/lib/stores/useAppStore';

interface MemberData {
  id: string;
  role: string;
  created_at: string;
  profiles: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    email: string;
  };
}

interface CardMemberData {
  id: string;
  created_at: string;
  profiles: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    email: string;
  };
}

interface CardMemberPickerProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  boardId: string;
  cardId: string;
  currentMembers: CardMemberData[];
  onMemberAdded: (member: CardMemberData) => void;
  onRemoveMember?: (profileId: string) => void;
  isLoading?: boolean;
  autoCloseAfterAdd?: boolean;
  allowMultipleSelections?: boolean;
  // Optimized cached data
  cachedWorkspaceMembers?: MemberData[];
}

const UserAvatar = ({
  profile,
  size = 32,
}: {
  profile: { full_name: string | null; avatar_url: string | null };
  size?: number;
}) => {
  const getInitials = () => {
    if (profile.full_name) {
      return profile.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return 'U';
  };

  if (profile.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={profile.full_name || 'User'}
        className='rounded-full object-cover flex-shrink-0'
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className='rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold flex-shrink-0'
      style={{ width: size, height: size }}
    >
      {getInitials()}
    </div>
  );
};

export function CardMemberPicker({
  isOpen,
  onClose,
  workspaceId,
  boardId,
  cardId,
  currentMembers,
  onMemberAdded,
  onRemoveMember,
  isLoading = false,
  autoCloseAfterAdd = false,
  allowMultipleSelections = true,
  cachedWorkspaceMembers,
}: CardMemberPickerProps) {
  const [availableMembers, setAvailableMembers] = useState<MemberData[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [addingMemberIds, setAddingMemberIds] = useState<Set<string>>(
    new Set()
  );
  // Write straight to the shared cache instead of going through
  // useBoardStore, which would spin up its own independent `useLists`
  // fetch just for this one function — and that separate fetch's sync
  // effect could overwrite the board's shared cache with a stale
  // snapshot the moment it resolves, discarding other recent edits.
  const { updateCardMembersInCache } = useAppStore();
  const updateCardMembers = (cardId: string, members: any[]) =>
    updateCardMembersInCache(boardId, cardId, members);

  // Get current member IDs for filtering
  const currentMemberIds = new Set(
    currentMembers.map((member) => member.profiles.id)
  );

  // Filter available members based on search and current members
  const filteredMembers = availableMembers.filter((member) => {
    if (!member.profiles) return false;
    if (currentMemberIds.has(member.profiles.id)) return false;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const name = member.profiles.full_name?.toLowerCase() || '';
      const email = member.profiles.email.toLowerCase();
      return name.includes(query) || email.includes(query);
    }

    return true;
  });

  // Handle ESC key and back button/gesture to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      onClose();
      // Push a new state to maintain history
      window.history.pushState(null, '', window.location.href);
    };

    // Add state to history when opening modal
    window.history.pushState(null, '', window.location.href);

    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('popstate', handlePopState);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, onClose]);

  // Fetch available members when modal opens
  useEffect(() => {
    if (isOpen) {
      // Use cached data if available, otherwise fallback to API call
      if (cachedWorkspaceMembers) {
        setAvailableMembers(cachedWorkspaceMembers);
        setIsLoadingMembers(false);
      } else {
        fetchAvailableMembers();
      }
    }
  }, [isOpen, workspaceId, boardId, cachedWorkspaceMembers]);

  const fetchAvailableMembers = async () => {
    setIsLoadingMembers(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/available-members?board_id=${boardId}`
      );
      const data = await response.json();

      if (response.ok) {
        setAvailableMembers(data.members || []);
      } else {
        console.error('Failed to fetch available members:', data.error);
      }
    } catch (error) {
      console.error('Error fetching available members:', error);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const handleAddMember = async (profileId: string) => {
    // Belt-and-suspenders: the visible list is already filtered against
    // currentMemberIds, but if `currentMembers` was still loading (empty)
    // when this list was fetched, someone already on the card could still
    // be showing as "available" — catch that here instead of round-
    // tripping to the API just to get "User is already a member" back.
    if (currentMemberIds.has(profileId)) {
      setAvailableMembers((prev) =>
        prev.filter((member) => member.profiles.id !== profileId)
      );
      return;
    }

    // Find the member being added for optimistic update
    const memberToAdd = availableMembers.find(
      (member) => member.profiles.id === profileId
    );
    if (!memberToAdd) return;

    // Optimistic update - remove from available list immediately
    setAvailableMembers((prev) =>
      prev.filter((member) => member.profiles.id !== profileId)
    );

    // Create optimistic member data
    const optimisticMember = {
      id: `temp-${Date.now()}`, // Temporary ID
      created_at: new Date().toISOString(),
      profiles: memberToAdd.profiles,
    };

    // Add this member ID to the adding set
    setAddingMemberIds((prev) => new Set(prev).add(profileId));

    // Add to current members optimistically and trigger immediate update
    const updatedMembers = [...currentMembers, optimisticMember];
    onMemberAdded(optimisticMember);

    // Update the board store immediately with optimistic data
    updateCardMembers(cardId, updatedMembers);

    try {
      const response = await fetch(`/api/cards/${cardId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profile_id: profileId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Update the board store with the real data
        updateCardMembers(cardId, data.members || updatedMembers);

        // Auto-close modal after successful addition
        if (
          autoCloseAfterAdd &&
          !allowMultipleSelections &&
          !window.matchMedia('(max-width: 640px)').matches
        ) {
          setTimeout(() => onClose(), 300); // Small delay for better UX
        }
      } else {
        // Rollback optimistic updates
        setAvailableMembers((prev) => [...prev, memberToAdd]);
        updateCardMembers(cardId, currentMembers);
        console.error('Failed to add member:', data.error);
        alert(`Failed to add member: ${data.error}`);
      }
    } catch (error) {
      // Rollback optimistic updates
      setAvailableMembers((prev) => [...prev, memberToAdd]);
      updateCardMembers(cardId, currentMembers);
      console.error('Error adding member:', error);
      alert('Failed to add member. Please try again.');
    } finally {
      // Remove this member ID from the adding set
      setAddingMemberIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(profileId);
        return newSet;
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className='fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4'
      onClick={(e) => {
        e.stopPropagation(); // Prevent event from bubbling up
        onClose();
      }}
    >
      <div
        className='bg-card/90 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl w-full max-w-sm sm:max-w-md max-h-[85vh] overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200'
        onClick={(e) => e.stopPropagation()} // Prevent clicks on modal content from closing
      >
        {/* Header — just the X closes it; there's no separate "Done" button
            to click through first, since every Add here already applies
            immediately (there's nothing left to confirm). */}
        <div className='flex items-center justify-between p-5 border-b border-border/50'>
          <div className='flex items-center gap-3'>
            <div className='w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center'>
              <User className='w-4 h-4 text-primary' />
            </div>
            <div>
              <h3 className='text-base font-semibold text-foreground'>
                Manage members
              </h3>
              <p className='text-xs text-muted-foreground'>
                {allowMultipleSelections
                  ? 'Add or remove people on this card'
                  : 'Assign a workspace member to this card'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className='p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
            title='Close'
            disabled={isLoading || addingMemberIds.size > 0}
          >
            <X className='w-4 h-4' />
          </button>
        </div>

        {/* Content */}
        <div className='p-5'>
          {/* Currently on this card — visible up front, separate from the
              "add someone new" list below, so it's clear at a glance who's
              already assigned without having to search for them. */}
          {currentMembers.length > 0 && (
            <div className='mb-4'>
              <p className='text-xs font-medium text-muted-foreground mb-2'>
                On this card ({currentMembers.length})
              </p>
              <div className='flex flex-wrap gap-2'>
                {currentMembers.map((member) => (
                  <div
                    key={member.id}
                    className='flex items-center gap-1.5 pl-1 pr-1 py-1 bg-muted/40 rounded-full group'
                    title={member.profiles.email}
                  >
                    <UserAvatar profile={member.profiles} size={20} />
                    <span className='text-xs font-medium text-foreground truncate max-w-[8rem]'>
                      {member.profiles.full_name || member.profiles.email}
                    </span>
                    {onRemoveMember && (
                      <button
                        type='button'
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onRemoveMember(member.profiles.id);
                        }}
                        title={`Remove ${
                          member.profiles.full_name || member.profiles.email
                        } from this card`}
                        className='p-0.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0'
                      >
                        <X className='w-3 h-3' />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          <div className='relative mb-3'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground' />
            <input
              type='text'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Search members...'
              className='w-full bg-muted/30 border border-border/50 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all'
              disabled={isLoadingMembers || addingMemberIds.size > 0}
            />
          </div>

          {/* Members List */}
          <div className='space-y-1.5 max-h-64 overflow-y-auto'>
            {isLoadingMembers ? (
              <div className='flex items-center justify-center py-8'>
                <div className='w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin' />
              </div>
            ) : filteredMembers.length > 0 ? (
              filteredMembers.map((member, index) => (
                <div
                  key={member.profiles.id}
                  className='flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/40 transition-colors duration-200 group animate-slide-in-right'
                  style={{
                    animationDelay: `${index * 30}ms`,
                  }}
                >
                  <UserAvatar profile={member.profiles} size={36} />
                  <div className='flex-1 min-w-0'>
                    <p className='text-sm font-medium text-foreground truncate'>
                      {member.profiles.full_name || 'Unknown User'}
                    </p>
                    <p className='text-xs text-muted-foreground truncate'>
                      {member.profiles.email}
                    </p>
                  </div>
                  <span className='text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded-full font-medium capitalize flex-shrink-0'>
                    {member.role}
                  </span>
                  <button
                    onClick={() => handleAddMember(member.profiles.id)}
                    disabled={addingMemberIds.has(member.profiles.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-foreground rounded-lg transition-colors duration-150 disabled:cursor-not-allowed flex-shrink-0 ${
                      addingMemberIds.has(member.profiles.id)
                        ? 'bg-success'
                        : 'bg-primary hover:bg-primary/90'
                    }`}
                    title={
                      addingMemberIds.has(member.profiles.id)
                        ? 'Adding member...'
                        : 'Add to card'
                    }
                  >
                    {addingMemberIds.has(member.profiles.id) ? (
                      <>
                        <div className='w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                        Added
                      </>
                    ) : (
                      <>
                        <Plus className='w-3.5 h-3.5' />
                        Add
                      </>
                    )}
                  </button>
                </div>
              ))
            ) : (
              <div className='text-center py-8 text-muted-foreground'>
                <User className='w-8 h-8 mx-auto mb-2 opacity-50' />
                <p className='text-sm'>
                  {searchQuery.trim()
                    ? 'No members found matching your search'
                    : 'All workspace members are already assigned to this card'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
 