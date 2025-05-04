'use client';

import { useState, useEffect } from 'react';
import { DashboardHeader } from '../components/dashboard/header';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/utils/supabase/client';
import Image from 'next/image';
import { User, Mail, Clock } from 'lucide-react';

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

        {/* Activity Section - Can be expanded later */}
        <div className='glass-dark rounded-xl p-6 mt-8'>
          <h2 className='text-xl font-semibold mb-6'>Recent Activity</h2>
          <div className='py-8 text-center text-muted-foreground'>
            <p>Your activity will appear here.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
