'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardHeader } from '../../../components/dashboard/header';
import { createClient } from '@/utils/supabase/client';
import {
  ArrowLeft,
  Users,
  UserPlus,
  Mail,
  Crown,
  Shield,
  User,
  ChevronRight,
  Send,
  X,
  Loader2,
  Check,
  CheckCircle2,
  AlertCircle,
  Trash2,
  UserMinus,
  MoreHorizontal,
} from 'lucide-react';
import Link from 'next/link';
import { canUserInviteMembers } from '@/utils/permissions';
import { useMembersStore } from '@/lib/stores/useMembersStore';
import {
  useWorkspaceMembers,
  type WorkspaceMember,
} from '@/hooks/useWorkspaceMembers';
import { MemberCard } from '@/app/components/workspace/MemberCard';
import { AddMemberModal } from '@/app/components/workspace/AddMemberModal';
import { PageLoadingSkeleton } from '@/app/components/ui/MembersSkeleton';

export default function WorkspaceMembersPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  // Zustand store
  const {
    showAddMemberModal,
    showRemoveConfirm,
    showChangeRoleModal,
    memberToRemove,
    memberToChangeRole,
    newRole,
    isRemovingMember,
    isChangingRole,
    openMemberActions,
    setShowAddMemberModal,
    setShowRemoveConfirm,
    setShowChangeRoleModal,
    setMemberToRemove,
    setMemberToChangeRole,
    setNewRole,
    setIsRemovingMember,
    setIsChangingRole,
    setOpenMemberActions,
    resetModals,
  } = useMembersStore();

  // Simple back navigation using browser history
  const handleGoBack = useCallback(() => {
    router.back();
  }, [router]);

  // Get current user
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');

  // Fetch data using optimized hook
  const {
    workspace,
    members,
    settings: workspaceSettings,
    loading: isLoading,
    error,
    refetch,
    updateMemberInCache,
    removeMemberFromCache,
  } = useWorkspaceMembers(workspaceId);

  // Simple mutation functions
  const removeMember = async (memberId: string) => {
    try {
      const supabase = createClient();
      const { error: removeError } = await supabase
        .from('workspace_members')
        .delete()
        .eq('id', memberId);

      if (removeError) throw removeError;

      // Update cache immediately
      removeMemberFromCache(workspaceId, memberId);

      // Refresh data
      await refetch();

      return { success: true };
    } catch (error) {
      console.error('Error removing member:', error);
      return { success: false, error };
    }
  };

  const changeMemberRole = async (memberId: string, newRole: string) => {
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('workspace_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (updateError) throw updateError;

      // Update cache immediately
      updateMemberInCache(workspaceId, memberId, { role: newRole });

      // Refresh data
      await refetch();

      return { success: true };
    } catch (error) {
      console.error('Error changing member role:', error);
      return { success: false, error };
    }
  };

  // Get current user and role on mount
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.push('/auth/login');
          return;
        }

        setCurrentUser(user.id);

        // Get user's role in workspace
        if (workspace) {
          let userRole = '';
          if (workspace.owner_id === user.id) {
            userRole = 'owner';
          } else {
            const { data: membershipData, error: membershipError } =
              await supabase
                .from('workspace_members')
                .select('role')
                .eq('workspace_id', workspaceId)
                .eq('profile_id', user.id)
                .single();

            if (membershipError || !membershipData) {
              router.push('/auth/login');
              return;
            }
            userRole = membershipData.role;
          }
          setCurrentUserRole(userRole);
        }
      } catch (err) {
        console.error('Error getting current user:', err);
        router.push('/auth/login');
      }
    };

    if (workspaceId) {
      getCurrentUser();
    }
  }, [workspaceId, workspace, router]);

  // Permission checks
  const canAddMembers = useMemo(() => {
    if (!workspaceSettings || !currentUserRole) return false;
    return canUserInviteMembers(
      workspaceSettings.membership_restriction,
      currentUserRole
    );
  }, [workspaceSettings, currentUserRole]);

  const canManageMembers = useMemo(() => {
    return currentUserRole === 'owner' || currentUserRole === 'admin';
  }, [currentUserRole]);

  // Handle mobile back button/gesture for modals
  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    if (!isMobile) return;

    const handlePopState = () => {
      resetModals();
    };

    // Add history state when any modal opens
    if (showChangeRoleModal || showRemoveConfirm || showAddMemberModal) {
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [showChangeRoleModal, showRemoveConfirm, showAddMemberModal, resetModals]);

  // Handle ESC key for desktop only
  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    if (isMobile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        resetModals();
      }
    };

    if (showChangeRoleModal || showRemoveConfirm || showAddMemberModal) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [showChangeRoleModal, showRemoveConfirm, showAddMemberModal, resetModals]);

  // Close member actions dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMemberActions) {
        const target = event.target as HTMLElement;
        if (!target.closest('[data-member-actions]')) {
          setOpenMemberActions(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMemberActions, setOpenMemberActions]);

  // Toast notifications
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccessToastFading, setIsSuccessToastFading] = useState(false);
  const [isErrorToastFading, setIsErrorToastFading] = useState(false);

  const showSuccess = useCallback((message: string) => {
    setSuccessMessage(message);
    setShowSuccessToast(true);
    setIsSuccessToastFading(false);

    setTimeout(() => {
      setIsSuccessToastFading(true);
      setTimeout(() => {
        setShowSuccessToast(false);
        setIsSuccessToastFading(false);
      }, 300);
    }, 3000);
  }, []);

  const showError = useCallback((message: string) => {
    setErrorMessage(message);
    setShowErrorToast(true);
    setIsErrorToastFading(false);

    setTimeout(() => {
      setIsErrorToastFading(true);
      setTimeout(() => {
        setShowErrorToast(false);
        setIsErrorToastFading(false);
      }, 300);
    }, 5000);
  }, []);

  // Member actions
  const handleRemoveMember = useCallback(async () => {
    if (!memberToRemove) return;

    setIsRemovingMember(true);
    try {
      const result = await removeMember(memberToRemove.id);

      if (result.success) {
        showSuccess(
          `${
            memberToRemove.profile.full_name || memberToRemove.profile.email
          } has been removed from the workspace`
        );
        setShowRemoveConfirm(false);
        setMemberToRemove(null);
      } else {
        showError(
          result.error instanceof Error
            ? result.error.message
            : 'Failed to remove member'
        );
      }
    } catch (error) {
      showError(
        error instanceof Error ? error.message : 'Failed to remove member'
      );
    } finally {
      setIsRemovingMember(false);
    }
  }, [
    memberToRemove,
    workspaceId,
    removeMember,
    showSuccess,
    showError,
    setShowRemoveConfirm,
    setMemberToRemove,
    setIsRemovingMember,
  ]);

  const handleChangeRole = useCallback(async () => {
    if (!memberToChangeRole) return;

    setIsChangingRole(true);
    try {
      const result = await changeMemberRole(memberToChangeRole.id, newRole);

      if (result.success) {
        showSuccess(
          `${
            memberToChangeRole.profile.full_name ||
            memberToChangeRole.profile.email
          }'s role changed to ${newRole}`
        );
        setShowChangeRoleModal(false);
        setMemberToChangeRole(null);
      } else {
        showError(
          result.error instanceof Error
            ? result.error.message
            : 'Failed to change member role'
        );
      }
    } catch (error) {
      showError(
        error instanceof Error ? error.message : 'Failed to change member role'
      );
    } finally {
      setIsChangingRole(false);
    }
  }, [
    memberToChangeRole,
    workspaceId,
    newRole,
    changeMemberRole,
    showSuccess,
    showError,
    setShowChangeRoleModal,
    setMemberToChangeRole,
    setIsChangingRole,
  ]);

  const handleRemoveMemberClick = useCallback(
    (member: WorkspaceMember) => {
      setMemberToRemove(member);
      setShowRemoveConfirm(true);
    },
    [setMemberToRemove, setShowRemoveConfirm]
  );

  const handleChangeRoleClick = useCallback(
    (member: WorkspaceMember) => {
      setMemberToChangeRole(member);
      setNewRole(member.role === 'admin' ? 'member' : 'admin');
      setShowChangeRoleModal(true);
    },
    [setMemberToChangeRole, setNewRole, setShowChangeRoleModal]
  );

  // Loading and error states
  if (isLoading && !workspace && (!members || members.length === 0)) {
    return <PageLoadingSkeleton />;
  }

  if (error) {
    return (
      <div className='min-h-screen dot-pattern-dark'>
        <DashboardHeader />
        <main className='container mx-auto max-w-7xl px-3 sm:px-4 pt-16 sm:pt-24 pb-8 sm:pb-16'>
          <div className='flex items-center justify-center h-64'>
            <div className='text-red-500 text-center text-sm sm:text-base px-4'>
              {error || 'An error occurred'}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className='min-h-screen dot-pattern-dark'>
      <DashboardHeader />

      <main className='container mx-auto max-w-4xl px-3 sm:px-4 pt-16 sm:pt-24 pb-8 sm:pb-16'>
        {/* Header */}
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8'>
          {/* Mobile: Title first, then description */}
          <div className='flex flex-col gap-3 sm:hidden min-w-0'>
            <div className='flex items-center gap-2'>
              <button
                onClick={handleGoBack}
                className='p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors flex-shrink-0'
                aria-label='Go back'
              >
                <ArrowLeft className='w-4 h-4' />
              </button>
              <div className='min-w-0 flex-1'>
                <h1 className='text-lg font-bold text-foreground truncate'>
                  {workspace.name} Members
                </h1>
              </div>
            </div>
            <div className='ml-7'>
              <p className='text-xs text-muted-foreground'>
                Manage workspace members and permissions
              </p>
            </div>
          </div>

          {/* Desktop: Traditional layout */}
          <div className='hidden sm:flex items-center gap-4 min-w-0 flex-1'>
            <button
              onClick={handleGoBack}
              className='p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors flex-shrink-0'
              aria-label='Go back'
            >
              <ArrowLeft className='w-5 h-5' />
            </button>
            <div className='min-w-0 flex-1'>
              <h1 className='text-2xl font-bold text-foreground'>
                {workspace.name} Members
              </h1>
              <p className='text-muted-foreground text-sm'>
                Manage workspace members and permissions
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className='flex items-center justify-end gap-3 flex-shrink-0'>
            {canAddMembers && (
              <button
                onClick={() => setShowAddMemberModal(true)}
                className='inline-flex items-center justify-center gap-2 px-3 py-2 sm:w-auto sm:px-4 sm:py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all duration-200 shadow-sm hover:shadow-md text-sm'
                title='Add Members'
                aria-label='Add Members'
              >
                <UserPlus className='w-4 h-4 sm:w-5 sm:h-5' />
                <span className='text-sm font-medium'>Add</span>
                <span className='hidden sm:inline'>Members</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className='mb-6 sm:mb-8'>
          <div className='flex items-center gap-1 border-b border-border overflow-x-auto'>
            <span className='px-3 sm:px-4 py-2 text-sm font-medium text-primary border-b-2 border-primary whitespace-nowrap'>
              Members
            </span>
            <Link
              href={`/workspace/${workspaceId}/settings`}
              className='px-3 sm:px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-b-2 hover:border-primary transition-colors whitespace-nowrap'
            >
              Settings
            </Link>
          </div>
        </div>

        <div className='space-y-4 sm:space-y-6'>
          {/* Members List */}
          <div className='card p-4 sm:p-6'>
            <h2 className='text-base sm:text-lg font-semibold mb-3 sm:mb-4'>
              Workspace members ({members.length})
            </h2>

            <div className='space-y-2'>
              {members.map((member) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  currentUser={currentUser}
                  currentUserRole={currentUserRole}
                  canManageMembers={canManageMembers}
                  onRemoveMember={handleRemoveMember}
                  onChangeRole={handleChangeRole}
                  openMemberActions={openMemberActions}
                  setOpenMemberActions={setOpenMemberActions}
                />
              ))}
            </div>
          </div>

          {/* Empty state */}
          {members.length === 0 && (
            <div className='flex flex-col items-center justify-center py-16 text-center'>
              <div className='w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4'>
                <Users className='w-8 h-8 text-muted-foreground' />
              </div>
              <h3 className='text-lg font-semibold text-foreground mb-2'>
                No members yet
              </h3>
              <p className='text-muted-foreground mb-4 max-w-md'>
                {canAddMembers
                  ? 'Get started by inviting members to this workspace. Members can collaborate on boards and projects.'
                  : "This workspace doesn't have any members yet. Contact an admin to add members to this workspace."}
              </p>
              {canAddMembers && (
                <button
                  onClick={() => setShowAddMemberModal(true)}
                  className='btn bg-primary text-white hover:bg-primary/90 px-4 py-2 flex items-center gap-2'
                >
                  <UserPlus className='w-4 h-4' />
                  Invite Members
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Add Member Modal */}
      <AddMemberModal
        workspaceId={workspaceId}
        onSuccess={showSuccess}
        onError={showError}
      />

      {/* Remove Member Confirmation Modal */}
      {showRemoveConfirm && memberToRemove && (
        <div className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'>
          <div className='bg-gradient-to-br from-background via-background to-background/95 border border-border/50 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden'>
            {/* Header */}
            <div className='relative bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent p-6 border-b border-border/50'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center'>
                    <UserMinus className='w-5 h-5 text-red-500' />
                  </div>
                  <div>
                    <h3 className='text-xl font-semibold text-foreground'>
                      Remove Member
                    </h3>
                    <p className='text-sm text-muted-foreground'>
                      This action cannot be undone
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowRemoveConfirm(false);
                    setMemberToRemove(null);
                  }}
                  className='w-8 h-8 rounded-full bg-muted/50 hover:bg-muted/80 flex items-center justify-center transition-colors'
                  aria-label='Close modal'
                >
                  <X className='w-4 h-4' />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className='p-6 space-y-4'>
              <div className='flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl dark:bg-red-900/20 dark:border-red-800'>
                <div className='w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white font-medium text-lg'>
                  {memberToRemove.profile.full_name?.charAt(0).toUpperCase() ||
                    memberToRemove.profile.email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className='font-medium text-foreground'>
                    {memberToRemove.profile.full_name ||
                      memberToRemove.profile.email}
                  </div>
                  <div className='text-sm text-muted-foreground'>
                    {memberToRemove.profile.email}
                  </div>
                  <div className='text-xs text-red-600 dark:text-red-400 mt-1'>
                    {memberToRemove.role === 'owner'
                      ? 'Owner'
                      : memberToRemove.role === 'admin'
                      ? 'Admin'
                      : 'Member'}
                  </div>
                </div>
              </div>

              <div className='bg-amber-50 border border-amber-200 rounded-xl p-4 dark:bg-amber-900/20 dark:border-amber-800'>
                <div className='flex items-start gap-3'>
                  <AlertCircle className='w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5' />
                  <div className='text-sm'>
                    <p className='font-medium text-amber-800 dark:text-amber-200 mb-1'>
                      Are you sure you want to remove this member?
                    </p>
                    <p className='text-amber-700 dark:text-amber-300'>
                      They will lose access to this workspace and all its
                      boards. You can add them back later if needed.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className='bg-gradient-to-r from-muted/20 to-transparent p-6 border-t border-border/50'>
              <div className='flex justify-end gap-3'>
                <button
                  onClick={() => {
                    setShowRemoveConfirm(false);
                    setMemberToRemove(null);
                  }}
                  disabled={isRemovingMember}
                  className='px-6 py-2.5 text-muted-foreground hover:text-foreground transition-colors font-medium disabled:opacity-50'
                >
                  Cancel
                </button>
                <button
                  onClick={handleRemoveMember}
                  disabled={isRemovingMember}
                  className={`px-6 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white font-medium rounded-lg flex items-center gap-2 transition-all duration-200 ${
                    isRemovingMember
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:from-red-600 hover:to-red-700 hover:shadow-lg hover:shadow-red-500/25 active:scale-95'
                  }`}
                >
                  {isRemovingMember ? (
                    <>
                      <Loader2 className='w-4 h-4 animate-spin' />
                      <span>Removing...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className='w-4 h-4' />
                      <span>Remove Member</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Role Modal */}
      {showChangeRoleModal && memberToChangeRole && (
        <div className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4'>
          <div className='bg-gradient-to-br from-background via-background to-background/95 border border-border/50 rounded-2xl shadow-2xl w-full max-w-md mx-2 sm:mx-4 overflow-hidden max-h-[90vh] overflow-y-auto'>
            {/* Header */}
            <div className='relative bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 sm:p-6 border-b border-border/50'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2 sm:gap-3'>
                  <div className='w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary/20 flex items-center justify-center'>
                    <Shield className='w-4 h-4 sm:w-5 sm:h-5 text-primary' />
                  </div>
                  <div>
                    <h3 className='text-lg sm:text-xl font-semibold text-foreground'>
                      Change Role
                    </h3>
                    <p className='text-xs sm:text-sm text-muted-foreground'>
                      Update member permissions
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowChangeRoleModal(false);
                    setMemberToChangeRole(null);
                  }}
                  className='w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-muted/50 hover:bg-muted/80 active:bg-muted/90 flex items-center justify-center transition-colors touch-manipulation'
                  aria-label='Close modal'
                >
                  <X className='w-4 h-4 sm:w-5 sm:h-5' />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className='p-4 sm:p-6 space-y-3 sm:space-y-4'>
              {/* Member Info */}
              <div className='flex items-center gap-3 p-3 sm:p-4 bg-muted/30 rounded-xl'>
                <div className='w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground font-medium text-base sm:text-lg flex-shrink-0'>
                  {memberToChangeRole.profile.full_name
                    ?.charAt(0)
                    .toUpperCase() ||
                    memberToChangeRole.profile.email.charAt(0).toUpperCase()}
                </div>
                <div className='min-w-0 flex-1'>
                  <div className='font-medium text-foreground text-sm sm:text-base truncate'>
                    {memberToChangeRole.profile.full_name ||
                      memberToChangeRole.profile.email}
                  </div>
                  <div className='text-xs sm:text-sm text-muted-foreground truncate'>
                    {memberToChangeRole.profile.email}
                  </div>
                  <div className='text-xs text-muted-foreground mt-1'>
                    Current role:{' '}
                    {memberToChangeRole.role === 'owner'
                      ? 'Owner'
                      : memberToChangeRole.role === 'admin'
                      ? 'Admin'
                      : 'Member'}
                  </div>
                </div>
              </div>

              {/* Role Selection */}
              <div className='space-y-2 sm:space-y-3'>
                <label className='text-sm font-medium text-foreground'>
                  Select new role:
                </label>
                <div className='space-y-2'>
                  {(['admin', 'member'] as const).map((role) => (
                    <label
                      key={role}
                      className={`flex items-start sm:items-center gap-3 p-3 sm:p-4 rounded-lg border cursor-pointer transition-all touch-manipulation ${
                        newRole === role
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50 active:bg-muted/70'
                      }`}
                    >
                      <input
                        type='radio'
                        name='role'
                        value={role}
                        checked={newRole === role}
                        onChange={(e) =>
                          setNewRole(e.target.value as 'admin' | 'member')
                        }
                        className='w-4 h-4 text-primary mt-0.5 sm:mt-0 flex-shrink-0'
                      />
                      <div className='flex items-center gap-2 flex-shrink-0'>
                        {role === 'admin' ? (
                          <Shield className='w-4 h-4 text-blue-500' />
                        ) : (
                          <User className='w-4 h-4 text-gray-500' />
                        )}
                        <span className='font-medium text-foreground text-sm sm:text-base'>
                          {role === 'admin' ? 'Admin' : 'Member'}
                        </span>
                      </div>
                      <div className='text-xs text-muted-foreground mt-1 sm:mt-0 sm:ml-auto'>
                        {role === 'admin'
                          ? 'Can manage members and boards'
                          : 'Can view and edit boards'}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Warning if changing to admin */}
              {newRole === 'admin' && memberToChangeRole.role === 'member' && (
                <div className='bg-blue-50 border border-blue-200 rounded-xl p-3 sm:p-4 dark:bg-blue-900/20 dark:border-blue-800'>
                  <div className='flex items-start gap-2 sm:gap-3'>
                    <Shield className='w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5' />
                    <div className='text-xs sm:text-sm'>
                      <p className='font-medium text-blue-800 dark:text-blue-200 mb-1'>
                        Promoting to Admin
                      </p>
                      <p className='text-blue-700 dark:text-blue-300'>
                        This user will be able to add/remove members and manage
                        workspace settings.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className='bg-gradient-to-r from-muted/20 to-transparent p-4 sm:p-6 border-t border-border/50'>
              <div className='flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3'>
                <button
                  onClick={() => {
                    setShowChangeRoleModal(false);
                    setMemberToChangeRole(null);
                  }}
                  disabled={isChangingRole}
                  className='w-full sm:w-auto px-4 sm:px-6 py-3 sm:py-2.5 text-muted-foreground hover:text-foreground active:text-foreground transition-colors font-medium disabled:opacity-50 touch-manipulation'
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangeRole}
                  disabled={
                    isChangingRole || newRole === memberToChangeRole.role
                  }
                  className={`w-full sm:w-auto px-4 sm:px-6 py-3 sm:py-2.5 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-medium rounded-lg flex items-center justify-center gap-2 transition-all duration-200 touch-manipulation ${
                    isChangingRole || newRole === memberToChangeRole.role
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:from-primary/90 hover:to-primary hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98]'
                  }`}
                >
                  {isChangingRole ? (
                    <>
                      <Loader2 className='w-4 h-4 animate-spin' />
                      <span>Changing...</span>
                    </>
                  ) : (
                    <>
                      <Shield className='w-4 h-4' />
                      <span>Change Role</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {showSuccessToast && (
        <div
          className={`fixed bottom-6 right-6 z-[9999] transition-all duration-500 ${
            isSuccessToastFading
              ? 'animate-out slide-out-to-bottom-2 fade-out opacity-0 scale-95'
              : 'animate-in slide-in-from-bottom-2 fade-in opacity-100 scale-100'
          }`}
        >
          <div className='bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 shadow-2xl max-w-sm backdrop-blur-sm'>
            <div className='flex items-center gap-3'>
              <div className='flex-shrink-0'>
                <CheckCircle2 className='w-5 h-5 text-green-600 dark:text-green-400' />
              </div>
              <div className='flex-1'>
                <p className='text-sm font-medium text-green-800 dark:text-green-200'>
                  {successMessage}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsSuccessToastFading(true);
                  setTimeout(() => {
                    setShowSuccessToast(false);
                    setIsSuccessToastFading(false);
                  }, 300);
                }}
                className='flex-shrink-0 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 transition-colors'
                aria-label='Close success notification'
              >
                <X className='w-4 h-4' />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {showErrorToast && (
        <div
          className={`fixed bottom-6 right-6 z-[9999] transition-all duration-500 ${
            isErrorToastFading
              ? 'animate-out slide-out-to-bottom-2 fade-out opacity-0 scale-95'
              : 'animate-in slide-in-from-bottom-2 fade-in opacity-100 scale-100'
          }`}
        >
          <div className='bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 shadow-2xl max-w-sm backdrop-blur-sm'>
            <div className='flex items-center gap-3'>
              <div className='flex-shrink-0'>
                <AlertCircle className='w-5 h-5 text-red-600 dark:text-red-400' />
              </div>
              <div className='flex-1'>
                <p className='text-sm font-medium text-red-800 dark:text-red-200'>
                  {errorMessage}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsErrorToastFading(true);
                  setTimeout(() => {
                    setShowErrorToast(false);
                    setIsErrorToastFading(false);
                  }, 300);
                }}
                className='flex-shrink-0 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors'
                aria-label='Close error notification'
              >
                <X className='w-4 h-4' />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Loading Overlay for Critical Actions */}
      {(isRemovingMember || isChangingRole) && (
        <div className='fixed inset-0 bg-black/10 backdrop-blur-sm z-[90] flex items-center justify-center'>
          <div className='bg-background/90 backdrop-blur border border-border rounded-lg p-6 shadow-xl'>
            <div className='flex items-center gap-4'>
              <Loader2 className='w-8 h-8 animate-spin' />
              <div>
                <p className='font-medium text-foreground'>
                  {isRemovingMember ? 'Removing member...' : 'Changing role...'}
                </p>
                <p className='text-sm text-muted-foreground'>
                  This will only take a moment
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
