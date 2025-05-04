'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import Image from 'next/image';
import { User, Settings, LogOut, Bell } from 'lucide-react';

export function UserProfileMenu() {
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle sign out
  const handleSignOut = async () => {
    await signOut();
    setIsOpen(false);
  };

  if (!user) {
    return (
      <Link href='/auth/login' className='btn btn-primary'>
        Sign In
      </Link>
    );
  }

  // Get user initials for avatar fallback
  const getInitials = () => {
    if (!user.user_metadata?.full_name) return 'U';
    return user.user_metadata.full_name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className='relative' ref={menuRef}>
      <button
        className='flex items-center gap-2'
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className='relative'>
          {user.user_metadata?.avatar_url ? (
            <Image
              src={user.user_metadata.avatar_url}
              alt='User avatar'
              width={36}
              height={36}
              className='rounded-full'
            />
          ) : (
            <div className='w-9 h-9 rounded-full bg-primary flex items-center justify-center text-sm font-medium text-primary-foreground'>
              {getInitials()}
            </div>
          )}

          {/* Notification indicator - for future implementation */}
          {/* <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-background"></div> */}
        </div>
      </button>

      {isOpen && (
        <div className='absolute right-0 mt-2 w-64 glass-dark rounded-xl overflow-hidden shadow-lg z-50'>
          <div className='p-4 border-b border-border'>
            <div className='font-medium'>
              {user.user_metadata?.full_name || user.email}
            </div>
            <div className='text-sm text-muted-foreground'>{user.email}</div>
          </div>

          <div className='py-2'>
            <Link
              href='/profile'
              className='flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 w-full text-left text-sm'
              onClick={() => setIsOpen(false)}
            >
              <User className='h-4 w-4' />
              <span>Profile</span>
            </Link>

            <Link
              href='/notifications'
              className='flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 w-full text-left text-sm'
              onClick={() => setIsOpen(false)}
            >
              <Bell className='h-4 w-4' />
              <span>Notifications</span>
            </Link>

            <Link
              href='/settings'
              className='flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 w-full text-left text-sm'
              onClick={() => setIsOpen(false)}
            >
              <Settings className='h-4 w-4' />
              <span>Settings</span>
            </Link>
          </div>

          <div className='border-t border-border py-2'>
            <button
              className='flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 w-full text-left text-sm text-red-400'
              onClick={handleSignOut}
            >
              <LogOut className='h-4 w-4' />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
