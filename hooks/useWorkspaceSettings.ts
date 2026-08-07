import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAppStore } from '@/lib/stores/useAppStore';
import { useAuth } from '@/context/AuthContext';

export interface WorkspaceSettings {
  membership_restriction: 'anyone' | 'admins_only' | 'owner_only';
  board_creation_simplified: 'any_member' | 'admins_only' | 'owner_only';
  board_deletion_simplified: 'any_member' | 'admins_only' | 'owner_only';
}

export interface Workspace {
  id: string;
  name: string;
  color: string;
  owner_id: string;
  visibility: string;
  created_at: string;
}

export const useWorkspaceSettings = (workspaceId: string) => {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [settings, setSettings] = useState<WorkspaceSettings>({
    membership_restriction: 'anyone',
    board_creation_simplified: 'any_member',
    board_deletion_simplified: 'any_member',
  });
  const [userRole, setUserRole] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  const supabase = createClient();
  // Read AuthContext's already-verified user rather than calling getUser()
  // again here — see the comment on the same pattern in RouteGuard.tsx.
  // Each independent getUser() call on the same page load is a chance to
  // race Supabase's refresh-token rotation with another one; the fewer
  // places do it, the less that can happen.
  const { user, isLoading: authLoading } = useAuth();
  const {
    getWorkspaceSettingsCache,
    setWorkspaceSettingsCache,
    updateSettingsInCache,
    updateWorkspaceInSettingsCache,
    clearWorkspaceSettingsCache,
  } = useAppStore();

  // Fetch workspace data
  const fetchWorkspace = useCallback(async () => {
    try {
      const cached = getWorkspaceSettingsCache(workspaceId);
      if (cached?.workspace) {
        setWorkspace(cached.workspace);
        return cached.workspace;
      }

      const { data: workspaceData, error: workspaceError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .single();

      if (workspaceError) {
        setError('Workspace not found');
        return null;
      }

      setWorkspace(workspaceData);
      return workspaceData;
    } catch (err) {
      console.error('Error fetching workspace:', err);
      setError('Failed to fetch workspace');
      return null;
    }
  }, [supabase, workspaceId, getWorkspaceSettingsCache]);

  // Fetch workspace settings
  const fetchSettings = useCallback(async () => {
    try {
      const cached = getWorkspaceSettingsCache(workspaceId);
      if (cached?.settings) {
        setSettings(cached.settings);
        return cached.settings;
      }

      const { data: settingsData, error: settingsError } = await supabase
        .from('workspace_settings')
        .select('setting_type, setting_value')
        .eq('workspace_id', workspaceId);

      if (settingsError) {
        console.error('Error fetching settings:', settingsError);
        return null;
      }

      // Process settings data with backward compatibility
      const processedSettings: WorkspaceSettings = {
        membership_restriction: 'anyone',
        board_creation_simplified: 'any_member',
        board_deletion_simplified: 'any_member',
      };

      if (settingsData && settingsData.length > 0) {
        settingsData.forEach((setting) => {
          const settingType = setting.setting_type;

          // Handle membership restriction
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
              processedSettings.board_deletion_simplified =
                oldValue?.workspace_visible_boards || 'any_member';
            } catch (error) {
              processedSettings.board_deletion_simplified = 'any_member';
            }
          }
        });
      }

      setSettings(processedSettings);
      return processedSettings;
    } catch (err) {
      console.error('Error fetching settings:', err);
      return null;
    }
  }, [supabase, workspaceId, getWorkspaceSettingsCache]);

  // Fetch user role
  const fetchUserRole = useCallback(
    async (workspaceData: Workspace) => {
      try {
        if (!user) {
          setError('User not authenticated');
          return null;
        }

        // Check if user is owner first
        if (workspaceData.owner_id === user.id) {
          return 'owner';
        }

        // Check membership
        const { data: memberData, error: memberError } = await supabase
          .from('workspace_members')
          .select('role')
          .eq('workspace_id', workspaceId)
          .eq('profile_id', user.id)
          .single();

        if (memberError && memberError.code !== 'PGRST116') {
          setError('Access denied to this workspace');
          return null;
        }

        return memberData?.role || null;
      } catch (err) {
        console.error('Error fetching user role:', err);
        setError('Failed to fetch user role');
        return null;
      }
    },
    [supabase, workspaceId, user]
  );

  // Initialize data with caching
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      // Check cache first - show cached data immediately if available
      const cached = getWorkspaceSettingsCache(workspaceId);
      if (cached) {
        setWorkspace(cached.workspace);
        setSettings(cached.settings);
        setUserRole(cached.userRole);
        setLoading(false);
        setLastFetchTime(Date.now());

        // Background refresh: fetch fresh data without blocking UI.
        // userRole is applied as soon as it resolves, independent of
        // workspace/settings — it's the security-relevant piece (gates
        // whether the page renders "Access Restricted"), and tying it to
        // workspace/settings also succeeding meant one of those failing
        // silently left a stale cached role (e.g. from before the user was
        // actually confirmed as owner) displayed indefinitely.
        setTimeout(async () => {
          try {
            const workspaceData = await fetchWorkspace();
            const settingsData = await fetchSettings();

            if (workspaceData) {
              const userRoleData = await fetchUserRole(workspaceData);

              if (userRoleData) {
                setUserRole(userRoleData);
              }

              if (workspaceData && settingsData && userRoleData) {
                setWorkspaceSettingsCache(
                  workspaceId,
                  workspaceData,
                  settingsData,
                  userRoleData
                );
                setWorkspace(workspaceData);
                setSettings(settingsData);
                setLastFetchTime(Date.now());
              }
            }
          } catch (error) {
            console.error('Background refresh failed:', error);
          }
        }, 100);

        return;
      }

      // No cache available - fetch fresh data in parallel
      const workspaceData = await fetchWorkspace();
      if (!workspaceData) {
        setLoading(false);
        return;
      }

      const [settingsData, userRoleData] = await Promise.all([
        fetchSettings(),
        fetchUserRole(workspaceData),
      ]);

      // This was the actual bug behind "works on refresh but not on first
      // load": this branch fetched userRoleData correctly and wrote it to
      // the cache below, but never applied it to this hook's own userRole
      // state — so the page's canManageSettings check saw userRole stuck
      // at its initial '', and rendered "Access Restricted" regardless of
      // the real (correctly fetched) role. A subsequent load that hit the
      // cache-read branch above *did* call setUserRole, which is why it
      // "worked on retry" — the cache had the right answer the whole time,
      // it just was never displayed the first time.
      if (userRoleData) {
        setUserRole(userRoleData);
      }

      // Cache the results
      if (workspaceData && settingsData && userRoleData) {
        setWorkspaceSettingsCache(
          workspaceId,
          workspaceData,
          settingsData,
          userRoleData
        );
      }

      setLoading(false);
      setLastFetchTime(Date.now());
    };

    // Wait for AuthContext to finish resolving `user` — fetchUserRole needs
    // it. This used to also have to race RouteGuard's own separate
    // getUser() call, which made waiting here cost real time; now that
    // RouteGuard reads AuthContext too instead of doing its own check,
    // this isn't competing with anything and resolves as fast as
    // AuthContext itself does.
    if (workspaceId && !authLoading) {
      loadData();
    }
  }, [
    workspaceId,
    authLoading,
    getWorkspaceSettingsCache,
    fetchWorkspace,
    fetchSettings,
    fetchUserRole,
    setWorkspaceSettingsCache,
  ]);

  // Memoized refetch function
  const refetch = useCallback(async () => {
    clearWorkspaceSettingsCache(workspaceId);

    setLoading(true);
    setError(null);

    const workspaceData = await fetchWorkspace();
    if (!workspaceData) {
      setLoading(false);
      return;
    }

    const [settingsData, userRoleData] = await Promise.all([
      fetchSettings(),
      fetchUserRole(workspaceData),
    ]);

    // Same fix as the initial-load effect above: apply the fetched role to
    // this hook's own state, not just to the cache.
    if (userRoleData) {
      setUserRole(userRoleData);
    }

    if (workspaceData && settingsData && userRoleData) {
      setWorkspaceSettingsCache(
        workspaceId,
        workspaceData,
        settingsData,
        userRoleData
      );
    }

    setLoading(false);
    setLastFetchTime(Date.now());
  }, [
    workspaceId,
    clearWorkspaceSettingsCache,
    fetchWorkspace,
    fetchSettings,
    fetchUserRole,
    setWorkspaceSettingsCache,
  ]);

  // These are what the settings page should actually call after a save —
  // updateSettingsInCache/updateWorkspaceInSettingsCache (still exposed
  // below, since other code may read them) only ever wrote through to the
  // Zustand cache, never to this hook's own workspace/settings state. That
  // state is what's actually rendered, so a save appeared to work (cache
  // was correct — a fresh load elsewhere would show it) but the page you
  // were looking at didn't update until something forced a refetch. These
  // wrappers update both in one call.
  const updateWorkspaceLocal = useCallback(
    (updates: Partial<Workspace>) => {
      setWorkspace((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, ...updates };
        updateWorkspaceInSettingsCache(workspaceId, updated);
        return updated;
      });
    },
    [workspaceId, updateWorkspaceInSettingsCache]
  );

  const updateSettingsLocal = useCallback(
    (updates: Partial<WorkspaceSettings>) => {
      setSettings((prev) => {
        const updated = { ...prev, ...updates };
        updateSettingsInCache(workspaceId, updated);
        return updated;
      });
    },
    [workspaceId, updateSettingsInCache]
  );

  return {
    workspace,
    settings,
    userRole,
    loading,
    error,
    refetch,
    lastFetchTime,
    updateSettingsInCache,
    updateWorkspaceInSettingsCache,
    updateWorkspaceLocal,
    updateSettingsLocal,
  };
};
