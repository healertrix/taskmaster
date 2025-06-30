import React, { useMemo, useCallback } from 'react';
import { Crown, Shield, User, MoreHorizontal, UserMinus } from 'lucide-react';
import type { WorkspaceMember } from '@/hooks/queries/useWorkspaceMembersQuery';

interface MemberCardProps {
  member: WorkspaceMember;
  currentUser: string | null;
  currentUserRole: string;
  canManageMembers: boolean;
  onRemoveMember: (member: WorkspaceMember) => void;
  onChangeRole: (member: WorkspaceMember) => void;
  openMemberActions: string | null;
  setOpenMemberActions: (id: string | null) => void;
}

export const MemberCard = React.memo<MemberCardProps>(
  ({
    member,
    currentUser,
    currentUserRole,
    canManageMembers,
    onRemoveMember,
    onChangeRole,
    openMemberActions,
    setOpenMemberActions,
  }) => {
    const roleInfo = useMemo(() => {
      switch (member.role) {
        case 'owner':
          return { icon: Crown, text: 'Owner', color: 'text-yellow-500' };
        case 'admin':
          return { icon: Shield, text: 'Admin', color: 'text-blue-500' };
        default:
          return { icon: User, text: 'Member', color: 'text-gray-500' };
      }
    }, [member.role]);

    const roleBadge = useMemo(() => {
      const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium';
      switch (member.role) {
        case 'owner':
          return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200`;
        case 'admin':
          return `${baseClasses} bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200`;
        default:
          return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200`;
      }
    }, [member.role]);

    const canManageThisMember = useMemo(() => {
      return (
        canManageMembers &&
        member.profile_id !== currentUser &&
        member.role !== 'owner' &&
        (currentUserRole === 'owner' ||
          (currentUserRole === 'admin' && member.role === 'member'))
      );
    }, [
      canManageMembers,
      member.profile_id,
      member.role,
      currentUser,
      currentUserRole,
    ]);

    const handleCardClick = useCallback(() => {
      const isMobile = window.innerWidth < 640;
      if (isMobile && canManageThisMember) {
        onChangeRole(member);
      }
    }, [canManageThisMember, onChangeRole, member]);

    const handleActionsClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        setOpenMemberActions(
          openMemberActions === member.id ? null : member.id
        );
      },
      [openMemberActions, member.id, setOpenMemberActions]
    );

    const handleChangeRole = useCallback(() => {
      onChangeRole(member);
      setOpenMemberActions(null);
    }, [onChangeRole, member, setOpenMemberActions]);

    const handleRemoveMember = useCallback(() => {
      onRemoveMember(member);
      setOpenMemberActions(null);
    }, [onRemoveMember, member, setOpenMemberActions]);

    return (
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-border transition-colors gap-3 sm:gap-0 ${
          canManageThisMember
            ? 'sm:hover:bg-muted/50 active:bg-muted/50 cursor-pointer sm:cursor-default'
            : 'hover:bg-muted/50 cursor-default'
        }`}
        onClick={handleCardClick}
      >
        <div className='flex items-center gap-3 min-w-0 flex-1'>
          <div className='w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0'>
            <span className='text-sm font-medium text-primary'>
              {member.profile.full_name?.charAt(0) ||
                member.profile.email.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className='min-w-0 flex-1'>
            <div className='font-medium text-foreground text-sm sm:text-base truncate'>
              {member.profile.full_name || member.profile.email}
              {member.profile_id === currentUser && (
                <span className='ml-2 text-xs text-muted-foreground'>
                  (You)
                </span>
              )}
            </div>
            <div className='text-xs sm:text-sm text-muted-foreground truncate'>
              {member.profile.email}
            </div>
          </div>
        </div>

        <div className='flex items-center justify-between sm:justify-end gap-3 sm:gap-3'>
          <div className='flex items-center gap-2'>
            <roleInfo.icon
              className={`w-3 h-3 sm:w-4 sm:h-4 ${roleInfo.color}`}
            />
            <span className={`${roleBadge} text-xs`}>{roleInfo.text}</span>
          </div>

          {/* Mobile tap hint for manageable members */}
          {canManageThisMember && (
            <div className='sm:hidden text-xs text-muted-foreground/70'>
              Tap to change role
            </div>
          )}

          {/* Member Actions Dropdown - Desktop only */}
          {canManageThisMember && (
            <div className='relative hidden sm:block' data-member-actions>
              <button
                onClick={handleActionsClick}
                className='p-1.5 sm:p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
                title='Member actions'
              >
                <MoreHorizontal className='w-3.5 h-3.5 sm:w-4 sm:h-4' />
              </button>

              {/* Dropdown Menu */}
              {openMemberActions === member.id && (
                <div className='absolute right-0 top-full mt-1 w-36 bg-background border border-border rounded-lg shadow-lg z-10 py-1'>
                  {/* Change Role Option */}
                  {member.role !== 'owner' &&
                    (currentUserRole === 'owner' ||
                      (currentUserRole === 'admin' &&
                        member.role === 'member')) && (
                      <button
                        onClick={handleChangeRole}
                        className='w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors flex items-center gap-2'
                      >
                        <Shield className='w-3 h-3' />
                        Change Role
                      </button>
                    )}

                  {/* Remove Option */}
                  {(currentUserRole === 'owner' ||
                    (currentUserRole === 'admin' &&
                      member.role === 'member')) && (
                    <button
                      onClick={handleRemoveMember}
                      className='w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2'
                    >
                      <UserMinus className='w-3 h-3' />
                      Remove
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);

MemberCard.displayName = 'MemberCard';
 