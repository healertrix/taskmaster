'use client';

import { format } from 'date-fns';
import { ArrowUpRight, Clock } from 'lucide-react';

const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const workTimeData = [3.2, 4.5, 3.8, 4.2, 5.4, 0, 0]; // Hours worked each day

export function ProgressCard() {
  const maxHeight = 100; // Maximum bar height in pixels
  const maxHours = Math.max(...workTimeData);

  return (
    <div className='card card-hover animate-slide-up'>
      <div className='p-6'>
        <div className='flex items-center justify-between mb-6'>
          <div>
            <div className='flex items-center gap-2'>
              <Clock className='w-5 h-5 text-gray-400' />
              <h3 className='text-lg font-semibold text-gray-900'>Progress</h3>
            </div>
            <div className='mt-2'>
              <div className='flex items-baseline gap-2'>
                <span className='text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent'>
                  6.1h
                </span>
                <span className='text-sm text-gray-500'>
                  Work Time this week
                </span>
              </div>
              <div className='mt-1 flex items-center gap-2'>
                <div className='flex items-center gap-1 text-emerald-600 text-sm'>
                  <span>+2.5h</span>
                  <ArrowUpRight className='w-4 h-4' />
                </div>
                <span className='text-sm text-gray-500'>vs last week</span>
              </div>
            </div>
          </div>
          <button
            className='btn btn-outline'
            aria-label='View detailed progress statistics'
          >
            <ArrowUpRight className='w-5 h-5' />
          </button>
        </div>

        <div className='flex items-end justify-between h-32'>
          {weekDays.map((day, index) => {
            const hours = workTimeData[index];
            const height = (hours / maxHours) * maxHeight;
            const isToday = index === 4; // Thursday in the example

            return (
              <div key={day} className='flex flex-col items-center'>
                <div className='relative w-8 mb-2'>
                  <div
                    className={`w-full rounded-xl transition-all duration-300 hover:scale-y-110 ${
                      isToday
                        ? 'bg-gradient-to-t from-blue-500 to-violet-500'
                        : 'bg-gray-100'
                    }`}
                    style={{ height: `${height}%` }}
                  />
                </div>
                <span className='text-sm text-gray-500'>{day}</span>
              </div>
            );
          })}
        </div>

        <div className='mt-4 flex items-center justify-between'>
          <div className='text-sm text-gray-500'>
            {format(new Date(), 'h:mm a')}
          </div>
          <div className='text-sm font-medium text-blue-500'>5h 23m</div>
        </div>
      </div>
    </div>
  );
}
