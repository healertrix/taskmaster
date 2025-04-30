'use client';

import { format, startOfWeek, addDays } from 'date-fns';

const meetings = [
  {
    id: 1,
    name: 'Weekly Team Sync',
    description: 'Discuss progress on projects',
    time: '8:00 am',
    duration: '1h',
    attendees: ['/avatars/1.png', '/avatars/2.png', '/avatars/3.png'],
  },
  {
    id: 2,
    name: 'Onboarding Session',
    description: 'Introduction for new hires',
    time: '10:00 am',
    duration: '2h',
    attendees: ['/avatars/4.png', '/avatars/5.png'],
  },
];

export function Calendar() {
  const today = new Date();
  const weekStart = startOfWeek(today);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className='bg-white dark:bg-gray-900 rounded-xl shadow-sm p-6'>
      <div className='flex items-center justify-between mb-6'>
        <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
          Calendar
        </h3>
        <div className='text-sm font-medium text-gray-500 dark:text-gray-400'>
          {format(today, 'MMMM yyyy')}
        </div>
      </div>

      <div className='grid grid-cols-7 gap-2 mb-4'>
        {weekDays.map((day) => (
          <div key={day.toString()} className='text-center'>
            <div className='text-xs text-gray-500 dark:text-gray-400 uppercase'>
              {format(day, 'EEE')}
            </div>
            <div
              className={`text-sm font-medium mt-1 ${
                format(day, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
                  ? 'text-yellow-500'
                  : 'text-gray-900 dark:text-white'
              }`}
            >
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      <div className='space-y-4'>
        {meetings.map((meeting) => (
          <div
            key={meeting.id}
            className='flex items-center space-x-4 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors'
          >
            <div className='flex-1'>
              <h4 className='text-sm font-medium text-gray-900 dark:text-white'>
                {meeting.name}
              </h4>
              <p className='text-sm text-gray-500 dark:text-gray-400'>
                {meeting.time} • {meeting.duration}
              </p>
            </div>
            <div className='flex -space-x-2'>
              {meeting.attendees.map((avatar, index) => (
                <div
                  key={index}
                  className='h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-gray-900'
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
