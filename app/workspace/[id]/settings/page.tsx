'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  Share2,
  AlertCircle,
  Info,
  Crown,
  Shield,
  User,
  ChevronRight,
  X,
  Loader2,
  Palette,
} from 'lucide-react';
import Link from 'next/link';

// Predefined workspace colors matching the create workspace modal
const workspaceColors = [
  { name: 'Blue', value: 'bg-blue-600' },
  { name: 'Purple', value: 'bg-purple-600' },
  { name: 'Green', value: 'bg-green-600' },
  { name: 'Red', value: 'bg-red-600' },
  { name: 'Yellow', value: 'bg-yellow-600' },
];

type WorkspaceSettings = {
  membership_restriction: 'anyone' | 'admins_only' | 'owner_only';
  board_creation_restriction: {
    public_boards: 'any_member' | 'admins_only' | 'owner_only';
    workspace_visible_boards: 'any_member' | 'admins_only' | 'owner_only';
    private_boards: 'any_member' | 'admins_only' | 'owner_only';
  };
  board_deletion_restriction: {
    public_boards: 'any_member' | 'admins_only' | 'owner_only';
    workspace_visible_boards: 'any_member' | 'admins_only' | 'owner_only';
    private_boards: 'any_member' | 'admins_only' | 'owner_only';
  };
  board_sharing_restriction: 'anyone' | 'admins_only' | 'owner_only';
};

type WorkspaceData = {
  id: string;
  name: string;
  color: string;
  owner_id: string;
  visibility: 'private' | 'public';
};

