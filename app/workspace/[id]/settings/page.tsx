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
  Crown,
  Shield,
  User,
  ChevronRight,
  ChevronDown,
  X,
  Loader2,
  Palette,
  Check,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import Link from 'next/link';
import { useAppStore, cacheUtils } from '@/lib/stores/useAppStore';

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
  board_creation_simplified: 'any_member' | 'admins_only' | 'owner_only';
  board_deletion_simplified: 'any_member' | 'admins_only' | 'owner_only';
};

type WorkspaceData = {
  id: string;
  name: string;
  color: string;
  owner_id: string;
};

export default function WorkspaceSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  // Cache helper constants
  const WORKSPACE_CACHE_KEY = cacheUtils.getWorkspaceKey(workspaceId);
  const SETTINGS_CACHE_KEY = cacheUtils.getWorkspaceSettingsKey(workspaceId);
  const CACHE_TTL = 2 * 60 * 1000; // 2 minutes TTL for workspace settings cache

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [settings, setSettings] = useState<WorkspaceSettings>({
    membership_restriction: 'anyone',
    board_creation_simplified: 'any_member',
    board_deletion_simplified: 'any_member',
  });

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
  const [editWorkspaceColor, setEditWorkspaceColor] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [customColor, setCustomColor] = useState('#3B82F6');
  const [editField, setEditField] = useState<'name' | 'color' | null>(null);
  const colorPickerRef = useRef<HTMLInputElement>(null);

  const { getCache, setCache, clearCache } = useAppStore();

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
        setEditWorkspaceColor(workspace?.color || '');
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
          setEditWorkspaceColor(workspace?.color || '');
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

        // Check cache first for workspace & settings to provide instant UI
        const cachedWorkspace = getCache<WorkspaceData>(WORKSPACE_CACHE_KEY);
        const cachedSettings = getCache<WorkspaceSettings>(SETTINGS_CACHE_KEY);

        if (cachedWorkspace) {
          setWorkspace(cachedWorkspace);

          // Initialize edit form values from cache for instant responsiveness
          setEditWorkspaceName(cachedWorkspace.name);
          setEditWorkspaceColor(cachedWorkspace.color);

          const isCustomColorLocal =
            cachedWorkspace.color?.startsWith('#') ||
            cachedWorkspace.color?.startsWith('rgb');
          if (isCustomColorLocal) {
            setSelectedColor('custom');
            setCustomColor(cachedWorkspace.color);
          } else {
            setSelectedColor(cachedWorkspace.color || 'bg-blue-600');
          }
        }

        if (cachedSettings) {
          setSettings(cachedSettings);
        }

        // Always continue with fetch to ensure data freshness (will be fast if cache is valid)

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
        // Update cache
        setCache(WORKSPACE_CACHE_KEY, workspaceData, CACHE_TTL);

        // Initialize edit form with latest workspace data (may differ from cache)
        setEditWorkspaceName(workspaceData.name);
        setEditWorkspaceColor(workspaceData.color);

        const isCustomColor =
          workspaceData.color?.startsWith('#') ||
          workspaceData.color?.startsWith('rgb');
        if (isCustomColor) {
          setSelectedColor('custom');
          setCustomColor(workspaceData.color);
        } else {
          setSelectedColor(workspaceData.color || 'bg-blue-600');
        }

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

        // Process settings data with backward compatibility
        const processedSettings = { ...settings };

        if (settingsData && settingsData.length > 0) {
          settingsData.forEach((setting) => {
            const settingType = setting.setting_type;

            // Handle membership restriction (unchanged)
            if (settingType === 'membership_restriction') {
              let value;
              try {
                if (typeof setting.setting_value === 'string') {
                  value = JSON.parse(setting.setting_value);
                } else {
                  value = setting.setting_value;
                }
              } catch (error) {
                value = processedSettings.membership_restriction;
              }
              processedSettings.membership_restriction = value;
            }

            // Handle new simplified format
            else if (settingType === 'board_creation_simplified') {
              let value;
              try {
                if (typeof setting.setting_value === 'string') {
                  value = JSON.parse(setting.setting_value);
                } else {
                  value = setting.setting_value;
                }
              } catch (error) {
                value = processedSettings.board_creation_simplified;
              }
              processedSettings.board_creation_simplified = value;
            } else if (settingType === 'board_deletion_simplified') {
              let value;
              try {
                if (typeof setting.setting_value === 'string') {
                  value = JSON.parse(setting.setting_value);
                } else {
                  value = setting.setting_value;
                }
              } catch (error) {
                value = processedSettings.board_deletion_simplified;
              }
              processedSettings.board_deletion_simplified = value;
            }

            // Backward compatibility: Handle old complex format
            else if (settingType === 'board_creation_restriction') {
              let oldValue;
              try {
                if (typeof setting.setting_value === 'string') {
                  oldValue = JSON.parse(setting.setting_value);
                } else {
                  oldValue = setting.setting_value;
                }
                // Extract workspace visible boards setting from old format
                processedSettings.board_creation_simplified =
                  oldValue?.workspace_visible_boards || 'any_member';
              } catch (error) {
                processedSettings.board_creation_simplified = 'any_member';
              }
            } else if (settingType === 'board_deletion_restriction') {
              let oldValue;
              try {
                if (typeof setting.setting_value === 'string') {
                  oldValue = JSON.parse(setting.setting_value);
                } else {
                  oldValue = setting.setting_value;
                }
                // Extract workspace visible boards setting from old format
                processedSettings.board_deletion_simplified =
                  oldValue?.workspace_visible_boards || 'any_member';
              } catch (error) {
                processedSettings.board_deletion_simplified = 'any_member';
              }
            }

            // Ignore old board_sharing_restriction - no longer used
          });
        }

        setSettings(processedSettings);
        // Update cache
        setCache(SETTINGS_CACHE_KEY, processedSettings, CACHE_TTL);
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

      // Optimistically update local state and cache
      setSettings((prev) => {
        const updated = { ...prev, [settingType]: settingValue };
        setCache(SETTINGS_CACHE_KEY, updated, CACHE_TTL);
        return updated;
      });

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
        const updated = {
          ...prev,
          ...updateData,
        };
        setCache(WORKSPACE_CACHE_KEY, updated, CACHE_TTL);
        return updated;
      });

      setShowWorkspaceEditModal(false);
      setEditField(null);

      // Show success message based on what was updated
      const updateType = editField === 'name' ? 'name' : 'color';
      showSuccess(`Workspace ${updateType} updated successfully`);
    } catch (error) {
      console.error('Error updating workspace details:', error);
      showError('Failed to update workspace details');
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
      <main className='container mx-auto max-w-4xl px-3 sm:px-4 pt-16 sm:pt-24 pb-8 sm:pb-16'>
        <div className='space-y-6'>
          {/* Header skeleton */}
          <div className='flex items-center gap-4 mb-8'>
            <div className='w-8 h-8 bg-muted/50 rounded-lg animate-pulse'></div>
            <div className='space-y-2'>
              <div className='w-48 h-6 bg-muted/50 rounded animate-pulse'></div>
              <div className='w-64 h-4 bg-muted/50 rounded animate-pulse'></div>
            </div>
          </div>

          {/* Cards skeleton */}
          {[1, 2, 3].map((i) => (
            <div key={i} className='card p-6 space-y-4'>
              <div className='w-40 h-5 bg-muted/50 rounded animate-pulse'></div>
              <div className='space-y-3'>
                {[1, 2, 3].map((j) => (
                  <div
                    key={j}
                    className='flex items-center justify-between p-3 rounded-lg border border-border'
                  >
                    <div className='flex items-center gap-3'>
                      <div className='w-8 h-8 bg-muted/50 rounded-full animate-pulse'></div>
                      <div className='space-y-2'>
                        <div className='w-32 h-4 bg-muted/50 rounded animate-pulse'></div>
                        <div className='w-48 h-3 bg-muted/50 rounded animate-pulse'></div>
                      </div>
                    </div>
                    <div className='w-16 h-8 bg-muted/50 rounded animate-pulse'></div>
                  </div>
                ))}
              </div>
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
      clearCache(WORKSPACE_CACHE_KEY);
      clearCache(SETTINGS_CACHE_KEY);

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

  if (isLoading) {
    return <PageLoadingSkeleton />;
  }

  if (error || !workspace) {
    return (
      <div className='min-h-screen dot-pattern-dark'>
        <DashboardHeader />
        <main className='container mx-auto max-w-4xl px-3 sm:px-4 pt-16 sm:pt-24 pb-8 sm:pb-16'>
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
        <main className='container mx-auto max-w-4xl px-3 sm:px-4 pt-16 sm:pt-24 pb-8 sm:pb-16'>
          <div className='flex items-center justify-center min-h-[60vh]'>
            <div className='text-center max-w-sm sm:max-w-md mx-auto px-4'>
              {/* Access Denied Card */}
              <div className='bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-lg'>
                {/* Icon */}
                <div className='flex justify-center mb-4 sm:mb-6'>
                  <div className='w-12 h-12 sm:w-16 sm:h-16 bg-amber-500/10 rounded-full flex items-center justify-center'>
                    <Shield className='w-6 h-6 sm:w-8 sm:h-8 text-amber-500' />
                  </div>
                </div>

                {/* Title */}
                <h2 className='text-lg sm:text-2xl font-bold text-foreground mb-2 sm:mb-3'>
                  Access Restricted
                </h2>

                {/* Description */}
                <p className='text-sm sm:text-base text-muted-foreground mb-2 leading-relaxed'>
                  You don't have permission to manage settings for this
                  workspace.
                </p>
                <p className='text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6'>
                  Only workspace owners and administrators can modify workspace
                  settings.
                </p>

                {/* User Role Info */}
                {userRole && (
                  <div className='bg-muted/30 rounded-lg p-3 mb-4 sm:mb-6'>
                    <div className='flex items-center justify-center gap-2 text-xs sm:text-sm'>
                      {userRole === 'member' && (
                        <>
                          <User className='w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground' />
                          <span className='text-muted-foreground font-medium'>
                            You are a member of this workspace
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Button */}
                <button
                  onClick={() => router.back()}
                  className='inline-flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors text-sm sm:text-base'
                >
                  <ArrowLeft className='w-3 h-3 sm:w-4 sm:h-4' />
                  Go back
                </button>
              </div>

              {/* Help Text */}
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
    <div className='min-h-screen dot-pattern-dark'>
      <DashboardHeader />

      <main className='container mx-auto max-w-4xl px-3 sm:px-4 pt-16 sm:pt-24 pb-8 sm:pb-16'>
        {/* Header */}
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8'>
          {/* Mobile: Title first, then description */}
          <div className='flex flex-col gap-3 sm:hidden min-w-0'>
            {/* Title with back button - prominent on mobile */}
            <div className='flex items-center gap-2'>
              <Link
                href={`/boards/${workspace.id}`}
                className='p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors flex-shrink-0'
                aria-label='Back to workspace'
              >
                <ArrowLeft className='w-4 h-4' />
              </Link>
              <div className='min-w-0 flex-1'>
                <h1 className='text-lg font-bold text-foreground truncate'>
                  {workspace.name} Settings
                </h1>
              </div>
            </div>

            {/* Description - subtle on mobile */}
            <div className='ml-7'>
              <p className='text-xs text-muted-foreground'>
                Manage workspace permissions and access controls
              </p>
            </div>
          </div>

          {/* Desktop: Traditional layout */}
          <div className='hidden sm:flex items-center gap-4 min-w-0 flex-1'>
            <Link
              href={`/boards/${workspace.id}`}
              className='p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors flex-shrink-0'
              aria-label='Back to workspace'
            >
              <ArrowLeft className='w-5 h-5' />
            </Link>
            <div className='min-w-0 flex-1'>
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
        <div className='mb-6 sm:mb-8'>
          <div className='flex items-center gap-1 border-b border-border overflow-x-auto'>
            <Link
              href={`/workspace/${workspaceId}/members`}
              className='px-3 sm:px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-b-2 hover:border-primary transition-colors whitespace-nowrap'
            >
              Members
            </Link>
            <span className='px-3 sm:px-4 py-2 text-sm font-medium text-primary border-b-2 border-primary whitespace-nowrap'>
              Settings
            </span>
          </div>
        </div>

        <div className='space-y-4 sm:space-y-6'>
          {/* Current User Role Info */}
          {userRole && (
            <div className='card p-3 sm:p-4 bg-primary/5 border-primary/20'>
              <div className='flex items-center gap-3'>
                <div className='flex items-center gap-2'>
                  {userRole === 'owner' && (
                    <Crown className='w-3 h-3 sm:w-4 sm:h-4 text-yellow-500' />
                  )}
                  {userRole === 'admin' && (
                    <Shield className='w-3 h-3 sm:w-4 sm:h-4 text-blue-500' />
                  )}
                  {userRole === 'member' && (
                    <User className='w-3 h-3 sm:w-4 sm:h-4 text-gray-500' />
                  )}
                  <span className='text-xs sm:text-sm font-medium'>
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
          <div className='card p-4 sm:p-6'>
            <h2 className='text-base sm:text-lg font-semibold mb-3 sm:mb-4'>
              Workspace details
            </h2>

            <div className='space-y-3'>
              {/* Workspace Name */}
              <button
                onClick={
                  canUpdateSettings
                    ? () => {
                        setEditField('name');
                        setEditWorkspaceName(workspace?.name || '');
                        setShowWorkspaceEditModal(true);
                      }
                    : undefined
                }
                className={`w-full flex items-center justify-between p-3 rounded-lg border border-border transition-colors text-left ${
                  canUpdateSettings
                    ? 'hover:bg-muted/50 cursor-pointer'
                    : 'cursor-default'
                }`}
                disabled={!canUpdateSettings}
              >
                <div className='flex items-center gap-3 min-w-0 flex-1'>
                  <div className='w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0'>
                    <span className='text-sm font-medium text-primary'>
                      {workspace?.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className='min-w-0 flex-1'>
                    <div className='font-medium text-foreground text-sm sm:text-base truncate'>
                      {workspace?.name}
                    </div>
                    <div className='text-xs sm:text-sm text-muted-foreground'>
                      Workspace name
                    </div>
                  </div>
                </div>
                {canUpdateSettings && (
                  <div className='px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors flex items-center gap-1 flex-shrink-0'>
                    <span className='hidden sm:inline'>Edit</span>
                    <ChevronRight className='w-3 h-3 sm:w-4 sm:h-4' />
                  </div>
                )}
              </button>

              {/* Workspace Color */}
              <button
                onClick={
                  canUpdateSettings
                    ? () => {
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
                      }
                    : undefined
                }
                className={`w-full flex items-center justify-between p-3 rounded-lg border border-border transition-colors text-left ${
                  canUpdateSettings
                    ? 'hover:bg-muted/50 cursor-pointer'
                    : 'cursor-default'
                }`}
                disabled={!canUpdateSettings}
              >
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
                  <div className='px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors flex items-center gap-1'>
                    Edit
                    <ChevronRight className='w-4 h-4' />
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Workspace Membership Restrictions */}
          <div className='card p-6'>
            <h2 className='text-lg font-semibold mb-4'>
              Workspace membership restrictions
            </h2>

            <button
              onClick={
                canUpdateSettings
                  ? () => setShowMembershipModal(true)
                  : undefined
              }
              className={`w-full flex items-center justify-between p-3 rounded-lg border border-border transition-colors text-left ${
                canUpdateSettings
                  ? 'hover:bg-muted/50 cursor-pointer'
                  : 'cursor-default'
              }`}
              disabled={!canUpdateSettings}
            >
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
                    {membershipInfo.text} can invite new members
                  </div>
                  <div className='text-sm text-muted-foreground'>
                    Controls who can invite new members to join this workspace
                  </div>
                </div>
              </div>
              {canUpdateSettings && (
                <div className='px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors items-center gap-1 hidden md:flex'>
                  Change
                  <ChevronRight className='w-4 h-4' />
                </div>
              )}
            </button>
          </div>

          {/* Board Creation Restrictions */}
          <div className='card p-6'>
            <h2 className='text-lg font-semibold mb-4'>
              Board creation restrictions
            </h2>

            <button
              onClick={
                canUpdateSettings ? () => setShowCreationModal(true) : undefined
              }
              className={`w-full flex items-center justify-between p-3 rounded-lg border border-border transition-colors text-left ${
                canUpdateSettings
                  ? 'hover:bg-muted/50 cursor-pointer'
                  : 'cursor-default'
              }`}
              disabled={!canUpdateSettings}
            >
              <div className='flex items-center gap-3'>
                <div className='w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center'>
                  <LayoutGrid className='w-4 h-4 text-blue-600 dark:text-blue-400' />
                </div>
                <div>
                  <div className='font-medium text-foreground'>
                    {getRoleDisplay(settings.board_creation_simplified).text}{' '}
                    can create boards
                  </div>
                  <div className='text-sm text-muted-foreground'>
                    All boards are workspace visible and can be viewed by all
                    members
                  </div>
                </div>
              </div>
              {canUpdateSettings && (
                <div className='px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors items-center gap-1 hidden md:flex'>
                  Change
                  <ChevronRight className='w-4 h-4' />
                </div>
              )}
            </button>
          </div>

          {/* Board Deletion Restrictions */}
          <div className='card p-6'>
            <h2 className='text-lg font-semibold mb-4'>
              Board deletion restrictions
            </h2>

            <button
              onClick={
                canUpdateSettings ? () => setShowDeletionModal(true) : undefined
              }
              className={`w-full flex items-center justify-between p-3 rounded-lg border border-border transition-colors text-left ${
                canUpdateSettings
                  ? 'hover:bg-muted/50 cursor-pointer'
                  : 'cursor-default'
              }`}
              disabled={!canUpdateSettings}
            >
              <div className='flex items-center gap-3'>
                <div className='w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center'>
                  <Trash2 className='w-4 h-4 text-red-600 dark:text-red-400' />
                </div>
                <div>
                  <div className='font-medium text-foreground'>
                    {getRoleDisplay(settings.board_deletion_simplified).text}{' '}
                    can delete boards
                  </div>
                  <div className='text-sm text-muted-foreground'>
                    Controls who can permanently delete workspace boards
                  </div>
                </div>
              </div>
              {canUpdateSettings && (
                <div className='px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors items-center gap-1 hidden md:flex'>
                  Change
                  <ChevronRight className='w-4 h-4' />
                </div>
              )}
            </button>
          </div>

          {/* Danger Zone - Workspace Deletion */}
          {userRole === 'owner' && (
            <div className='card p-6 border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'>
              <h2 className='text-lg font-semibold mb-6 text-red-700 dark:text-red-400'>
                Danger Zone
              </h2>

              <div className='flex items-start gap-3'>
                <AlertCircle className='w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0' />
                <div className='flex-1'>
                  <div className='flex items-center gap-2 mb-2'>
                    <h3 className='font-medium text-red-800 dark:text-red-200'>
                      Delete this workspace
                    </h3>
                    <button
                      onClick={() =>
                        setShowDeletionDetails(!showDeletionDetails)
                      }
                      className='p-1 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all duration-200'
                      title={
                        showDeletionDetails
                          ? 'Hide details'
                          : 'Show what will be deleted'
                      }
                    >
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${
                          showDeletionDetails ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  </div>
                  <p className='text-sm text-red-700 dark:text-red-300 mb-4'>
                    Once you delete a workspace, there is no going back. This
                    action cannot be undone.
                  </p>

                  {showDeletionDetails && (
                    <div className='mb-4 animate-in slide-in-from-top-1 fade-in duration-200'>
                      <ul className='text-sm text-red-700 dark:text-red-300 space-y-1 pl-4 border-l-2 border-red-300 dark:border-red-700'>
                        <li>
                          • All boards in this workspace will be permanently
                          deleted
                        </li>
                        <li>
                          • All lists, cards, and comments will be lost forever
                        </li>
                        <li>• All workspace members will lose access</li>
                        <li>
                          • All workspace settings and permissions will be
                          removed
                        </li>
                        <li>
                          • All activity history will be permanently deleted
                        </li>
                      </ul>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setDeletionConfirmName('');
                      setShowDeletionDetails(false);
                      setShowWorkspaceDeletionModal(true);
                    }}
                    className='px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2'
                  >
                    <Trash2 className='w-4 h-4' />
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
                className={`btn bg-primary text-white hover:bg-primary/90 px-4 py-2 flex items-center transition-all duration-200 ${
                  isUpdating ? 'scale-95 opacity-90' : 'hover:scale-105'
                }`}
                disabled={
                  isUpdating ||
                  (editField === 'name' && !editWorkspaceName.trim())
                }
              >
                {isUpdating ? (
                  <>
                    <LoadingSpinner size='sm' className='mr-2' />
                    <span className='animate-pulse'>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className='w-4 h-4 mr-2' />
                    Save Changes
                  </>
                )}
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
                      } transition-all duration-200 flex items-center gap-3 ${
                        isUpdating ? 'opacity-50 scale-95' : 'hover:scale-102'
                      }`}
                    >
                      {isUpdating ? (
                        <LoadingSpinner size='sm' />
                      ) : (
                        React.createElement(info.icon, {
                          className: `w-4 h-4 ${info.color}`,
                        })
                      )}
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

      {/* Board Creation Restriction Modal */}
      {showCreationModal && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-background border border-border rounded-lg p-6 w-full max-w-md mx-4'>
            <h3 className='text-lg font-semibold mb-4'>
              Change Board Creation Permissions
            </h3>

            <div className='space-y-3'>
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
                      className={`w-full p-3 text-left rounded-lg border ${
                        isSelected
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
                onClick={() => setShowCreationModal(false)}
                disabled={isUpdating}
                className='px-4 py-2 text-muted-foreground hover:text-foreground disabled:opacity-50'
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Board Deletion Restriction Modal */}
      {showDeletionModal && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-background border border-border rounded-lg p-6 w-full max-w-md mx-4'>
            <h3 className='text-lg font-semibold mb-4'>
              Change Board Deletion Permissions
            </h3>

            <div className='space-y-3'>
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
                      className={`w-full p-3 text-left rounded-lg border ${
                        isSelected
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
                onClick={() => setShowDeletionModal(false)}
                disabled={isUpdating}
                className='px-4 py-2 text-muted-foreground hover:text-foreground disabled:opacity-50'
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workspace Deletion Confirmation Modal */}
      {showWorkspaceDeletionModal && workspace && (
        <div className='fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6'>
          <div className='bg-card rounded-lg shadow-xl max-w-lg w-full p-6 border border-red-200 dark:border-red-800'>
            <div className='flex items-center gap-3 mb-6'>
              <div className='w-12 h-12 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center'>
                <Trash2 className='w-6 h-6 text-red-600 dark:text-red-400' />
              </div>
              <div>
                <h3 className='text-xl font-bold text-foreground'>
                  Delete Workspace
                </h3>
                <p className='text-sm text-muted-foreground'>
                  This action cannot be undone
                </p>
              </div>
            </div>

            <div className='space-y-6'>
              {/* Consequences */}
              <div className='p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg'>
                <h4 className='font-semibold text-red-800 dark:text-red-200 mb-3 flex items-center gap-2'>
                  <AlertCircle className='w-4 h-4' />
                  What will be deleted:
                </h4>
                <ul className='text-sm text-red-700 dark:text-red-300 space-y-2'>
                  <li className='flex items-center gap-2'>
                    <Trash2 className='w-3 h-3' />
                    The workspace "{workspace.name}" and all its settings
                  </li>
                  <li className='flex items-center gap-2'>
                    <LayoutGrid className='w-3 h-3' />
                    All boards, lists, and cards in this workspace
                  </li>
                  <li className='flex items-center gap-2'>
                    <Users className='w-3 h-3' />
                    All member access and permissions
                  </li>
                  <li className='flex items-center gap-2'>
                    <FileText className='w-3 h-3' />
                    All comments, attachments, and activity history
                  </li>
                </ul>
              </div>

              {/* Confirmation Input */}
              <div>
                <label className='block text-sm font-medium text-foreground mb-2'>
                  Type the workspace name{' '}
                  <span className='font-bold text-red-600'>
                    "{workspace.name}"
                  </span>{' '}
                  to confirm:
                </label>
                <input
                  type='text'
                  value={deletionConfirmName}
                  onChange={(e) => setDeletionConfirmName(e.target.value)}
                  placeholder={workspace.name}
                  className='w-full p-3 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent'
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
                  className='flex-1 px-4 py-2.5 text-sm font-medium bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2'
                >
                  {isDeletingWorkspace ? (
                    <>
                      <Loader2 className='w-4 h-4 animate-spin' />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className='w-4 h-4' />
                      Delete workspace permanently
                    </>
                  )}
                </button>
              </div>

              {/* Progress indicator */}
              {isDeletingWorkspace && (
                <div className='p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg'>
                  <div className='flex items-center gap-2 text-yellow-800 dark:text-yellow-200'>
                    <Loader2 className='w-4 h-4 animate-spin' />
                    <span className='text-sm font-medium'>
                      Deleting workspace and all related data...
                    </span>
                  </div>
                  <p className='text-xs text-yellow-700 dark:text-yellow-300 mt-1'>
                    This may take a few moments. Please do not close this
                    window.
                  </p>
                </div>
              )}

              {/* Deletion stats (if available) */}
              {deletionStats && (
                <div className='p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg'>
                  <h5 className='font-medium text-green-800 dark:text-green-200 mb-2'>
                    Deletion completed:
                  </h5>
                  <div className='grid grid-cols-2 gap-2 text-xs text-green-700 dark:text-green-300'>
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
      {isUpdating && (
        <div className='fixed inset-0 bg-black/10 backdrop-blur-sm z-[90] flex items-center justify-center'>
          <div className='bg-background/90 backdrop-blur border border-border rounded-lg p-6 shadow-xl'>
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
