import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
};

export type WorkspaceMember = {
  id: string;
  workspace_id: string;
  profile_id: string;
  role: 'owner' | 'admin' | 'member';
  created_at: string;
  profile: Profile;
};

export type WorkspaceSettings = {
  membership_restriction: 'anyone' | 'admins_only' | 'owner_only';
  board_creation_simplified: 'any_member' | 'admins_only' | 'owner_only';
  board_deletion_simplified: 'any_member' | 'admins_only' | 'owner_only';
};

export type Workspace = {
  id: string;
  name: string;
  color: string;
  owner_id: string;
  settings?: WorkspaceSettings;
};

export type Invitation = {
  id: string;
  workspace_id: string;
  email: string;
  role: 'admin' | 'member';
  invited_by: string;
  created_at: string;
  status: 'pending' | 'accepted' | 'declined';
};

// Fetch workspace data
export const useWorkspace = (workspaceId: string) => {
  return useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: async (): Promise<Workspace> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
  });
};

// Fetch workspace settings
export const useWorkspaceSettings = (workspaceId: string) => {
  return useQuery({
    queryKey: ['workspace-settings', workspaceId],
    queryFn: async (): Promise<WorkspaceSettings> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('workspace_settings')
        .select('setting_type, setting_value')
        .eq('workspace_id', workspaceId);

      if (error) throw error;

      // Process settings data
      const processedSettings: WorkspaceSettings = {
        membership_restriction: 'admins_only',
        board_creation_simplified: 'any_member',
        board_deletion_simplified: 'any_member',
      };

      data?.forEach((setting) => {
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

      return processedSettings;
    },
    enabled: !!workspaceId,
  });
};

// Fetch workspace members
export const useWorkspaceMembers = (workspaceId: string) => {
  return useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: async (): Promise<WorkspaceMember[]> => {
      const supabase = createClient();

      // Get workspace first to get owner info
      const { data: workspaceData, error: workspaceError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .single();

      if (workspaceError) throw workspaceError;

      // Fetch all workspace members
      const { data: membersData, error: membersError } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true });

      if (membersError) throw membersError;

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
        const { data: ownerProfile, error: ownerProfileError } = await supabase
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
            created_at: workspaceData.created_at || new Date().toISOString(),
            profile: ownerProfile,
          };
          allMembers.unshift(ownerMember); // Add owner at the beginning
        }
      }

      return allMembers;
    },
    enabled: !!workspaceId,
  });
};

// Fetch pending invitations
export const useWorkspaceInvitations = (
  workspaceId: string,
  userRole: string
) => {
  return useQuery({
    queryKey: ['workspace-invitations', workspaceId],
    queryFn: async (): Promise<Invitation[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!workspaceId && (userRole === 'owner' || userRole === 'admin'),
  });
};

// Search profiles
export const useProfileSearch = (query: string, workspaceId: string) => {
  return useQuery({
    queryKey: ['profile-search', query, workspaceId],
    queryFn: async () => {
      if (!query || query.length < 2) return [];

      const searchUrl = `/api/profiles/search?q=${encodeURIComponent(
        query
      )}&workspace_id=${workspaceId}`;

      const response = await fetch(searchUrl);
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Search failed');
      }

      const data = await response.json();
      return data.profiles || [];
    },
    enabled: !!query && query.length >= 2 && !!workspaceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Add member mutation
export const useAddMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workspaceId,
      profileId,
      role,
    }: {
      workspaceId: string;
      profileId: string;
      role: 'admin' | 'member';
    }) => {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/add-member`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile_id: profileId, role }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add member');
      }

      return response.json();
    },
    onSuccess: (_, { workspaceId }) => {
      // Invalidate and refetch members
      queryClient.invalidateQueries({
        queryKey: ['workspace-members', workspaceId],
      });
    },
  });
};

// Remove member mutation
export const useRemoveMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workspaceId,
      profileId,
    }: {
      workspaceId: string;
      profileId: string;
    }) => {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/remove-member`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile_id: profileId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove member');
      }

      return response.json();
    },
    onSuccess: (_, { workspaceId }) => {
      // Invalidate and refetch members
      queryClient.invalidateQueries({
        queryKey: ['workspace-members', workspaceId],
      });
    },
  });
};

// Change member role mutation
export const useChangeMemberRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workspaceId,
      profileId,
      role,
    }: {
      workspaceId: string;
      profileId: string;
      role: 'admin' | 'member';
    }) => {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/members/${profileId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to change member role');
      }

      return response.json();
    },
    onSuccess: (_, { workspaceId }) => {
      // Invalidate and refetch members
      queryClient.invalidateQueries({
        queryKey: ['workspace-members', workspaceId],
      });
    },
  });
};
