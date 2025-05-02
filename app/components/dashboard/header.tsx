'use client';

import Link from 'next/link';
import { Search, CheckSquare, Plus, Bell, User } from 'lucide-react';
import { useState, useEffect } from 'react';

export function DashboardHeader() {
  const [mounted, setMounted] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <header className='fixed top-0 left-0 right-0 bg-blue-900 text-white z-50'>
      <div className='mx-auto px-4 py-2'>
        <div className='flex items-center justify-between'>
          {/* Left section */}
          <div className='flex items-center space-x-4'>
            <Link
              href='/'
              className='font-bold text-lg flex items-center gap-2'
            >
              <CheckSquare className='w-5 h-5' />
              Taskmaster
            </Link>

            <button className='px-3 py-1 bg-blue-800 hover:bg-blue-700 rounded text-sm transition-colors'>
              Boards
            </button>

            <button className='px-3 py-1 hover:bg-blue-800 rounded text-sm transition-colors'>
              Create
              <Plus className='w-4 h-4 ml-1 inline-block' />
            </button>
          </div>

          {/* Search */}
          <div className='relative max-w-md w-full mx-4'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300' />
            <input
              type='text'
              placeholder='Search'
              className='w-full pl-10 pr-4 py-1.5 bg-blue-800 text-white placeholder-blue-300 rounded border border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent'
            />
          </div>

          {/* Right section */}
          <div className='flex items-center space-x-3'>
            <button
              className='p-1.5 hover:bg-blue-800 rounded-full'
              aria-label='Notifications'
            >
              <Bell className='w-5 h-5' />
            </button>

            <div className='relative'>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className='w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-sm hover:bg-purple-500 transition-colors'
                aria-label='Profile menu'
                aria-haspopup='true'
              >
                <User className='w-4 h-4' />
              </button>

              {isUserMenuOpen && (
                <div className='absolute top-full right-0 mt-2 w-48 bg-white text-gray-800 rounded-md shadow-lg overflow-hidden'>
                  <div className='p-2'>
                    <div className='text-sm font-medium p-2'>User Profile</div>
                    <div className='border-t border-gray-200 my-1'></div>
                    <button className='w-full text-left p-2 text-sm hover:bg-gray-100 rounded'>
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
