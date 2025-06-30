import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAppStore } from '@/lib/stores/useAppStore';

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  profile_id: string;
  role: 'owner' | 'admin' | 'member';
  created_at: string;
  profile: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
}

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

export const useWorkspaceMembers = (workspaceId: string) => {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  const supabase = createClient();
  const {
    getWorkspaceMembersCache,
    setWorkspaceMembersCache,
    updateMemberInCache,
    addMemberToCache,
    removeMemberFromCache,
    clearWorkspaceMembersCache,
  } = useAppStore();

  // Check cache first
  const checkCache = useCallback(() => {
    const cached = getWorkspaceMembersCache(workspaceId);
    if (cached) {
      setWorkspace(cached.workspace);
      setMembers(cached.members);
      setSettings(cached.settings);
      setLoading(false);
      setError(null);
      return true;
    }
    return false;
  }, [workspaceId, getWorkspaceMembersCache]);

  // Fetch workspace data
  const fetchWorkspace = useCallback(async () => {
    try {
      const cached = getWorkspaceMembersCache(workspaceId);
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
  }, [supabase, workspaceId, getWorkspaceMembersCache]);

  // Fetch workspace settings
  const fetchSettings = useCallback(async () => {
    try {
      const cached = getWorkspaceMembersCache(workspaceId);
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

      // Process settings data
      const processedSettings: WorkspaceSettings = {
        membership_restriction: 'admins_only',
        board_creation_simplified: 'any_member',
        board_deletion_simplified: 'any_member',
      };

      settingsData?.forEach((setting) => {
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
      });

      setSettings(processedSettings);
      return processedSettings;
    } catch (err) {
      console.error('Error fetching settings:', err);
      return null;
    }
  }, [supabase, workspaceId, getWorkspaceMembersCache]);

  // Fetch members with profiles in parallel
  const fetchMembers = useCallback(async () => {
    try {
      const cached = getWorkspaceMembersCache(workspaceId);
      if (cached?.members) {
        setMembers(cached.members);
        return cached.members;
      }

      // Optimized: Fetch workspace, members, and profiles in parallel
      const [workspaceResult, membersResult] = await Promise.all([
        supabase.from('workspaces').select('*').eq('id', workspaceId).single(),
        supabase
          .from('workspace_members')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: true }),
      ]);

      if (workspaceResult.error) {
        setError('Workspace not found');
        return [];
      }

      if (membersResult.error) {
        console.error('Error fetching members:', membersResult.error);
        setError('Failed to fetch members');
        return [];
      }

      let allMembers = membersResult.data || [];

      // Fetch profiles in parallel if there are members
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
        member.profile_id === workspaceResult.data.owner_id
          ? { ...member, role: 'owner' }
          : member
      );

      // Ensure workspace owner is always included
      const ownerExists = allMembers.some(
        (member) => member.profile_id === workspaceResult.data.owner_id
      );

      if (!ownerExists) {
        // Fetch owner's profile
        const { data: ownerProfile, error: ownerProfileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', workspaceResult.data.owner_id)
          .single();

        if (!ownerProfileError && ownerProfile) {
          const ownerMember: WorkspaceMember = {
            id: `owner-${workspaceResult.data.owner_id}`,
            workspace_id: workspaceId,
            profile_id: workspaceResult.data.owner_id,
            role: 'owner',
            created_at:
              workspaceResult.data.created_at || new Date().toISOString(),
            profile: ownerProfile,
          };
          allMembers.unshift(ownerMember);
        }
      }

      setMembers(allMembers);
      return allMembers;
    } catch (err) {
      console.error('Error in fetchMembers:', err);
      setError('Failed to fetch members');
      return [];
    }
  }, [supabase, workspaceId, getWorkspaceMembersCache]);

  // Initialize data with caching
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      // Check cache first - show cached data immediately if available
      const cached = getWorkspaceMembersCache(workspaceId);
      if (cached) {
        setWorkspace(cached.workspace);
        setMembers(cached.members);
        setSettings(cached.settings);
        setLoading(false);
        setLastFetchTime(Date.now());

        // Background refresh: fetch fresh data without blocking UI
        setTimeout(async () => {
          try {
            const [workspaceData, membersData, settingsData] =
              await Promise.all([
                fetchWorkspace(),
                fetchMembers(),
                fetchSettings(),
              ]);

            if (workspaceData && membersData && settingsData) {
              setWorkspaceMembersCache(
                workspaceId,
                workspaceData,
                membersData,
                settingsData
              );
              setWorkspace(workspaceData);
              setMembers(membersData);
              setSettings(settingsData);
              setLastFetchTime(Date.now());
            }
          } catch (error) {
            console.error('Background refresh failed:', error);
          }
        }, 100);

        return;
      }

      // No cache available - fetch fresh data in parallel
      const [workspaceData, membersData, settingsData] = await Promise.all([
        fetchWorkspace(),
        fetchMembers(),
        fetchSettings(),
      ]);

      // Cache the results
      if (workspaceData && membersData && settingsData) {
        setWorkspaceMembersCache(
          workspaceId,
          workspaceData,
          membersData,
          settingsData
        );
      }

      setLoading(false);
      setLastFetchTime(Date.now());
    };

    if (workspaceId) {
      loadData();
    }
  }, [
    workspaceId,
    getWorkspaceMembersCache,
    fetchWorkspace,
    fetchMembers,
    fetchSettings,
    setWorkspaceMembersCache,
  ]);

  // Memoized refetch function
  const refetch = useCallback(async () => {
    clearWorkspaceMembersCache(workspaceId);

    setLoading(true);
    setError(null);

    const [workspaceData, membersData, settingsData] = await Promise.all([
      fetchWorkspace(),
      fetchMembers(),
      fetchSettings(),
    ]);

    if (workspaceData && membersData && settingsData) {
      setWorkspaceMembersCache(
        workspaceId,
        workspaceData,
        membersData,
        settingsData
      );
    }

    setLoading(false);
    setLastFetchTime(Date.now());
  }, [
    workspaceId,
    clearWorkspaceMembersCache,
    fetchWorkspace,
    fetchMembers,
    fetchSettings,
    setWorkspaceMembersCache,
  ]);

  return {
    workspace,
    members,
    settings,
    loading,
    error,
    refetch,
    lastFetchTime,
    updateMemberInCache,
    addMemberToCache,
    removeMemberFromCache,
  };
};
