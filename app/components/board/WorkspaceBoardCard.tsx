'use client';

import Link from 'next/link';
import { Star, Clock } from 'lucide-react';
import { WorkspaceBoard } from '@/hooks/useWorkspaceBoards';
import { useState, useCallback, useMemo, memo } from 'react';

interface WorkspaceBoardCardProps {
  board: WorkspaceBoard;
  onToggleStar: (boardId: string) => Promise<void>;
  formatDate: (dateString: string) => string;
  getColorDisplay: (color: string) => {
    isCustom: boolean;
    style: any;
    className: string;
  };
}

// Memoized color display component
const ColorBar = memo(
  ({
    color,
    getColorDisplay,
  }: {
    color: string;
    getColorDisplay: (color: string) => any;
  }) => {
    const colorDisplay = useMemo(
      () => getColorDisplay(color),
      [color, getColorDisplay]
    );

    return (
      <div
        className={`absolute top-0 left-0 right-0 h-1.5 sm:h-2 ${
          colorDisplay.isCustom ? '' : colorDisplay.className
        }`}
        style={colorDisplay.isCustom ? colorDisplay.style : {}}
      />
    );
  }
);

ColorBar.displayName = 'ColorBar';

// Memoized board title component
const BoardTitle = memo(({ name }: { name: string }) => (
  <h3 className='font-semibold text-sm sm:text-base text-foreground mb-1 sm:mb-2 line-clamp-2 pr-8'>
    {name}
  </h3>
));

BoardTitle.displayName = 'BoardTitle';

// Memoized board description component
const BoardDescription = memo(({ description }: { description?: string }) => {
  if (!description) return null;

  return (
    <p className='text-xs sm:text-sm text-muted-foreground line-clamp-2 sm:line-clamp-3 mb-2 sm:mb-3'>
      {description}
    </p>
  );
});

BoardDescription.displayName = 'BoardDescription';

// Memoized date display component
const DateDisplay = memo(
  ({
    dateString,
    formatDate,
  }: {
    dateString: string;
    formatDate: (dateString: string) => string;
  }) => {
    const formattedDate = useMemo(
      () => formatDate(dateString),
      [dateString, formatDate]
    );
    const mobileDate = useMemo(
      () => formattedDate.split(' ')[0],
      [formattedDate]
    );

    return (
      <div className='flex items-center gap-1 text-xs text-muted-foreground'>
        <Clock className='w-3 h-3' />
        <span className='hidden sm:inline'>{formattedDate}</span>
        <span className='sm:hidden'>{mobileDate}</span>
      </div>
    );
  }
);

DateDisplay.displayName = 'DateDisplay';

// Simple throttling utility
const throttle = (func: Function, delay: number) => {
  let lastCall = 0;
  return (...args: any[]) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      return func(...args);
    }
  };
};

// Memoized star button component with throttling
const StarButton = memo(
  ({
    boardId,
    starred,
    isToggling,
    onToggleStar,
  }: {
    boardId: string;
    starred?: boolean;
    isToggling: boolean;
    onToggleStar: (boardId: string) => Promise<void>;
  }) => {
    // Throttled click handler to prevent rapid clicks
    const throttledToggleStar = useMemo(
      () =>
        throttle(async () => {
          try {
            await onToggleStar(boardId);
          } catch (error) {
            console.error('Failed to toggle star:', error);
          }
        }, 300),
      [boardId, onToggleStar]
    );

    const handleStarClick = useCallback(
      async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (isToggling) return;

        throttledToggleStar();
      },
      [isToggling, throttledToggleStar]
    );

    return (
      <button
        className={`relative z-30 p-1.5 sm:p-2 rounded-full transition-all duration-200 ${
          starred
            ? 'text-yellow-400 hover:text-yellow-500'
            : 'text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:text-yellow-400'
        } hover:bg-yellow-400/10 ${isToggling ? 'animate-pulse' : ''}`}
        onClick={handleStarClick}
        disabled={isToggling}
        aria-label={starred ? 'Unstar board' : 'Star board'}
        title={starred ? 'Unstar board' : 'Star board'}
        style={{ pointerEvents: 'auto' }}
      >
        <Star
          className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-200 ${
            isToggling ? 'scale-110' : ''
          }`}
          fill={starred ? 'currentColor' : 'none'}
          stroke={starred ? 'currentColor' : 'currentColor'}
        />
      </button>
    );
  }
);

StarButton.displayName = 'StarButton';

export const WorkspaceBoardCard = memo(function WorkspaceBoardCard({
  board,
  onToggleStar,
  formatDate,
  getColorDisplay,
}: WorkspaceBoardCardProps) {
  const [isToggling, setIsToggling] = useState(false);

  // Memoized board color display
  const boardColorDisplay = useMemo(
    () => getColorDisplay(board.color),
    [board.color, getColorDisplay]
  );

  // Memoized card content
  const cardContent = useMemo(
    () => (
      <div className='relative z-10 flex flex-col justify-between h-full'>
        <div>
          <BoardTitle name={board.name} />
          <BoardDescription description={board.description} />
        </div>

        <div className='flex items-center justify-between'>
          <DateDisplay
            dateString={board.last_activity_at}
            formatDate={formatDate}
          />

          <div className='relative z-20'>
            <StarButton
              boardId={board.id}
              starred={board.starred}
              isToggling={isToggling}
              onToggleStar={onToggleStar}
            />
          </div>
        </div>
      </div>
    ),
    [
      board.name,
      board.description,
      board.last_activity_at,
      board.id,
      board.starred,
      formatDate,
      onToggleStar,
      isToggling,
    ]
  );

  return (
    <Link
      href={`/board/${board.id}`}
      className='group relative block p-4 sm:p-5 rounded-xl card card-hover h-32 sm:h-40 overflow-hidden transition-all duration-200'
    >
      <ColorBar color={board.color} getColorDisplay={getColorDisplay} />
      {cardContent}
    </Link>
  );
});
