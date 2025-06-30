import React from 'react';

// Individual member skeleton
export const MemberSkeleton = React.memo(() => (
  <div className='flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-border animate-pulse'>
    <div className='flex items-center gap-3 min-w-0 flex-1'>
      <div className='w-8 h-8 rounded-full bg-muted animate-pulse' />
      <div className='min-w-0 flex-1 space-y-2'>
        <div className='h-4 bg-muted rounded w-32 animate-pulse' />
        <div className='h-3 bg-muted rounded w-40 animate-pulse' />
      </div>
    </div>
    <div className='flex items-center justify-between sm:justify-end gap-3 sm:gap-3 mt-3 sm:mt-0'>
      <div className='flex items-center gap-2'>
        <div className='w-3 h-3 sm:w-4 sm:h-4 bg-muted rounded animate-pulse' />
        <div className='h-5 bg-muted rounded-full w-16 animate-pulse' />
      </div>
    </div>
  </div>
));

MemberSkeleton.displayName = 'MemberSkeleton';

// Members list skeleton
export const MembersListSkeleton = React.memo(() => (
  <div className='card p-4 sm:p-6'>
    <div className='h-6 bg-muted rounded w-48 mb-4 animate-pulse' />
    <div className='space-y-2'>
      {Array.from({ length: 5 }).map((_, index) => (
        <MemberSkeleton key={index} />
      ))}
    </div>
  </div>
));

MembersListSkeleton.displayName = 'MembersListSkeleton';

// Search result skeleton
export const SearchResultSkeleton = React.memo(() => (
  <div className='w-full text-left p-3 rounded-lg border-2 border-transparent'>
    <div className='flex items-center gap-3'>
      <div className='w-10 h-10 rounded-full bg-muted animate-pulse' />
      <div className='flex-1 min-w-0 space-y-2'>
        <div className='h-4 bg-muted rounded w-32 animate-pulse' />
        <div className='h-3 bg-muted rounded w-40 animate-pulse' />
      </div>
    </div>
  </div>
));

SearchResultSkeleton.displayName = 'SearchResultSkeleton';

// Search results container skeleton
export const SearchResultsSkeleton = React.memo(() => (
  <div className='mt-4 border border-border/50 rounded-xl overflow-hidden bg-background/30 backdrop-blur-sm'>
    <div className='max-h-64 overflow-y-auto'>
      <div className='p-2 space-y-1'>
        {Array.from({ length: 3 }).map((_, index) => (
          <SearchResultSkeleton key={index} />
        ))}
      </div>
    </div>
  </div>
));

SearchResultsSkeleton.displayName = 'SearchResultsSkeleton';

// Page loading skeleton
export const PageLoadingSkeleton = React.memo(() => (
  <div className='min-h-screen dot-pattern-dark'>
    <div className='h-16 bg-background/80 backdrop-blur-sm border-b border-border sticky top-0 z-40' />
    <main className='container mx-auto max-w-4xl px-3 sm:px-4 pt-16 sm:pt-24 pb-8 sm:pb-16'>
      {/* Header skeleton */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8'>
        <div className='flex flex-col gap-3 sm:hidden min-w-0'>
          <div className='flex items-center gap-2'>
            <div className='w-6 h-6 bg-muted rounded animate-pulse' />
            <div className='h-6 bg-muted rounded w-48 animate-pulse' />
          </div>
          <div className='ml-7'>
            <div className='h-3 bg-muted rounded w-64 animate-pulse' />
          </div>
        </div>
        <div className='hidden sm:flex items-center gap-4 min-w-0 flex-1'>
          <div className='w-8 h-8 bg-muted rounded animate-pulse' />
          <div className='min-w-0 flex-1 space-y-2'>
            <div className='h-8 bg-muted rounded w-64 animate-pulse' />
            <div className='h-4 bg-muted rounded w-80 animate-pulse' />
          </div>
        </div>
        <div className='flex items-center justify-end gap-3 flex-shrink-0'>
          <div className='h-10 bg-muted rounded-lg w-32 animate-pulse' />
        </div>
      </div>

      {/* Navigation tabs skeleton */}
      <div className='mb-6 sm:mb-8'>
        <div className='flex items-center gap-1 border-b border-border'>
          <div className='h-10 bg-muted rounded w-20 animate-pulse' />
          <div className='h-10 bg-muted rounded w-20 animate-pulse' />
        </div>
      </div>

      <div className='space-y-4 sm:space-y-6'>
        <MembersListSkeleton />
      </div>
    </main>
  </div>
));

PageLoadingSkeleton.displayName = 'PageLoadingSkeleton';

// Modal skeleton
export const ModalSkeleton = React.memo(() => (
  <div className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'>
    <div className='bg-gradient-to-br from-background via-background to-background/95 border border-border/50 rounded-2xl shadow-2xl w-full max-w-2xl h-[600px] mx-4 overflow-hidden flex flex-col'>
      {/* Header skeleton */}
      <div className='relative bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border-b border-border/50'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 rounded-xl bg-muted animate-pulse' />
            <div className='space-y-2'>
              <div className='h-6 bg-muted rounded w-32 animate-pulse' />
              <div className='h-4 bg-muted rounded w-48 animate-pulse' />
            </div>
          </div>
          <div className='w-8 h-8 rounded-full bg-muted animate-pulse' />
        </div>
      </div>

      {/* Content skeleton */}
      <div className='flex-1 p-6 space-y-6 overflow-y-auto'>
        <div className='space-y-3'>
          <div className='h-5 bg-muted rounded w-32 animate-pulse' />
          <div className='relative'>
            <div className='w-full h-12 bg-muted rounded-xl animate-pulse' />
          </div>
          <SearchResultsSkeleton />
        </div>
      </div>

      {/* Footer skeleton */}
      <div className='flex-shrink-0 bg-gradient-to-r from-muted/20 to-transparent p-6 border-t border-border/50'>
        <div className='flex justify-end gap-3'>
          <div className='h-10 bg-muted rounded w-20 animate-pulse' />
          <div className='h-10 bg-muted rounded w-32 animate-pulse' />
        </div>
      </div>
    </div>
  </div>
));

ModalSkeleton.displayName = 'ModalSkeleton';
