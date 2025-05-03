'use client';

import Link from 'next/link';
import {
  Search,
  CheckSquare,
  Plus,
  Bell,
  User,
  Settings,
  LogOut,
} from 'lucide-react';
import { useState, useEffect } from 'react';

export function DashboardHeader() {
  const [mounted, setMounted] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className='h-[68px]'></div>;
  }

  return (
    <header className='fixed top-0 left-0 right-0 superhero-header z-50'>
      <div className='container mx-auto px-4 py-3'>
        <div className='flex items-center justify-between'>
          {/* Left section */}
          <div className='flex items-center space-x-5'>
            <Link
              href='/'
              className='font-bold text-xl flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity'
            >
              <CheckSquare className='w-6 h-6 text-primary' />
              Taskmaster
            </Link>
          </div>

          {/* Search and Create */}
          <div className='flex items-center max-w-lg w-full mx-6'>
            <div className='relative flex-1'>
              <Search className='absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground' />
              <input
                type='text'
                placeholder='Search tasks, projects, etc...'
                className='w-full pl-10 pr-4 py-2.5 superhero-header-search text-foreground placeholder-muted-foreground rounded-lg border focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all input'
              />
            </div>
            <button className='btn btn-primary flex items-center gap-1.5 text-sm ml-3 hover:bg-primary/90 hover:text-primary-foreground'>
              <Plus className='w-4 h-4' />
              Create
            </button>
          </div>

          {/* Right section */}
          <div className='flex items-center space-x-4'>
            <button
              className='p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors relative'
              aria-label='Notifications'
            >
              <Bell className='w-5 h-5' />
              <span className='absolute top-1.5 right-1.5 w-2 h-2 bg-secondary rounded-full border-2 border-background'></span>
            </button>

            <div className='relative'>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className='w-9 h-9 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-primary-foreground text-sm hover:opacity-90 transition-opacity ring-2 ring-primary/30 hover:ring-primary/50'
                aria-label='Profile menu'
                aria-haspopup='true'
              >
                <User className='w-5 h-5' />
              </button>

              {isUserMenuOpen && (
                <div className='absolute top-full right-0 mt-2 w-60 card p-2 animate-fade-in z-10'>
                  <div className='px-2 py-2 border-b border-border mb-1'>
                    <p className='text-sm font-semibold text-foreground'>
                      User Name
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      user@example.com
                    </p>
                  </div>
                  <nav className='flex flex-col gap-1'>
                    <button className='flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors'>
                      <Settings className='w-4 h-4' /> Settings
                    </button>
                    <button className='flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors'>
                      <LogOut className='w-4 h-4' /> Sign out
                    </button>
                  </nav>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
