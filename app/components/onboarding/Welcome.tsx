'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { CheckSquare, Plus, Users, Zap } from 'lucide-react';

export default function Welcome() {
  const { user } = useAuth();
  const router = useRouter();

  const handleGetStarted = () => {
    // Later you can route to workspace creation flow
    router.push('/create-workspace');
  };

  return (
    <div className='min-h-screen bg-gradient-to-br from-background to-background/80 flex items-center justify-center p-6'>
      <div className='max-w-md w-full text-center'>
        <div className='mb-8'>
          <div className='w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4'>
            <CheckSquare className='w-8 h-8 text-primary' />
          </div>
          <h1 className='text-2xl font-bold mb-2'>
            Welcome to Taskmaster, {user?.user_metadata?.name || 'there'}! 👋
          </h1>
          <p className='text-muted-foreground'>
            You're all set up! Ready to organize your first project?
          </p>
        </div>

        <div className='space-y-4 mb-8'>
          <div className='flex items-center gap-3 p-3 rounded-lg bg-muted/10'>
            <div className='w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center'>
              <Zap className='w-4 h-4 text-blue-500' />
            </div>
            <div className='text-left'>
              <div className='font-medium text-sm'>Create Workspaces</div>
              <div className='text-xs text-muted-foreground'>
                Organize your projects
              </div>
            </div>
          </div>

          <div className='flex items-center gap-3 p-3 rounded-lg bg-muted/10'>
            <div className='w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center'>
              <Users className='w-4 h-4 text-green-500' />
            </div>
            <div className='text-left'>
              <div className='font-medium text-sm'>Invite Team Members</div>
              <div className='text-xs text-muted-foreground'>
                Collaborate with others
              </div>
            </div>
          </div>

          <div className='flex items-center gap-3 p-3 rounded-lg bg-muted/10'>
            <div className='w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center'>
              <CheckSquare className='w-4 h-4 text-purple-500' />
            </div>
            <div className='text-left'>
              <div className='font-medium text-sm'>Manage Tasks</div>
              <div className='text-xs text-muted-foreground'>
                Create boards, lists & cards
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleGetStarted}
          className='w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2'
        >
          <Plus className='w-4 h-4' />
          Create Your First Workspace
        </button>

        <p className='text-xs text-muted-foreground mt-4'>
          You can always create more workspaces later
        </p>
      </div>
    </div>
  );
}
