import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import {
  Workspace,
  WorkspaceMember,
  Invitation,
  WorkspaceSettings,
} from './useWorkspaceMembersStore';

export function useWorkspaceMembersQuery(workspaceId: string) {
  return useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: async () => {
      const supabase = createClient();
      // Fetch workspace
      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .single();
      if (workspaceError) throw workspaceError;
      // Fetch members
      const { data: members, error: membersError } = await supabase
        .from('workspace_members')
        .select('*, profile:profiles(*)')
        .eq('workspace_id', workspaceId);
      if (membersError) throw membersError;
      // Fetch invitations
      const { data: invitations, error: invitationsError } = await supabase
        .from('workspace_invitations')
        .select('*')
        .eq('workspace_id', workspaceId);
      if (invitationsError) throw invitationsError;
      // Fetch settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('workspace_settings')
        .select('setting_type, setting_value')
        .eq('workspace_id', workspaceId);
      if (settingsError) throw settingsError;
      // Normalize settings
      const settings: Partial<WorkspaceSettings> = {};
      settingsData?.forEach((setting: any) => {
        settings[setting.setting_type] = setting.setting_value;
      });
      return {
        workspace,
        members,
        invitations,
        settings: settings as WorkspaceSettings,
      };
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
