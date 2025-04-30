'use client';

import Link from 'next/link';
import { Bell, Settings, Search } from 'lucide-react';
import { useState, useEffect } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/', current: true },
  { name: 'People', href: '/people', current: false },
  { name: 'Hiring', href: '/hiring', current: false },
  { name: 'Devices', href: '/devices', current: false },
  { name: 'Apps', href: '/apps', current: false },
  { name: 'Salary', href: '/salary', current: false },
  { name: 'Calendar', href: '/calendar', current: false },
  { name: 'Reviews', href: '/reviews', current: false },
];

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
    <header className='glass fixed top-4 left-4 right-4 z-50 animate-fade-in'>
      <div className='mx-auto px-6 py-3'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-8'>
            <Link
              href='/'
              className='text-xl font-semibold bg-white/50 px-4 py-2 rounded-xl backdrop-blur-sm
                         hover:bg-white/60 transition-colors animate-float'
            >
              Crextio
            </Link>

            <div className='relative'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
              <input
                type='text'
                placeholder='Search...'
                className='input pl-10 w-64'
              />
            </div>
          </div>

          <nav className='flex items-center gap-2'>
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`nav-item animate-scale ${
                  item.current ? 'nav-item-active' : ''
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          <div className='flex items-center gap-4'>
            <button
              className='btn btn-outline relative animate-scale'
              aria-label='View notifications'
            >
              <Bell className='w-5 h-5 text-gray-600' />
              <span className='absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full' />
            </button>
            <button
              className='btn btn-outline animate-scale'
              aria-label='Open settings'
            >
              <Settings className='w-5 h-5 text-gray-600' />
            </button>
            <div className='relative'>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className='relative animate-scale'
                aria-label='Open user menu'
                aria-expanded='false'
                aria-haspopup='true'
              >
                <img
                  src='https://images.unsplash.com/photo-1550525811-e5869dd03032?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=32&h=32&q=80'
                  alt='Profile'
                  className='w-10 h-10 rounded-xl ring-2 ring-white/50 hover:ring-white
                         transition-all duration-300'
                />
              </button>
              {isUserMenuOpen && (
                <div
                  className='absolute top-full right-0 mt-2 w-48 transition-all duration-200'
                  role='menu'
                  aria-orientation='vertical'
                  aria-labelledby='user-menu-button'
                >
                  <div className='glass p-4 rounded-xl space-y-2'>
                    <div className='text-sm font-medium'>Lora Piterson</div>
                    <div className='text-xs text-gray-500'>UX/UI Designer</div>
                    <div className='pt-2 border-t border-gray-200'>
                      <button
                        className='btn btn-outline w-full text-sm'
                        role='menuitem'
                      >
                        Sign out
                      </button>
                    </div>
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
