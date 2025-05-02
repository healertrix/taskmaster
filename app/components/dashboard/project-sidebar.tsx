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
    <>
      {/* Overlay for mobile/smaller screens when sidebar is open */}
      {isOpen && (
        <div
          onClick={onToggle}
          className='fixed inset-0 bg-black/30 z-20 lg:hidden backdrop-blur-sm'
          aria-hidden='true'
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed left-0 top-0 h-full bg-card/80 backdrop-blur-xl border-r border-border transition-transform duration-300 ease-in-out z-30 ${
          // Changed positioning to top-0
          isOpen ? 'translate-x-0 w-72' : '-translate-x-full w-72' // Use translate for smooth animation
        }`}
      >
        <div className={`flex h-full flex-col gap-4 p-5`}>
          {/* Project Header/Selector (Example) */}
          <div className='flex items-center justify-between pb-4 border-b border-border'>
            <div className='flex items-center gap-2'>
              <div className='w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center text-primary-foreground font-bold'>
                P
              </div>
              <span className='font-semibold text-foreground'>
                Project Name
              </span>
            </div>
            {/* Maybe a dropdown or settings icon here */}
          </div>

          {/* Search */}
          <div className='relative'>
            <Search className='absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground' />
            <input
              type='text'
              placeholder='Search issues...'
              className='w-full pl-10 pr-4 py-2.5 text-sm input' // Reusing input style
            />
          </div>

          {/* Navigation */}
          <nav className='flex-1 space-y-1.5 overflow-y-auto pr-1 -mr-1'>
            {' '}
            {/* Added overflow */}
            <button className='nav-item flex items-center gap-2.5 w-full text-sm'>
              <LayoutDashboard className='w-4 h-4' />
              Planning
            </button>
            <button className='nav-item-active flex items-center gap-2.5 w-full text-sm font-medium'>
              <KanbanSquare className='w-4 h-4' />
              Board
            </button>
            <button className='nav-item flex items-center gap-2.5 w-full text-sm'>
              <List className='w-4 h-4' />
              List
            </button>
            <button className='nav-item flex items-center gap-2.5 w-full text-sm'>
              <Calendar className='w-4 h-4' />
              Calendar
            </button>
            {/* Divider */}
            <div className='pt-4 mt-4 border-t border-border'>
              <h3 className='px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
                Views
              </h3>
              <button className='nav-item flex items-center gap-2.5 w-full text-sm'>
                <Filter className='w-4 h-4' />
                My Issues
              </button>
              <button className='nav-item flex items-center gap-2.5 w-full text-sm'>
                <Clock className='w-4 h-4' />
                Recently Updated
              </button>
            </div>
          </nav>

          {/* Footer Navigation */}
          <div className='mt-auto border-t border-border pt-4'>
            <nav className='space-y-1.5'>
              <button className='nav-item flex items-center gap-2.5 w-full text-sm'>
                <Users className='w-4 h-4' />
                Members
              </button>
              <button className='nav-item flex items-center gap-2.5 w-full text-sm'>
                <Settings className='w-4 h-4' />
                Project Settings
              </button>
            </nav>
          </div>
        </div>

        {/* Toggle Button (Positioned relative to sidebar) - This might need adjustment based on overall layout */}
        <button
          onClick={onToggle}
          className={`absolute top-1/2 -right-3.5 transform -translate-y-1/2 z-40 w-7 h-10 bg-primary text-primary-foreground shadow-lg border-2 border-background rounded-full flex items-center justify-center hover:bg-[hsl(var(--primary),0.9)] transition-all duration-300`}
          aria-label='Toggle sidebar'
        >
          <ChevronLeft
            className={`w-4 h-4 transition-transform duration-200 ${
              isOpen ? '' : 'rotate-180'
            }`}
          />
        </button>
      </aside>
    </>
  );
}