export default function WorkspaceSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [settings, setSettings] = useState<WorkspaceSettings>({
    membership_restriction: 'anyone',
    board_creation_restriction: {
      public_boards: 'any_member',
      workspace_visible_boards: 'any_member',
      private_boards: 'any_member',
    },
    board_deletion_restriction: {
      public_boards: 'any_member',
      workspace_visible_boards: 'any_member',
      private_boards: 'any_member',
    },
    board_sharing_restriction: 'anyone',
  });

  // Modal states
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [showCreationModal, setShowCreationModal] = useState(false);
  const [showDeletionModal, setShowDeletionModal] = useState(false);
  const [showSharingModal, setShowSharingModal] = useState(false);
  const [showWorkspaceEditModal, setShowWorkspaceEditModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Workspace edit form state
  const [editWorkspaceName, setEditWorkspaceName] = useState('');
  const [editWorkspaceColor, setEditWorkspaceColor] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [customColor, setCustomColor] = useState('#3B82F6');
  const [editField, setEditField] = useState<'name' | 'color' | null>(null);
  const colorPickerRef = useRef<HTMLInputElement>(null);

  // Function to check if color is a hex code or tailwind class
  const getColorDisplay = (color: string) => {
    if (color?.startsWith('#') || color?.startsWith('rgb')) {
      return {
        isCustom: true,
        style: { backgroundColor: color },
        className: '',
      };
    }
    return {
      isCustom: false,
      style: {},
      className: color || 'bg-blue-600',
    };
  };

  // Fetch workspace data and settings
  useEffect(() => {
    const fetchWorkspaceData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const supabase = createClient();

        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.push('/auth/login');
          return;
        }

        // Fetch workspace data
        const { data: workspaceData, error: workspaceError } = await supabase
          .from('workspaces')
          .select('*')
          .eq('id', workspaceId)
          .single();

        if (workspaceError) {
          throw new Error(workspaceError.message);
        }

        if (!workspaceData) {
          throw new Error('Workspace not found');
        }

        setWorkspace(workspaceData);

        // Check user's role in the workspace
        const { data: memberData, error: memberError } = await supabase
          .from('workspace_members')
          .select('role')
          .eq('workspace_id', workspaceId)
          .eq('profile_id', user.id)
          .single();

        if (memberError && memberError.code !== 'PGRST116') {
          throw new Error(memberError.message);
        }

        // Set user role - check if user is owner first, then check membership
        if (workspaceData.owner_id === user.id) {
          setUserRole('owner');
        } else if (memberData) {
          setUserRole(memberData.role);
        } else {
          router.push('/');
          return;
        }

        // Fetch workspace settings
        const { data: settingsData, error: settingsError } = await supabase
          .from('workspace_settings')
          .select('setting_type, setting_value')
          .eq('workspace_id', workspaceId);

        if (settingsError) {
          throw new Error(settingsError.message);
        }

        // Process settings data
        const processedSettings = { ...settings };

        if (settingsData && settingsData.length > 0) {
          settingsData.forEach((setting) => {
            const settingType = setting.setting_type as keyof WorkspaceSettings;

            if (
              settingType === 'membership_restriction' ||
              settingType === 'board_sharing_restriction'
            ) {
              let value;
              try {
                if (typeof setting.setting_value === 'string') {
                  value = JSON.parse(setting.setting_value);
                } else {
                  value = setting.setting_value;
                }
              } catch (error) {
                value = processedSettings[settingType];
              }
              processedSettings[settingType] = value;
            } else if (
              settingType === 'board_creation_restriction' ||
              settingType === 'board_deletion_restriction'
            ) {
              let value;
              try {
                if (typeof setting.setting_value === 'string') {
                  value = JSON.parse(setting.setting_value);
                } else {
                  value = setting.setting_value;
                }
              } catch (error) {
                value = processedSettings[settingType];
              }
              processedSettings[settingType] = value;
            }
          });
        }

        setSettings(processedSettings);

        // Initialize edit form with current workspace data
        setEditWorkspaceName(workspaceData.name);
        setEditWorkspaceColor(workspaceData.color);

        // Initialize color selection state
        const isCustomColor =
          workspaceData.color?.startsWith('#') ||
          workspaceData.color?.startsWith('rgb');
        if (isCustomColor) {
          setSelectedColor('custom');
          setCustomColor(workspaceData.color);
        } else {
          setSelectedColor(workspaceData.color || 'bg-blue-600');
        }
      } catch (err) {
        console.error('Error fetching workspace data:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'An error occurred while fetching workspace data'
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkspaceData();
  }, [workspaceId, router]);

  const canUpdateSettings = userRole === 'admin' || userRole === 'owner';

  // Function to update workspace visibility
  const updateWorkspaceVisibility = async (
    newVisibility: 'private' | 'public'
  ) => {
    if (!canUpdateSettings) return;

    setIsUpdating(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('workspaces')
        .update({ visibility: newVisibility })
        .eq('id', workspaceId);

      if (error) throw error;

      setWorkspace((prev) =>
        prev ? { ...prev, visibility: newVisibility } : null
      );
      setShowVisibilityModal(false);
    } catch (error) {
      console.error('Error updating workspace visibility:', error);
      alert('Failed to update workspace visibility');
    } finally {
      setIsUpdating(false);
    }
  };

  // Function to update workspace settings
  const updateWorkspaceSetting = async (
    settingType: keyof WorkspaceSettings,
    settingValue: any
  ) => {
    if (!canUpdateSettings) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          settingType,
          settingValue,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      setSettings((prev) => ({
        ...prev,
        [settingType]: settingValue,
      }));

      // Close modals
      setShowMembershipModal(false);
      setShowCreationModal(false);
      setShowDeletionModal(false);
      setShowSharingModal(false);
    } catch (error) {
      console.error('Error updating workspace setting:', error);
      alert('Failed to update setting');
    } finally {
      setIsUpdating(false);
    }
  };

  // Function to update workspace details (name and color)
  const updateWorkspaceDetails = async () => {
    if (!canUpdateSettings) return;

    // Validate based on edit field
    if (editField === 'name' && !editWorkspaceName.trim()) return;

    setIsUpdating(true);
    try {
      const supabase = createClient();

      let updateData: any = {};

      if (editField === 'name') {
        updateData.name = editWorkspaceName.trim();
      } else if (editField === 'color') {
        const colorValue =
          selectedColor === 'custom' ? customColor : selectedColor;
        updateData.color = colorValue;
      }

      const { error } = await supabase
        .from('workspaces')
        .update(updateData)
        .eq('id', workspaceId);

      if (error) throw error;

      setWorkspace((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          ...updateData,
        };
      });

      setShowWorkspaceEditModal(false);
      setEditField(null);
    } catch (error) {
      console.error('Error updating workspace details:', error);
      alert('Failed to update workspace details');
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle custom color selection
  const handleCustomColorClick = () => {
    if (colorPickerRef.current) {
      colorPickerRef.current.click();
    }
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomColor(e.target.value);
    setSelectedColor('custom');
    setEditWorkspaceColor(e.target.value);
  };

  const handleColorSelection = (color: string) => {
    setSelectedColor(color);
    setEditWorkspaceColor(color);
  };

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'owner_only':
        return { icon: Crown, text: 'Owner only', color: 'text-yellow-500' };
      case 'admins_only':
        return { icon: Shield, text: 'Admins only', color: 'text-blue-500' };
      case 'any_member':
        return { icon: User, text: 'Any member', color: 'text-gray-500' };
      case 'anyone':
        return {
          icon: Globe,
          text: 'Anyone in workspace',
          color: 'text-green-500',
        };
      default:
        return { icon: User, text: 'Any member', color: 'text-gray-500' };
    }
  };

  const getVisibilityDisplay = (visibility: string) => {
    return visibility === 'public'
      ? {
          icon: Globe,
          text: 'Public',
          description: 'This workspace is public. Anyone can view boards.',
          color: 'text-green-500',
        }
      : {
          icon: Lock,
          text: 'Private',
          description:
            'This workspace is private. Only invited members can access.',
          color: 'text-gray-500',
        };
  };

  if (isLoading) {
    return (
      <div className='min-h-screen dot-pattern-dark'>
        <DashboardHeader />
        <main className='container mx-auto max-w-4xl px-4 pt-24 pb-16'>
          <div className='flex items-center justify-center h-64'>
            <div className='text-muted-foreground'>Loading...</div>
          </div>
        </main>
      </div>
    );
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

  if (!canUpdateSettings) {
    return (
      <div className='min-h-screen dot-pattern-dark'>
        <DashboardHeader />
        <main className='container mx-auto max-w-4xl px-4 pt-24 pb-16'>
          <div className='flex items-center justify-center h-64'>
            <div className='text-red-500'>
              You don't have permission to manage this workspace
            </div>
          </div>
        </main>
      </div>
    );
  }

  const visibilityInfo = getVisibilityDisplay(workspace.visibility);
  const membershipInfo = getRoleDisplay(settings.membership_restriction);

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
                {workspace.name} Settings
              </h1>
              <p className='text-muted-foreground text-sm'>
                Manage workspace permissions and access controls
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className='mb-8'>
          <div className='flex items-center gap-1 border-b border-border'>
            <Link
              href={`/workspace/${workspaceId}/members`}
              className='px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-b-2 hover:border-primary transition-colors'
            >
              Members
            </Link>
            <span className='px-4 py-2 text-sm font-medium text-primary border-b-2 border-primary'>
              Settings
            </span>
          </div>
        </div>

        <div className='space-y-6'>
          {/* Current User Role Info */}
          {userRole && (
            <div className='card p-4 bg-primary/5 border-primary/20'>
              <div className='flex items-center gap-3'>
                <div className='flex items-center gap-2'>
                  {userRole === 'owner' && (
                    <Crown className='w-4 h-4 text-yellow-500' />
                  )}
                  {userRole === 'admin' && (
                    <Shield className='w-4 h-4 text-blue-500' />
                  )}
                  {userRole === 'member' && (
                    <User className='w-4 h-4 text-gray-500' />
                  )}
                  <span className='text-sm font-medium'>
                    You are{' '}
                    {userRole === 'owner'
                      ? 'the owner'
                      : userRole === 'admin'
                      ? 'an admin'
                      : 'a member'}{' '}
                    of this workspace
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Workspace Details */}
          <div className='card p-6'>
            <h2 className='text-lg font-semibold mb-4'>Workspace details</h2>

            <div className='space-y-3'>
              {/* Workspace Name */}
              <div className='flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors'>
                <div className='flex items-center gap-3'>
                  <div className='w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center'>
                    <span className='text-sm font-medium text-primary'>
                      {workspace?.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className='font-medium text-foreground'>
                      {workspace?.name}
                    </div>
                    <div className='text-sm text-muted-foreground'>
                      Workspace name
                    </div>
                  </div>
                </div>
                {canUpdateSettings && (
                  <button
                    onClick={() => {
                      setEditField('name');
                      setEditWorkspaceName(workspace?.name || '');
                      setShowWorkspaceEditModal(true);
                    }}
                    className='px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors flex items-center gap-1'
                  >
                    Edit
                    <ChevronRight className='w-4 h-4' />
                  </button>
                )}
              </div>

              {/* Workspace Color */}
              <div className='flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors'>
                <div className='flex items-center gap-3'>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      getColorDisplay(workspace?.color || '').isCustom
                        ? ''
                        : getColorDisplay(workspace?.color || '').className
                    }`}
                    style={
                      getColorDisplay(workspace?.color || '').isCustom
                        ? getColorDisplay(workspace?.color || '').style
                        : {}
                    }
                  >
                    <span className='text-sm font-medium text-white'>
                      {workspace?.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className='font-medium text-foreground'>
                      {workspace?.color}
                    </div>
                    <div className='text-sm text-muted-foreground'>
                      Workspace color
                    </div>
                  </div>
                </div>
                {canUpdateSettings && (
                  <button
                    onClick={() => {
                      setEditField('color');
                      setEditWorkspaceColor(workspace?.color || '');
                      // Initialize color selection state
                      const isCustomColor =
                        workspace?.color?.startsWith('#') ||
                        workspace?.color?.startsWith('rgb');
                      if (isCustomColor) {
                        setSelectedColor('custom');
                        setCustomColor(workspace?.color || '#3B82F6');
                      } else {
                        setSelectedColor(workspace?.color || 'bg-blue-600');
                      }
                      setShowWorkspaceEditModal(true);
                    }}
                    className='px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors flex items-center gap-1'
                  >
                    Edit
                    <ChevronRight className='w-4 h-4' />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Workspace Visibility */}
          <div className='card p-6'>
            <h2 className='text-lg font-semibold mb-4'>Workspace visibility</h2>

            <div className='flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors'>
              <div className='flex items-center gap-3'>
                <div
                  className={`w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center`}
                >
                  {React.createElement(visibilityInfo.icon, {
                    className: `w-4 h-4 ${visibilityInfo.color}`,
                  })}
                </div>
                <div>
                  <div className='font-medium text-foreground flex items-center gap-2'>
                    {visibilityInfo.text}
                  </div>
                  <div className='text-sm text-muted-foreground'>
                    {visibilityInfo.description}
                  </div>
                </div>
              </div>
              {canUpdateSettings && (
                <button
                  onClick={() => setShowVisibilityModal(true)}
                  className='px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors flex items-center gap-1'
                >
                  Change
                  <ChevronRight className='w-4 h-4' />
                </button>
              )}
            </div>
          </div>

          {/* Workspace Membership Restrictions */}
          <div className='card p-6'>
            <h2 className='text-lg font-semibold mb-4'>
              Workspace membership restrictions
            </h2>

            <div className='flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors'>
              <div className='flex items-center gap-3'>
                <div
                  className={`w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center`}
                >
                  {React.createElement(membershipInfo.icon, {
                    className: `w-4 h-4 ${membershipInfo.color}`,
                  })}
                </div>
                <div>
                  <div className='font-medium text-foreground'>
                    {membershipInfo.text} can be added to this workspace
                  </div>
                  <div className='text-sm text-muted-foreground'>
                    Controls who can invite new members to join this workspace
                  </div>
                </div>
              </div>
              {canUpdateSettings && (
                <button
                  onClick={() => setShowMembershipModal(true)}
                  className='px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors flex items-center gap-1'
                >
                  Change
                  <ChevronRight className='w-4 h-4' />
                </button>
              )}
            </div>
          </div>

          {/* Board Creation Restrictions */}
          <div className='card p-6'>
            <h2 className='text-lg font-semibold mb-4'>
              Board creation restrictions
            </h2>

            <div className='space-y-2'>
              {/* Public Boards */}
              <div className='flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors'>
                <div className='flex items-center gap-3'>
                  <div className='w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center'>
                    <Globe className='w-4 h-4 text-green-600 dark:text-green-400' />
                  </div>
                  <div>
                    <div className='font-medium text-foreground'>
                      {
                        getRoleDisplay(
                          settings.board_creation_restriction.public_boards
                        ).text
                      }{' '}
                      can create public boards
                    </div>
                    <div className='text-sm text-muted-foreground'>
                      Public boards can be viewed by anyone, even without a
                      login
                    </div>
                  </div>
                </div>
                {canUpdateSettings && (
                  <button
                    onClick={() =>
                      alert('Board permission settings coming soon!')
                    }
                    className='px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors flex items-center gap-1'
                  >
                    Change
                    <ChevronRight className='w-4 h-4' />
                  </button>
                )}
              </div>

              {/* Workspace Visible Boards */}
              <div className='flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors'>
                <div className='flex items-center gap-3'>
                  <div className='w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center'>
                    <Users className='w-4 h-4 text-yellow-600 dark:text-yellow-400' />
                  </div>
                  <div>
                    <div className='font-medium text-foreground'>
                      {
                        getRoleDisplay(
                          settings.board_creation_restriction
                            .workspace_visible_boards
                        ).text
                      }{' '}
                      can create workspace visible boards
                    </div>
                    <div className='text-sm text-muted-foreground'>
                      Workspace visible boards can be viewed by all members
                    </div>
                  </div>
                </div>
                {canUpdateSettings && (
                  <button
                    onClick={() =>
                      alert('Board permission settings coming soon!')
                    }
                    className='px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors flex items-center gap-1'
                  >
                    Change
                    <ChevronRight className='w-4 h-4' />
                  </button>
                )}
              </div>

              {/* Private Boards */}
              <div className='flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors'>
                <div className='flex items-center gap-3'>
                  <div className='w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center'>
                    <Lock className='w-4 h-4 text-red-600 dark:text-red-400' />
                  </div>
                  <div>
                    <div className='font-medium text-foreground'>
                      {
                        getRoleDisplay(
                          settings.board_creation_restriction.private_boards
                        ).text
                      }{' '}
                      can create private boards
                    </div>
                    <div className='text-sm text-muted-foreground'>
                      Private boards can only be viewed by specific members
                    </div>
                  </div>
                </div>
                {canUpdateSettings && (
                  <button
                    onClick={() =>
                      alert('Board permission settings coming soon!')
                    }
                    className='px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors flex items-center gap-1'
                  >
                    Change
                    <ChevronRight className='w-4 h-4' />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Board Deletion Restrictions */}
          <div className='card p-6'>
            <h2 className='text-lg font-semibold mb-4'>
              Board deletion restrictions
            </h2>

            <div className='space-y-2'>
              {/* Public Boards Deletion */}
              <div className='flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors'>
                <div className='flex items-center gap-3'>
                  <div className='w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center'>
                    <Trash2 className='w-4 h-4 text-green-600 dark:text-green-400' />
                  </div>
                  <div>
                    <div className='font-medium text-foreground'>
                      {
                        getRoleDisplay(
                          settings.board_deletion_restriction.public_boards
                        ).text
                      }{' '}
                      can delete public boards
                    </div>
                  </div>
                </div>
                {canUpdateSettings && (
                  <button
                    onClick={() =>
                      alert('Board permission settings coming soon!')
                    }
                    className='px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors flex items-center gap-1'
                  >
                    Change
                    <ChevronRight className='w-4 h-4' />
                  </button>
                )}
              </div>

              {/* Workspace Visible Boards Deletion */}
              <div className='flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors'>
                <div className='flex items-center gap-3'>
                  <div className='w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center'>
                    <Trash2 className='w-4 h-4 text-yellow-600 dark:text-yellow-400' />
                  </div>
                  <div>
                    <div className='font-medium text-foreground'>
                      {
                        getRoleDisplay(
                          settings.board_deletion_restriction
                            .workspace_visible_boards
                        ).text
                      }{' '}
                      can delete workspace visible boards
                    </div>
                  </div>
                </div>
                {canUpdateSettings && (
                  <button
                    onClick={() =>
                      alert('Board permission settings coming soon!')
                    }
                    className='px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors flex items-center gap-1'
                  >
                    Change
                    <ChevronRight className='w-4 h-4' />
                  </button>
                )}
              </div>

              {/* Private Boards Deletion */}
              <div className='flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors'>
                <div className='flex items-center gap-3'>
                  <div className='w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center'>
                    <Trash2 className='w-4 h-4 text-red-600 dark:text-red-400' />
                  </div>
                  <div>
                    <div className='font-medium text-foreground'>
                      {
                        getRoleDisplay(
                          settings.board_deletion_restriction.private_boards
                        ).text
                      }{' '}
                      can delete private boards
                    </div>
                  </div>
                </div>
                {canUpdateSettings && (
                  <button
                    onClick={() =>
                      alert('Board permission settings coming soon!')
                    }
                    className='px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors flex items-center gap-1'
                  >
                    Change
                    <ChevronRight className='w-4 h-4' />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Board Sharing Restrictions */}
          <div className='card p-6'>
            <h2 className='text-lg font-semibold mb-4'>
              Board sharing restrictions
            </h2>

            <div className='flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors'>
              <div className='flex items-center gap-3'>
                <div
                  className={`w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center`}
                >
                  <Share2
                    className={`w-4 h-4 ${
                      getRoleDisplay(settings.board_sharing_restriction).color
                    }`}
                  />
                </div>
                <div>
                  <div className='font-medium text-foreground'>
                    {getRoleDisplay(settings.board_sharing_restriction).text}{' '}
                    can share boards with external users
                  </div>
                  <div className='text-sm text-muted-foreground'>
                    Controls who can share boards with people outside this
                    workspace
                  </div>
                </div>
              </div>
              {canUpdateSettings && (
                <button
                  onClick={() => setShowSharingModal(true)}
                  className='px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors flex items-center gap-1'
                >
                  Change
                  <ChevronRight className='w-4 h-4' />
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Workspace Edit Modal */}
      {showWorkspaceEditModal && (
        <div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6'>
          <div className='bg-card rounded-lg shadow-lg max-w-md w-full p-5 border border-border'>
            <div className='flex justify-between items-center mb-4'>
              <h3 className='text-xl font-bold text-foreground'>
                {editField === 'name'
                  ? 'Edit Workspace Name'
                  : 'Edit Workspace Color'}
              </h3>
              <button
                onClick={() => {
                  setShowWorkspaceEditModal(false);
                  setEditField(null);
                  setEditWorkspaceName(workspace?.name || '');
                  setEditWorkspaceColor(workspace?.color || '');
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
                    Workspace Name
                  </label>
                  <input
                    id='workspace-name'
                    type='text'
                    value={editWorkspaceName}
                    onChange={(e) => setEditWorkspaceName(e.target.value)}
                    className='w-full p-2 bg-input border border-border rounded-md text-foreground'
                    placeholder='My Workspace'
                    disabled={isUpdating}
                    autoFocus
                  />
                </div>
              )}

              {editField === 'color' && (
                <div>
                  <label className='block text-sm font-medium text-foreground mb-2'>
                    Workspace Color
                  </label>
                  <div className='mb-3 flex flex-wrap gap-3'>
                    {/* Standard color circles */}
                    {workspaceColors.map((color) => (
                      <button
                        key={color.value}
                        type='button'
                        onClick={() => handleColorSelection(color.value)}
                        className={`w-10 h-10 rounded-full ${
                          color.value
                        } flex items-center justify-center transition-all ${
                          selectedColor === color.value
                            ? 'ring-2 ring-ring ring-offset-2 ring-offset-background'
                            : 'hover:ring-1 hover:ring-ring hover:ring-offset-1 hover:ring-offset-background'
                        }`}
                        title={color.name}
                        aria-label={`Select ${color.name} color`}
                        disabled={isUpdating}
                      >
                        {selectedColor === color.value && (
                          <div className='w-2 h-2 bg-white rounded-full'></div>
                        )}
                      </button>
                    ))}

                    {/* Custom color button - distinct design */}
                    <button
                      type='button'
                      onClick={handleCustomColorClick}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border-2 border-dashed ${
                        selectedColor === 'custom'
                          ? 'ring-2 ring-ring ring-offset-2 ring-offset-background'
                          : 'hover:border-primary'
                      }`}
                      style={
                        selectedColor === 'custom'
                          ? { backgroundColor: customColor }
                          : {}
                      }
                      title='Choose custom color'
                      aria-label='Choose custom color'
                      disabled={isUpdating}
                    >
                      {selectedColor !== 'custom' ? (
                        <Palette className='w-5 h-5 text-muted-foreground' />
                      ) : (
                        <div className='w-2 h-2 bg-white rounded-full'></div>
                      )}
                      <input
                        ref={colorPickerRef}
                        type='color'
                        value={customColor}
                        onChange={handleColorChange}
                        className='sr-only'
                        aria-label='Choose custom color'
                      />
                    </button>
                  </div>

                  {selectedColor === 'custom' && (
                    <div className='mt-2 p-2 border border-border rounded-md bg-muted/30 flex items-center'>
                      <div
                        className='w-6 h-6 rounded-md mr-2 border border-border/50'
                        style={{ backgroundColor: customColor }}
                      ></div>
                      <span className='text-sm font-medium'>{customColor}</span>
                      <span className='ml-auto text-xs text-muted-foreground'>
                        Custom color
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className='flex justify-end space-x-2 mt-6'>
              <button
                type='button'
                onClick={() => {
                  setShowWorkspaceEditModal(false);
                  setEditField(null);
                  setEditWorkspaceName(workspace?.name || '');
                  setEditWorkspaceColor(workspace?.color || '');
                }}
                className='btn btn-ghost px-4 py-2'
                disabled={isUpdating}
              >
                Cancel
              </button>
              <button
                onClick={updateWorkspaceDetails}
                className='btn bg-primary text-white hover:bg-primary/90 px-4 py-2 flex items-center'
                disabled={
                  isUpdating ||
                  (editField === 'name' && !editWorkspaceName.trim())
                }
              >
                {isUpdating ? (
                  <>
                    <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workspace Visibility Modal */}
      {showVisibilityModal && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-background border border-border rounded-lg p-6 w-full max-w-md mx-4'>
            <h3 className='text-lg font-semibold mb-4'>
              Change Workspace Visibility
            </h3>

            <div className='space-y-3'>
              <button
                onClick={() => updateWorkspaceVisibility('private')}
                disabled={isUpdating}
                className={`w-full p-3 text-left rounded-lg border ${
                  workspace?.visibility === 'private'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-muted/50'
                } transition-colors flex items-center gap-3`}
              >
                <Lock className='w-4 h-4 text-gray-500' />
                <div>
                  <div className='font-medium'>Private</div>
                  <div className='text-sm text-muted-foreground'>
                    Only invited members can access
                  </div>
                </div>
              </button>

              <button
                onClick={() => updateWorkspaceVisibility('public')}
                disabled={isUpdating}
                className={`w-full p-3 text-left rounded-lg border ${
                  workspace?.visibility === 'public'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-muted/50'
                } transition-colors flex items-center gap-3`}
              >
                <Globe className='w-4 h-4 text-green-500' />
                <div>
                  <div className='font-medium'>Public</div>
                  <div className='text-sm text-muted-foreground'>
                    Anyone can view boards
                  </div>
                </div>
              </button>
            </div>

            <div className='flex justify-end gap-3 mt-6'>
              <button
                onClick={() => setShowVisibilityModal(false)}
                disabled={isUpdating}
                className='px-4 py-2 text-muted-foreground hover:text-foreground disabled:opacity-50'
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Membership Restriction Modal */}
      {showMembershipModal && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-background border border-border rounded-lg p-6 w-full max-w-md mx-4'>
            <h3 className='text-lg font-semibold mb-4'>
              Change Membership Restrictions
            </h3>

            <div className='space-y-3'>
              {(['anyone', 'admins_only', 'owner_only'] as const).map(
                (option) => {
                  const info = getRoleDisplay(option);
                  return (
                    <button
                      key={option}
                      onClick={() =>
                        updateWorkspaceSetting('membership_restriction', option)
                      }
                      disabled={isUpdating}
                      className={`w-full p-3 text-left rounded-lg border ${
                        settings.membership_restriction === option
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:bg-muted/50'
                      } transition-colors flex items-center gap-3`}
                    >
                      {React.createElement(info.icon, {
                        className: `w-4 h-4 ${info.color}`,
                      })}
                      <div>
                        <div className='font-medium'>{info.text}</div>
                      </div>
                    </button>
                  );
                }
              )}
            </div>

            <div className='flex justify-end gap-3 mt-6'>
              <button
                onClick={() => setShowMembershipModal(false)}
                disabled={isUpdating}
                className='px-4 py-2 text-muted-foreground hover:text-foreground disabled:opacity-50'
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Board Sharing Restriction Modal */}
      {showSharingModal && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-background border border-border rounded-lg p-6 w-full max-w-md mx-4'>
            <h3 className='text-lg font-semibold mb-4'>
              Change Board Sharing Restrictions
            </h3>

            <div className='space-y-3'>
              {(['anyone', 'admins_only', 'owner_only'] as const).map(
                (option) => {
                  const info = getRoleDisplay(option);
                  return (
                    <button
                      key={option}
                      onClick={() =>
                        updateWorkspaceSetting(
                          'board_sharing_restriction',
                          option
                        )
                      }
                      disabled={isUpdating}
                      className={`w-full p-3 text-left rounded-lg border ${
                        settings.board_sharing_restriction === option
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:bg-muted/50'
                      } transition-colors flex items-center gap-3`}
                    >
                      {React.createElement(info.icon, {
                        className: `w-4 h-4 ${info.color}`,
                      })}
                      <div>
                        <div className='font-medium'>{info.text}</div>
                      </div>
                    </button>
                  );
                }
              )}
            </div>

            <div className='flex justify-end gap-3 mt-6'>
              <button
                onClick={() => setShowSharingModal(false)}
                disabled={isUpdating}
                className='px-4 py-2 text-muted-foreground hover:text-foreground disabled:opacity-50'
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
