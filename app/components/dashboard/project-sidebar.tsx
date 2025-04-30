import {
  ChevronLeft,
  LayoutDashboard,
  KanbanSquare,
  List,
  Calendar,
  Settings,
  Users,
  Filter,
  Search,
  Clock,
} from 'lucide-react';

interface ProjectSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function ProjectSidebar({ isOpen, onToggle }: ProjectSidebarProps) {
  return (
    <aside
      className={`fixed left-0 top-20 h-[calc(100vh-5rem)] bg-white border-r border-gray-200 transition-all duration-300 z-30 ${
        isOpen ? 'w-64' : 'w-0'
      }`}
    >
      <div className={`flex h-full flex-col gap-2 p-4 ${!isOpen && 'hidden'}`}>
        {/* Search */}
        <div className='relative mb-4'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
          <input
            type='text'
            placeholder='Search issues...'
            className='w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-md'
          />
        </div>

        {/* Navigation */}
        <nav className='space-y-1'>
          <button className='flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-50'>
            <LayoutDashboard className='w-4 h-4' />
            Planning
          </button>
          <button className='flex items-center gap-2 w-full px-3 py-2 text-sm text-blue-600 bg-blue-50 rounded-md'>
            <KanbanSquare className='w-4 h-4' />
            Board
          </button>
          <button className='flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-50'>
            <List className='w-4 h-4' />
            List
          </button>
          <button className='flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-50'>
            <Calendar className='w-4 h-4' />
            Calendar
          </button>
        </nav>

        {/* Filters Section */}
        <div className='mt-6'>
          <h3 className='px-3 text-xs font-medium text-gray-500 uppercase tracking-wider'>
            Filters
          </h3>
          <div className='mt-2 space-y-1'>
            <button className='flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-50'>
              <Filter className='w-4 h-4' />
              My Issues
            </button>
            <button className='flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-50'>
              <Clock className='w-4 h-4' />
              Recent
            </button>
          </div>
        </div>

        {/* Team Section */}
        <div className='mt-6'>
          <h3 className='px-3 text-xs font-medium text-gray-500 uppercase tracking-wider'>
            Team
          </h3>
          <div className='mt-2 space-y-1'>
            <button className='flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-50'>
              <Users className='w-4 h-4' />
              Members
            </button>
            <button className='flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-50'>
              <Settings className='w-4 h-4' />
              Settings
            </button>
          </div>
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className={`fixed top-1/2 transform -translate-y-1/2 z-40 w-6 h-12 bg-white border border-gray-200 rounded-r-full flex items-center justify-center hover:bg-gray-50 transition-all duration-300 ${
          isOpen ? 'left-64' : 'left-0'
        }`}
        aria-label='Toggle sidebar'
      >
        <ChevronLeft
          className={`w-4 h-4 transition-transform duration-200 ${
            isOpen ? '' : 'rotate-180'
          }`}
        />
      </button>
    </aside>
  );
}
