'use client';

import React, { useState, useMemo, useCallback, memo, Suspense } from 'react';
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
  X,
  SortAsc,
  SortDesc,
} from 'lucide-react';
import { useBoardStars } from '@/hooks/useBoardStars';
import { FixedSizeList as List } from 'react-window';

// Memoized skeleton component for loading states
const BoardSkeleton = memo(() => (
  <div className='h-32 rounded-xl bg-card/50 animate-pulse' />
));
BoardSkeleton.displayName = 'BoardSkeleton';

// Memoized empty state component
const EmptyState = memo(({ searchQuery }: { searchQuery: string }) => (
  <div className='flex flex-col items-center justify-center py-12 md:py-16 text-center px-4'>
    <div className='w-16 h-16 md:w-20 md:h-20 rounded-full bg-yellow-400/10 flex items-center justify-center mb-4 md:mb-6'>
      <Star className='w-8 h-8 md:w-10 md:h-10 text-yellow-400' />
    </div>
    <h2 className='text-xl md:text-2xl font-bold text-foreground mb-2 md:mb-3'>
      {searchQuery ? 'No boards found' : 'No starred boards yet'}
    </h2>
    <p className='text-muted-foreground mb-6 max-w-md text-sm md:text-base leading-relaxed'>
      {searchQuery
        ? `No starred boards match "${searchQuery}". Try adjusting your search.`
        : 'Star some boards to see them here. Click the star icon on any board to add it to your favorites.'}
    </p>
    <Link
      href='/'
      className='inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors min-h-[44px] text-sm md:text-base'
    >
      <Grid3x3 className='w-4 h-4' />
      Browse Boards
    </Link>
  </div>
));
EmptyState.displayName = 'EmptyState';

// Sorting options
type SortOption = 'name' | 'recent' | 'workspace';
type SortDirection = 'asc' | 'desc';

// Memoized search and filter controls
const SearchControls = memo(
  ({
    searchQuery,
    onSearchChange,
    sortBy,
    sortDirection,
    onSortChange,
    onSortDirectionChange,
    totalCount,
    filteredCount,
  }: {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    sortBy: SortOption;
    sortDirection: SortDirection;
    onSortChange: (sort: SortOption) => void;
    onSortDirectionChange: () => void;
    totalCount: number;
    filteredCount: number;
  }) => (
    <div className='flex flex-col gap-4 mb-6 md:mb-8'>
      {/* Search Input - Full width on mobile */}
      <div className='relative w-full'>
        <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground' />
        <input
          type='text'
          placeholder='Search starred boards...'
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className='w-full pl-10 pr-10 py-3 md:py-2.5 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-base md:text-sm'
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className='absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 md:p-0'
            aria-label='Clear search'
            title='Clear search'
          >
            <X className='w-4 h-4' />
          </button>
        )}
      </div>

      {/* Sort Controls - Stack on mobile, inline on desktop */}
      <div className='flex flex-col sm:flex-row gap-3 sm:gap-2 sm:items-center sm:justify-between'>
        <div className='flex items-center gap-2'>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className='flex-1 sm:flex-initial px-3 py-3 md:py-2.5 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-base md:text-sm'
            aria-label='Sort boards by'
            title='Sort boards by'
          >
            <option value='name'>Sort by Name</option>
            <option value='recent'>Sort by Recent</option>
            <option value='workspace'>Sort by Workspace</option>
          </select>

          <button
            onClick={onSortDirectionChange}
            className='p-3 md:p-2.5 bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors min-w-[48px] md:min-w-auto'
            title={`Sort ${
              sortDirection === 'asc' ? 'Descending' : 'Ascending'
            }`}
            aria-label={`Sort ${
              sortDirection === 'asc' ? 'Descending' : 'Ascending'
            }`}
          >
            {sortDirection === 'asc' ? (
              <SortAsc className='w-4 h-4' />
            ) : (
              <SortDesc className='w-4 h-4' />
            )}
          </button>
        </div>

        {/* Results count - Better positioned on mobile */}
        {searchQuery && (
          <div className='flex items-center text-sm text-muted-foreground'>
            <span className='px-2 py-1 bg-muted/30 rounded-md'>
              {filteredCount} of {totalCount} boards
            </span>
          </div>
        )}
      </div>
    </div>
  )
);
SearchControls.displayName = 'SearchControls';

