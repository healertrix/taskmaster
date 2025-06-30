'use client';

import { useState } from 'react';

interface Label {
  id: string;
  name: string | null;
  color: string;
  board_id: string;
  created_at: string;
  updated_at: string;
}

interface CardLabel {
  id: string;
  created_at: string;
  labels: Label;
}

interface CardLabelsProps {
  labels?: CardLabel[];
  maxVisible?: number;
  showNames?: boolean;
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

// Helper function to determine if a color is light (needs black text)
const isColorLight = (hexColor: string): boolean => {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128;
};

export default function CardLabels({
  labels = [],
  maxVisible = 5,
  showNames = false,
  size = 'sm',
  isLoading = false,
}: CardLabelsProps) {
  if (isLoading) {
    return (
      <div className='flex gap-2'>
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className={`bg-muted rounded-lg animate-pulse ${
              size === 'lg'
                ? 'w-20 h-8'
                : size === 'md'
                ? 'w-16 h-6'
                : 'w-12 h-4'
            }`}
          />
        ))}
      </div>
    );
  }

  if (labels.length === 0) {
    return (
      <div className='flex items-center gap-2 text-muted-foreground'>
        <div className='w-2 h-2 rounded-full bg-muted-foreground/30'></div>
        <span className='text-xs italic'>No labels assigned</span>
      </div>
    );
  }

  const visibleLabels = labels.slice(0, maxVisible);
  const remainingCount = labels.length - maxVisible;

  const sizeClasses = {
    sm: showNames
      ? 'px-2 py-1 text-xs min-h-[20px] min-w-[40px] rounded-md'
      : 'w-8 h-2 rounded-sm',
    md: showNames
      ? 'px-3 py-1.5 text-sm min-h-[28px] min-w-[60px] rounded-lg'
      : 'w-10 h-3 rounded-md',
    lg: showNames
      ? 'px-4 py-2 text-base min-h-[36px] min-w-[80px] rounded-xl'
      : 'w-12 h-4 rounded-lg',
  };

  return (
    <div className='flex flex-wrap gap-2 items-center'>
      {visibleLabels.map((cardLabel, index) => {
        const isLight = isColorLight(cardLabel.labels.color);

        return (
          <div
            key={cardLabel.id}
            className={`
              flex-shrink-0 transition-all duration-200 ease-out flex items-center justify-center
              hover:scale-105 hover:shadow-lg hover:shadow-black/10
              ${sizeClasses[size]}
              ${
                showNames
                  ? 'font-medium shadow-md border border-white/20'
                  : 'shadow-sm'
              }
              ${size === 'lg' ? 'hover:shadow-xl' : ''}
            `}
            style={{
              backgroundColor: cardLabel.labels.color,
              animationDelay: `${index * 50}ms`,
            }}
            title={cardLabel.labels.name || undefined}
          >
            {showNames &&
              cardLabel.labels.name &&
              cardLabel.labels.name.trim() && (
                <span
                  className={`
                  ${isLight ? 'text-black' : 'text-white'} 
                  font-medium tracking-wide
                  ${size === 'lg' ? 'drop-shadow-sm' : ''}
                `}
                >
                  {cardLabel.labels.name}
                </span>
              )}
          </div>
        );
      })}

      {remainingCount > 0 && (
        <div
          className={`
            bg-gradient-to-r from-muted to-muted/80 text-muted-foreground 
            flex items-center justify-center transition-all duration-200
            hover:from-muted/80 hover:to-muted hover:scale-105 cursor-pointer
            border border-border/50 hover:border-border
            ${sizeClasses[size]}
            ${showNames ? 'font-medium shadow-md' : 'shadow-sm'}
          `}
          title={`${remainingCount} more label${remainingCount > 1 ? 's' : ''}`}
        >
          {showNames ? (
            <span className='font-semibold'>+{remainingCount}</span>
          ) : (
            <span className='text-xs font-bold'>+{remainingCount}</span>
          )}
        </div>
      )}

      {/* Subtle animation for when labels are loaded */}
      <style jsx>{`
        @keyframes slideInFromLeft {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .flex > div {
          animation: slideInFromLeft 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
