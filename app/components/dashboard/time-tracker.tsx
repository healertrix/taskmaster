'use client';

import { Play, Pause, RotateCcw } from 'lucide-react';
import { useState, useEffect } from 'react';

export function TimeTracker() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState(0); // Time in seconds

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setTime((prevTime) => prevTime + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
      2,
      '0'
    )}:${String(secs).padStart(2, '0')}`;
  };

  const progress = (time / (8 * 3600)) * 100; // Assuming 8-hour workday

  return (
    <div className='bg-white dark:bg-gray-900 rounded-xl shadow-sm p-6'>
      <div className='flex items-center justify-between mb-6'>
        <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
          Time tracker
        </h3>
        <button
          onClick={() => setTime(0)}
          className='p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg'
          title='Reset timer'
          aria-label='Reset timer'
        >
          <RotateCcw className='h-5 w-5 text-gray-500' />
        </button>
      </div>

      <div className='flex flex-col items-center'>
        <div className='relative w-32 h-32'>
          {/* Circular progress background */}
          <div className='absolute inset-0 rounded-full border-8 border-gray-200 dark:border-gray-700' />

          {/* Circular progress indicator */}
          <div
            className='absolute inset-0 rounded-full border-8 border-yellow-400'
            style={{
              clipPath: `polygon(50% 50%, -50% -50%, ${progress}% -50%)`,
              transform: 'rotate(-90deg)',
            }}
          />

          {/* Time display */}
          <div className='absolute inset-0 flex items-center justify-center'>
            <span className='text-2xl font-bold text-gray-900 dark:text-white'>
              {formatTime(time)}
            </span>
          </div>
        </div>

        <div className='mt-6 flex items-center space-x-4'>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className='flex items-center justify-center w-12 h-12 rounded-full bg-yellow-400 hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2'
            title={isPlaying ? 'Pause timer' : 'Start timer'}
            aria-label={isPlaying ? 'Pause timer' : 'Start timer'}
          >
            {isPlaying ? (
              <Pause className='h-6 w-6 text-yellow-900' />
            ) : (
              <Play className='h-6 w-6 text-yellow-900' />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
