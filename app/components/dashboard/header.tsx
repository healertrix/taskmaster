'use client';

import Link from 'next/link';
import {
  Search,
  CheckSquare,
  Plus,
  Bell,
  User,
  Users,
  Settings,
  LogOut,
  X,
  ChevronRight,
  Filter,
  Clock,
  Star,
  ChevronDown,
  Briefcase,
  LayoutGrid,
  Zap,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { UserProfileMenu } from './UserProfileMenu';
import { CreateWorkspaceModal } from '../workspace/CreateWorkspaceModal';
import { CreateBoardModal } from '../board/CreateBoardModal';

// Mock search results data
const searchResultsData = {
  cards: [
    {
      id: 'card1',
      name: 'Tourists List, Police Control Room, Police, State Supervisor List',
      board: 'TouristSprint1: Web - Pending',
      updatedAt: 'yesterday',
    },
    {
      id: 'card2',
      name: 'Hotel View and Tourist Spot',
      board: 'TouristSprint1: Backend - Pending',
      updatedAt: '3 years ago',
    },
    {
      id: 'card3',
      name: 'Models Creation',
      board: 'TouristSprint1: Backend - Complete',
      updatedAt: '3 years ago',
    },
    {
      id: 'card4',
      name: 'Figma Design',
      board: 'TouristSprint1: Web - Complete',
      updatedAt: '3 years ago',
    },
    {
      id: 'card5',
      name: 'Figma Design',
      board: 'TouristSprint1: Android - Complete',
      updatedAt: '3 years ago',
    },
    {
      id: 'card6',
      name: 'Figma Designs',
      board: 'TouristSprint1: References',
      updatedAt: '3 years ago',
    },
  ],
  boards: [
    {
      id: 'board1',
      name: 'TouristSprint1',
      workspace: 'Entrepreneur Tourist',
      updatedAt: '6 hours ago',
      starred: true,
    },
  ],
  workspaces: [
    {
      id: 'ws1',
      name: 'Entrepreneur Tourist',
      letter: 'E',
      members: 8,
      updatedAt: '1 day ago',
    },
    {
      id: 'ws2',
      name: 'Personal Projects',
      letter: 'P',
      members: 1,
      updatedAt: '3 weeks ago',
    },
    {
      id: 'ws3',
      name: 'Marketing Campaign',
      letter: 'M',
      members: 12,
      updatedAt: '2 days ago',
    },
  ],
};

export function DashboardHeader() {
  const [mounted, setMounted] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'cards' | 'boards' | 'workspaces'
  >('all');
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [isCreateWorkspaceModalOpen, setIsCreateWorkspaceModalOpen] =
    useState(false);
  const [isCreateBoardModalOpen, setIsCreateBoardModalOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const createDropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const isSearchPage = pathname === '/search';

  useEffect(() => {
    setMounted(true);

    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowSearchResults(false);
      }
      if (
        createDropdownRef.current &&
        !createDropdownRef.current.contains(event.target as Node)
      ) {
        setShowCreateDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter search results based on the search term
  const filteredResults = {
    cards: searchResultsData.cards.filter(
      (card) =>
        searchTerm && card.name.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    boards: searchResultsData.boards.filter(
      (board) =>
        searchTerm &&
        board.name.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    workspaces: searchResultsData.workspaces.filter(
      (workspace) =>
        searchTerm &&
        workspace.name.toLowerCase().includes(searchTerm.toLowerCase())
    ),
  };

  // Check if there are any results
  const hasResults =
    filteredResults.cards.length > 0 ||
    filteredResults.boards.length > 0 ||
    filteredResults.workspaces.length > 0;

  const handleSearchFocus = () => {
    if (searchTerm) {
      setShowSearchResults(true);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if (e.target.value) {
      setShowSearchResults(true);
    } else {
      setShowSearchResults(false);
    }
  };

  if (!mounted) {
    return <div className='h-[68px]'></div>;
  }

  return (
    <>
      <header className='fixed top-0 left-0 right-0 superhero-header z-50'>
        <div className='container mx-auto px-4 py-3'>
          <div className='flex items-center justify-between'>
            {/* Left section */}
            <div
              className={`flex items-center space-x-5 ${
                isSearchPage ? 'w-1/4' : 'w-1/6'
              }`}
            >
              <Link
                href='/'
                className='font-bold text-xl flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity'
              >
                <CheckSquare className='w-6 h-6 text-primary' />
                Taskmaster
              </Link>
            </div>

            {/* Search Bar and Create Button */}
            <div
              className='flex items-center w-3/4 mx-auto px-4'
              ref={searchRef}
            >
              <div className='relative flex-1'>
                <Search className='absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground' />
                <input
                  type='text'
                  placeholder='Search tasks, projects, etc...'
                  className='w-full pl-10 pr-4 py-2.5 superhero-header-search text-foreground placeholder-muted-foreground rounded-lg border border-border bg-background/80 focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all input'
                  value={searchTerm}
                  onChange={handleSearchChange}
                  onFocus={handleSearchFocus}
                />
                {searchTerm && (
                  <button
                    className='absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground hover:text-foreground'
                    onClick={() => {
                      setSearchTerm('');
                      setShowSearchResults(false);
                    }}
                    aria-label='Clear search'
                  >
                    <X className='w-4 h-4' />
                  </button>
                )}

                {/* Search Results Dropdown */}
                {showSearchResults && (
                  <div className='absolute top-full left-0 right-0 mt-1 card p-2 z-50 max-h-[80vh] overflow-y-auto'>
                    {/* Tabs */}
                    <div className='flex border-b border-border mb-2'>
                      <button
                        className={`px-3 py-1.5 text-xs font-medium ${
                          activeFilter === 'all'
                            ? 'text-primary border-b-2 border-primary'
                            : 'text-muted-foreground'
                        }`}
                        onClick={() => setActiveFilter('all')}
                      >
                        All
                      </button>
                      <button
                        className={`px-3 py-1.5 text-xs font-medium ${
                          activeFilter === 'cards'
                            ? 'text-primary border-b-2 border-primary'
                            : 'text-muted-foreground'
                        }`}
                        onClick={() => setActiveFilter('cards')}
                      >
                        Cards
                      </button>
                      <button
                        className={`px-3 py-1.5 text-xs font-medium ${
                          activeFilter === 'boards'
                            ? 'text-primary border-b-2 border-primary'
                            : 'text-muted-foreground'
                        }`}
                        onClick={() => setActiveFilter('boards')}
                      >
                        Boards
                      </button>
                      <button
                        className={`px-3 py-1.5 text-xs font-medium ${
                          activeFilter === 'workspaces'
                            ? 'text-primary border-b-2 border-primary'
                            : 'text-muted-foreground'
                        }`}
                        onClick={() => setActiveFilter('workspaces')}
                      >
                        Workspaces
                      </button>
                    </div>

                    {hasResults ? (
                      <>
                        {/* Cards Section */}
                        {(activeFilter === 'all' || activeFilter === 'cards') &&
                          filteredResults.cards.length > 0 && (
                            <div className='mb-3'>
                              <h3 className='text-xs font-semibold text-muted-foreground uppercase px-2 mb-1'>
                                Cards
                              </h3>
                              <div className='space-y-0.5'>
                                {filteredResults.cards.map((card) => (
                                  <Link
                                    key={card.id}
                                    href={`/card/${card.id}`}
                                    className='block px-2 py-1.5 hover:bg-muted/50 rounded-md transition-colors'
                                  >
                                    <div className='flex items-start'>
                                      <div className='w-5 h-5 mr-2 mt-0.5 bg-card border border-border rounded'></div>
                                      <div className='flex-1'>
                                        <p className='text-sm text-foreground font-medium'>
                                          {card.name}
                                        </p>
                                        <p className='text-xs text-muted-foreground'>
                                          {card.board}
                                        </p>
                                      </div>
                                      <span className='text-xs text-muted-foreground whitespace-nowrap ml-2'>
                                        Updated {card.updatedAt}
                                      </span>
                                    </div>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          )}

                        {/* Boards Section */}
                        {(activeFilter === 'all' ||
                          activeFilter === 'boards') &&
                          filteredResults.boards.length > 0 && (
                            <div className='mb-3'>
                              <h3 className='text-xs font-semibold text-muted-foreground uppercase px-2 mb-1'>
                                Boards
                              </h3>
                              <div className='space-y-0.5'>
                                {filteredResults.boards.map((board) => (
                                  <Link
                                    key={board.id}
                                    href={`/board/${board.id}`}
                                    className='block px-2 py-1.5 hover:bg-muted/50 rounded-md transition-colors'
                                  >
                                    <div className='flex items-center'>
                                      <div className='w-5 h-5 mr-2 bg-blue-600 rounded'></div>
                                      <div className='flex-1'>
                                        <p className='text-sm text-foreground font-medium flex items-center'>
                                          {board.name}
                                          {board.starred && (
                                            <Star className='w-3.5 h-3.5 ml-1 text-yellow-400 fill-current' />
                                          )}
                                        </p>
                                        <p className='text-xs text-muted-foreground'>
                                          {board.workspace}
                                        </p>
                                      </div>
                                      <span className='text-xs text-muted-foreground whitespace-nowrap ml-2'>
                                        Updated {board.updatedAt}
                                      </span>
                                    </div>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          )}

                        {/* Workspaces Section */}
                        {(activeFilter === 'all' ||
                          activeFilter === 'workspaces') &&
                          filteredResults.workspaces.length > 0 && (
                            <div className='mb-3'>
                              <h3 className='text-xs font-semibold text-muted-foreground uppercase px-2 mb-1'>
                                Workspaces
                              </h3>
                              <div className='space-y-0.5'>
                                {filteredResults.workspaces.map((workspace) => (
                                  <Link
                                    key={workspace.id}
                                    href={`/workspace/${workspace.id}`}
                                    className='block px-2 py-1.5 hover:bg-muted/50 rounded-md transition-colors'
                                  >
                                    <div className='flex items-center'>
                                      <div className='w-5 h-5 mr-2 bg-gradient-to-br from-purple-600 to-indigo-600 rounded flex items-center justify-center text-white text-xs font-bold'>
                                        {workspace.letter}
                                      </div>
                                      <div className='flex-1'>
                                        <p className='text-sm text-foreground font-medium'>
                                          {workspace.name}
                                        </p>
                                        {workspace.members && (
                                          <p className='text-xs text-muted-foreground flex items-center'>
                                            <User className='w-3 h-3 mr-1' />
                                            {workspace.members}{' '}
                                            {workspace.members === 1
                                              ? 'member'
                                              : 'members'}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </Link>
                                ))}
                              </div>
                            </div>
                          )}

                        {/* Advanced Search Link with improved hover */}
                        <Link
                          href={`/search?q=${encodeURIComponent(searchTerm)}`}
                          className='flex items-center justify-between px-3 py-3 text-sm font-medium bg-background/90 border border-border hover:bg-primary/10 hover:text-primary hover:border-primary/30 rounded-md transition-colors mt-3 shadow-sm'
                          onClick={() => setShowSearchResults(false)}
                        >
                          <div className='flex items-center'>
                            <Search className='w-4 h-4 mr-2 text-primary' />
                            <span className='text-foreground group-hover:text-primary'>
                              Advanced Search
                            </span>
                          </div>
                          <ChevronRight className='w-4 h-4 text-primary' />
                        </Link>
                      </>
                    ) : (
                      <div className='py-5 px-3 text-center'>
                        <div className='flex flex-col items-center justify-center'>
                          <div className='relative mb-3'>
                            <div className='bg-red-500/10 rounded-full p-3'>
                              <Search className='w-10 h-10 text-red-500/60' />
                            </div>
                            <div className='absolute -bottom-1 -right-1 bg-red-500/30 rounded-full p-1'>
                              <X className='w-5 h-5 text-red-500' />
                            </div>
                          </div>
                          <p className='text-base font-medium text-foreground mb-1'>
                            No results found for{' '}
                            <span className='text-red-400'>"{searchTerm}"</span>
                          </p>
                          <p className='text-sm text-muted-foreground mb-3'>
                            Try different keywords or check your spelling
                          </p>
                          <Link
                            href={`/search?q=${encodeURIComponent(searchTerm)}`}
                            className='flex items-center justify-center gap-1.5 mt-1 px-4 py-2 text-sm bg-background/90 border border-border text-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 rounded-md transition-colors shadow-sm'
                            onClick={() => setShowSearchResults(false)}
                          >
                            <Search className='w-3.5 h-3.5 text-primary' />
                            <span>Advanced Search</span>
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Create Button */}
              <div className='relative ml-3' ref={createDropdownRef}>
                <button
                  className='btn btn-primary flex items-center gap-1.5 text-sm hover:bg-primary/90 hover:text-primary-foreground'
                  onClick={() => setShowCreateDropdown(!showCreateDropdown)}
                >
                  <Plus className='w-4 h-4' />
                  Create
                  <ChevronDown className='w-3 h-3 ml-1' />
                </button>

                {/* Create Dropdown Menu */}
                {showCreateDropdown && (
                  <div className='absolute top-full right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-50 overflow-hidden'>
                    {/* Board Creation Section */}
                    <div className='p-4 border-b border-slate-700'>
                      <h3 className='text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 px-1'>
                        CREATE BOARD
                      </h3>

                      <button
                        onClick={() => {
                          setIsCreateBoardModalOpen(true);
                          setShowCreateDropdown(false);
                        }}
                        className='w-full flex items-start gap-3 p-3 hover:bg-slate-700/50 rounded-lg transition-colors text-left group'
                      >
                        <div className='w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-purple-500/30 transition-colors'>
                          <LayoutGrid className='w-4 h-4 text-purple-400' />
                        </div>
                        <div className='flex-1'>
                          <h4 className='font-semibold text-sm text-white mb-1'>
                            Create board
                          </h4>
                          <p className='text-xs text-slate-400 leading-relaxed'>
                            A board is made up of cards ordered on lists. Use it
                            to manage projects, track information, or organize
                            anything.
                          </p>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          // For now, just show the regular create board modal
                          setIsCreateBoardModalOpen(true);
                          setShowCreateDropdown(false);
                        }}
                        className='w-full flex items-start gap-3 p-3 hover:bg-slate-700/50 rounded-lg transition-colors text-left group mt-2'
                      >
                        <div className='w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-blue-500/30 transition-colors'>
                          <Zap className='w-4 h-4 text-blue-400' />
                        </div>
                        <div className='flex-1'>
                          <div className='flex items-center gap-2 mb-1'>
                            <h4 className='font-semibold text-sm text-white'>
                              Start with a template
                            </h4>
                            <span className='relative inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white rounded-full shadow-lg overflow-hidden group'>
                              <span className='absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300'></span>
                              <span className='absolute inset-0 bg-white/20 rounded-full animate-pulse'></span>
                              <span className='relative z-10 flex items-center gap-1'>
                                <svg
                                  className='w-3 h-3 animate-spin'
                                  fill='currentColor'
                                  viewBox='0 0 20 20'
                                >
                                  <path
                                    fillRule='evenodd'
                                    d='M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z'
                                    clipRule='evenodd'
                                  />
                                </svg>
                                Coming Soon
                              </span>
                            </span>
                          </div>
                          <p className='text-xs text-slate-400 leading-relaxed'>
                            Get started faster with a board template.
                          </p>
                        </div>
                      </button>
                    </div>

                    {/* Workspace Creation Section */}
                    <div className='p-4'>
                      <h3 className='text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 px-1'>
                        CREATE WORKSPACE
                      </h3>

                      <button
                        onClick={() => {
                          setIsCreateWorkspaceModalOpen(true);
                          setShowCreateDropdown(false);
                        }}
                        className='w-full flex items-start gap-3 p-3 hover:bg-slate-700/50 rounded-lg transition-colors text-left group'
                      >
                        <div className='w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-green-500/30 transition-colors'>
                          <Briefcase className='w-4 h-4 text-green-400' />
                        </div>
                        <div className='flex-1'>
                          <h4 className='font-semibold text-sm text-white mb-1'>
                            Create workspace
                          </h4>
                          <p className='text-xs text-slate-400 leading-relaxed'>
                            A workspace is a group of boards and people. Use it
                            to organize your company, side project, or family.
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right section with profile menu */}
            <div className='flex items-center gap-4'>
              <button
                className='relative p-2 text-muted-foreground hover:text-foreground rounded-full'
                aria-label='Notifications'
              >
                <Bell className='w-5 h-5' />
                {/* Notification indicator */}
                <span className='absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full'></span>
              </button>

              <UserProfileMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Modals */}
      <CreateWorkspaceModal
        isOpen={isCreateWorkspaceModalOpen}
        onClose={() => setIsCreateWorkspaceModalOpen(false)}
      />

      <CreateBoardModal
        isOpen={isCreateBoardModalOpen}
        onClose={() => setIsCreateBoardModalOpen(false)}
      />
    </>
  );
}
