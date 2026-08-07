'use client';

import Link from 'next/link';
import { Star, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
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
      className='group relative block h-40 rounded-2xl border border-border bg-card/70 backdrop-blur-xl overflow-hidden
        transition-all duration-300 ease-out touch-manipulation
        hover:-translate-y-1 hover:border-muted-foreground/40 hover:bg-card/85 hover:shadow-2xl hover:shadow-black/40'
    >
      {/* Content */}
      <div className='relative z-10 flex flex-col justify-between h-full p-5'>
        <div className='flex items-start justify-between gap-2'>
          <div className='flex items-center gap-2 min-w-0'>
            <span
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${board.color}`}
            />
            <h3 className='font-semibold text-foreground text-base line-clamp-2 leading-tight'>
              {board.name}
            </h3>
          </div>

          {showStar && (
            <button
              className={`relative z-20 -mt-1 -mr-1 p-2 rounded-full transition-all duration-200 flex items-center justify-center flex-shrink-0 ${
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
            >
              <Star
                className={`w-4 h-4 transition-transform duration-200 ${
                  isToggling ? 'scale-110' : ''
                }`}
                fill={board.starred ? 'currentColor' : 'none'}
              />
            </button>
          )}
        </div>

        {board.updated_at && (
          <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
            <Clock className='w-3.5 h-3.5' />
            <span>
              Updated {formatDistanceToNow(new Date(board.updated_at), { addSuffix: true })}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
