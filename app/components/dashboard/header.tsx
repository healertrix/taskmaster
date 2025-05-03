'use client';

import Link from 'next/link';
import {
  Search,
  CheckSquare,
  Plus,
  Bell,
  User,
  Settings,
  LogOut,
  X,
  ChevronRight,
  Filter,
  Clock,
  Star,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

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
  workspaces: [{ id: 'ws1', name: 'Entrepreneur Tourist', letter: 'E' }],
};

export function DashboardHeader() {
  const [mounted, setMounted] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);

    // Close search results when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowSearchResults(false);
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
    <header className='fixed top-0 left-0 right-0 superhero-header z-50'>
      <div className='container mx-auto px-4 py-3'>
        <div className='flex items-center justify-between'>
          {/* Left section */}
          <div className='flex items-center space-x-5 w-1/6'>
            <Link
              href='/'
              className='font-bold text-xl flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity'
            >
              <CheckSquare className='w-6 h-6 text-primary' />
              Taskmaster
            </Link>
          </div>

          {/* Search and Create */}
          <div className='flex items-center w-3/4 mx-auto px-4' ref={searchRef}>
            <div className='relative flex-1'>
              <Search className='absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground' />
              <input
                type='text'
                placeholder='Search tasks, projects, etc...'
                className='w-full pl-10 pr-4 py-2.5 superhero-header-search text-foreground placeholder-muted-foreground rounded-lg border focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all input'
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
                      {(activeFilter === 'all' || activeFilter === 'boards') &&
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
                      {activeFilter === 'all' &&
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
                                    <div className='w-5 h-5 mr-2 bg-purple-600 rounded flex items-center justify-center text-white text-xs font-bold'>
                                      {workspace.letter}
                                    </div>
                                    <p className='text-sm text-foreground font-medium'>
                                      {workspace.name}
                                    </p>
                                  </div>
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}

                      {/* Advanced Search Link */}
                      <Link
                        href={`/search?q=${encodeURIComponent(searchTerm)}`}
                        className='flex items-center justify-between px-2 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors mt-1 border-t border-border'
                        onClick={() => setShowSearchResults(false)}
                      >
                        <div className='flex items-center'>
                          <Search className='w-4 h-4 mr-2' />
                          Advanced Search
                        </div>
                        <ChevronRight className='w-4 h-4' />
                      </Link>
                    </>
                  ) : (
                    <div className='py-5 px-3 text-center'>
                      <div className='flex flex-col items-center justify-center'>
                        <div className='relative mb-3'>
                          <Search className='w-12 h-12 text-muted-foreground opacity-20' />
                          <X className='w-6 h-6 text-muted-foreground absolute bottom-0 right-0 opacity-70' />
                        </div>
                        <p className='text-base font-medium text-foreground mb-1'>
                          No results found for "{searchTerm}"
                        </p>
                        <p className='text-sm text-muted-foreground mb-3'>
                          Try different keywords or check your spelling
                        </p>
                        <Link
                          href={`/search?q=${encodeURIComponent(searchTerm)}`}
                          className='flex items-center justify-center gap-1.5 mt-1 px-3 py-1.5 text-sm bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors'
                          onClick={() => setShowSearchResults(false)}
                        >
                          <Search className='w-3.5 h-3.5' />
                          Advanced Search
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <button className='btn btn-primary flex items-center gap-1.5 text-sm ml-3 hover:bg-primary/90 hover:text-primary-foreground'>
              <Plus className='w-4 h-4' />
              Create
            </button>
          </div>

          {/* Right section */}
          <div className='flex items-center space-x-4 w-1/6 justify-end'>
            <button
              className='p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors relative'
              aria-label='Notifications'
            >
              <Bell className='w-5 h-5' />
              <span className='absolute top-1.5 right-1.5 w-2 h-2 bg-secondary rounded-full border-2 border-background'></span>
            </button>

            <div className='relative'>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className='w-9 h-9 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-primary-foreground text-sm hover:opacity-90 transition-opacity ring-2 ring-primary/30 hover:ring-primary/50'
                aria-label='Profile menu'
                aria-haspopup='true'
              >
                <User className='w-5 h-5' />
              </button>

              {isUserMenuOpen && (
                <div className='absolute top-full right-0 mt-2 w-60 card p-2 animate-fade-in z-10'>
                  <div className='px-2 py-2 border-b border-border mb-1'>
                    <p className='text-sm font-semibold text-foreground'>
                      User Name
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      user@example.com
                    </p>
                  </div>
                  <nav className='flex flex-col gap-1'>
                    <button className='flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors'>
                      <Settings className='w-4 h-4' /> Settings
                    </button>
                    <button className='flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors'>
                      <LogOut className='w-4 h-4' /> Sign out
                    </button>
                  </nav>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
