import React from 'react';

// Card skeleton component
export const CardSkeleton = ({ delay = 0 }: { delay?: number }) => (
  <div
    className='animate-pulse bg-card border border-border/20 rounded-lg p-3 mb-6 last:mb-0 min-h-[80px]'
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className='space-y-3'>
      {/* Labels area */}
      <div className='flex gap-2'>
        <div className='h-4 bg-muted/50 rounded-full w-16' />
        <div className='h-4 bg-muted/50 rounded-full w-12' />
      </div>

      {/* Title */}
      <div className='space-y-2'>
        <div className='h-4 bg-muted/50 rounded w-full' />
        <div className='h-4 bg-muted/50 rounded w-3/4' />
      </div>

      {/* Footer */}
      <div className='flex justify-between items-center mt-4'>
        <div className='flex -space-x-2'>
          <div className='w-6 h-6 bg-muted/50 rounded-full' />
          <div className='w-6 h-6 bg-muted/50 rounded-full' />
        </div>
        <div className='flex gap-2'>
          <div className='w-4 h-4 bg-muted/50 rounded' />
          <div className='w-4 h-4 bg-muted/50 rounded' />
        </div>
      </div>
    </div>
  </div>
);

// List/Column skeleton component
export const ListSkeleton = ({
  cardCount = 3,
  delay = 0,
}: {
  cardCount?: number;
  delay?: number;
}) => (
  <div
    className='flex-shrink-0 w-80 animate-pulse'
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className='bg-card rounded-xl border border-border/20 overflow-hidden'>
      {/* List header */}
      <div className='p-4 border-b border-border/20'>
        <div className='flex items-center justify-between'>
          <div className='h-6 bg-muted/50 rounded w-32' />
          <div className='w-8 h-8 bg-muted/50 rounded-lg' />
        </div>
      </div>

      {/* List content */}
      <div className='p-4 space-y-4 min-h-[200px]'>
        {Array.from({ length: cardCount }).map((_, index) => (
          <CardSkeleton key={index} delay={index * 100} />
        ))}

        {/* Add card button skeleton */}
        <div className='h-10 bg-muted/30 border-2 border-dashed border-muted/50 rounded-lg flex items-center justify-center'>
          <div className='w-20 h-4 bg-muted/50 rounded' />
        </div>
      </div>
    </div>
  </div>
);

// Board skeleton component
export const BoardSkeleton = () => (
  <div className='min-h-screen dot-pattern-dark flex flex-col'>
    {/* Header skeleton */}
    <div className='container mx-auto max-w-full px-4 pt-24 pb-8'>
      <div className='flex items-center justify-between mb-8 animate-pulse'>
        <div className='flex items-center gap-4'>
          <div className='w-9 h-9 bg-muted/50 rounded-lg' />
          <div className='flex items-center gap-3'>
            <div className='w-8 h-8 bg-muted/50 rounded-lg' />
            <div className='space-y-2'>
              <div className='h-7 w-48 bg-muted/50 rounded' />
              <div className='h-4 w-32 bg-muted/50 rounded' />
            </div>
          </div>
        </div>
        <div className='flex items-center gap-4'>
          <div className='w-9 h-9 bg-muted/50 rounded-lg' />
          <div className='flex items-center gap-2'>
            <div className='w-4 h-4 bg-muted/50 rounded' />
            <div className='w-24 h-4 bg-muted/50 rounded' />
          </div>
          <div className='w-9 h-9 bg-muted/50 rounded-lg' />
          <div className='w-9 h-9 bg-muted/50 rounded-lg' />
          <div className='w-9 h-9 bg-muted/50 rounded-lg' />
        </div>
      </div>
    </div>

    {/* Board content skeleton */}
    <div className='flex-1 overflow-x-auto px-4'>
      <div className='flex gap-6 h-full min-w-max'>
        {/* List skeletons */}
        {Array.from({ length: 4 }).map((_, index) => (
          <ListSkeleton
            key={index}
            cardCount={Math.floor(Math.random() * 4) + 2}
            delay={index * 150}
          />
        ))}

        {/* Add list skeleton */}
        <div
          className='flex-shrink-0 w-80 animate-pulse'
          style={{ animationDelay: '600ms' }}
        >
          <div className='h-32 bg-card/30 border-2 border-dashed border-border/50 rounded-xl flex flex-col items-center justify-center'>
            <div className='w-8 h-8 bg-muted/50 rounded-full mb-3' />
            <div className='h-4 w-20 bg-muted/50 rounded mb-1' />
            <div className='h-3 w-16 bg-muted/50 rounded' />
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Compact card skeleton for dense layouts
export const CompactCardSkeleton = ({ delay = 0 }: { delay?: number }) => (
  <div
    className='animate-pulse bg-card border border-border/20 rounded-lg p-2 mb-3 last:mb-0 min-h-[60px]'
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className='space-y-2'>
      <div className='h-3 bg-muted/50 rounded w-full' />
      <div className='h-3 bg-muted/50 rounded w-2/3' />
      <div className='flex justify-between items-center mt-2'>
        <div className='w-4 h-4 bg-muted/50 rounded-full' />
        <div className='flex gap-1'>
          <div className='w-3 h-3 bg-muted/50 rounded' />
          <div className='w-3 h-3 bg-muted/50 rounded' />
        </div>
      </div>
    </div>
  </div>
);

// List skeleton with compact cards
export const CompactListSkeleton = ({
  cardCount = 5,
  delay = 0,
}: {
  cardCount?: number;
  delay?: number;
}) => (
  <div
    className='flex-shrink-0 w-72 animate-pulse'
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className='bg-card rounded-lg border border-border/20 overflow-hidden'>
      <div className='p-3 border-b border-border/20'>
        <div className='h-5 bg-muted/50 rounded w-24' />
      </div>
      <div className='p-3 space-y-2 min-h-[150px]'>
        {Array.from({ length: cardCount }).map((_, index) => (
          <CompactCardSkeleton key={index} delay={index * 50} />
        ))}
      </div>
    </div>
  </div>
);
