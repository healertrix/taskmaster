'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { DashboardHeader } from '../components/dashboard/header';
import { BoardCard } from '../components/board/BoardCard';
import {
  ArrowLeft,
  Star,
  Search,
  Filter,
  Grid3x3,
  Loader2,
} from 'lucide-react';

function StarredBoardsPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // Don't render anything on server
  }

  return (
    <div className='min-h-screen dot-pattern-dark'>
      <DashboardHeader />
      <main className='container mx-auto max-w-7xl px-4 pt-24 pb-16'>
        <div className='flex items-center justify-between mb-8'>
          <div className='flex items-center gap-4'>
            <Link
              href='/'
              className='p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
              title='Back to Home'
            >
              <ArrowLeft className='w-5 h-5' />
            </Link>
            <div className='flex items-center gap-3'>
              <div className='w-10 h-10 bg-yellow-400/10 rounded-lg flex items-center justify-center'>
                <Star className='w-6 h-6 text-yellow-400' fill='currentColor' />
              </div>
              <div>
                <h1 className='text-2xl font-bold text-foreground'>
                  Starred Boards
                </h1>
                <p className='text-muted-foreground text-sm'>
                  Your favorite boards will appear here
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className='flex flex-col items-center justify-center py-16 text-center'>
          <div className='w-20 h-20 rounded-full bg-yellow-400/10 flex items-center justify-center mb-6'>
            <Star className='w-10 h-10 text-yellow-400' />
          </div>
          <h2 className='text-2xl font-bold text-foreground mb-3'>
            Starred Boards Coming Soon
          </h2>
          <p className='text-muted-foreground mb-6 max-w-md'>
            This feature is currently being updated. Star functionality will be
            available soon.
          </p>
          <Link
            href='/'
            className='inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors'
          >
            <Grid3x3 className='w-4 h-4' />
            Browse Boards
          </Link>
        </div>
      </main>
    </div>
  );
}

export default StarredBoardsPage;
