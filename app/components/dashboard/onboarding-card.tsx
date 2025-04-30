'use client';

import { format } from 'date-fns';
import { Video, Users, FileText, FileCheck, Link2 } from 'lucide-react';

const tasks = [
  {
    id: 1,
    title: 'Interview',
    time: '08:30',
    icon: Video,
    completed: true,
  },
  {
    id: 2,
    title: 'Team Meeting',
    time: '10:30',
    icon: Users,
    completed: true,
  },
  {
    id: 3,
    title: 'Project Update',
    time: '13:00',
    icon: FileText,
    completed: false,
  },
  {
    id: 4,
    title: 'Discuss Q3 Goals',
    time: '14:45',
    icon: Link2,
    completed: false,
  },
  {
    id: 5,
    title: 'HR Policy Review',
    time: '16:30',
    icon: FileCheck,
    completed: false,
  },
];

export function OnboardingCard() {
  const completedTasks = tasks.filter((task) => task.completed).length;
  const totalTasks = tasks.length;
  const progress = (completedTasks / totalTasks) * 100;

  return (
    <div className='bg-white dark:bg-gray-900 rounded-xl shadow-sm p-6'>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
            Onboarding
          </h3>
          <div className='mt-1 flex items-baseline'>
            <span className='text-2xl font-bold text-gray-900 dark:text-white'>
              18%
            </span>
            <span className='ml-2 text-sm text-gray-500 dark:text-gray-400'>
              Task completion
            </span>
          </div>
        </div>
        <div className='text-2xl font-bold text-gray-900 dark:text-white'>
          2/8
        </div>
      </div>

      <div className='space-y-4'>
        {tasks.map((task) => {
          const Icon = task.icon;
          return (
            <div key={task.id} className='flex items-center space-x-4'>
              <div
                className={`p-2 rounded-lg ${
                  task.completed
                    ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}
              >
                <Icon className='h-5 w-5' />
              </div>
              <div className='flex-1 min-w-0'>
                <p
                  className={`text-sm font-medium ${
                    task.completed
                      ? 'text-gray-500 dark:text-gray-400'
                      : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {task.title}
                </p>
                <p className='text-sm text-gray-500 dark:text-gray-400'>
                  {format(
                    new Date().setHours(
                      parseInt(task.time.split(':')[0]),
                      parseInt(task.time.split(':')[1])
                    ),
                    'hh:mm a'
                  )}
                </p>
              </div>
              {task.completed && (
                <svg
                  className='h-5 w-5 text-green-500'
                  fill='currentColor'
                  viewBox='0 0 20 20'
                >
                  <path
                    fillRule='evenodd'
                    d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                    clipRule='evenodd'
                  />
                </svg>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
