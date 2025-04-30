'use client';

import { Laptop, MoreVertical } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

const devices = [
  {
    id: 1,
    name: 'MacBook Air',
    version: 'Version M1',
    lastUsed: '2 hours ago',
  },
];

export function DevicesList() {
  return (
    <div className='bg-white dark:bg-gray-900 rounded-xl shadow-sm p-6'>
      <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-6'>
        Devices
      </h3>

      <div className='space-y-4'>
        {devices.map((device) => (
          <div key={device.id} className='flex items-center justify-between'>
            <div className='flex items-center space-x-4'>
              <div className='p-2 bg-gray-100 dark:bg-gray-800 rounded-lg'>
                <Laptop className='h-5 w-5 text-gray-600 dark:text-gray-400' />
              </div>
              <div>
                <h4 className='text-sm font-medium text-gray-900 dark:text-white'>
                  {device.name}
                </h4>
                <p className='text-sm text-gray-500 dark:text-gray-400'>
                  {device.version}
                </p>
                <p className='text-xs text-gray-500 dark:text-gray-400'>
                  {device.lastUsed}
                </p>
              </div>
            </div>

            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  className='p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded'
                  title='Device options'
                  aria-label='Device options'
                >
                  <MoreVertical className='h-4 w-4 text-gray-500' />
                </button>
              </DropdownMenu.Trigger>

              <DropdownMenu.Portal>
                <DropdownMenu.Content className='min-w-[160px] bg-white dark:bg-gray-800 rounded-md p-1 shadow-lg'>
                  <DropdownMenu.Item className='text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1.5 outline-none cursor-pointer'>
                    View Details
                  </DropdownMenu.Item>
                  <DropdownMenu.Item className='text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1.5 outline-none cursor-pointer'>
                    Update Device
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className='h-px bg-gray-200 dark:bg-gray-700 my-1' />
                  <DropdownMenu.Item className='text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1.5 outline-none cursor-pointer'>
                    Remove Device
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        ))}
      </div>
    </div>
  );
}
