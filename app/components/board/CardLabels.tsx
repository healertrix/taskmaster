'use client';

import { useEffect, useState } from 'react';

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
  cardId: string;
  maxVisible?: number;
  showNames?: boolean;
  size?: 'sm' | 'md' | 'lg';
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
  cardId,
  maxVisible = 5,
  showNames = false,
  size = 'sm',
}: CardLabelsProps) {
  const [labels, setLabels] = useState<CardLabel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLabels();
  }, [cardId]);

  const fetchLabels = async () => {
    try {
      const response = await fetch(`/api/cards/${cardId}/labels`);
      if (response.ok) {
        const data = await response.json();
        setLabels(data.labels || []);
      }
    } catch (error) {
      console.error('Failed to fetch card labels:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className='flex gap-1'>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className='w-8 h-2 bg-muted rounded-sm animate-pulse' />
        ))}
      </div>
    );
  }

  if (labels.length === 0) {
    return null;
  }

  const visibleLabels = labels.slice(0, maxVisible);
  const remainingCount = labels.length - maxVisible;

  const sizeClasses = {
    sm: showNames ? 'px-2 py-1 text-xs min-h-[20px]' : 'w-8 h-2',
    md: showNames ? 'px-3 py-1.5 text-sm min-h-[24px]' : 'w-10 h-3',
    lg: showNames ? 'px-4 py-2 text-sm min-h-[32px]' : 'w-12 h-4',
  };

  return (
    <div className='flex flex-wrap gap-1'>
      {visibleLabels.map((cardLabel) => {
        const isLight = isColorLight(cardLabel.labels.color);

        return (
          <div
            key={cardLabel.id}
            className={`
              rounded-sm flex-shrink-0 transition-all flex items-center justify-center
              ${sizeClasses[size]}
              ${showNames ? 'font-medium shadow-sm' : ''}
            `}
            style={{ backgroundColor: cardLabel.labels.color }}
            title={cardLabel.labels.name || undefined}
          >
            {showNames && cardLabel.labels.name && (
              <span className={`${isLight ? 'text-black' : 'text-white'}`}>
                {cardLabel.labels.name}
              </span>
            )}
          </div>
        );
      })}

      {remainingCount > 0 && (
        <div
          className={`
            bg-muted text-muted-foreground rounded-sm flex items-center justify-center
            ${sizeClasses[size]}
            ${showNames ? 'font-medium' : ''}
          `}
          title={`${remainingCount} more label${remainingCount > 1 ? 's' : ''}`}
        >
          {showNames ? (
            <span>+{remainingCount}</span>
          ) : (
            <span className='text-xs'>+{remainingCount}</span>
          )}
        </div>
      )}
    </div>
  );
}
