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
      className='group relative block p-5 rounded-xl card card-hover h-32 overflow-hidden transition-all duration-200'
    >
      {/* Color bar at top */}
      <div
        className={`absolute top-0 left-0 right-0 h-1.5 ${board.color}`}
      ></div>

      {/* Content */}
      <div className='relative z-10 flex flex-col justify-between h-full'>
        <div>
          <h3 className='font-semibold text-foreground truncate pr-8'>
            {board.name}
          </h3>
        </div>

        {/* Star button */}
        {showStar && (
          <div className='flex justify-end relative z-20'>
            <button
              className={`relative z-30 p-2 rounded-full transition-all duration-200 ${
                board.starred
                  ? 'text-yellow-400 hover:text-yellow-500'
                  : 'text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:text-yellow-400'
              } hover:bg-yellow-400/10 ${isToggling ? 'animate-pulse' : ''}`}
              onClick={handleStarClick}
              disabled={isToggling}
              aria-label={board.starred ? 'Unstar board' : 'Star board'}
              title={board.starred ? 'Unstar board' : 'Star board'}
              style={{ pointerEvents: 'auto' }}
            >
              <Star
                className={`w-4 h-4 transition-transform duration-200 ${
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
