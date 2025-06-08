'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  UserPlus,
  Crown,
  Shield,
  User,
  MoreHorizontal,
  Mail,
  Calendar,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowLeft,
  Search,
  Filter,
  Send,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Member {
  id: string;
  role: 'admin' | 'member' | 'guest';
  created_at: string;
  invited_by: string | null;
  profiles: Profile;
  inviter?: {
    full_name: string | null;
    email: string;
  } | null;
}

interface Invitation {
  id: string;
  email: string;
  role: 'admin' | 'member' | 'guest';
  created_at: string;
  expires_at: string;
  profiles: {
    full_name: string | null;
    email: string;
  };
}

interface Workspace {
  id: string;
  name: string;
  color: string;
}

type MemberFilter = 'all' | 'admin' | 'member' | 'guest';

export default function WorkspaceMembersPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;
  const supabase = createClient();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [userRole, setUserRole] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [memberFilter, setMemberFilter] = useState<MemberFilter>('all');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showMemberActions, setShowMemberActions] = useState<string | null>(
    null
  );

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'guest'>(
    'member'
  );
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string>('');

  useEffect(() => {
    fetchWorkspaceData();
    fetchMembers();
    getCurrentUser();
  }, [workspaceId]);

  const getCurrentUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  const fetchWorkspaceData = async () => {
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .select('id, name, color')
        .eq('id', workspaceId)
        .single();

      if (error) throw error;
      setWorkspace(data);
    } catch (err) {
      console.error('Error fetching workspace:', err);
      setError('Failed to load workspace data');
    }
  };

  const fetchMembers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/workspaces/${workspaceId}/members`);
      if (!response.ok) {
        throw new Error('Failed to fetch members');
      }

      const data = await response.json();
      setMembers(data.members || []);
      setInvitations(data.invitations || []);
      setUserRole(data.userRole || '');
    } catch (err) {
      console.error('Error fetching members:', err);
      setError('Failed to load members');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setIsInviting(true);
    setInviteError('');

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send invitation');
      }

      setInviteEmail('');
      setInviteRole('member');
      setShowInviteModal(false);
      fetchMembers(); // Refresh the member list
    } catch (err) {
      setInviteError(
        err instanceof Error ? err.message : 'Failed to send invitation'
      );
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateMemberRole = async (
    memberId: string,
    newRole: 'admin' | 'member' | 'guest'
  ) => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/members/${memberId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: newRole }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update member role');
      }

      fetchMembers(); // Refresh the member list
      setShowMemberActions(null);
    } catch (err) {
      console.error('Error updating member role:', err);
      alert(
        err instanceof Error ? err.message : 'Failed to update member role'
      );
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/members/${memberId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove member');
      }

      fetchMembers(); // Refresh the member list
      setShowMemberActions(null);
    } catch (err) {
      console.error('Error removing member:', err);
      alert(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) return;

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/invitations/${invitationId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel invitation');
      }

      fetchMembers(); // Refresh the lists
    } catch (err) {
      console.error('Error canceling invitation:', err);
      alert(err instanceof Error ? err.message : 'Failed to cancel invitation');
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/invitations/${invitationId}`,
        {
          method: 'PATCH',
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to resend invitation');
      }

      fetchMembers(); // Refresh the lists
    } catch (err) {
      console.error('Error resending invitation:', err);
      alert(err instanceof Error ? err.message : 'Failed to resend invitation');
    }
  };

  const filteredMembers = members.filter((member) => {
    const matchesSearch =
      !searchQuery ||
      member.profiles.full_name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      member.profiles.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      memberFilter === 'all' || member.role === memberFilter;

    return matchesSearch && matchesFilter;
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className='w-4 h-4 text-yellow-500' />;
      case 'member':
        return <User className='w-4 h-4 text-blue-500' />;
      case 'guest':
        return <Shield className='w-4 h-4 text-gray-500' />;
      default:
        return <User className='w-4 h-4 text-gray-500' />;
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'member':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'guest':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email[0].toUpperCase();
  };

  const canInviteMembers = userRole === 'admin';
  const canManageMembers = userRole === 'admin';

  if (isLoading) {
    return (
      <div className='flex flex-col items-center justify-center h-screen'>
        <Loader2 className='w-8 h-8 text-primary animate-spin' />
        <p className='mt-2 text-muted-foreground'>
          Loading workspace members...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex flex-col items-center justify-center h-screen'>
        <AlertCircle className='w-12 h-12 text-red-500 mb-4' />
        <h1 className='text-xl font-semibold text-foreground mb-2'>
          Error Loading Members
        </h1>
        <p className='text-muted-foreground mb-4'>{error}</p>
        <button
          onClick={() => window.location.reload()}
          className='px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90'
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className='container mx-auto max-w-6xl px-4 py-8'>
      {/* Header */}
      <div className='mb-8'>
        <div className='flex items-center gap-2 mb-4'>
          <Link
            href={`/#workspace-${workspaceId}`}
            className='text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2'
          >
            <ArrowLeft className='w-4 h-4' />
            {workspace?.name || 'Workspace'}
          </Link>
        </div>

        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <div className='flex items-center gap-3'>
              <div className='w-12 h-12 bg-primary rounded-lg flex items-center justify-center text-white text-lg font-bold'>
                <Users className='w-6 h-6' />
              </div>
              <div>
                <h1 className='text-3xl font-bold text-foreground'>Members</h1>
                <p className='text-muted-foreground'>
                  Manage workspace members and invitations
                </p>
              </div>
            </div>
          </div>

          {canInviteMembers && (
            <button
              onClick={() => setShowInviteModal(true)}
              className='flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors'
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

      {/* Search and Filters */}
      <div className='flex items-center gap-4 mb-6'>
        <div className='relative flex-1 max-w-md'>
          <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground' />
          <input
            type='text'
            placeholder='Search members...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='w-full pl-10 pr-4 py-2 bg-input border border-border rounded-md text-foreground'
          />
        </div>

        <div className='flex items-center gap-2'>
          <Filter className='w-4 h-4 text-muted-foreground' />
          <select
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value as MemberFilter)}
            className='bg-input border border-border rounded-md px-3 py-2 text-sm'
            aria-label='Filter members by role'
          >
            <option value='all'>All Roles</option>
            <option value='admin'>Admins</option>
            <option value='member'>Members</option>
            <option value='guest'>Guests</option>
          </select>
        </div>
      </div>

      <div className='grid gap-6'>
        {/* Members Section */}
        <div className='card p-6'>
          <div className='flex items-center justify-between mb-6'>
            <h2 className='text-xl font-semibold flex items-center gap-2'>
              <Users className='w-5 h-5' />
              Members ({filteredMembers.length})
            </h2>
          </div>

          <div className='space-y-3'>
            {filteredMembers.map((member) => (
              <div
                key={member.id}
                className='flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border hover:bg-muted/50 transition-colors'
              >
                <div className='flex items-center gap-4'>
                  <div className='w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center text-white font-semibold'>
                    {getInitials(
                      member.profiles.full_name,
                      member.profiles.email
                    )}
                  </div>

                  <div className='flex-1'>
                    <div className='flex items-center gap-2'>
                      <h3 className='font-medium text-foreground'>
                        {member.profiles.full_name || member.profiles.email}
                      </h3>
                      {member.profiles.id === currentUserId && (
                        <span className='px-2 py-1 text-xs bg-primary/10 text-primary rounded'>
                          You
                        </span>
                      )}
                    </div>
                    <p className='text-sm text-muted-foreground'>
                      {member.profiles.email}
                    </p>
                    <div className='flex items-center gap-2 mt-1'>
                      <span className='text-xs text-muted-foreground'>
                        Joined {formatDate(member.created_at)}
                      </span>
                      {member.inviter && (
                        <span className='text-xs text-muted-foreground'>
                          • Invited by{' '}
                          {member.inviter.full_name || member.inviter.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className='flex items-center gap-3'>
                  <div
                    className={`flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium ${getRoleBadgeClass(
                      member.role
                    )}`}
                  >
                    {getRoleIcon(member.role)}
                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                  </div>

                  {canManageMembers && member.profiles.id !== currentUserId && (
                    <div className='relative'>
                      <button
                        onClick={() =>
                          setShowMemberActions(
                            showMemberActions === member.id ? null : member.id
                          )
                        }
                        className='p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground'
                        title='Member actions'
                        aria-label='Member actions'
                      >
                        <MoreHorizontal className='w-4 h-4' />
                      </button>

                      {showMemberActions === member.id && (
                        <div className='absolute right-0 top-8 w-48 bg-background border border-border rounded-md shadow-lg py-1 z-10'>
                          <div className='px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border'>
                            Change Role
                          </div>
                          {(['admin', 'member', 'guest'] as const).map(
                            (role) => (
                              <button
                                key={role}
                                onClick={() =>
                                  handleUpdateMemberRole(
                                    member.profiles.id,
                                    role
                                  )
                                }
                                disabled={member.role === role}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 ${
                                  member.role === role
                                    ? 'opacity-50 cursor-not-allowed'
                                    : ''
                                }`}
                              >
                                {getRoleIcon(role)}
                                {role.charAt(0).toUpperCase() + role.slice(1)}
                                {member.role === role && (
                                  <CheckCircle className='w-3 h-3 ml-auto' />
                                )}
                              </button>
                            )
                          )}
                          <div className='border-t border-border mt-1'>
                            <button
                              onClick={() =>
                                handleRemoveMember(member.profiles.id)
                              }
                              className='w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2'
                            >
                              <Trash2 className='w-4 h-4' />
                              Remove Member
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {filteredMembers.length === 0 && (
              <div className='text-center py-12'>
                <Users className='w-12 h-12 text-muted-foreground mx-auto mb-4' />
                <h3 className='text-lg font-medium text-foreground mb-2'>
                  No members found
                </h3>
                <p className='text-muted-foreground'>
                  {searchQuery
                    ? 'Try adjusting your search or filters'
                    : 'This workspace has no members yet'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Pending Invitations Section */}
        {canInviteMembers && invitations.length > 0 && (
          <div className='card p-6'>
            <div className='flex items-center justify-between mb-6'>
              <h2 className='text-xl font-semibold flex items-center gap-2'>
                <Mail className='w-5 h-5' />
                Pending Invitations ({invitations.length})
              </h2>
            </div>

            <div className='space-y-3'>
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className='flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800'
                >
                  <div className='flex items-center gap-4'>
                    <div className='w-10 h-10 bg-yellow-100 dark:bg-yellow-900/40 rounded-full flex items-center justify-center'>
                      <Mail className='w-5 h-5 text-yellow-600 dark:text-yellow-400' />
                    </div>

                    <div className='flex-1'>
                      <h3 className='font-medium text-foreground'>
                        {invitation.email}
                      </h3>
                      <div className='flex items-center gap-2 text-sm text-muted-foreground mt-1'>
                        <span>Invited {formatDate(invitation.created_at)}</span>
                        <span>•</span>
                        <span>Expires {formatDate(invitation.expires_at)}</span>
                        <span>•</span>
                        <span>
                          By{' '}
                          {invitation.profiles.full_name ||
                            invitation.profiles.email}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className='flex items-center gap-3'>
                    <div
                      className={`flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium ${getRoleBadgeClass(
                        invitation.role
                      )}`}
                    >
                      {getRoleIcon(invitation.role)}
                      {invitation.role.charAt(0).toUpperCase() +
                        invitation.role.slice(1)}
                    </div>

                    <div className='flex items-center gap-2'>
                      <button
                        onClick={() => handleResendInvitation(invitation.id)}
                        className='p-1 hover:bg-yellow-100 dark:hover:bg-yellow-900/40 rounded text-yellow-600 dark:text-yellow-400'
                        title='Resend invitation'
                      >
                        <RefreshCw className='w-4 h-4' />
                      </button>
                      <button
                        onClick={() => handleCancelInvitation(invitation.id)}
                        className='p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded text-red-600 dark:text-red-400'
                        title='Cancel invitation'
                      >
                        <XCircle className='w-4 h-4' />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-background border border-border rounded-lg w-full max-w-md mx-4'>
            <div className='p-6'>
              <div className='flex items-center justify-between mb-4'>
                <h2 className='text-xl font-semibold flex items-center gap-2'>
                  <UserPlus className='w-5 h-5' />
                  Invite Member
                </h2>
                <button
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteError('');
                    setInviteEmail('');
                    setInviteRole('member');
                  }}
                  className='text-muted-foreground hover:text-foreground'
                  title='Close modal'
                  aria-label='Close modal'
                >
                  <XCircle className='w-5 h-5' />
                </button>
              </div>

              <form onSubmit={handleInviteMember} className='space-y-4'>
                <div>
                  <label className='block text-sm font-medium text-foreground mb-1'>
                    Email Address
                  </label>
                  <input
                    type='email'
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder='Enter email address'
                    required
                    className='w-full px-3 py-2 bg-input border border-border rounded-md text-foreground'
                  />
                </div>

                <div>
                  <label className='block text-sm font-medium text-foreground mb-1'>
                    Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(
                        e.target.value as 'admin' | 'member' | 'guest'
                      )
                    }
                    className='w-full px-3 py-2 bg-input border border-border rounded-md text-foreground'
                    aria-label='Select role for invitation'
                  >
                    <option value='member'>Member</option>
                    <option value='admin'>Admin</option>
                    <option value='guest'>Guest</option>
                  </select>
                  <p className='text-xs text-muted-foreground mt-1'>
                    {inviteRole === 'admin' &&
                      'Can manage workspace, members, and all boards'}
                    {inviteRole === 'member' &&
                      'Can view and edit boards, create new boards'}
                    {inviteRole === 'guest' &&
                      'Limited access to specific boards only'}
                  </p>
                </div>

                {inviteError && (
                  <div className='p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md'>
                    <p className='text-sm text-red-600 dark:text-red-400'>
                      {inviteError}
                    </p>
                  </div>
                )}

                <div className='flex gap-3 pt-4'>
                  <button
                    type='button'
                    onClick={() => {
                      setShowInviteModal(false);
                      setInviteError('');
                      setInviteEmail('');
                      setInviteRole('member');
                    }}
                    className='flex-1 px-4 py-2 border border-border rounded-md text-foreground hover:bg-muted transition-colors'
                  >
                    Cancel
                  </button>
                  <button
                    type='submit'
                    disabled={isInviting}
                    className='flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2'
                  >
                    {isInviting ? (
                      <>
                        <Loader2 className='w-4 h-4 animate-spin' />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className='w-4 h-4' />
                        Send Invitation
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close member actions */}
      {showMemberActions && (
        <div
          className='fixed inset-0 z-5'
          onClick={() => setShowMemberActions(null)}
        />
      )}
    </div>
  );
}
