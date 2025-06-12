import { useState, useEffect, useCallback } from 'react';

type BoardCreationInfo = {
  canCreatePublic: boolean;
  canCreateWorkspaceVisible: boolean;
  canCreatePrivate: boolean;
  reason: string;
};

export type WorkspaceWithPermissions = {
  id: string;
  name: string;
  color: string;
  visibility: string;
  userRole: string;
  isOwner: boolean;
  canCreateBoards: boolean;
  boardCreationInfo: BoardCreationInfo;
};

export const useWorkspacesWithPermissions = () => {
  const [workspaces, setWorkspaces] = useState<WorkspaceWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/workspaces');

      if (!response.ok) {
        throw new Error('Failed to fetch workspaces');
      }

      const data = await response.json();
      setWorkspaces(data.workspaces || []);
    } catch (err) {
      console.error('Error fetching workspaces with permissions:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to fetch workspaces'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  return {
    workspaces,
    loading,
    error,
    refetch: fetchWorkspaces,
  };
};
