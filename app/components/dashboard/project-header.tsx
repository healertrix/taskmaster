import { ChevronDown, Star } from 'lucide-react';

export function ProjectHeader() {
  return (
    <div className='flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white'>
      <div className='flex items-center gap-4'>
        {/* Project Info */}
        <div className='flex items-center gap-3'>
          <div className='w-8 h-8 bg-blue-100 rounded flex items-center justify-center'>
            <span className='text-blue-700 font-medium'>T</span>
          </div>
          <div>
            <div className='flex items-center gap-2'>
              <h1 className='text-lg font-semibold text-gray-900'>
                TaskMaster
              </h1>
              <button
                className='text-gray-400 hover:text-yellow-400'
                aria-label='Toggle project favorite status'
              >
                <Star className='w-4 h-4' />
              </button>
            </div>
            <p className='text-sm text-gray-500'>Software Project</p>
          </div>
        </div>
      </div>

      <div className='flex items-center gap-3'>
        {/* Quick Actions */}
        <button className='inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 rounded-md hover:bg-gray-50 border border-gray-200'>
          Quick Filters
          <ChevronDown className='w-4 h-4' />
        </button>
      </div>
    </div>
  );
}
