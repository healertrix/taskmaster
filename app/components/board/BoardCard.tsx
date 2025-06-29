'use client';

import Link from 'next/link';
import { Star } from 'lucide-react';
import { Board } from '@/hooks/useBoardStars';
import { useState } from 'react';

interface BoardCardProps {
  board: Board;
  onToggleStar: (boardId: string) => Promise<void>;
  showStar?: boolean;
}

export function BoardCard({
  board,
  onToggleStar,
  showStar = true,
}: BoardCardProps) {
  const [isToggling, setIsToggling] = useState(false);

  const handleStarClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isToggling) return;

    setIsToggling(true);
    try {
      await onToggleStar(board.id);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <Link
      href={`/board/${board.id}?from=home`}
      className='group relative block p-4 md:p-5 rounded-xl card card-hover h-28 md:h-32 overflow-hidden transition-all duration-200 touch-manipulation'
    >
      {/* Color bar at top */}
      <div
        className={`absolute top-0 left-0 right-0 h-1.5 ${board.color}`}
      ></div>

      {/* Content */}
      <div className='relative z-10 flex flex-col justify-between h-full'>
        <div className='pr-8 md:pr-8'>
          <h3 className='font-semibold text-foreground text-sm md:text-base line-clamp-2 leading-tight'>
            {board.name}
          </h3>
        </div>

        {/* Star button - Mobile optimized */}
        {showStar && (
          <div className='flex justify-end relative z-20'>
            <button
              className={`relative z-30 p-2 md:p-2 rounded-full transition-all duration-200 min-w-[44px] min-h-[44px] md:min-w-auto md:min-h-auto flex items-center justify-center ${
                board.starred
                  ? 'text-yellow-400 hover:text-yellow-500'
                  : 'text-muted-foreground/50 opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-yellow-400'
              } hover:bg-yellow-400/10 active:bg-yellow-400/20 ${
                isToggling ? 'animate-pulse' : ''
              }`}
              onClick={handleStarClick}
              disabled={isToggling}
              aria-label={board.starred ? 'Unstar board' : 'Star board'}
              title={board.starred ? 'Unstar board' : 'Star board'}
              style={{ pointerEvents: 'auto' }}
            >
              <Star
                className={`w-4 h-4 md:w-4 md:h-4 transition-transform duration-200 ${
                  isToggling ? 'scale-110' : ''
                }`}
                fill={board.starred ? 'currentColor' : 'none'}
                stroke={board.starred ? 'currentColor' : 'currentColor'}
              />
            </button>
          </div>
        )}
      </div>
    </Link>
  );
}
