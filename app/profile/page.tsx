'use client';

import { useState, useEffect } from 'react';
import { DashboardHeader } from '../components/dashboard/header';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/utils/supabase/client';
import Image from 'next/image';
import { 
  User, 
  Mail, 
  Clock, 
  Activity, 
  Calendar, 
  CheckSquare, 
  Star, 
  BarChart3,
  PlusCircle,
  FileEdit,
  MessageSquare
} from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        setProfile(data);
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [user, supabase]);

  if (!user) {
    return null; // Let the RouteGuard handle redirection
  }

  const getInitials = () => {
    if (!user.user_metadata?.full_name) return 'U';
    return user.user_metadata.full_name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className='min-h-screen dot-pattern-dark'>
      <DashboardHeader />

      <main className='container mx-auto max-w-5xl px-4 pt-24 pb-16'>
        <div className='glass-dark rounded-xl overflow-hidden'>
          <div className='h-32 bg-gradient-to-r from-primary/20 to-accent/20 relative'>
            {/* Banner area */}
          </div>

          <div className='px-8 pb-8'>
            <div className='flex flex-col md:flex-row gap-8'>
              {/* Profile Image */}
              <div className='-mt-16 flex flex-col items-center'>
                <div className='relative mb-4'>
                  {user.user_metadata?.avatar_url ? (
                    <Image
                      src={user.user_metadata.avatar_url}
                      alt='User avatar'
                      width={96}
                      height={96}
                      className='rounded-full border-4 border-background shadow-lg'
                    />
                  ) : (
                    <div className='w-24 h-24 rounded-full bg-primary flex items-center justify-center text-2xl font-medium text-primary-foreground border-4 border-background shadow-lg'>
                      {getInitials()}
                    </div>
                  )}
                </div>
              </div>

              {/* Profile Info */}
              <div className='flex-1 pt-4'>
                <h1 className='text-2xl font-bold mb-1'>
                  {user.user_metadata?.full_name || 'User'}
                </h1>

                <div className='space-y-3 mt-4'>
                  <div className='flex items-center gap-3 text-sm'>
                    <Mail className='w-4 h-4 text-muted-foreground' />
                    <span>{user.email}</span>
                  </div>

                  {user.created_at && (
                    <div className='flex items-center gap-3 text-sm'>
                      <Clock className='w-4 h-4 text-muted-foreground' />
                      <span>Member since {formatDate(user.created_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Activity Section - Improved design */}
        <div className='glass-dark rounded-xl p-6 mt-8'>
          <div className='flex items-center justify-between mb-6'>
            <h2 className='text-xl font-semibold flex items-center'>
              <Activity className='w-5 h-5 mr-2 text-primary' />
              Recent Activity
            </h2>
            <div className='flex space-x-2'>
              <button className='px-3 py-1.5 text-xs bg-background hover:bg-muted/20 rounded-lg transition-colors text-foreground'>
                All
              </button>
              <button className='px-3 py-1.5 text-xs bg-background/40 hover:bg-muted/20 rounded-lg transition-colors text-muted-foreground'>
                Comments
              </button>
              <button className='px-3 py-1.5 text-xs bg-background/40 hover:bg-muted/20 rounded-lg transition-colors text-muted-foreground'>
                Cards
              </button>
            </div>
          </div>
          
          {/* Empty state with better design */}
          <div className='bg-background/30 rounded-xl p-8 flex flex-col items-center justify-center border border-border'>
            <div className='w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4'>
              <Activity className='w-8 h-8 text-primary/70' />
            </div>
            <h3 className='text-lg font-medium mb-2'>No activity yet</h3>
            <p className='text-muted-foreground text-center max-w-md mb-6'>
              Your recent actions across boards and cards will appear here. Start collaborating to see your activity.
            </p>
            <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-lg'>
              <div className='flex flex-col items-center p-4 rounded-lg bg-background/50 hover:bg-background/70 transition-colors'>
                <PlusCircle className='w-6 h-6 text-blue-500 mb-2' />
                <span className='text-xs text-center'>Create cards</span>
              </div>
              <div className='flex flex-col items-center p-4 rounded-lg bg-background/50 hover:bg-background/70 transition-colors'>
                <MessageSquare className='w-6 h-6 text-green-500 mb-2' />
                <span className='text-xs text-center'>Add comments</span>
              </div>
              <div className='flex flex-col items-center p-4 rounded-lg bg-background/50 hover:bg-background/70 transition-colors'>
                <FileEdit className='w-6 h-6 text-purple-500 mb-2' />
                <span className='text-xs text-center'>Edit boards</span>
              </div>
            </div>
          </div>
          
          {/* Future activity items would be listed here */}
          {/* Example of what an activity item might look like (commented out) */}
          {/* 
          <div className='border-b border-border py-4 first:pt-0 last:border-0 last:pb-0'>
            <div className='flex'>
              <div className='mr-4 mt-1'>
                <div className='w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center'>
                  <CheckSquare className='w-4 h-4 text-blue-500' />
                </div>
              </div>
              <div className='flex-1'>
                <p className='text-sm'>
                  <span className='font-medium'>You</span> completed a task{' '}
                  <span className='font-medium text-primary'>Update design specs</span> on{' '}
                  <span className='font-medium'>Website Redesign</span> board
                </p>
                <span className='text-xs text-muted-foreground'>2 hours ago</span>
              </div>
            </div>
          </div>
          */}
        </div>
      </main>
    </div>
  );
}
