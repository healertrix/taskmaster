'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import {
  Save,
  Loader2,
  Users,
  LayoutGrid,
  Trash2,
  Share2,
  AlertCircle,
  Info,
} from 'lucide-react';
import Link from 'next/link';

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
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
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

  // Function to check if color is a hex code or tailwind class
  const getColorDisplay = (color: string) => {
    // If it starts with # or rgb, it's a custom color
    if (color?.startsWith('#') || color?.startsWith('rgb')) {
      return {
        isCustom: true,
        style: { backgroundColor: color },
        className: '',
      };
    }
    // Otherwise it's a Tailwind class
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
          router.push('/login');
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
          // Not found error
          throw new Error(memberError.message);
        }

        // Set user role
        if (memberData) {
          setUserRole(memberData.role);
        } else if (workspaceData.owner_id === user.id) {
          setUserRole('owner');
        } else {
          // User doesn't have access to this workspace
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
          console.log('Raw settings data from database:', settingsData);
          settingsData.forEach((setting) => {
            const settingType = setting.setting_type as keyof WorkspaceSettings;

            if (
              settingType === 'membership_restriction' ||
              settingType === 'board_sharing_restriction'
            ) {
              // These are simple string values stored as JSON
              // Try to parse if it's a string, or use directly if it's already an object
              let value;
              try {
                // Check if the value is a string before trying to parse it
                if (typeof setting.setting_value === 'string') {
                  value = JSON.parse(setting.setting_value);
                } else {
                  value = setting.setting_value;
                }
              } catch (error) {
                console.error(
                  `Error parsing setting value for ${settingType}:`,
                  error
                );
                // Use default value if parsing fails
                value = processedSettings[settingType];
              }
              processedSettings[settingType] = value;
            } else if (
              settingType === 'board_creation_restriction' ||
              settingType === 'board_deletion_restriction'
            ) {
              // These are JSON objects
              let value;
              try {
                // Check if the value is a string before trying to parse it
                if (typeof setting.setting_value === 'string') {
                  value = JSON.parse(setting.setting_value);
                } else {
                  value = setting.setting_value;
                }
              } catch (error) {
                console.error(
                  `Error parsing setting value for ${settingType}:`,
                  error
                );
                // Use default value if parsing fails
                value = processedSettings[settingType];
              }
              processedSettings[settingType] = value;
            }
          });
        }

        setSettings(processedSettings);
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

  const handleSaveSettings = async () => {
    if (!workspace || (userRole !== 'admin' && userRole !== 'owner')) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const supabase = createClient();

      // Get the current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('You must be logged in to update workspace settings');
      }

      // Update each setting separately
      const settingsToUpdate = [
        {
          type: 'membership_restriction',
          value: JSON.stringify(settings.membership_restriction),
        },
        {
          type: 'board_creation_restriction',
          value: JSON.stringify(settings.board_creation_restriction),
        },
        {
          type: 'board_deletion_restriction',
          value: JSON.stringify(settings.board_deletion_restriction),
        },
        {
          type: 'board_sharing_restriction',
          value: JSON.stringify(settings.board_sharing_restriction),
        },
      ];

      console.log('Settings to save:', settingsToUpdate);

      // Execute updates in parallel
      const updatePromises = settingsToUpdate.map((setting) => {
        return supabase.from('workspace_settings').upsert(
          {
            workspace_id: workspaceId,
            setting_type: setting.type,
            setting_value: setting.value,
            set_by: user.id,
          },
          { onConflict: 'workspace_id,setting_type' }
        );
      });

      await Promise.all(updatePromises);

      setSuccess(true);

      // Hide success message after 3 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Error saving workspace settings:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to save workspace settings'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleRoleChange = (
    settingType: keyof WorkspaceSettings,
    value: any,
    subSetting?: string
  ) => {
    setSettings((prev) => {
      const newSettings = { ...prev };

      if (
        settingType === 'membership_restriction' ||
        settingType === 'board_sharing_restriction'
      ) {
        newSettings[settingType] = value;
      } else if (
        settingType === 'board_creation_restriction' ||
        settingType === 'board_deletion_restriction'
      ) {
        if (subSetting) {
          newSettings[settingType] = {
            ...newSettings[settingType],
            [subSetting]: value,
          };
        }
      }

      return newSettings;
    });
  };

  // Render role selector component
  const RoleSelector = ({
    value,
    onChange,
    disabled = false,
    includeAnyone = true,
    id,
  }: {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    includeAnyone?: boolean;
    id: string;
  }) => (
    <select
      id={id}
      className='bg-input border border-border rounded-md p-2 text-sm w-full'
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label='Permission level selector'
    >
      {includeAnyone && <option value='anyone'>Anyone in workspace</option>}
      <option value='any_member'>Any member</option>
      <option value='admins_only'>Admins only</option>
      <option value='owner_only'>Owner only</option>
    </select>
  );

  if (isLoading) {
    return (
      <div className='flex flex-col items-center justify-center h-screen'>
        <Loader2 className='w-8 h-8 text-primary animate-spin' />
        <p className='mt-2 text-muted-foreground'>
          Loading workspace settings...
        </p>
      </div>
    );
  }

  const canUpdateSettings = userRole === 'admin' || userRole === 'owner';

  return (
    <div className='container mx-auto max-w-4xl px-4 py-10'>
      {/* Header */}
      <div className='mb-8'>
        <div className='flex items-center gap-2 mb-2'>
          <Link
            href={`/workspace/${workspaceId}`}
            className='text-muted-foreground hover:text-foreground transition-colors'
          >
            {workspace?.name || 'Workspace'}
          </Link>
          <span className='text-muted-foreground'>/</span>
          <h1 className='text-xl font-semibold'>Settings</h1>
        </div>

        <div className='flex items-center gap-3'>
          {workspace && (
            <div
              className={`w-10 h-10 ${
                getColorDisplay(workspace.color).isCustom
                  ? ''
                  : getColorDisplay(workspace.color).className
              } rounded-lg flex items-center justify-center text-lg font-bold text-white`}
              style={getColorDisplay(workspace.color).style}
            >
              {workspace.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className='text-2xl font-bold'>
              {workspace?.name || 'Workspace'} Settings
            </h1>
            <p className='text-muted-foreground'>
              Manage permissions and access controls
            </p>
          </div>
        </div>
      </div>

      {/* Access warning */}
      {!canUpdateSettings && (
        <div className='mb-6 p-4 bg-amber-500/10 border border-amber-200/20 rounded-lg flex items-start gap-3'>
          <AlertCircle className='w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5' />
          <div>
            <h3 className='font-medium text-foreground'>View-only access</h3>
            <p className='text-sm text-muted-foreground'>
              You don't have permission to change these settings. Only workspace
              admins and the owner can modify settings.
            </p>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className='mb-6 p-4 bg-red-500/10 border border-red-200/20 rounded-lg flex items-start gap-3'>
          <AlertCircle className='w-5 h-5 text-red-500 flex-shrink-0 mt-0.5' />
          <div>
            <h3 className='font-medium text-foreground'>Error</h3>
            <p className='text-sm text-muted-foreground'>{error}</p>
          </div>
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className='mb-6 p-4 bg-green-500/10 border border-green-200/20 rounded-lg flex items-start gap-3'>
          <Info className='w-5 h-5 text-green-500 flex-shrink-0 mt-0.5' />
          <div>
            <h3 className='font-medium text-foreground'>Settings saved</h3>
            <p className='text-sm text-muted-foreground'>
              Your workspace settings have been updated successfully.
            </p>
          </div>
        </div>
      )}

      {/* Settings form */}
      <div className='space-y-8'>
        {/* Membership restrictions */}
        <div className='card p-6'>
          <div className='flex items-center gap-3 mb-4'>
            <Users className='w-5 h-5 text-primary' />
            <h2 className='text-lg font-semibold'>Membership Controls</h2>
          </div>

          <div className='mb-4'>
            <label
              htmlFor='membership-restriction'
              className='block text-sm font-medium mb-1'
            >
              Who can add members to this workspace?
            </label>
            <RoleSelector
              id='membership-restriction'
              value={settings.membership_restriction}
              onChange={(value) =>
                handleRoleChange('membership_restriction', value)
              }
              disabled={!canUpdateSettings}
            />
            <p className='mt-1 text-xs text-muted-foreground'>
              This controls who can invite new members to join this workspace.
            </p>
          </div>
        </div>

        {/* Board creation restrictions */}
        <div className='card p-6'>
          <div className='flex items-center gap-3 mb-4'>
            <LayoutGrid className='w-5 h-5 text-primary' />
            <h2 className='text-lg font-semibold'>Board Creation Controls</h2>
          </div>

          <div className='space-y-4'>
            <div>
              <label
                htmlFor='create-public-boards'
                className='block text-sm font-medium mb-1'
              >
                Who can create public boards?
              </label>
              <RoleSelector
                id='create-public-boards'
                value={settings.board_creation_restriction.public_boards}
                onChange={(value) =>
                  handleRoleChange(
                    'board_creation_restriction',
                    value,
                    'public_boards'
                  )
                }
                disabled={!canUpdateSettings}
                includeAnyone={false}
              />
              <p className='mt-1 text-xs text-muted-foreground'>
                Public boards can be viewed by anyone, even without a login.
              </p>
            </div>

            <div>
              <label
                htmlFor='create-workspace-visible-boards'
                className='block text-sm font-medium mb-1'
              >
                Who can create workspace-visible boards?
              </label>
              <RoleSelector
                id='create-workspace-visible-boards'
                value={
                  settings.board_creation_restriction.workspace_visible_boards
                }
                onChange={(value) =>
                  handleRoleChange(
                    'board_creation_restriction',
                    value,
                    'workspace_visible_boards'
                  )
                }
                disabled={!canUpdateSettings}
                includeAnyone={false}
              />
              <p className='mt-1 text-xs text-muted-foreground'>
                Workspace-visible boards can be viewed by all members of this
                workspace.
              </p>
            </div>

            <div>
              <label
                htmlFor='create-private-boards'
                className='block text-sm font-medium mb-1'
              >
                Who can create private boards?
              </label>
              <RoleSelector
                id='create-private-boards'
                value={settings.board_creation_restriction.private_boards}
                onChange={(value) =>
                  handleRoleChange(
                    'board_creation_restriction',
                    value,
                    'private_boards'
                  )
                }
                disabled={!canUpdateSettings}
                includeAnyone={false}
              />
              <p className='mt-1 text-xs text-muted-foreground'>
                Private boards can only be viewed by specific members who have
                been added to the board.
              </p>
            </div>
          </div>
        </div>

        {/* Board deletion restrictions */}
        <div className='card p-6'>
          <div className='flex items-center gap-3 mb-4'>
            <Trash2 className='w-5 h-5 text-primary' />
            <h2 className='text-lg font-semibold'>Board Deletion Controls</h2>
          </div>

          <div className='space-y-4'>
            <div>
              <label
                htmlFor='delete-public-boards'
                className='block text-sm font-medium mb-1'
              >
                Who can delete public boards?
              </label>
              <RoleSelector
                id='delete-public-boards'
                value={settings.board_deletion_restriction.public_boards}
                onChange={(value) =>
                  handleRoleChange(
                    'board_deletion_restriction',
                    value,
                    'public_boards'
                  )
                }
                disabled={!canUpdateSettings}
                includeAnyone={false}
              />
            </div>

            <div>
              <label
                htmlFor='delete-workspace-visible-boards'
                className='block text-sm font-medium mb-1'
              >
                Who can delete workspace-visible boards?
              </label>
              <RoleSelector
                id='delete-workspace-visible-boards'
                value={
                  settings.board_deletion_restriction.workspace_visible_boards
                }
                onChange={(value) =>
                  handleRoleChange(
                    'board_deletion_restriction',
                    value,
                    'workspace_visible_boards'
                  )
                }
                disabled={!canUpdateSettings}
                includeAnyone={false}
              />
            </div>

            <div>
              <label
                htmlFor='delete-private-boards'
                className='block text-sm font-medium mb-1'
              >
                Who can delete private boards?
              </label>
              <RoleSelector
                id='delete-private-boards'
                value={settings.board_deletion_restriction.private_boards}
                onChange={(value) =>
                  handleRoleChange(
                    'board_deletion_restriction',
                    value,
                    'private_boards'
                  )
                }
                disabled={!canUpdateSettings}
                includeAnyone={false}
              />
              <p className='mt-1 text-xs text-muted-foreground'>
                Note: Board creators and admins can always delete their own
                boards regardless of this setting.
              </p>
            </div>
          </div>
        </div>

        {/* Board sharing restrictions */}
        <div className='card p-6'>
          <div className='flex items-center gap-3 mb-4'>
            <Share2 className='w-5 h-5 text-primary' />
            <h2 className='text-lg font-semibold'>Board Sharing Controls</h2>
          </div>

          <div className='mb-4'>
            <label
              htmlFor='board-sharing-restriction'
              className='block text-sm font-medium mb-1'
            >
              Who can share boards with external users?
            </label>
            <RoleSelector
              id='board-sharing-restriction'
              value={settings.board_sharing_restriction}
              onChange={(value) =>
                handleRoleChange('board_sharing_restriction', value)
              }
              disabled={!canUpdateSettings}
            />
            <p className='mt-1 text-xs text-muted-foreground'>
              This controls who can share boards with people outside this
              workspace.
            </p>
          </div>
        </div>

        {/* Save button */}
        {canUpdateSettings && (
          <div className='flex justify-end'>
            <button
              className='btn bg-primary text-white hover:bg-primary/90 px-4 py-2 flex items-center'
              onClick={handleSaveSettings}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                  Saving...
                </>
              ) : (
                <>
                  <Save className='w-4 h-4 mr-2' />
                  Save Settings
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