// Virtual list item component (memoized for performance)
const VirtualBoardItem = memo(
  ({
    index,
    style,
    data,
  }: {
    index: number;
    style: React.CSSProperties;
    data: {
      boards: any[];
      onToggleStar: (boardId: string) => Promise<void>;
      itemsPerRow: number;
    };
  }) => {
    const { boards, onToggleStar, itemsPerRow } = data;
    const startIndex = index * itemsPerRow;
    const rowBoards = boards.slice(startIndex, startIndex + itemsPerRow);

    return (
      <div style={style} className='px-1'>
        <div
          className='grid gap-3 md:gap-5'
          style={{ gridTemplateColumns: `repeat(${itemsPerRow}, 1fr)` }}
        >
          {rowBoards.map((board) => (
            <BoardCard
              key={board.id}
              board={board}
              onToggleStar={onToggleStar}
            />
          ))}
          {/* Fill empty slots to maintain grid alignment */}
          {rowBoards.length < itemsPerRow &&
            Array.from({ length: itemsPerRow - rowBoards.length }).map(
              (_, i) => <div key={`empty-${i}`} />
            )}
        </div>
      </div>
    );
  }
);
VirtualBoardItem.displayName = 'VirtualBoardItem';

function StarredBoardsPage() {
  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Data fetching with automatic caching and background refetching
  const { starredBoards, loading, error, toggleBoardStar, refetch } =
    useBoardStars();

  // Memoized search function for performance
  const filteredAndSortedBoards = useMemo(() => {
    let filtered = [...starredBoards];

    // Search filtering (debounced via useMemo)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (board) =>
          board.name.toLowerCase().includes(query) ||
          board.workspace_id?.toLowerCase().includes(query)
      );
    }

    // Sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'recent':
          const aDate = new Date(a.updated_at || '').getTime();
          const bDate = new Date(b.updated_at || '').getTime();
          comparison = bDate - aDate; // Most recent first by default
          break;
        case 'workspace':
          comparison = (a.workspace_id || '').localeCompare(
            b.workspace_id || ''
          );
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [starredBoards, searchQuery, sortBy, sortDirection]);

  // Memoized callbacks to prevent unnecessary re-renders
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleSortChange = useCallback((sort: SortOption) => {
    setSortBy(sort);
  }, []);

  const handleSortDirectionChange = useCallback(() => {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }, []);

  const handleToggleStar = useCallback(
    async (boardId: string) => {
      await toggleBoardStar(boardId);
      // Optimistic update already handled by the hook
    },
    [toggleBoardStar]
  );

  // Calculate virtual list dimensions - responsive
  const getItemsPerRow = () => {
    if (typeof window !== 'undefined') {
      const width = window.innerWidth;
      if (width < 768) return 1; // Mobile: 1 column
      if (width < 1024) return 2; // Tablet: 2 columns
      return 3; // Desktop: 3 columns
    }
    return 3; // Default
  };

  const [itemsPerRow, setItemsPerRow] = useState(getItemsPerRow);

  // Update items per row on resize
  React.useEffect(() => {
    const handleResize = () => setItemsPerRow(getItemsPerRow());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const itemHeight = 152; // h-32 + gap
  const totalRows = Math.ceil(filteredAndSortedBoards.length / itemsPerRow);

  // Loading state with skeletons
  if (loading) {
    return (
      <div className='min-h-screen dot-pattern-dark'>
        <DashboardHeader />
        <main className='container mx-auto max-w-7xl px-4 md:px-6 lg:px-8 pt-20 md:pt-24 pb-16'>
          <div className='flex items-center justify-between mb-6 md:mb-8'>
            <div className='flex items-center gap-3 md:gap-4'>
              <Link
                href='/'
                className='p-2 md:p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center'
                title='Back to Home'
              >
                <ArrowLeft className='w-5 h-5' />
              </Link>
              <div className='flex items-center gap-2 md:gap-3'>
                <div className='w-8 h-8 md:w-10 md:h-10 bg-yellow-400/10 rounded-lg flex items-center justify-center'>
                  <Star
                    className='w-5 h-5 md:w-6 md:h-6 text-yellow-400'
                    fill='currentColor'
                  />
                </div>
                <div>
                  <h1 className='text-xl md:text-2xl font-bold text-foreground'>
                    Starred Boards
                  </h1>
                  <p className='text-muted-foreground text-xs md:text-sm'>
                    Loading your favorite boards...
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5'>
            {Array.from({ length: 6 }).map((_, i) => (
              <BoardSkeleton key={i} />
            ))}
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className='min-h-screen dot-pattern-dark'>
        <DashboardHeader />
        <main className='container mx-auto max-w-7xl px-4 md:px-6 lg:px-8 pt-20 md:pt-24 pb-16'>
          <div className='flex items-center justify-between mb-6 md:mb-8'>
            <div className='flex items-center gap-3 md:gap-4'>
              <Link
                href='/'
                className='p-2 md:p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center'
                title='Back to Home'
              >
                <ArrowLeft className='w-5 h-5' />
              </Link>
              <div className='flex items-center gap-2 md:gap-3'>
                <div className='w-8 h-8 md:w-10 md:h-10 bg-red-400/10 rounded-lg flex items-center justify-center'>
                  <Star className='w-5 h-5 md:w-6 md:h-6 text-red-400' />
                </div>
                <div>
                  <h1 className='text-xl md:text-2xl font-bold text-foreground'>
                    Starred Boards
                  </h1>
                  <p className='text-red-400 text-xs md:text-sm'>
                    Error loading boards: {error}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className='flex flex-col items-center justify-center py-16 text-center px-4'>
            <button
              onClick={() => refetch()}
              className='inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors min-h-[44px]'
            >
              <Loader2 className='w-4 h-4' />
              Try Again
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className='min-h-screen dot-pattern-dark'>
      <DashboardHeader />
      <main className='container mx-auto max-w-7xl px-4 md:px-6 lg:px-8 pt-20 md:pt-24 pb-16'>
        {/* Header - Mobile optimized */}
        <div className='flex items-center justify-between mb-6 md:mb-8'>
          <div className='flex items-center gap-3 md:gap-4 min-w-0 flex-1'>
            <Link
              href='/'
              className='p-2 md:p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0'
              title='Back to Home'
            >
              <ArrowLeft className='w-5 h-5' />
            </Link>
            <div className='flex items-center gap-2 md:gap-3 min-w-0 flex-1'>
              <div className='w-8 h-8 md:w-10 md:h-10 bg-yellow-400/10 rounded-lg flex items-center justify-center flex-shrink-0'>
                <Star
                  className='w-5 h-5 md:w-6 md:h-6 text-yellow-400'
                  fill='currentColor'
                />
              </div>
              <div className='min-w-0 flex-1'>
                <h1 className='text-xl md:text-2xl font-bold text-foreground truncate'>
                  Starred Boards
                </h1>
                <p className='text-muted-foreground text-xs md:text-sm'>
                  {starredBoards.length} starred board
                  {starredBoards.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Sort Controls - Mobile optimized */}
        {starredBoards.length > 0 && (
          <SearchControls
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            sortBy={sortBy}
            sortDirection={sortDirection}
            onSortChange={handleSortChange}
            onSortDirectionChange={handleSortDirectionChange}
            totalCount={starredBoards.length}
            filteredCount={filteredAndSortedBoards.length}
          />
        )}

        {/* Boards Grid or Empty State */}
        {filteredAndSortedBoards.length === 0 ? (
          <EmptyState searchQuery={searchQuery} />
        ) : filteredAndSortedBoards.length <= 20 ? (
          // Regular grid for small datasets - responsive columns
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5'>
            {filteredAndSortedBoards.map((board) => (
              <BoardCard
                key={board.id}
                board={board}
                onToggleStar={handleToggleStar}
              />
            ))}
          </div>
        ) : (
          // Virtual scrolling for large datasets - mobile optimized height
          <div className='h-[70vh] md:h-[600px]'>
            <List
              height={
                typeof window !== 'undefined'
                  ? window.innerWidth < 768
                    ? window.innerHeight * 0.7
                    : 600
                  : 600
              }
              itemCount={totalRows}
              itemSize={itemHeight}
              itemData={{
                boards: filteredAndSortedBoards,
                onToggleStar: handleToggleStar,
                itemsPerRow,
              }}
            >
              {VirtualBoardItem}
            </List>
          </div>
        )}
      </main>
    </div>
  );
}

// Export with React.memo for top-level optimization
export default memo(StarredBoardsPage);
