'use client';

import Link from 'next/link';
import { Star, Clock } from 'lucide-react';
import { WorkspaceBoard } from '@/hooks/useWorkspaceBoards';
import { useState } from 'react';

interface WorkspaceBoardCardProps {
  board: WorkspaceBoard;
  onToggleStar: (boardId: string) => Promise<void>;
  formatDate: (dateString: string) => string;
  getColorDisplay: (color: string) => {
    isCustom: boolean;
    style: any;
    className: string;
  };
  workspaceId?: string;
}

export function WorkspaceBoardCard({
  board,
  onToggleStar,
  formatDate,
  getColorDisplay,
  workspaceId,
}: WorkspaceBoardCardProps) {
  const [isToggling, setIsToggling] = useState(false);

  const handleStarClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isToggling) return;

    setIsToggling(true);
    try {
      await onToggleStar(board.id);
    } catch (error) {
      console.error('Failed to toggle star:', error);
    } finally {
      setIsToggling(false);
    }
  };

  const boardColorDisplay = getColorDisplay(board.color);

  return (
    <Link
      href={`/board/${board.id}`}
      className='group relative block p-5 rounded-xl card card-hover h-40 overflow-hidden transition-all duration-200'
    >
      {/* Color bar at top */}
      <div
        className={`absolute top-0 left-0 right-0 h-2 ${
          boardColorDisplay.isCustom ? '' : boardColorDisplay.className
        }`}
        style={boardColorDisplay.isCustom ? boardColorDisplay.style : {}}
      />

      <div className='relative z-10 flex flex-col justify-between h-full'>
        <div>
          <h3 className='font-semibold text-foreground mb-2 line-clamp-2 pr-8'>
            {board.name}
          </h3>
          {board.description && (
            <p className='text-sm text-muted-foreground line-clamp-3 mb-3'>
              {board.description}
            </p>
          )}
        </div>

        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-1 text-xs text-muted-foreground'>
            <Clock className='w-3 h-3' />
            {formatDate(board.last_activity_at)}
          </div>

          <div className='relative z-20'>
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
        </div>
      </div>
    </Link>
  );
}
