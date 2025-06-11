'use client';

import { useState, useEffect } from 'react';
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
  Bug,
} from 'lucide-react';
import Link from 'next/link';

type Profile = {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
};

type WorkspaceMember = {
  id: string;
  workspace_id: string;
  profile_id: string;
  role: 'owner' | 'admin' | 'member';
  created_at: string;
  profile: Profile;
};

type Workspace = {
  id: string;
  name: string;
  color: string;
  owner_id: string;
};

type Invitation = {
  id: string;
  workspace_id: string;
  email: string;
  role: 'admin' | 'member';
  invited_by: string;
  created_at: string;
  status: 'pending' | 'accepted' | 'declined';
};

export default function WorkspaceMembersPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [isInviting, setIsInviting] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  // Notification states
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccessToastFading, setIsSuccessToastFading] = useState(false);
  const [isErrorToastFading, setIsErrorToastFading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient();

        // Get current user
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.push('/auth/login');
          return;
        }

        setCurrentUser(user.id);

        // Fetch workspace
        const { data: workspaceData, error: workspaceError } = await supabase
          .from('workspaces')
          .select('*')
          .eq('id', workspaceId)
          .single();

        if (workspaceError) {
          setError('Workspace not found');
          return;
        }

        setWorkspace(workspaceData);

        // Check user's role in workspace - check if owner first, then membership
        let userRole = '';
        if (workspaceData.owner_id === user.id) {
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
            setError('Access denied');
            return;
          }
          userRole = membershipData.role;
        }

        setCurrentUserRole(userRole);

        // Fetch all workspace members (simplified query first)
        const { data: membersData, error: membersError } = await supabase
          .from('workspace_members')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: true });

        console.log('=== MEMBERS FETCH DEBUG ===');
        console.log('Members query error:', membersError);
        console.log('Members query data:', membersData);
        console.log('Workspace owner_id:', workspaceData.owner_id);

        if (membersError) {
          console.error('Error fetching members:', membersError);
          setMembers([]); // Set empty array on error
        } else {
          let allMembers = membersData || [];
          console.log('Raw members from DB:', allMembers);

          // Fetch all profiles for the members
          if (allMembers.length > 0) {
            const profileIds = allMembers.map((m) => m.profile_id);
            const { data: profilesData, error: profilesError } = await supabase
              .from('profiles')
              .select('*')
              .in('id', profileIds);

            console.log('Profiles fetch error:', profilesError);
            console.log('Profiles data:', profilesData);

            if (!profilesError && profilesData) {
              // Attach profiles to members
              allMembers = allMembers.map((member) => {
                const profile = profilesData.find(
                  (p) => p.id === member.profile_id
                );
                return {
                  ...member,
                  profile: profile || {
                    id: member.profile_id,
                    email: 'Unknown',
                    full_name: 'Unknown User',
                  },
                };
              });
            }
          }

          // Update owner role to 'owner' instead of 'admin'
          allMembers = allMembers.map((member) =>
            member.profile_id === workspaceData.owner_id
              ? { ...member, role: 'owner' }
              : member
          );

          console.log('Final members list with profiles:', allMembers);
          setMembers(allMembers);
        }

        // Fetch pending invitations (only if user has permission)
        if (userRole === 'owner' || userRole === 'admin') {
          const { data: invitationsData, error: invitationsError } =
            await supabase
              .from('invitations')
              .select('*')
              .eq('workspace_id', workspaceId)
              .eq('status', 'pending')
              .order('created_at', { ascending: false });

          if (invitationsError) {
            console.error('Error fetching invitations:', invitationsError);
          } else {
            setInvitations(invitationsData || []);
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    if (workspaceId) {
      fetchData();
    }
  }, [workspaceId, router]);

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

  // Define permission flags
  const canInviteMembers =
    currentUserRole === 'owner' || currentUserRole === 'admin';
  const canManageMembers =
    currentUserRole === 'owner' || currentUserRole === 'admin';

  // Beautiful loading component
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
    <div className='min-h-screen dot-pattern-dark'>
      <DashboardHeader />
      <main className='container mx-auto max-w-4xl px-4 pt-24 pb-16'>
        <div className='space-y-6'>
          {/* Header skeleton */}
          <div className='flex items-center justify-between mb-8'>
            <div className='flex items-center gap-4'>
              <div className='w-8 h-8 bg-muted/50 rounded-lg animate-pulse'></div>
              <div className='space-y-2'>
                <div className='w-48 h-6 bg-muted/50 rounded animate-pulse'></div>
                <div className='w-64 h-4 bg-muted/50 rounded animate-pulse'></div>
              </div>
            </div>
            <div className='w-32 h-10 bg-muted/50 rounded animate-pulse'></div>
          </div>

          {/* Members card skeleton */}
          <div className='card p-6 space-y-4'>
            <div className='w-40 h-5 bg-muted/50 rounded animate-pulse'></div>
            <div className='space-y-3'>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className='flex items-center justify-between p-3 rounded-lg border border-border'
                >
                  <div className='flex items-center gap-3'>
                    <div className='w-8 h-8 bg-muted/50 rounded-full animate-pulse'></div>
                    <div className='space-y-2'>
                      <div className='w-32 h-4 bg-muted/50 rounded animate-pulse'></div>
                      <div className='w-48 h-3 bg-muted/50 rounded animate-pulse'></div>
                    </div>
                  </div>
                  <div className='flex items-center gap-3'>
                    <div className='w-16 h-6 bg-muted/50 rounded animate-pulse'></div>
                    <div className='w-16 h-8 bg-muted/50 rounded animate-pulse'></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) return;

    setIsInviting(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });

      if (response.ok) {
        setInviteEmail('');
        setShowInviteModal(false);
        showSuccess(`Invitation sent to ${inviteEmail.trim()}`);
        // Refresh invitations
        window.location.reload();
      } else {
        const error = await response.text();
        showError(`Failed to send invitation: ${error}`);
      }
    } catch (error) {
      console.error('Error sending invitation:', error);
      showError('Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  };

  const handleDebugInfo = () => {
    setShowDebugInfo(!showDebugInfo);

    if (!showDebugInfo) {
      console.log('=== WORKSPACE DEBUG INFO ===');
      console.log('Workspace ID:', workspaceId);
      console.log('Workspace Data:', workspace);
      console.log('Current User ID:', currentUser);
      console.log('Current User Role:', currentUserRole);
      console.log('Members Count:', members.length);
      console.log(
        'Members:',
        members.map((m) => ({
          id: m.id,
          profile_id: m.profile_id,
          role: m.role,
          email: m.profile.email,
          name: m.profile.full_name,
        }))
      );
      console.log('Invitations:', invitations);
      console.log('Can Invite Members:', canInviteMembers);
      console.log('Can Manage Members:', canManageMembers);
      console.log('=== END DEBUG INFO ===');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className='w-4 h-4 text-yellow-500' />;
      case 'admin':
        return <Shield className='w-4 h-4 text-blue-500' />;
      default:
        return <User className='w-4 h-4 text-gray-500' />;
    }
  };

  const getRoleBadge = (role: string) => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium';
    switch (role) {
      case 'owner':
        return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200`;
      case 'admin':
        return `${baseClasses} bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200`;
    }
  };

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'owner':
        return { icon: Crown, text: 'Owner', color: 'text-yellow-500' };
      case 'admin':
        return { icon: Shield, text: 'Admin', color: 'text-blue-500' };
      default:
        return { icon: User, text: 'Member', color: 'text-gray-500' };
    }
  };

  if (isLoading) {
    return <PageLoadingSkeleton />;
  }

  if (error || !workspace) {
    return (
      <div className='min-h-screen dot-pattern-dark'>
        <DashboardHeader />
        <main className='container mx-auto max-w-4xl px-4 pt-24 pb-16'>
          <div className='flex items-center justify-center h-64'>
            <div className='text-red-500'>{error || 'Workspace not found'}</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className='min-h-screen dot-pattern-dark'>
      <DashboardHeader />

      <main className='container mx-auto max-w-4xl px-4 pt-24 pb-16'>
        {/* Header */}
        <div className='flex items-center justify-between mb-8'>
          <div className='flex items-center gap-4'>
            <Link
              href={`/boards/${workspace.id}`}
              className='p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
              aria-label='Back to workspace'
            >
              <ArrowLeft className='w-5 h-5' />
            </Link>
            <div>
              <h1 className='text-2xl font-bold text-foreground'>
                {workspace.name} Members
              </h1>
              <p className='text-muted-foreground text-sm'>
                Manage workspace members and permissions
              </p>
            </div>
          </div>

          <div className='flex items-center gap-3'>
            {/* Debug Button */}
            <button
              onClick={handleDebugInfo}
              className={`btn ${
                showDebugInfo ? 'btn-secondary' : 'btn-ghost'
              } flex items-center gap-2`}
              title='Debug workspace members info'
            >
              <Bug className='w-4 h-4' />
              Debug
            </button>

            {canInviteMembers && (
              <button
                onClick={() => setShowInviteModal(true)}
                className='btn btn-primary flex items-center gap-2'
              >
                <UserPlus className='w-4 h-4' />
                Invite Members
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className='mb-8'>
          <div className='flex items-center gap-1 border-b border-border'>
            <span className='px-4 py-2 text-sm font-medium text-primary border-b-2 border-primary'>
              Members
            </span>
            <Link
              href={`/workspace/${workspaceId}/settings`}
              className='px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-b-2 hover:border-primary transition-colors'
            >
              Settings
            </Link>
          </div>
        </div>

        <div className='space-y-6'>
          {/* Debug Info Panel */}
          {showDebugInfo && (
            <div className='card p-6 bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800'>
              <h2 className='text-lg font-semibold mb-4 text-yellow-800 dark:text-yellow-200 flex items-center gap-2'>
                <Bug className='w-5 h-5' />
                Debug Information
              </h2>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4 text-sm'>
                <div>
                  <strong>Workspace:</strong>
                  <pre className='bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded mt-1 text-xs overflow-auto'>
                    {JSON.stringify(
                      {
                        id: workspace?.id,
                        name: workspace?.name,
                        owner_id: workspace?.owner_id,
                        color: workspace?.color,
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
                <div>
                  <strong>Current User:</strong>
                  <pre className='bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded mt-1 text-xs overflow-auto'>
                    {JSON.stringify(
                      {
                        user_id: currentUser,
                        role: currentUserRole,
                        can_invite: canInviteMembers,
                        can_manage: canManageMembers,
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
                <div className='md:col-span-2'>
                  <strong>Members ({members.length}):</strong>
                  <pre className='bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded mt-1 text-xs overflow-auto max-h-40'>
                    {JSON.stringify(
                      members.map((m) => ({
                        id: m.id,
                        profile_id: m.profile_id,
                        role: m.role,
                        email: m.profile.email,
                        name: m.profile.full_name,
                        created_at: m.created_at,
                      })),
                      null,
                      2
                    )}
                  </pre>
                </div>
                {invitations.length > 0 && (
                  <div className='md:col-span-2'>
                    <strong>Invitations ({invitations.length}):</strong>
                    <pre className='bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded mt-1 text-xs overflow-auto max-h-32'>
                      {JSON.stringify(invitations, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
              <p className='text-xs text-yellow-700 dark:text-yellow-300 mt-4'>
                💡 Check the browser console for detailed logs
              </p>
            </div>
          )}

          {/* Members List */}
          <div className='card p-6'>
            <h2 className='text-lg font-semibold mb-4'>
              Workspace members ({members.length})
            </h2>

            <div className='space-y-2'>
              {members.map((member) => {
                const roleInfo = getRoleDisplay(member.role);
                return (
                  <div
                    key={member.id}
                    className='flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors'
                  >
                    <div className='flex items-center gap-3'>
                      <div className='w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center'>
                        <span className='text-sm font-medium text-primary'>
                          {member.profile.full_name?.charAt(0) ||
                            member.profile.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className='font-medium text-foreground'>
                          {member.profile.full_name || member.profile.email}
                          {member.profile_id === currentUser && (
                            <span className='ml-2 text-xs text-muted-foreground'>
                              (You)
                            </span>
                          )}
                        </div>
                        <div className='text-sm text-muted-foreground'>
                          {member.profile.email}
                        </div>
                      </div>
                    </div>

                    <div className='flex items-center gap-3'>
                      <div className='flex items-center gap-2'>
                        <roleInfo.icon
                          className={`w-4 h-4 ${roleInfo.color}`}
                        />
                        <span className={getRoleBadge(member.role)}>
                          {roleInfo.text}
                        </span>
                      </div>
                      {canManageMembers &&
                        member.profile_id !== currentUser && (
                          <button className='px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors flex items-center gap-1'>
                            Change
                            <ChevronRight className='w-4 h-4' />
                          </button>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pending Invitations */}
          {canInviteMembers && invitations.length > 0 && (
            <div className='card p-6'>
              <h2 className='text-lg font-semibold mb-4'>
                Pending invitations ({invitations.length})
              </h2>

              <div className='space-y-2'>
                {invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className='flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors'
                  >
                    <div className='flex items-center gap-3'>
                      <div className='w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center'>
                        <Mail className='w-4 h-4 text-orange-600 dark:text-orange-400' />
                      </div>
                      <div>
                        <div className='font-medium text-foreground'>
                          {invitation.email}
                        </div>
                        <div className='text-sm text-muted-foreground'>
                          Invited{' '}
                          {new Date(invitation.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div className='flex items-center gap-3'>
                      <span className={getRoleBadge(invitation.role)}>
                        {invitation.role}
                      </span>
                      <span className='px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'>
                        Pending
                      </span>
                      <button className='px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors flex items-center gap-1'>
                        Cancel
                        <X className='w-4 h-4' />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-background border border-border rounded-lg p-6 w-full max-w-md mx-4'>
            <h3 className='text-lg font-semibold mb-4'>Invite Member</h3>

            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium mb-2'>
                  Email Address
                </label>
                <input
                  type='email'
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder='Enter email address'
                  className='w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary'
                />
              </div>

              <div>
                <label className='block text-sm font-medium mb-2'>Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(e.target.value as 'admin' | 'member')
                  }
                  className='w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary'
                  aria-label='Select role for new member'
                >
                  <option value='member'>Member</option>
                  <option value='admin'>Admin</option>
                </select>
              </div>
            </div>

            <div className='flex justify-end gap-3 mt-6'>
              <button
                onClick={() => setShowInviteModal(false)}
                className='px-4 py-2 text-muted-foreground hover:text-foreground'
              >
                Cancel
              </button>
              <button
                onClick={handleInviteMember}
                disabled={isInviting || !inviteEmail.trim()}
                className={`btn btn-primary flex items-center gap-2 transition-all duration-200 ${
                  isInviting ? 'scale-95 opacity-90' : 'hover:scale-105'
                } disabled:opacity-50`}
              >
                {isInviting ? (
                  <>
                    <LoadingSpinner size='sm' />
                    <span className='animate-pulse'>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className='w-4 h-4' />
                    Send Invitation
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
      {isInviting && (
        <div className='fixed inset-0 bg-black/10 backdrop-blur-sm z-[90] flex items-center justify-center'>
          <div className='bg-background/90 backdrop-blur border border-border rounded-lg p-6 shadow-xl'>
            <div className='flex items-center gap-4'>
              <LoadingSpinner size='lg' />
              <div>
                <p className='font-medium text-foreground'>
                  Sending invitation...
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
