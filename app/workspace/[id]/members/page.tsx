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
  Trash2,
  UserMinus,
  MoreHorizontal,
} from 'lucide-react';
import Link from 'next/link';
import { canUserInviteMembers } from '@/utils/permissions';

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

type WorkspaceSettings = {
  membership_restriction: 'anyone' | 'admins_only' | 'owner_only';
  board_creation_simplified: 'any_member' | 'admins_only' | 'owner_only';
  board_deletion_simplified: 'any_member' | 'admins_only' | 'owner_only';
};

type Workspace = {
  id: string;
  name: string;
  color: string;
  owner_id: string;
  settings?: WorkspaceSettings;
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

  // Simple back navigation using browser history
  const handleGoBack = () => {
    router.back();
  };

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaceSettings, setWorkspaceSettings] =
    useState<WorkspaceSettings | null>(null);
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

  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMember | null>(
    null
  );
  const [isRemovingMember, setIsRemovingMember] = useState(false);

  // Change role modal states
  const [showChangeRoleModal, setShowChangeRoleModal] = useState(false);
  const [memberToChangeRole, setMemberToChangeRole] =
    useState<WorkspaceMember | null>(null);
  const [newRole, setNewRole] = useState<'admin' | 'member'>('member');
  const [isChangingRole, setIsChangingRole] = useState(false);

  // Member actions dropdown states
  const [openMemberActions, setOpenMemberActions] = useState<string | null>(
    null
  );

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

        // Fetch workspace settings - match the pattern from settings page
        const { data: settingsData, error: settingsError } = await supabase
          .from('workspace_settings')
          .select('setting_type, setting_value')
          .eq('workspace_id', workspaceId);

        console.log('Raw workspace settings data:', {
          settingsData,
          settingsError,
        });

        if (!settingsError && settingsData) {
          // Process settings data similar to settings page
          const processedSettings = {
            membership_restriction: 'admins_only',
            board_creation_simplified: 'any_member',
            board_deletion_simplified: 'any_member',
          };

          settingsData.forEach((setting) => {
            const settingType = setting.setting_type;

            if (settingType === 'membership_restriction') {
              let value;
              try {
                if (typeof setting.setting_value === 'string') {
                  value = JSON.parse(setting.setting_value);
                } else {
                  value = setting.setting_value;
                }
              } catch (error) {
                console.error('Error parsing membership_restriction:', error);
                value = 'admins_only';
              }
              processedSettings.membership_restriction = value;
            }
            // Add other settings processing if needed later
          });

          console.log('Processed workspace settings:', processedSettings);
          setWorkspaceSettings(processedSettings);
        } else {
          console.log('No workspace settings found or error:', settingsError);
        }

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

        if (membersError) {
          console.error('Error fetching members:', membersError);
          setMembers([]); // Set empty array on error
        } else {
          let allMembers = membersData || [];

          // Fetch all profiles for the members
          if (allMembers.length > 0) {
            const profileIds = allMembers.map((m) => m.profile_id);
            const { data: profilesData, error: profilesError } = await supabase
              .from('profiles')
              .select('*')
              .in('id', profileIds);

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

          // Ensure workspace owner is always included in the members list
          const ownerExists = allMembers.some(
            (member) => member.profile_id === workspaceData.owner_id
          );

          if (!ownerExists) {
            // Fetch owner's profile
            const { data: ownerProfile, error: ownerProfileError } =
              await supabase
                .from('profiles')
                .select('*')
                .eq('id', workspaceData.owner_id)
                .single();

            if (!ownerProfileError && ownerProfile) {
              // Add owner to members list
              const ownerMember: WorkspaceMember = {
                id: `owner-${workspaceData.owner_id}`, // synthetic ID
                workspace_id: workspaceId,
                profile_id: workspaceData.owner_id,
                role: 'owner',
                created_at:
                  workspaceData.created_at || new Date().toISOString(),
                profile: ownerProfile,
              };
              allMembers.unshift(ownerMember); // Add owner at the beginning
            }
          }

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

  // Handle mobile back button/gesture for modals
  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    if (!isMobile) return;

    const handlePopState = () => {
      // Close modals in order of priority
      if (showChangeRoleModal) {
        setShowChangeRoleModal(false);
        setMemberToChangeRole(null);
      } else if (showRemoveConfirm) {
        setShowRemoveConfirm(false);
        setMemberToRemove(null);
      } else if (showAddMemberModal) {
        setShowAddMemberModal(false);
        setSearchQuery('');
        setSearchResults([]);
        setSelectedMember(null);
      }
    };

    // Add history state when any modal opens
    if (showChangeRoleModal || showRemoveConfirm || showAddMemberModal) {
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [showChangeRoleModal, showRemoveConfirm, showAddMemberModal]);

  // Handle ESC key for desktop only
  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    if (isMobile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Close modals in order of priority
        if (showChangeRoleModal) {
          setShowChangeRoleModal(false);
          setMemberToChangeRole(null);
        } else if (showRemoveConfirm) {
          setShowRemoveConfirm(false);
          setMemberToRemove(null);
        } else if (showAddMemberModal) {
          setShowAddMemberModal(false);
          setSearchQuery('');
          setSearchResults([]);
          setSelectedMember(null);
        }
      }
    };

    if (showChangeRoleModal || showRemoveConfirm || showAddMemberModal) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [showChangeRoleModal, showRemoveConfirm, showAddMemberModal]);

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
  }, [openMemberActions]);

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

  // Define permission flags based on workspace settings
  const canAddMembers = canUserInviteMembers(
    workspaceSettings,
    currentUserRole as 'owner' | 'admin' | 'member'
  );

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
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const searchUrl = `/api/profiles/search?q=${encodeURIComponent(
        query
      )}&workspace_id=${workspaceId}`;

      const response = await fetch(searchUrl);

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.profiles || []);
      } else {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Unknown error' }));

        // Show specific error messages to help debug
        if (response.status === 403) {
          showError(
            'Permission denied. You may not have access to search members.'
          );
        } else if (response.status === 404) {
          showError('Workspace not found.');
        } else {
          showError(`Search failed: ${errorData.error || 'Unknown error'}`);
        }
        setSearchResults([]);
      }
    } catch (error) {
      showError('Network error while searching profiles');
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

  const handleChangeRole = async () => {
    if (!memberToChangeRole) return;

    setIsChangingRole(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/members/${memberToChangeRole.profile_id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            role: newRole,
          }),
        }
      );

      if (response.ok) {
        // Update the member's role in the local state
        setMembers((prevMembers) =>
          prevMembers.map((member) =>
            member.profile_id === memberToChangeRole.profile_id
              ? { ...member, role: newRole }
              : member
          )
        );

        showSuccess(
          `${
            memberToChangeRole.profile.full_name ||
            memberToChangeRole.profile.email
          }'s role changed to ${newRole}`
        );
        setShowChangeRoleModal(false);
        setMemberToChangeRole(null);
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to change member role');
      }
    } catch (error) {
      console.error('Error changing member role:', error);
      showError('Failed to change member role');
    } finally {
      setIsChangingRole(false);
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
        <main className='container mx-auto max-w-4xl px-3 sm:px-4 pt-16 sm:pt-24 pb-8 sm:pb-16'>
          <div className='flex items-center justify-center h-64'>
            <div className='text-red-500 text-center text-sm sm:text-base px-4'>
              {error || 'Workspace not found'}
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
            {/* Title with back button - prominent on mobile */}
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

            {/* Description - subtle on mobile */}
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

          {/* Actions - always accessible */}
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
              {members.map((member) => {
                const roleInfo = getRoleDisplay(member.role);
                return (
                  <div
                    key={member.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-border transition-colors gap-3 sm:gap-0 ${
                      // Make clickable on mobile if user can manage this member
                      canManageMembers &&
                      member.profile_id !== currentUser &&
                      member.role !== 'owner' &&
                      (currentUserRole === 'owner' ||
                        (currentUserRole === 'admin' &&
                          member.role === 'member'))
                        ? 'sm:hover:bg-muted/50 active:bg-muted/50 cursor-pointer sm:cursor-default'
                        : 'hover:bg-muted/50 cursor-default'
                    }`}
                    onClick={() => {
                      // Only handle click on mobile for manageable members
                      const isMobile = window.innerWidth < 640; // sm breakpoint
                      if (
                        isMobile &&
                        canManageMembers &&
                        member.profile_id !== currentUser &&
                        member.role !== 'owner' &&
                        (currentUserRole === 'owner' ||
                          (currentUserRole === 'admin' &&
                            member.role === 'member'))
                      ) {
                        setMemberToChangeRole(member);
                        setNewRole(
                          member.role === 'admin' ? 'member' : 'admin'
                        );
                        setShowChangeRoleModal(true);
                      }
                    }}
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
                        <span
                          className={`${getRoleBadge(member.role)} text-xs`}
                        >
                          {roleInfo.text}
                        </span>
                      </div>

                      {/* Mobile tap hint for manageable members */}
                      {canManageMembers &&
                        member.profile_id !== currentUser &&
                        member.role !== 'owner' &&
                        (currentUserRole === 'owner' ||
                          (currentUserRole === 'admin' &&
                            member.role === 'member')) && (
                          <div className='sm:hidden text-xs text-muted-foreground/70'>
                            Tap to change role
                          </div>
                        )}

                      {/* Member Actions Dropdown - Desktop only */}
                      {canManageMembers &&
                        member.profile_id !== currentUser &&
                        member.role !== 'owner' &&
                        (currentUserRole === 'owner' ||
                          (currentUserRole === 'admin' &&
                            member.role === 'member')) && (
                          <div
                            className='relative hidden sm:block'
                            data-member-actions
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent triggering the card click
                                setOpenMemberActions(
                                  openMemberActions === member.id
                                    ? null
                                    : member.id
                                );
                              }}
                              className='p-1.5 sm:p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
                              title='Member actions'
                            >
                              <MoreHorizontal className='w-3.5 h-3.5 sm:w-4 sm:h-4' />
                            </button>

                            {/* Dropdown Menu */}
                            {openMemberActions === member.id && (
                              <div className='absolute right-0 top-full mt-1 w-36 bg-background border border-border rounded-lg shadow-lg z-10 py-1'>
                                {/* Change Role Option - Frontend permission check */}
                                {member.role !== 'owner' &&
                                  (currentUserRole === 'owner' ||
                                    (currentUserRole === 'admin' &&
                                      member.role === 'member')) && (
                                    <button
                                      onClick={() => {
                                        setMemberToChangeRole(member);
                                        setNewRole(
                                          member.role === 'admin'
                                            ? 'member'
                                            : 'admin'
                                        );
                                        setShowChangeRoleModal(true);
                                        setOpenMemberActions(null);
                                      }}
                                      className='w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors flex items-center gap-2'
                                    >
                                      <Shield className='w-3 h-3' />
                                      Change Role
                                    </button>
                                  )}

                                {/* Remove Option - Frontend permission check */}
                                {(currentUserRole === 'owner' ||
                                  (currentUserRole === 'admin' &&
                                    member.role === 'member')) &&
                                  !(
                                    member.role === 'owner' &&
                                    members.filter((m) => m.role === 'owner')
                                      .length <= 1
                                  ) && (
                                    <button
                                      onClick={() => {
                                        setMemberToRemove(member);
                                        setShowRemoveConfirm(true);
                                        setOpenMemberActions(null);
                                      }}
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
                    Current role: {getRoleDisplay(memberToChangeRole.role).text}
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
                        {getRoleIcon(role)}
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

      {/* Global Loading Overlay for Critical Actions */}
      {(isAddingMember || isRemovingMember || isChangingRole) && (
        <div className='fixed inset-0 bg-black/10 backdrop-blur-sm z-[90] flex items-center justify-center'>
          <div className='bg-background/90 backdrop-blur border border-border rounded-lg p-6 shadow-xl'>
            <div className='flex items-center gap-4'>
              <Loader2 className='w-8 h-8 animate-spin' />
              <div>
                <p className='font-medium text-foreground'>
                  {isAddingMember
                    ? 'Adding member...'
                    : isRemovingMember
                    ? 'Removing member...'
                    : 'Changing role...'}
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
