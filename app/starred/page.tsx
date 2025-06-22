'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { DashboardHeader } from '../components/dashboard/header';
import { BoardCard } from '../components/board/BoardCard';
import { useBoardStars } from '@/hooks/useBoardStars';
import {
  ArrowLeft,
  Star,
  Search,
  Filter,
  Grid3x3,
  Loader2,
} from 'lucide-react';

// Disable SSR for this page to prevent Supabase prerender issues
const StarredBoardsPageComponent = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const { starredBoards, loading, error, toggleBoardStar } = useBoardStars();

  // Filter starred boards based on search query
  const filteredStarredBoards = starredBoards.filter((board) =>
    board.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className='min-h-screen dot-pattern-dark'>
        <DashboardHeader />

        <main className='container mx-auto max-w-7xl px-4 pt-24 pb-16'>
          {/* Header */}
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
                  <Star
                    className='w-6 h-6 text-yellow-400'
                    fill='currentColor'
                  />
                </div>
                <div>
                  <h1 className='text-2xl font-bold text-foreground'>
                    Starred Boards
                  </h1>
                  <p className='text-muted-foreground text-sm'>
                    All your favorite boards in one place
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Loading Content */}
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8'>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className='h-40 rounded-xl bg-card/50 animate-pulse'
              />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className='min-h-screen dot-pattern-dark'>
        <DashboardHeader />

        <main className='container mx-auto max-w-7xl px-4 pt-24 pb-16'>
          <div className='text-center py-16'>
            <div className='w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4'>
              <Star className='w-8 h-8 text-red-500' />
            </div>
            <h1 className='text-2xl font-bold text-foreground mb-2'>
              Error Loading Starred Boards
            </h1>
            <p className='text-muted-foreground mb-6'>{error}</p>
            <Link
              href='/'
              className='inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors'
            >
              <ArrowLeft className='w-4 h-4' />
              Back to Home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className='min-h-screen dot-pattern-dark'>
      <DashboardHeader />

      <main className='container mx-auto max-w-7xl px-4 pt-24 pb-16'>
        {/* Header */}
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
                  {starredBoards.length}{' '}
                  {starredBoards.length === 1 ? 'board' : 'boards'} starred
                </p>
              </div>
            </div>
          </div>

          {/* Search */}
          {starredBoards.length > 0 && (
            <div className='flex items-center gap-2'>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground' />
                <input
                  type='text'
                  placeholder='Search starred boards...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='pl-10 pr-4 py-2 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 w-64'
                />
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        {starredBoards.length === 0 ? (
          /* Empty State */
          <div className='flex flex-col items-center justify-center py-16 text-center'>
            <div className='w-20 h-20 rounded-full bg-yellow-400/10 flex items-center justify-center mb-6'>
              <Star className='w-10 h-10 text-yellow-400' />
            </div>
            <h2 className='text-2xl font-bold text-foreground mb-3'>
              No Starred Boards Yet
            </h2>
            <p className='text-muted-foreground mb-6 max-w-md'>
              Star your favorite boards to quickly access them from this page.
              Click the star icon on any board to add it to your favorites.
            </p>
            <Link
              href='/'
              className='inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors'
            >
              <Grid3x3 className='w-4 h-4' />
              Browse Boards
            </Link>
          </div>
        ) : filteredStarredBoards.length === 0 ? (
          /* No Search Results */
          <div className='flex flex-col items-center justify-center py-16 text-center'>
            <div className='w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4'>
              <Search className='w-8 h-8 text-muted-foreground' />
            </div>
            <h2 className='text-xl font-bold text-foreground mb-2'>
              No boards found
            </h2>
            <p className='text-muted-foreground mb-4'>
              No starred boards match "{searchQuery}". Try a different search
              term.
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className='text-primary hover:text-primary/80 transition-colors'
            >
              Clear search
            </button>
          </div>
        ) : (
          /* Boards Grid */
          <>
            {/* Results Info */}
            {searchQuery && (
              <div className='mb-6'>
                <p className='text-sm text-muted-foreground'>
                  Showing {filteredStarredBoards.length} of{' '}
                  {starredBoards.length} starred boards
                  {searchQuery && ` matching "${searchQuery}"`}
                </p>
              </div>
            )}

            {/* Boards Grid */}
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8'>
              {filteredStarredBoards.map((board) => (
                <BoardCard
                  key={board.id}
                  board={board}
                  onToggleStar={toggleBoardStar}
                  showStar={true}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

// Export with SSR disabled to prevent Supabase prerender issues
export default dynamic(() => Promise.resolve(StarredBoardsPageComponent), {
  ssr: false,
});
