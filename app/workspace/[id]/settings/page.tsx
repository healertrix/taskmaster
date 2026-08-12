'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { DashboardHeader } from '../../../components/dashboard/header';
import { createClient } from '@/utils/supabase/client';
import {
  ArrowLeft,
  Settings,
  Globe,
  Lock,
  Users,
  LayoutGrid,
  Trash2,
  AlertCircle,
  Crown,
  Shield,
  User,
  ChevronRight,
  ChevronDown,
  X,
  Loader2,
  Check,
  CheckCircle2,
  FileText,
  Github,
  Link2,
  Unlink,
} from 'lucide-react';
import Link from 'next/link';
import { useWorkspaceSettings } from '@/hooks/useWorkspaceSettings';

// Guards against a save spinner hanging forever if the underlying request
// genuinely stalls (dropped connection, dev-server recompile mid-request,
// etc.) — without this, updateWorkspaceDetails/updateWorkspaceSetting's
// try/finally only stops the spinner once their awaited call settles, and
// if it never settles, neither does the spinner.
function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out')), ms)
    ),
  ]);
}

export default function WorkspaceSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  // Use optimized hook for fast loading
  const {
    workspace,
    settings,
    userRole,
    loading,
    error,
    refetch,
    updateWorkspaceLocal,
    updateSettingsLocal,
  } = useWorkspaceSettings(workspaceId);

  // Owners have the same settings-management rights as admins (the API
  // route already allows both — see app/api/workspaces/[id]/settings —
  // this just keeps the UI's gating in sync with that).
  const canManageSettings = userRole === 'admin' || userRole === 'owner';

  // GitHub integration — connection status + connected repos. See
  // app/api/workspaces/[id]/github/route.ts.
  const searchParams = useSearchParams();
  const [githubInstallation, setGithubInstallation] = useState<{
    account_login: string;
    account_type: string;
    created_at: string;
  } | null>(null);
  const [githubRepos, setGithubRepos] = useState<
    { id: string; full_name: string; created_at: string }[]
  >([]);
  const [isLoadingGithub, setIsLoadingGithub] = useState(true);
  const [isDisconnectingGithub, setIsDisconnectingGithub] = useState(false);

  const fetchGithubStatus = useCallback(() => {
    if (!workspaceId) return;
    setIsLoadingGithub(true);
    fetch(`/api/workspaces/${workspaceId}/github`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        setGithubInstallation(data.installation || null);
        setGithubRepos(data.repos || []);
      })
      .catch((error) => console.error('Error fetching GitHub status:', error))
      .finally(() => setIsLoadingGithub(false));
  }, [workspaceId]);

  useEffect(() => {
    fetchGithubStatus();
  }, [fetchGithubStatus]);

  // "Connect GitHub" opens the install flow in a new tab (see the anchor
  // below) so this settings tab is never navigated away from — but that
  // means this tab has no way to know the connection finished on its own.
  // Refetching whenever the window regains focus (switching back from the
  // GitHub tab) picks it up without needing a manual reload.
  useEffect(() => {
    const handleFocus = () => fetchGithubStatus();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchGithubStatus]);

  // Surfaces the result of the install-flow redirect (?github=connected or
  // ?github=error&reason=... — see app/api/github/callback/route.ts) as a
  // toast, then strips those params from the URL so refreshing the page
  // doesn't re-show it.
  useEffect(() => {
    const github = searchParams.get('github');
    if (!github) return;

    if (github === 'connected') {
      const reason = searchParams.get('reason');
      showSuccess(
        reason?.endsWith('_repos_already_linked_elsewhere')
          ? `Connected — ${reason.split('_')[0]} repo(s) were skipped, already linked to another workspace.`
          : 'GitHub connected successfully.'
      );
      fetchGithubStatus();
    } else if (github === 'error') {
      const reason = searchParams.get('reason');
      const messages: Record<string, string> = {
        installation_already_linked:
          'This GitHub installation is already connected to another workspace.',
        access_denied: "You don't have permission to connect GitHub for this workspace.",
        awaiting_org_approval:
          'Install request sent — waiting on your GitHub org owner to approve it.',
        not_signed_in: 'Please sign in and try connecting again.',
      };
      showError(messages[reason || ''] || 'Failed to connect GitHub. Please try again.');
    }

    router.replace(`/workspace/${workspaceId}/settings`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleDisconnectGithub = async () => {
    if (!confirm('Disconnect GitHub? All linked commits/PRs on cards will be removed.'))
      return;
    setIsDisconnectingGithub(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/github`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Request failed');
      setGithubInstallation(null);
      setGithubRepos([]);
      showSuccess('GitHub disconnected.');
    } catch (error) {
      console.error('Error disconnecting GitHub:', error);
      showError('Failed to disconnect GitHub. Please try again.');
    } finally {
      setIsDisconnectingGithub(false);
    }
  };

  // Modal states
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [showCreationModal, setShowCreationModal] = useState(false);
  const [showDeletionModal, setShowDeletionModal] = useState(false);
  const [showWorkspaceEditModal, setShowWorkspaceEditModal] = useState(false);
  const [showWorkspaceDeletionModal, setShowWorkspaceDeletionModal] =
    useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Workspace deletion states
  const [deletionConfirmName, setDeletionConfirmName] = useState('');
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);
  const [deletionStats, setDeletionStats] = useState<any>(null);
  const [showDeletionDetails, setShowDeletionDetails] = useState(false);

  // Notification states
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccessToastFading, setIsSuccessToastFading] = useState(false);
  const [isErrorToastFading, setIsErrorToastFading] = useState(false);

  // Workspace edit form state
  const [editWorkspaceName, setEditWorkspaceName] = useState('');
  const [editField, setEditField] = useState<'name' | null>(null);

  // Initialize edit form when workspace data is available
  useEffect(() => {
    if (workspace) {
      setEditWorkspaceName(workspace.name);
    }
  }, [workspace]);

  // Handle mobile back button/gesture for modals
  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    if (!isMobile) return;

    const handlePopState = () => {
      // Close modals in order of priority
      if (showWorkspaceEditModal) {
        setShowWorkspaceEditModal(false);
        setEditField(null);
        setEditWorkspaceName(workspace?.name || '');
      } else if (showMembershipModal) {
        setShowMembershipModal(false);
      } else if (showCreationModal) {
        setShowCreationModal(false);
      } else if (showDeletionModal) {
        setShowDeletionModal(false);
      } else if (showWorkspaceDeletionModal) {
        setShowWorkspaceDeletionModal(false);
        setDeletionConfirmName('');
        setShowDeletionDetails(false);
      }
    };

    // Add history state when any modal opens
    if (
      showWorkspaceEditModal ||
      showMembershipModal ||
      showCreationModal ||
      showDeletionModal ||
      showWorkspaceDeletionModal
    ) {
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [
    showWorkspaceEditModal,
    showMembershipModal,
    showCreationModal,
    showDeletionModal,
    showWorkspaceDeletionModal,
    workspace,
  ]);

  // Handle ESC key for desktop only
  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    if (isMobile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Close modals in order of priority
        if (showWorkspaceEditModal) {
          setShowWorkspaceEditModal(false);
          setEditField(null);
          setEditWorkspaceName(workspace?.name || '');
        } else if (showMembershipModal) {
          setShowMembershipModal(false);
        } else if (showCreationModal) {
          setShowCreationModal(false);
        } else if (showDeletionModal) {
          setShowDeletionModal(false);
        } else if (showWorkspaceDeletionModal && !isDeletingWorkspace) {
          setShowWorkspaceDeletionModal(false);
          setDeletionConfirmName('');
          setShowDeletionDetails(false);
        }
      }
    };

    if (
      showWorkspaceEditModal ||
      showMembershipModal ||
      showCreationModal ||
      showDeletionModal ||
      showWorkspaceDeletionModal
    ) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [
    showWorkspaceEditModal,
    showMembershipModal,
    showCreationModal,
    showDeletionModal,
    showWorkspaceDeletionModal,
    isDeletingWorkspace,
    workspace,
  ]);

  // Notification helper functions
  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setShowSuccessToast(true);
    setIsSuccessToastFading(false);

    // Start fade out animation after 3.5 seconds
    setTimeout(() => {
      setIsSuccessToastFading(true);
      // Remove toast after fade animation completes
      setTimeout(() => {
        setShowSuccessToast(false);
        setIsSuccessToastFading(false);
      }, 500);
    }, 3500);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setShowErrorToast(true);
    setIsErrorToastFading(false);

    // Start fade out animation after 4.5 seconds
    setTimeout(() => {
      setIsErrorToastFading(true);
      // Remove toast after fade animation completes
      setTimeout(() => {
        setShowErrorToast(false);
        setIsErrorToastFading(false);
      }, 500);
    }, 4500);
  };

  // Function to update workspace settings
  const updateWorkspaceSetting = async (
    settingType: keyof WorkspaceSettings,
    settingValue: any
  ) => {
    if (!canManageSettings) return;

    setIsUpdating(true);
    try {
      const response = await withTimeout(
        fetch(`/api/workspaces/${workspaceId}/settings`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            settingType,
            settingValue,
          }),
        }),
        15000
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      // Updates both this hook's rendered state and the cache — see the
      // comment on updateSettingsLocal in useWorkspaceSettings.ts.
      updateSettingsLocal({ [settingType]: settingValue });

      // Close modals
      setShowMembershipModal(false);
      setShowCreationModal(false);
      setShowDeletionModal(false);

      // Show success message based on setting type
      const settingDisplayNames = {
        membership_restriction: 'Membership restrictions',
        board_creation_simplified: 'Board creation permissions',
        board_deletion_simplified: 'Board deletion permissions',
      };
      showSuccess(`${settingDisplayNames[settingType]} updated successfully`);
    } catch (error) {
      console.error('Error updating workspace setting:', error);
      showError('Failed to update setting');
    } finally {
      setIsUpdating(false);
    }
  };

  // Function to update workspace details (currently just the name — color
  // is no longer user-editable, see the read-only "Workspace color" row
  // below, derived from the workspace's own id via utils/idColor.ts)
  const updateWorkspaceDetails = async () => {
    if (!canManageSettings) return;
    if (!editWorkspaceName.trim()) return;

    setIsUpdating(true);
    try {
      const supabase = createClient();
      const updateData = { name: editWorkspaceName.trim() };

      const { error } = await withTimeout(
        supabase.from('workspaces').update(updateData).eq('id', workspaceId),
        15000
      );

      if (error) throw error;

      // Updates both this hook's rendered state and the cache — see the
      // comment on updateWorkspaceLocal in useWorkspaceSettings.ts.
      updateWorkspaceLocal(updateData);

      setShowWorkspaceEditModal(false);
      setEditField(null);

      showSuccess('Workspace name updated successfully');
    } catch (error) {
      console.error('Error updating workspace details:', error);
      showError('Failed to update workspace details');
    } finally {
      setIsUpdating(false);
    }
  };

  // Function to update board creation restriction
  const updateBoardCreationRestriction = async (
    newValue: 'any_member' | 'admins_only' | 'owner_only'
  ) => {
    await updateWorkspaceSetting('board_creation_simplified', newValue);
    setShowCreationModal(false);
  };

  // Function to update board deletion restriction
  const updateBoardDeletionRestriction = async (
    newValue: 'any_member' | 'admins_only' | 'owner_only'
  ) => {
    await updateWorkspaceSetting('board_deletion_simplified', newValue);
    setShowDeletionModal(false);
  };

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'owner_only':
        return { icon: Crown, text: 'Owner only', color: 'text-yellow-500' };
      case 'admins_only':
        return { icon: Shield, text: 'Admins only', color: 'text-accent' };
      case 'any_member':
        return {
          icon: User,
          text: 'Any member',
          color: 'text-muted-foreground',
        };
      case 'anyone':
        return {
          icon: Globe,
          text: 'Anyone in workspace',
          color: 'text-success',
        };
      default:
        return {
          icon: User,
          text: 'Any member',
          color: 'text-muted-foreground',
        };
    }
  };

  // Loading spinner, on-brand sizing
  const LoadingSpinner = ({ size = 'md', className = '' }) => {
    const sizeClasses = {
      sm: 'w-4 h-4',
      md: 'w-6 h-6',
      lg: 'w-8 h-8',
      xl: 'w-12 h-12',
    };

    return (
      <div className={`relative ${sizeClasses[size]} ${className}`}>
        <div className='absolute inset-0 rounded-full border-2 border-primary/20'></div>
        <div className='absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin'></div>
      </div>
    );
  };

  // Page loading skeleton
  const PageLoadingSkeleton = () => (
    <div className='min-h-screen'>
      <DashboardHeader />
      <main className='container mx-auto max-w-3xl px-3 sm:px-4 pt-16 sm:pt-24 pb-8 sm:pb-16'>
        <div className='space-y-4'>
          <div className='flex items-center gap-4 mb-6'>
            <div className='w-8 h-8 bg-muted/50 rounded-lg animate-pulse'></div>
            <div className='space-y-2'>
              <div className='w-48 h-6 bg-muted/50 rounded animate-pulse'></div>
              <div className='w-64 h-4 bg-muted/50 rounded animate-pulse'></div>
            </div>
          </div>

          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className='bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl p-5 space-y-3'
            >
              <div className='w-40 h-4 bg-muted/50 rounded animate-pulse'></div>
              <div className='h-14 rounded-lg bg-muted/30 animate-pulse'></div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );

  // Add new function for workspace deletion
  const deleteWorkspace = async () => {
    if (!workspace || deletionConfirmName !== workspace.name) {
      showError('Please type the workspace name exactly to confirm deletion');
      return;
    }

    setIsDeletingWorkspace(true);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceName: workspace.name,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete workspace');
      }

      // Clear cached workspace & settings so UI reflects deletion immediately
      refetch();

      setDeletionStats(data.deletionStats);
      showSuccess('Workspace deleted successfully');

      // Redirect to home page after a short delay
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (error) {
      console.error('Error deleting workspace:', error);
      showError(
        error instanceof Error ? error.message : 'Failed to delete workspace'
      );
    } finally {
      setIsDeletingWorkspace(false);
    }
  };

  if (loading && !workspace) {
    return <PageLoadingSkeleton />;
  }

  if (error || !workspace) {
    return (
      <div className='min-h-screen'>
        <DashboardHeader />
        <main className='container mx-auto max-w-3xl px-3 sm:px-4 pt-16 sm:pt-24 pb-8 sm:pb-16'>
          <div className='flex items-center justify-center h-64'>
            <div className='text-destructive'>
              {error || 'Workspace not found'}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!canManageSettings) {
    return (
      <div className='min-h-screen'>
        <DashboardHeader />
        <main className='container mx-auto max-w-3xl px-3 sm:px-4 pt-16 sm:pt-24 pb-8 sm:pb-16'>
          <div className='flex items-center justify-center min-h-[60vh]'>
            <div className='text-center max-w-sm sm:max-w-md mx-auto px-4'>
              <div className='bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl p-6 sm:p-8'>
                <div className='flex justify-center mb-4 sm:mb-6'>
                  <div className='w-12 h-12 sm:w-16 sm:h-16 bg-amber-500/10 rounded-full flex items-center justify-center'>
                    <Shield className='w-6 h-6 sm:w-8 sm:h-8 text-amber-500' />
                  </div>
                </div>

                <h2 className='text-lg sm:text-2xl font-bold text-foreground mb-2 sm:mb-3'>
                  Access Restricted
                </h2>

                <p className='text-sm sm:text-base text-muted-foreground mb-2 leading-relaxed'>
                  You don't have permission to manage settings for this
                  workspace.
                </p>
                <p className='text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6'>
                  Only workspace administrators can modify workspace settings.
                </p>

                {userRole && (
                  <div className='bg-muted/30 rounded-lg p-3 mb-4 sm:mb-6'>
                    <div className='flex items-center justify-center gap-2 text-xs sm:text-sm'>
                      <User className='w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground' />
                      <span className='text-muted-foreground font-medium'>
                        You are a member of this workspace
                      </span>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => router.back()}
                  className='btn btn-primary inline-flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 text-sm sm:text-base'
                >
                  <ArrowLeft className='w-3 h-3 sm:w-4 sm:h-4' />
                  Go back
                </button>
              </div>

              <p className='text-xs text-muted-foreground mt-3 sm:mt-4'>
                Need access? Contact a workspace administrator or owner.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const membershipInfo = getRoleDisplay(settings.membership_restriction);

  return (
    <div className='min-h-screen'>
      <DashboardHeader />

      <main className='container mx-auto max-w-3xl px-3 sm:px-4 pt-16 sm:pt-24 pb-8 sm:pb-16'>
        {/* Header */}
        <div className='flex items-center gap-3 mb-6'>
          <Link
            href={`/boards/${workspace.id}`}
            className='p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors flex-shrink-0'
            aria-label='Back to workspace'
          >
            <ArrowLeft className='w-4 h-4 sm:w-5 sm:h-5' />
          </Link>
          <div className='min-w-0 flex-1'>
            <h1 className='text-xl sm:text-2xl font-bold text-foreground truncate heading-enter'>
              {workspace.name}
            </h1>
            <p className='text-muted-foreground text-xs sm:text-sm'>
              Workspace settings
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className='mb-6 flex items-center gap-1 border-b border-border/60'>
          <Link
            href={`/workspace/${workspaceId}/members`}
            className='px-3 sm:px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border-b-2 border-transparent hover:border-border transition-colors whitespace-nowrap'
          >
            Members
          </Link>
          <span className='px-3 sm:px-4 py-2 text-sm font-medium text-primary border-b-2 border-primary whitespace-nowrap'>
            Settings
          </span>
        </div>

        <div className='space-y-4'>
          {/* Current User Role Info */}
          {userRole && (
            <div className='flex items-center gap-2 px-4 py-2.5 bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl text-sm'>
              {userRole === 'owner' && (
                <Crown className='w-4 h-4 text-yellow-500 flex-shrink-0' />
              )}
              {userRole === 'admin' && (
                <Shield className='w-4 h-4 text-accent flex-shrink-0' />
              )}
              {(userRole as string) === 'member' && (
                <User className='w-4 h-4 text-muted-foreground flex-shrink-0' />
              )}
              <span className='text-foreground'>
                You are{' '}
                {userRole === 'owner'
                  ? 'the owner'
                  : userRole === 'admin'
                  ? 'an admin'
                  : 'a member'}{' '}
                of this workspace
              </span>
            </div>
          )}

          {/* Workspace Details */}
          <div className='bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl p-4 sm:p-5'>
            <h2 className='text-sm font-semibold text-foreground mb-3'>
              Workspace details
            </h2>

            <div className='space-y-2'>
              {/* Workspace Name */}
              <button
                onClick={
                  canManageSettings
                    ? () => {
                        setEditField('name');
                        setEditWorkspaceName(workspace?.name || '');
                        setShowWorkspaceEditModal(true);
                      }
                    : undefined
                }
                className={`w-full flex items-center justify-between p-3 rounded-lg border border-border/50 transition-colors text-left ${
                  canManageSettings
                    ? 'hover:bg-muted/40 cursor-pointer'
                    : 'cursor-default'
                }`}
                disabled={!canManageSettings}
              >
                <div className='flex items-center gap-3 min-w-0 flex-1'>
                  <div className='w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0'>
                    <span className='text-sm font-medium text-primary'>
                      {workspace?.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className='min-w-0 flex-1'>
                    <div className='font-medium text-foreground text-sm truncate'>
                      {workspace?.name}
                    </div>
                    <div className='text-xs text-muted-foreground'>
                      Workspace name
                    </div>
                  </div>
                </div>
                {canManageSettings && (
                  <ChevronRight className='w-4 h-4 text-muted-foreground flex-shrink-0' />
                )}
              </button>
            </div>
          </div>

          {/* Permissions */}
          <div className='bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl p-4 sm:p-5'>
            <h2 className='text-sm font-semibold text-foreground mb-3'>
              Permissions
            </h2>

            <div className='space-y-2'>
              {/* Membership Restrictions */}
              <button
                onClick={
                  canManageSettings
                    ? () => setShowMembershipModal(true)
                    : undefined
                }
                className={`w-full flex items-center justify-between p-3 rounded-lg border border-border/50 transition-colors text-left ${
                  canManageSettings
                    ? 'hover:bg-muted/40 cursor-pointer'
                    : 'cursor-default'
                }`}
                disabled={!canManageSettings}
              >
                <div className='flex items-center gap-3 min-w-0'>
                  <div className='w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0'>
                    {React.createElement(membershipInfo.icon, {
                      className: `w-4 h-4 ${membershipInfo.color}`,
                    })}
                  </div>
                  <div className='min-w-0'>
                    <div className='font-medium text-foreground text-sm truncate'>
                      {membershipInfo.text} can invite members
                    </div>
                    <div className='text-xs text-muted-foreground hidden sm:block'>
                      Who can invite new members to this workspace
                    </div>
                  </div>
                </div>
                {canManageSettings && (
                  <ChevronRight className='w-4 h-4 text-muted-foreground flex-shrink-0' />
                )}
              </button>

              {/* Board Creation Restrictions */}
              <button
                onClick={
                  canManageSettings
                    ? () => setShowCreationModal(true)
                    : undefined
                }
                className={`w-full flex items-center justify-between p-3 rounded-lg border border-border/50 transition-colors text-left ${
                  canManageSettings
                    ? 'hover:bg-muted/40 cursor-pointer'
                    : 'cursor-default'
                }`}
                disabled={!canManageSettings}
              >
                <div className='flex items-center gap-3 min-w-0'>
                  <div className='w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0'>
                    <LayoutGrid className='w-4 h-4 text-accent' />
                  </div>
                  <div className='min-w-0'>
                    <div className='font-medium text-foreground text-sm truncate'>
                      {getRoleDisplay(settings.board_creation_simplified).text}{' '}
                      can create boards
                    </div>
                    <div className='text-xs text-muted-foreground hidden sm:block'>
                      Boards are visible to all workspace members
                    </div>
                  </div>
                </div>
                {canManageSettings && (
                  <ChevronRight className='w-4 h-4 text-muted-foreground flex-shrink-0' />
                )}
              </button>

              {/* Board Deletion Restrictions */}
              <button
                onClick={
                  canManageSettings
                    ? () => setShowDeletionModal(true)
                    : undefined
                }
                className={`w-full flex items-center justify-between p-3 rounded-lg border border-border/50 transition-colors text-left ${
                  canManageSettings
                    ? 'hover:bg-muted/40 cursor-pointer'
                    : 'cursor-default'
                }`}
                disabled={!canManageSettings}
              >
                <div className='flex items-center gap-3 min-w-0'>
                  <div className='w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0'>
                    <Trash2 className='w-4 h-4 text-destructive' />
                  </div>
                  <div className='min-w-0'>
                    <div className='font-medium text-foreground text-sm truncate'>
                      {getRoleDisplay(settings.board_deletion_simplified).text}{' '}
                      can delete boards
                    </div>
                    <div className='text-xs text-muted-foreground hidden sm:block'>
                      Who can permanently delete workspace boards
                    </div>
                  </div>
                </div>
                {canManageSettings && (
                  <ChevronRight className='w-4 h-4 text-muted-foreground flex-shrink-0' />
                )}
              </button>
            </div>
          </div>

          {/* GitHub Integration */}
          <div className='bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl p-4 sm:p-5'>
            <h2 className='text-sm font-semibold text-foreground mb-3'>
              GitHub integration
            </h2>

            {isLoadingGithub ? (
              <div className='flex justify-center py-6'>
                <Loader2 className='w-5 h-5 animate-spin text-muted-foreground' />
              </div>
            ) : githubInstallation ? (
              <div className='space-y-3'>
                <div className='flex items-center justify-between p-3 rounded-lg border border-border/50'>
                  <div className='flex items-center gap-3 min-w-0'>
                    <div className='w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0'>
                      <Github className='w-4 h-4 text-foreground' />
                    </div>
                    <div className='min-w-0'>
                      <div className='font-medium text-foreground text-sm truncate'>
                        Connected to {githubInstallation.account_login}
                      </div>
                      <div className='text-xs text-muted-foreground'>
                        {githubRepos.length} repo{githubRepos.length === 1 ? '' : 's'}{' '}
                        connected · mention a card with{' '}
                        <code className='px-1 py-0.5 bg-muted rounded text-[11px]'>
                          #board-card
                        </code>{' '}
                        in a commit or PR to link it
                      </div>
                    </div>
                  </div>
                  {canManageSettings && (
                    <button
                      onClick={handleDisconnectGithub}
                      disabled={isDisconnectingGithub}
                      className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0'
                    >
                      {isDisconnectingGithub ? (
                        <Loader2 className='w-3.5 h-3.5 animate-spin' />
                      ) : (
                        <Unlink className='w-3.5 h-3.5' />
                      )}
                      Disconnect
                    </button>
                  )}
                </div>

                {githubRepos.length > 0 && (
                  <div className='divide-y divide-border/40 rounded-lg border border-border/50 overflow-hidden'>
                    {githubRepos.map((repo) => (
                      <div
                        key={repo.id}
                        className='flex items-center gap-2 px-3 py-2 text-sm text-foreground'
                      >
                        <Link2 className='w-3.5 h-3.5 text-muted-foreground flex-shrink-0' />
                        <span className='truncate'>{repo.full_name}</span>
                      </div>
                    ))}
                  </div>
                )}

                {canManageSettings && (
                  <p className='text-xs text-muted-foreground'>
                    To add or remove repos, manage this from{' '}
                    <a
                      href={`https://github.com/settings/installations`}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-primary hover:text-primary/80 underline'
                    >
                      GitHub's App permissions page
                    </a>
                    .
                  </p>
                )}
              </div>
            ) : (
              <div className='flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50'>
                <div className='flex items-center gap-3 min-w-0'>
                  <div className='w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0'>
                    <Github className='w-4 h-4 text-muted-foreground' />
                  </div>
                  <div className='min-w-0'>
                    <div className='font-medium text-foreground text-sm'>
                      Not connected
                    </div>
                    <div className='text-xs text-muted-foreground hidden sm:block'>
                      Link commits and pull requests to cards, and move cards to Done
                      automatically when a PR merges
                    </div>
                  </div>
                </div>
                {canManageSettings ? (
                  <a
                    href={`/api/workspaces/${workspaceId}/github/connect`}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex-shrink-0'
                  >
                    <Github className='w-3.5 h-3.5' />
                    Connect GitHub
                  </a>
                ) : (
                  <span className='text-xs text-muted-foreground flex-shrink-0'>
                    Admin only
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Danger Zone - Workspace Deletion */}
          {userRole === 'owner' && (
            <div className='bg-card/70 backdrop-blur-xl border border-destructive/30 rounded-2xl p-4 sm:p-5'>
              <h2 className='text-sm font-semibold text-destructive mb-3'>
                Danger zone
              </h2>

              <div className='flex items-start gap-3'>
                <AlertCircle className='w-4 h-4 text-destructive mt-0.5 flex-shrink-0' />
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center gap-2 mb-1.5'>
                    <h3 className='font-medium text-foreground text-sm'>
                      Delete this workspace
                    </h3>
                    <button
                      onClick={() =>
                        setShowDeletionDetails(!showDeletionDetails)
                      }
                      className='p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors'
                      title={
                        showDeletionDetails
                          ? 'Hide details'
                          : 'Show what will be deleted'
                      }
                    >
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          showDeletionDetails ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  </div>
                  <p className='text-xs text-muted-foreground mb-3'>
                    Once you delete a workspace, there is no going back.
                  </p>

                  {showDeletionDetails && (
                    <ul className='text-xs text-muted-foreground space-y-1 pl-3 border-l-2 border-destructive/30 mb-3 animate-in slide-in-from-top-1 fade-in duration-200'>
                      <li>
                        All boards in this workspace will be permanently
                        deleted
                      </li>
                      <li>All lists, cards, and comments will be lost forever</li>
                      <li>All workspace members will lose access</li>
                      <li>
                        All workspace settings and permissions will be removed
                      </li>
                      <li>All activity history will be permanently deleted</li>
                    </ul>
                  )}

                  <button
                    onClick={() => {
                      setDeletionConfirmName('');
                      setShowDeletionDetails(false);
                      setShowWorkspaceDeletionModal(true);
                    }}
                    className='px-3.5 py-1.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm font-medium rounded-lg transition-colors flex items-center gap-2'
                  >
                    <Trash2 className='w-3.5 h-3.5' />
                    Delete workspace permanently
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Workspace Edit Modal */}
      {showWorkspaceEditModal && (
        <div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4'>
          <div className='bg-card/90 backdrop-blur-xl rounded-xl shadow-2xl max-w-md w-full p-5 border border-border animate-in fade-in-50 zoom-in-95 duration-200'>
            <div className='flex justify-between items-center mb-4'>
              <h3 className='text-lg font-bold text-foreground'>
                Edit workspace name
              </h3>
              <button
                onClick={() => {
                  setShowWorkspaceEditModal(false);
                  setEditField(null);
                  setEditWorkspaceName(workspace?.name || '');
                }}
                className='text-muted-foreground hover:text-foreground transition-colors'
                aria-label='Close modal'
                disabled={isUpdating}
              >
                <X className='w-5 h-5' />
              </button>
            </div>

            <div className='space-y-4'>
              {editField === 'name' && (
                <div>
                  <label
                    htmlFor='workspace-name'
                    className='block text-sm font-medium text-foreground mb-1'
                  >
                    Workspace name
                  </label>
                  <input
                    id='workspace-name'
                    type='text'
                    value={editWorkspaceName}
                    onChange={(e) => setEditWorkspaceName(e.target.value)}
                    className='w-full p-2.5 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
                    placeholder='My Workspace'
                    disabled={isUpdating}
                    autoFocus
                  />
                </div>
              )}

            </div>

            <div className='flex justify-end gap-2 mt-6'>
              <button
                type='button'
                onClick={() => {
                  setShowWorkspaceEditModal(false);
                  setEditField(null);
                  setEditWorkspaceName(workspace?.name || '');
                }}
                className='btn btn-ghost px-4 py-2'
                disabled={isUpdating}
              >
                Cancel
              </button>
              <button
                onClick={updateWorkspaceDetails}
                className='btn btn-primary px-4 py-2 flex items-center gap-2'
                disabled={
                  isUpdating ||
                  (editField === 'name' && !editWorkspaceName.trim())
                }
              >
                {isUpdating ? (
                  <>
                    <LoadingSpinner size='sm' />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className='w-4 h-4' />
                    Save changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Membership Restriction Modal */}
      {showMembershipModal && (
        <div className='fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4'>
          <div className='bg-card/90 backdrop-blur-xl border border-border rounded-xl shadow-2xl p-5 w-full max-w-md animate-in fade-in-50 zoom-in-95 duration-200'>
            <h3 className='text-base font-semibold text-foreground mb-4'>
              Who can invite new members?
            </h3>

            <div className='space-y-2'>
              {(['anyone', 'admins_only', 'owner_only'] as const).map(
                (option) => {
                  const info = getRoleDisplay(option);
                  const isSelected =
                    settings.membership_restriction === option;
                  return (
                    <button
                      key={option}
                      onClick={() =>
                        updateWorkspaceSetting('membership_restriction', option)
                      }
                      disabled={isUpdating}
                      className={`w-full p-3 text-left rounded-lg border transition-colors flex items-center gap-3 ${
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-border/50 hover:bg-muted/40'
                      } ${isUpdating ? 'opacity-50' : ''}`}
                    >
                      {isUpdating && isSelected ? (
                        <LoadingSpinner size='sm' />
                      ) : (
                        React.createElement(info.icon, {
                          className: `w-4 h-4 ${info.color}`,
                        })
                      )}
                      <span className='text-sm font-medium text-foreground'>
                        {info.text}
                      </span>
                    </button>
                  );
                }
              )}
            </div>

            <div className='flex justify-end mt-5'>
              <button
                onClick={() => setShowMembershipModal(false)}
                disabled={isUpdating}
                className='btn btn-ghost px-4 py-2'
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Board Creation Restriction Modal */}
      {showCreationModal && (
        <div className='fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4'>
          <div className='bg-card/90 backdrop-blur-xl border border-border rounded-xl shadow-2xl p-5 w-full max-w-md animate-in fade-in-50 zoom-in-95 duration-200'>
            <h3 className='text-base font-semibold text-foreground mb-4'>
              Who can create boards?
            </h3>

            <div className='space-y-2'>
              {(['any_member', 'admins_only', 'owner_only'] as const).map(
                (option) => {
                  const info = getRoleDisplay(option);
                  const isSelected =
                    settings.board_creation_simplified === option;

                  return (
                    <button
                      key={option}
                      onClick={() => updateBoardCreationRestriction(option)}
                      disabled={isUpdating}
                      className={`w-full p-3 text-left rounded-lg border transition-colors flex items-center gap-3 ${
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-border/50 hover:bg-muted/40'
                      }`}
                    >
                      {React.createElement(info.icon, {
                        className: `w-4 h-4 ${info.color}`,
                      })}
                      <span className='text-sm font-medium text-foreground'>
                        {info.text}
                      </span>
                    </button>
                  );
                }
              )}
            </div>

            <div className='flex justify-end mt-5'>
              <button
                onClick={() => setShowCreationModal(false)}
                disabled={isUpdating}
                className='btn btn-ghost px-4 py-2'
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Board Deletion Restriction Modal */}
      {showDeletionModal && (
        <div className='fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4'>
          <div className='bg-card/90 backdrop-blur-xl border border-border rounded-xl shadow-2xl p-5 w-full max-w-md animate-in fade-in-50 zoom-in-95 duration-200'>
            <h3 className='text-base font-semibold text-foreground mb-4'>
              Who can delete boards?
            </h3>

            <div className='space-y-2'>
              {(['any_member', 'admins_only', 'owner_only'] as const).map(
                (option) => {
                  const info = getRoleDisplay(option);
                  const isSelected =
                    settings.board_deletion_simplified === option;

                  return (
                    <button
                      key={option}
                      onClick={() => updateBoardDeletionRestriction(option)}
                      disabled={isUpdating}
                      className={`w-full p-3 text-left rounded-lg border transition-colors flex items-center gap-3 ${
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-border/50 hover:bg-muted/40'
                      }`}
                    >
                      {React.createElement(info.icon, {
                        className: `w-4 h-4 ${info.color}`,
                      })}
                      <span className='text-sm font-medium text-foreground'>
                        {info.text}
                      </span>
                    </button>
                  );
                }
              )}
            </div>

            <div className='flex justify-end mt-5'>
              <button
                onClick={() => setShowDeletionModal(false)}
                disabled={isUpdating}
                className='btn btn-ghost px-4 py-2'
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workspace Deletion Confirmation Modal */}
      {showWorkspaceDeletionModal && workspace && (
        <div className='fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4'>
          <div className='bg-card/90 backdrop-blur-xl rounded-xl shadow-2xl max-w-lg w-full p-6 border border-destructive/30 animate-in fade-in-50 zoom-in-95 duration-200'>
            <div className='flex items-center gap-3 mb-6'>
              <div className='w-12 h-12 rounded-full bg-destructive/15 flex items-center justify-center'>
                <Trash2 className='w-6 h-6 text-destructive' />
              </div>
              <div>
                <h3 className='text-lg font-bold text-foreground'>
                  Delete workspace
                </h3>
                <p className='text-sm text-muted-foreground'>
                  This action cannot be undone
                </p>
              </div>
            </div>

            <div className='space-y-5'>
              {/* Consequences */}
              <div className='p-3.5 bg-destructive/10 border border-destructive/30 rounded-lg'>
                <h4 className='font-semibold text-foreground mb-2.5 flex items-center gap-2 text-sm'>
                  <AlertCircle className='w-4 h-4 text-destructive' />
                  What will be deleted
                </h4>
                <ul className='text-sm text-muted-foreground space-y-1.5'>
                  <li className='flex items-center gap-2'>
                    <Trash2 className='w-3 h-3 flex-shrink-0' />
                    The workspace "{workspace.name}" and all its settings
                  </li>
                  <li className='flex items-center gap-2'>
                    <LayoutGrid className='w-3 h-3 flex-shrink-0' />
                    All boards, lists, and cards in this workspace
                  </li>
                  <li className='flex items-center gap-2'>
                    <Users className='w-3 h-3 flex-shrink-0' />
                    All member access and permissions
                  </li>
                  <li className='flex items-center gap-2'>
                    <FileText className='w-3 h-3 flex-shrink-0' />
                    All comments, attachments, and activity history
                  </li>
                </ul>
              </div>

              {/* Confirmation Input */}
              <div>
                <label className='block text-sm font-medium text-foreground mb-2'>
                  Type the workspace name{' '}
                  <span className='font-bold text-destructive'>
                    "{workspace.name}"
                  </span>{' '}
                  to confirm:
                </label>
                <input
                  type='text'
                  value={deletionConfirmName}
                  onChange={(e) => setDeletionConfirmName(e.target.value)}
                  placeholder={workspace.name}
                  className='w-full p-2.5 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive focus:border-transparent'
                  disabled={isDeletingWorkspace}
                  autoFocus
                />
              </div>

              {/* Action Buttons */}
              <div className='flex gap-3'>
                <button
                  onClick={() => {
                    setShowWorkspaceDeletionModal(false);
                    setDeletionConfirmName('');
                    setShowDeletionDetails(false);
                  }}
                  className='flex-1 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
                  disabled={isDeletingWorkspace}
                >
                  Cancel
                </button>
                <button
                  onClick={deleteWorkspace}
                  disabled={
                    isDeletingWorkspace ||
                    deletionConfirmName !== workspace.name
                  }
                  className='flex-1 px-4 py-2.5 text-sm font-medium bg-destructive hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed text-destructive-foreground rounded-lg transition-colors flex items-center justify-center gap-2'
                >
                  {isDeletingWorkspace ? (
                    <>
                      <Loader2 className='w-4 h-4 animate-spin' />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className='w-4 h-4' />
                      Delete permanently
                    </>
                  )}
                </button>
              </div>

              {isDeletingWorkspace && (
                <div className='p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg'>
                  <div className='flex items-center gap-2 text-amber-500'>
                    <Loader2 className='w-4 h-4 animate-spin' />
                    <span className='text-sm font-medium'>
                      Deleting workspace and all related data...
                    </span>
                  </div>
                  <p className='text-xs text-muted-foreground mt-1'>
                    This may take a few moments. Please don't close this
                    window.
                  </p>
                </div>
              )}

              {deletionStats && (
                <div className='p-3 bg-success/10 border border-success/30 rounded-lg'>
                  <h5 className='font-medium text-success mb-2 text-sm'>
                    Deletion completed
                  </h5>
                  <div className='grid grid-cols-2 gap-1.5 text-xs text-muted-foreground'>
                    <div>Workspace: {deletionStats.workspace}</div>
                    <div>Members: {deletionStats.members}</div>
                    <div>Boards: {deletionStats.boards}</div>
                    <div>Settings: {deletionStats.settings}</div>
                    <div>Lists: {deletionStats.lists}</div>
                    <div>Invitations: {deletionStats.invitations}</div>
                    <div>Cards: {deletionStats.cards}</div>
                    <div>Activities: {deletionStats.activities}</div>
                  </div>
                </div>
              )}
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
      {isUpdating && (
        <div className='fixed inset-0 bg-black/10 backdrop-blur-sm z-[90] flex items-center justify-center'>
          <div className='bg-card/95 backdrop-blur-xl border border-border rounded-lg p-6 shadow-2xl'>
            <div className='flex items-center gap-4'>
              <LoadingSpinner size='lg' />
              <div>
                <p className='font-medium text-foreground'>
                  Updating settings...
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
