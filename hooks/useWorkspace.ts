import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';

export interface WorkspaceData {
  id: string;
  name: string;
  description: string | null;
  color: string;
  owner_id: string;
  visibility: 'private' | 'public';
  created_at: string;
  updated_at: string;
}

export const useWorkspace = (workspaceId: string) => {
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchWorkspace = useCallback(async () => {
    if (!workspaceId) {
      setError('Workspace ID is required');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .single();

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (!data) {
        throw new Error('Workspace not found');
      }

      setWorkspace(data);
    } catch (err) {
      console.error('Error fetching workspace:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to fetch workspace'
      );
      setWorkspace(null);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, supabase]);

  const updateWorkspaceName = useCallback(
    async (newName: string) => {
      if (!workspace || !newName.trim()) return false;

      try {
        const { error } = await supabase
          .from('workspaces')
          .update({ name: newName.trim() })
          .eq('id', workspaceId);

        if (error) throw error;

        setWorkspace((prev) =>
          prev ? { ...prev, name: newName.trim() } : null
        );
        return true;
      } catch (err) {
        console.error('Error updating workspace name:', err);
        return false;
      }
    },
    [workspace, workspaceId, supabase]
  );

  const updateWorkspaceDescription = useCallback(
    async (newDescription: string) => {
      if (!workspace) return false;

      try {
        const { error } = await supabase
          .from('workspaces')
          .update({ description: newDescription.trim() || null })
          .eq('id', workspaceId);

        if (error) throw error;

        setWorkspace((prev) =>
          prev ? { ...prev, description: newDescription.trim() || null } : null
        );
        return true;
      } catch (err) {
        console.error('Error updating workspace description:', err);
        return false;
      }
    },
    [workspace, workspaceId, supabase]
  );

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  return {
    workspace,
    loading,
    error,
    updateWorkspaceName,
    updateWorkspaceDescription,
    refetch: fetchWorkspace,
  };
};
