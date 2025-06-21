'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, User, Search, Check } from 'lucide-react';

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
  isLoading?: boolean;
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

  const sizeClass = `w-${Math.floor(size / 4)} h-${Math.floor(size / 4)}`;

  if (profile.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={profile.full_name || 'User'}
        className={`${sizeClass} rounded-full object-cover`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold`}
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
  isLoading = false,
}: CardMemberPickerProps) {
  const [availableMembers, setAvailableMembers] = useState<MemberData[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);

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

  // Fetch available members when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchAvailableMembers();
    }
  }, [isOpen, workspaceId, boardId]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

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
    setIsAddingMember(true);
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
        onMemberAdded(data.member);
        // Remove the added member from available members
        setAvailableMembers((prev) =>
          prev.filter((member) => member.profiles.id !== profileId)
        );
      } else {
        console.error('Failed to add member:', data.error);
        alert(`Failed to add member: ${data.error}`);
      }
    } catch (error) {
      console.error('Error adding member:', error);
      alert('Failed to add member. Please try again.');
    } finally {
      setIsAddingMember(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4'>
      <div className='bg-card border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200'>
        {/* Header */}
        <div className='bg-gradient-to-r from-primary to-primary/90 px-6 py-4'>
          <div className='flex items-center justify-between text-white'>
            <div className='flex items-center gap-3'>
              <div className='w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center'>
                <User className='w-4 h-4' />
              </div>
              <div>
                <h3 className='text-lg font-semibold'>Add Card Member</h3>
                <p className='text-sm text-white/80'>
                  Assign workspace members to this card
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className='p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200'
              title='Close modal'
              disabled={isLoading || isAddingMember}
            >
              <X className='w-5 h-5' />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className='p-6'>
          {/* Search */}
          <div className='relative mb-4'>
            <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground' />
            <input
              type='text'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Search members...'
              className='w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200'
              disabled={isLoadingMembers || isAddingMember}
            />
          </div>

          {/* Members List */}
          <div className='space-y-2 max-h-64 overflow-y-auto'>
            {isLoadingMembers ? (
              <div className='flex items-center justify-center py-8'>
                <div className='w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin' />
              </div>
            ) : filteredMembers.length > 0 ? (
              filteredMembers.map((member) => (
                <div
                  key={member.profiles.id}
                  className='flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors group'
                >
                  <UserAvatar profile={member.profiles} size={32} />
                  <div className='flex-1 min-w-0'>
                    <p className='text-sm font-medium text-foreground truncate'>
                      {member.profiles.full_name || 'Unknown User'}
                    </p>
                    <p className='text-xs text-muted-foreground truncate'>
                      {member.profiles.email}
                    </p>
                    <p className='text-xs text-muted-foreground capitalize'>
                      {member.role}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAddMember(member.profiles.id)}
                    disabled={isAddingMember}
                    className='flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary hover:text-primary-foreground hover:bg-primary rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                    title='Add to card'
                  >
                    {isAddingMember ? (
                      <div className='w-3 h-3 border border-current border-t-transparent rounded-full animate-spin' />
                    ) : (
                      <Plus className='w-3 h-3' />
                    )}
                    Add
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

          {/* Current Members Count */}
          {currentMembers.length > 0 && (
            <div className='mt-4 pt-4 border-t border-border'>
              <p className='text-xs text-muted-foreground'>
                {currentMembers.length} member
                {currentMembers.length !== 1 ? 's' : ''} currently assigned
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
