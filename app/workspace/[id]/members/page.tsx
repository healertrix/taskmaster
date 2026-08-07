'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardHeader } from '../../../components/dashboard/header';
import { createClient } from '@/utils/supabase/client';
import {
  ArrowLeft,
  Users,
  UserPlus,
  Shield,
  User,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  UserMinus,
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

      // Find the member to get their profile_id for cache update
      const memberToRemove = members.find((m) => m.id === memberId);
      if (memberToRemove) {
        // Update cache immediately
        removeMemberFromCache(workspaceId, memberToRemove.profile_id);
      }

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

      // Find the member to get their profile_id for cache update
      const memberToUpdate = members.find((m) => m.id === memberId);
      if (memberToUpdate) {
        // Update cache immediately
        updateMemberInCache(workspaceId, memberToUpdate.profile_id, {
          role: newRole,
        });
      }

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
      <div className='min-h-screen'>
        <DashboardHeader />
        <main className='container mx-auto max-w-3xl px-3 sm:px-4 pt-16 sm:pt-24 pb-8 sm:pb-16'>
          <div className='flex items-center justify-center h-64'>
            <div className='text-destructive text-center text-sm sm:text-base px-4'>
              {error || 'An error occurred'}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className='min-h-screen'>
      <DashboardHeader />

      <main className='container mx-auto max-w-3xl px-3 sm:px-4 pt-16 sm:pt-24 pb-8 sm:pb-16'>
        {/* Header */}
        <div className='flex items-center gap-3 mb-6'>
          <button
            onClick={handleGoBack}
            className='p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors flex-shrink-0'
            aria-label='Go back'
          >
            <ArrowLeft className='w-4 h-4 sm:w-5 sm:h-5' />
          </button>
          <div className='min-w-0 flex-1'>
            <h1 className='text-xl sm:text-2xl font-bold text-foreground truncate heading-enter'>
              {workspace.name}
            </h1>
            <p className='text-muted-foreground text-xs sm:text-sm'>
              {members.length} member{members.length === 1 ? '' : 's'}
            </p>
          </div>

          {canAddMembers && (
            <button
              onClick={() => setShowAddMemberModal(true)}
              className='btn btn-primary flex items-center gap-2 px-3 sm:px-4 py-2 flex-shrink-0'
              title='Add members'
              aria-label='Add members'
            >
              <UserPlus className='w-4 h-4' />
              <span className='hidden sm:inline'>Add members</span>
            </button>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className='mb-6 flex items-center gap-1 border-b border-border/60'>
          <span className='px-3 sm:px-4 py-2 text-sm font-medium text-primary border-b-2 border-primary whitespace-nowrap'>
            Members
          </span>
          <Link
            href={`/workspace/${workspaceId}/settings`}
            className='px-3 sm:px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border-b-2 border-transparent hover:border-border transition-colors whitespace-nowrap'
          >
            Settings
          </Link>
        </div>

        <div className='space-y-4'>
          {/* Members List */}
          <div className='bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl p-4 sm:p-5'>
            <div className='space-y-1.5'>
              {members.map((member) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  currentUser={currentUser}
                  currentUserRole={currentUserRole}
                  canManageMembers={canManageMembers}
                  onRemoveMember={handleRemoveMemberClick}
                  onChangeRole={handleChangeRoleClick}
                  openMemberActions={openMemberActions}
                  setOpenMemberActions={setOpenMemberActions}
                />
              ))}
            </div>
          </div>

          {/* Empty state */}
          {members.length === 0 && (
            <div className='flex flex-col items-center justify-center py-16 text-center'>
              <div className='w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4'>
                <Users className='w-7 h-7 text-primary/70' />
              </div>
              <h3 className='text-base font-medium text-foreground mb-1'>
                No members yet
              </h3>
              <p className='text-sm text-muted-foreground mb-4 max-w-md'>
                {canAddMembers
                  ? 'Get started by inviting members to this workspace. Members can collaborate on boards and projects.'
                  : "This workspace doesn't have any members yet. Contact an admin to add members to this workspace."}
              </p>
              {canAddMembers && (
                <button
                  onClick={() => setShowAddMemberModal(true)}
                  className='btn btn-primary px-4 py-2 flex items-center gap-2'
                >
                  <UserPlus className='w-4 h-4' />
                  Invite members
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
          <div className='bg-card/90 backdrop-blur-xl border border-border rounded-xl shadow-2xl w-full max-w-md animate-in fade-in-50 zoom-in-95 duration-200'>
            {/* Header */}
            <div className='flex items-center justify-between p-5 border-b border-border/50'>
              <div className='flex items-center gap-3'>
                <div className='w-9 h-9 rounded-full bg-destructive/15 flex items-center justify-center'>
                  <UserMinus className='w-4 h-4 text-destructive' />
                </div>
                <div>
                  <h3 className='text-base font-semibold text-foreground'>
                    Remove member
                  </h3>
                  <p className='text-xs text-muted-foreground'>
                    This action cannot be undone
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowRemoveConfirm(false);
                  setMemberToRemove(null);
                }}
                className='p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
                aria-label='Close modal'
              >
                <X className='w-4 h-4' />
              </button>
            </div>

            {/* Content */}
            <div className='p-5 space-y-3'>
              <div className='flex items-center gap-3 p-3 bg-muted/30 border border-border/50 rounded-lg'>
                <div className='w-10 h-10 rounded-full bg-destructive flex items-center justify-center text-destructive-foreground font-medium flex-shrink-0'>
                  {memberToRemove.profile.full_name?.charAt(0).toUpperCase() ||
                    memberToRemove.profile.email.charAt(0).toUpperCase()}
                </div>
                <div className='min-w-0'>
                  <div className='font-medium text-foreground text-sm truncate'>
                    {memberToRemove.profile.full_name ||
                      memberToRemove.profile.email}
                  </div>
                  <div className='text-xs text-muted-foreground truncate'>
                    {memberToRemove.profile.email}
                  </div>
                </div>
                <div className='ml-auto text-xs text-muted-foreground flex-shrink-0'>
                  {memberToRemove.role === 'owner'
                    ? 'Owner'
                    : memberToRemove.role === 'admin'
                    ? 'Admin'
                    : 'Member'}
                </div>
              </div>

              <div className='flex items-start gap-2.5 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg'>
                <AlertCircle className='w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5' />
                <p className='text-xs text-muted-foreground'>
                  They will lose access to this workspace and all its boards.
                  You can add them back later if needed.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className='flex justify-end gap-2 p-5 pt-0'>
              <button
                onClick={() => {
                  setShowRemoveConfirm(false);
                  setMemberToRemove(null);
                }}
                disabled={isRemovingMember}
                className='btn btn-ghost px-4 py-2'
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveMember}
                disabled={isRemovingMember}
                className='px-4 py-2 bg-destructive hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed text-destructive-foreground text-sm font-medium rounded-lg flex items-center gap-2 transition-colors'
              >
                {isRemovingMember ? (
                  <>
                    <Loader2 className='w-4 h-4 animate-spin' />
                    Removing...
                  </>
                ) : (
                  <>
                    <Trash2 className='w-4 h-4' />
                    Remove member
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Role Modal */}
      {showChangeRoleModal && memberToChangeRole && (
        <div className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'>
          <div className='bg-card/90 backdrop-blur-xl border border-border rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-in fade-in-50 zoom-in-95 duration-200'>
            {/* Header */}
            <div className='flex items-center justify-between p-5 border-b border-border/50'>
              <div className='flex items-center gap-3'>
                <div className='w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center'>
                  <Shield className='w-4 h-4 text-primary' />
                </div>
                <div>
                  <h3 className='text-base font-semibold text-foreground'>
                    Change role
                  </h3>
                  <p className='text-xs text-muted-foreground'>
                    Update member permissions
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowChangeRoleModal(false);
                  setMemberToChangeRole(null);
                }}
                className='p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
                aria-label='Close modal'
              >
                <X className='w-4 h-4' />
              </button>
            </div>

            {/* Content */}
            <div className='p-5 space-y-3'>
              {/* Member Info */}
              <div className='flex items-center gap-3 p-3 bg-muted/30 rounded-lg'>
                <div className='w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium text-sm flex-shrink-0'>
                  {memberToChangeRole.profile.full_name
                    ?.charAt(0)
                    .toUpperCase() ||
                    memberToChangeRole.profile.email.charAt(0).toUpperCase()}
                </div>
                <div className='min-w-0 flex-1'>
                  <div className='font-medium text-foreground text-sm truncate'>
                    {memberToChangeRole.profile.full_name ||
                      memberToChangeRole.profile.email}
                  </div>
                  <div className='text-xs text-muted-foreground truncate'>
                    Currently{' '}
                    {memberToChangeRole.role === 'owner'
                      ? 'Owner'
                      : memberToChangeRole.role === 'admin'
                      ? 'Admin'
                      : 'Member'}
                  </div>
                </div>
              </div>

              {/* Role Selection */}
              <div className='space-y-2'>
                {(['admin', 'member'] as const).map((role) => (
                  <label
                    key={role}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      newRole === role
                        ? 'border-primary bg-primary/5'
                        : 'border-border/50 hover:bg-muted/40'
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
                      className='w-4 h-4 text-primary flex-shrink-0'
                    />
                    {role === 'admin' ? (
                      <Shield className='w-4 h-4 text-accent flex-shrink-0' />
                    ) : (
                      <User className='w-4 h-4 text-muted-foreground flex-shrink-0' />
                    )}
                    <div className='min-w-0 flex-1'>
                      <span className='font-medium text-foreground text-sm block'>
                        {role === 'admin' ? 'Admin' : 'Member'}
                      </span>
                      <span className='text-xs text-muted-foreground'>
                        {role === 'admin'
                          ? 'Can manage members and boards'
                          : 'Can view and edit boards'}
                      </span>
                    </div>
                  </label>
                ))}
              </div>

              {/* Warning if changing to admin */}
              {newRole === 'admin' && memberToChangeRole.role === 'member' && (
                <div className='flex items-start gap-2.5 p-3 bg-accent/10 border border-accent/30 rounded-lg'>
                  <Shield className='w-4 h-4 text-accent flex-shrink-0 mt-0.5' />
                  <p className='text-xs text-muted-foreground'>
                    This user will be able to add/remove members and manage
                    workspace settings.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className='flex justify-end gap-2 p-5 pt-0'>
              <button
                onClick={() => {
                  setShowChangeRoleModal(false);
                  setMemberToChangeRole(null);
                }}
                disabled={isChangingRole}
                className='btn btn-ghost px-4 py-2'
              >
                Cancel
              </button>
              <button
                onClick={handleChangeRole}
                disabled={
                  isChangingRole || newRole === memberToChangeRole.role
                }
                className='btn btn-primary px-4 py-2 flex items-center gap-2'
              >
                {isChangingRole ? (
                  <>
                    <Loader2 className='w-4 h-4 animate-spin' />
                    Changing...
                  </>
                ) : (
                  <>
                    <Shield className='w-4 h-4' />
                    Change role
                  </>
                )}
              </button>
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
          <div className='bg-card/95 backdrop-blur-xl border border-success/30 rounded-lg p-4 shadow-2xl max-w-sm'>
            <div className='flex items-center gap-3'>
              <CheckCircle2 className='w-5 h-5 text-success flex-shrink-0' />
              <div className='flex-1'>
                <p className='text-sm font-medium text-foreground'>
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
                className='flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors'
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
          <div className='bg-card/95 backdrop-blur-xl border border-destructive/30 rounded-lg p-4 shadow-2xl max-w-sm'>
            <div className='flex items-center gap-3'>
              <AlertCircle className='w-5 h-5 text-destructive flex-shrink-0' />
              <div className='flex-1'>
                <p className='text-sm font-medium text-foreground'>
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
                className='flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors'
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
          <div className='bg-card/95 backdrop-blur-xl border border-border rounded-lg p-6 shadow-2xl'>
            <div className='flex items-center gap-4'>
              <Loader2 className='w-8 h-8 animate-spin text-primary' />
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
