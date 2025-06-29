'use client';

import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { WorkspaceBoard } from '@/hooks/useWorkspaceBoards';
import { WorkspaceBoardCard } from './WorkspaceBoardCard';

interface VirtualizedBoardGridProps {
  boards: WorkspaceBoard[];
  onToggleStar: (boardId: string) => Promise<void>;
  formatDate: (dateString: string) => string;
  getColorDisplay: (color: string) => {
    isCustom: boolean;
    style: any;
    className: string;
  };
  canCreateBoards?: boolean;
  onCreateBoard?: () => void;
}

// Grid configuration
const GRID_CONFIG = {
  mobile: { cols: 1, gap: 16 },
  tablet: { cols: 2, gap: 24 },
  desktop: { cols: 3, gap: 24 },
  wide: { cols: 4, gap: 24 },
};

// Breakpoints
const BREAKPOINTS = {
  mobile: 640,
  tablet: 768,
  desktop: 1024,
  wide: 1280,
};

export function VirtualizedBoardGrid({
  boards,
  onToggleStar,
  formatDate,
  getColorDisplay,
  canCreateBoards = false,
  onCreateBoard,
}: VirtualizedBoardGridProps) {
  const [windowWidth, setWindowWidth] = useState(0);
  const [isIntersecting, setIsIntersecting] = useState(false);

  // Get current grid configuration based on window width
  const gridConfig = useMemo(() => {
    if (windowWidth < BREAKPOINTS.mobile) return GRID_CONFIG.mobile;
    if (windowWidth < BREAKPOINTS.tablet) return GRID_CONFIG.tablet;
    if (windowWidth < BREAKPOINTS.desktop) return GRID_CONFIG.desktop;
    return GRID_CONFIG.wide;
  }, [windowWidth]);

  // Calculate grid styles
  const gridStyles = useMemo(
    () => ({
      display: 'grid',
      gridTemplateColumns: `repeat(${gridConfig.cols}, 1fr)`,
      gap: `${gridConfig.gap}px`,
    }),
    [gridConfig]
  );

  // Memoized board cards
  const boardCards = useMemo(() => {
    return boards.map((board) => (
      <WorkspaceBoardCard
        key={board.id}
        board={board}
        onToggleStar={onToggleStar}
        formatDate={formatDate}
        getColorDisplay={getColorDisplay}
      />
    ));
  }, [boards, onToggleStar, formatDate, getColorDisplay]);

  // Memoized create board button
  const createBoardButton = useMemo(() => {
    if (!canCreateBoards || !onCreateBoard) return null;

    return (
      <button
        key='create-board-btn'
        onClick={onCreateBoard}
        className='h-32 sm:h-40 rounded-xl border-2 border-dashed border-border/50 hover:border-primary bg-card/30 hover:bg-card/50 flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition-all group card-hover'
      >
        <div className='w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2 sm:mb-3 group-hover:bg-primary/20 transition-colors'>
          <svg
            className='w-5 h-5 sm:w-6 sm:h-6 text-primary'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M12 4v16m8-8H4'
            />
          </svg>
        </div>
        <span className='font-semibold text-sm'>Create New Board</span>
        <span className='text-xs text-muted-foreground mt-1 px-2 text-center'>
          Add a board to this workspace
        </span>
      </button>
    );
  }, [canCreateBoards, onCreateBoard]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    // Set initial width
    setWindowWidth(window.innerWidth);

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      {
        rootMargin: '100px', // Start loading 100px before the element is visible
        threshold: 0.1,
      }
    );

    const gridElement = document.getElementById('board-grid');
    if (gridElement) {
      observer.observe(gridElement);
    }

    return () => {
      if (gridElement) {
        observer.unobserve(gridElement);
      }
    };
  }, []);

  // Render grid content
  const renderGridContent = useCallback(() => {
    const items = [];

    // Add create board button first if available
    if (createBoardButton) {
      items.push(createBoardButton);
    }

    // Add board cards
    items.push(...boardCards);

    return items;
  }, [createBoardButton, boardCards]);

  return (
    <div id='board-grid' style={gridStyles} className='w-full'>
      {renderGridContent()}
    </div>
  );
}

// Optimized wrapper component for better performance
export const MemoizedVirtualizedBoardGrid = React.memo(VirtualizedBoardGrid);
