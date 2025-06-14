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
  Trash2,
  UserMinus,
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
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [addMemberRole, setAddMemberRole] = useState<'admin' | 'member'>(
    'member'
  );
  const [isSearching, setIsSearching] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMember | null>(
    null
  );
  const [isRemovingMember, setIsRemovingMember] = useState(false);

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
  const canAddMembers =
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

  // Search for profiles
  const handleSearch = async (query: string) => {
    console.log('handleSearch called with query:', query);

    if (!query || query.length < 2) {
      console.log('Query too short, clearing results');
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const searchUrl = `/api/profiles/search?q=${encodeURIComponent(
        query
      )}&workspace_id=${workspaceId}`;
      console.log('Making request to:', searchUrl);

      const response = await fetch(searchUrl);
      console.log('Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Search response data:', data);
        setSearchResults(data.profiles || []);
      } else {
        const errorText = await response.text();
        console.error(
          'Failed to search profiles. Status:',
          response.status,
          'Error:',
          errorText
        );
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching profiles:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle adding a member
  const handleAddMember = async () => {
    if (!selectedMember) return;

    setIsAddingMember(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/add-member`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            profile_id: selectedMember.id,
            role: addMemberRole,
          }),
        }
      );

      if (response.ok) {
        setSearchQuery('');
        setSearchResults([]);
        setSelectedMember(null);
        setShowAddMemberModal(false);
        showSuccess(`${selectedMember.name} has been added to the workspace`);
        // Refresh the page to show new member
        window.location.reload();
      } else {
        const errorData = await response.json();
        showError(
          `Failed to add member: ${errorData.error || 'Unknown error'}`
        );
      }
    } catch (error) {
      console.error('Error adding member:', error);
      showError('Failed to add member');
    } finally {
      setIsAddingMember(false);
    }
  };

  // Handle removing a member
  const handleRemoveMember = async () => {
    if (!memberToRemove) return;

    console.log('Removing member:', {
      memberToRemove,
      workspaceId,
      profile_id: memberToRemove.profile_id,
    });

    setIsRemovingMember(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/remove-member`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            profile_id: memberToRemove.profile_id,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setShowRemoveConfirm(false);
        setMemberToRemove(null);
        showSuccess(
          `${
            memberToRemove.profile.full_name || memberToRemove.profile.email
          } has been removed from the workspace`
        );
        // Refresh the page to show updated members list
        window.location.reload();
      } else {
        const errorData = await response.json();
        showError(
          `Failed to remove member: ${errorData.error || 'Unknown error'}`
        );
      }
    } catch (error) {
      console.error('Error removing member:', error);
      showError('Failed to remove member');
    } finally {
      setIsRemovingMember(false);
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
      console.log('Can Add Members:', canAddMembers);
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

            {canAddMembers && (
              <button
                onClick={() => setShowAddMemberModal(true)}
                className='btn btn-primary flex items-center gap-2'
              >
                <UserPlus className='w-4 h-4' />
                Add Members
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
                        can_add_members: canAddMembers,
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
                          <div className='flex items-center gap-2'>
                            <button className='px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors flex items-center gap-1'>
                              Change
                              <ChevronRight className='w-4 h-4' />
                            </button>
                            {/* Only show remove button for owners/admins, and prevent removing last owner */}
                            {['owner', 'admin'].includes(currentUserRole) &&
                              !(
                                member.role === 'owner' &&
                                members.filter((m) => m.role === 'owner')
                                  .length <= 1
                              ) && (
                                <button
                                  onClick={() => {
                                    console.log(
                                      'Setting member to remove:',
                                      member
                                    );
                                    setMemberToRemove(member);
                                    setShowRemoveConfirm(true);
                                  }}
                                  className='px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-1'
                                  title={`Remove ${
                                    member.profile.full_name ||
                                    member.profile.email
                                  } from workspace (ID: ${member.profile_id})`}
                                >
                                  <UserMinus className='w-4 h-4' />
                                  Remove
                                </button>
                              )}
                          </div>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pending Invitations */}
          {canAddMembers && invitations.length > 0 && (
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

      {/* Add Member Modal - Modern & Beautiful */}
      {showAddMemberModal && (
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
                  onClick={() => {
                    setShowAddMemberModal(false);
                    setSearchQuery('');
                    setSearchResults([]);
                    setSelectedMember(null);
                  }}
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
                    type='text'
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      handleSearch(e.target.value);
                    }}
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
                      onClick={() => {
                        setSearchQuery('');
                        setSearchResults([]);
                        setSelectedMember(null);
                      }}
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
                    {isSearching ? (
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
                    ) : searchResults.length > 0 ? (
                      <div className='max-h-64 overflow-y-auto'>
                        <div className='p-2 space-y-1'>
                          {searchResults.map((profile) => (
                            <button
                              key={profile.id}
                              onClick={() => setSelectedMember(profile)}
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
                    ) : (
                      <div className='p-8 text-center'>
                        <div className='flex flex-col items-center gap-3'>
                          <div className='w-12 h-12 rounded-full bg-muted/20 flex items-center justify-center'>
                            <Users className='w-6 h-6 text-muted-foreground' />
                          </div>
                          <div>
                            <p className='font-medium text-foreground'>
                              No users found
                            </p>
                            <p className='text-sm text-muted-foreground'>
                              Try adjusting your search terms
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
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
                      <button
                        onClick={() => setAddMemberRole('member')}
                        className={`group relative p-4 rounded-xl border-2 transition-all duration-300 text-left ${
                          addMemberRole === 'member'
                            ? 'border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-lg shadow-primary/20'
                            : 'border-border/50 hover:border-border bg-background/50 hover:bg-background/80 hover:shadow-md'
                        }`}
                      >
                        <div className='flex flex-col items-center text-center space-y-3'>
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                              addMemberRole === 'member'
                                ? 'bg-primary/20 text-primary'
                                : 'bg-muted/50 text-muted-foreground group-hover:bg-muted/80'
                            }`}
                          >
                            <User className='w-6 h-6' />
                          </div>
                          <div>
                            <div
                              className={`font-semibold text-base transition-colors ${
                                addMemberRole === 'member'
                                  ? 'text-primary'
                                  : 'text-foreground'
                              }`}
                            >
                              Member
                            </div>
                            <div
                              className={`text-xs transition-colors ${
                                addMemberRole === 'member'
                                  ? 'text-primary/80'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              Basic access
                            </div>
                          </div>
                          {addMemberRole === 'member' && (
                            <div className='absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center'>
                              <Check className='w-3 h-3 text-primary-foreground' />
                            </div>
                          )}
                        </div>
                      </button>

                      <button
                        onClick={() => setAddMemberRole('admin')}
                        className={`group relative p-4 rounded-xl border-2 transition-all duration-300 text-left ${
                          addMemberRole === 'admin'
                            ? 'border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-lg shadow-primary/20'
                            : 'border-border/50 hover:border-border bg-background/50 hover:bg-background/80 hover:shadow-md'
                        }`}
                      >
                        <div className='flex flex-col items-center text-center space-y-3'>
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                              addMemberRole === 'admin'
                                ? 'bg-primary/20 text-primary'
                                : 'bg-muted/50 text-muted-foreground group-hover:bg-muted/80'
                            }`}
                          >
                            <Shield className='w-6 h-6' />
                          </div>
                          <div>
                            <div
                              className={`font-semibold text-base transition-colors ${
                                addMemberRole === 'admin'
                                  ? 'text-primary'
                                  : 'text-foreground'
                              }`}
                            >
                              Admin
                            </div>
                            <div
                              className={`text-xs transition-colors ${
                                addMemberRole === 'admin'
                                  ? 'text-primary/80'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              Full access
                            </div>
                          </div>
                          {addMemberRole === 'admin' && (
                            <div className='absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center'>
                              <Check className='w-3 h-3 text-primary-foreground' />
                            </div>
                          )}
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className='flex-shrink-0 bg-gradient-to-r from-muted/20 to-transparent p-6 border-t border-border/50'>
              <div className='flex justify-end gap-3'>
                <button
                  onClick={() => {
                    setShowAddMemberModal(false);
                    setSearchQuery('');
                    setSearchResults([]);
                    setSelectedMember(null);
                  }}
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
                    {getRoleDisplay(memberToRemove.role).text}
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

      {/* Global Loading Overlay for Critical Actions */}
      {(isAddingMember || isRemovingMember) && (
        <div className='fixed inset-0 bg-black/10 backdrop-blur-sm z-[90] flex items-center justify-center'>
          <div className='bg-background/90 backdrop-blur border border-border rounded-lg p-6 shadow-xl'>
            <div className='flex items-center gap-4'>
              <Loader2 className='w-8 h-8 animate-spin' />
              <div>
                <p className='font-medium text-foreground'>
                  {isAddingMember ? 'Adding member...' : 'Removing member...'}
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
