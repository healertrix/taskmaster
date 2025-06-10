'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Trash2, RefreshCw } from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  created_at: string;
  color: string;
}

export default function CleanupPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const supabase = createClient();

  const fetchWorkspaces = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data, error } = await supabase
        .from('workspaces')
        .select('id, name, created_at, color')
        .eq('owner_id', user.user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setWorkspaces(data || []);
    } catch (error) {
      console.error('Error fetching workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteWorkspace = async (workspaceId: string) => {
    if (!confirm('Are you sure you want to delete this workspace?')) return;

    setDeleting(workspaceId);
    try {
      // Delete workspace members first
      await supabase
        .from('workspace_members')
        .delete()
        .eq('workspace_id', workspaceId);

      // Delete workspace settings
      await supabase
        .from('workspace_settings')
        .delete()
        .eq('workspace_id', workspaceId);

      // Delete the workspace
      const { error } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', workspaceId);

      if (error) throw error;

      // Refresh the list
      await fetchWorkspaces();
      alert('Workspace deleted successfully!');
    } catch (error) {
      console.error('Error deleting workspace:', error);
      alert('Error deleting workspace: ' + error.message);
    } finally {
      setDeleting(null);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  if (loading) {
    return (
      <div className='min-h-screen bg-gray-100 flex items-center justify-center'>
        <div className='text-center'>
          <RefreshCw className='animate-spin h-8 w-8 text-blue-600 mx-auto mb-4' />
          <p>Loading workspaces...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-100 p-8'>
      <div className='max-w-4xl mx-auto'>
        <div className='bg-white rounded-lg shadow-lg p-6'>
          <div className='flex items-center justify-between mb-6'>
            <h1 className='text-2xl font-bold text-gray-900'>
              Workspace Cleanup
            </h1>
            <button
              onClick={fetchWorkspaces}
              className='flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'
            >
              <RefreshCw className='h-4 w-4' />
              Refresh
            </button>
          </div>

          <div className='mb-4'>
            <p className='text-gray-600'>
              You have <strong>{workspaces.length}</strong> workspaces.
              {workspaces.length > 1 && (
                <span className='text-red-600'>
                  {' '}
                  You can delete the duplicate ones below.
                </span>
              )}
            </p>
          </div>

          <div className='space-y-4'>
            {workspaces.map((workspace, index) => (
              <div
                key={workspace.id}
                className='flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50'
              >
                <div className='flex items-center gap-4'>
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold ${
                      workspace.color.startsWith('#')
                        ? ''
                        : workspace.color || 'bg-blue-600'
                    }`}
                    style={
                      workspace.color.startsWith('#')
                        ? { backgroundColor: workspace.color }
                        : {}
                    }
                  >
                    {workspace.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className='font-semibold text-gray-900'>
                      {workspace.name}
                    </h3>
                    <p className='text-sm text-gray-500'>
                      Created: {new Date(workspace.created_at).toLocaleString()}
                      {index === 0 && workspaces.length > 1 && (
                        <span className='ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded'>
                          KEEP (Oldest)
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {index > 0 && (
                  <button
                    onClick={() => deleteWorkspace(workspace.id)}
                    disabled={deleting === workspace.id}
                    className='flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    {deleting === workspace.id ? (
                      <RefreshCw className='h-4 w-4 animate-spin' />
                    ) : (
                      <Trash2 className='h-4 w-4' />
                    )}
                    Delete Duplicate
                  </button>
                )}
              </div>
            ))}
          </div>

          {workspaces.length === 0 && (
            <div className='text-center py-8'>
              <p className='text-gray-500'>No workspaces found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
