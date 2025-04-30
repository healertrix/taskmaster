'use client';

import { Users, UserPlus, FolderKanban } from 'lucide-react';

const stats = [
  {
    name: 'Employe',
    value: '78',
    icon: Users,
    description: 'Total employees',
  },
  {
    name: 'Hirings',
    value: '56',
    icon: UserPlus,
    description: 'Open positions',
  },
  {
    name: 'Projects',
    value: '203',
    icon: FolderKanban,
    description: 'Active projects',
  },
];

export function DashboardStats() {
  return (
    <>
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.name}
            className='bg-white dark:bg-gray-900 rounded-xl shadow-sm p-6'
          >
            <div className='flex items-center'>
              <div className='p-2 bg-gray-100 dark:bg-gray-800 rounded-lg'>
                <Icon className='h-6 w-6 text-gray-600 dark:text-gray-300' />
              </div>
              <div className='ml-4'>
                <p className='text-sm font-medium text-gray-500 dark:text-gray-400'>
                  {stat.name}
                </p>
                <h3 className='text-2xl font-semibold text-gray-900 dark:text-white'>
                  {stat.value}
                </h3>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
