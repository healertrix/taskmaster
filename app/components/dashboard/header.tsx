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

// Types for search results
interface SearchCard {
  id: string;
  title: string;
  description?: string;
  board: string;
  boardId: string;
  boardColor: string;
  workspace: string;
  list: string;
  updatedAt: string;
  dueDate?: string;
}

interface SearchBoard {
  id: string;
  name: string;
  color: string;
  workspace: string;
  workspaceId: string;
  updatedAt: string;
  lastActivityAt: string;
  starred: boolean;
}

interface SearchWorkspace {
  id: string;
  name: string;
  color: string;
  updatedAt: string;
  isOwner: boolean;
  memberCount: number;
  letter: string;
}

interface SearchResults {
  cards: SearchCard[];
  boards: SearchBoard[];
  workspaces: SearchWorkspace[];
}

export function DashboardHeader() {
  const [mounted, setMounted] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showMobileSearchModal, setShowMobileSearchModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'cards' | 'boards' | 'workspaces'
  >('all');
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [showMobileCreateDropdown, setShowMobileCreateDropdown] =
    useState(false);
  const [isCreateWorkspaceModalOpen, setIsCreateWorkspaceModalOpen] =
    useState(false);
  const [isCreateBoardModalOpen, setIsCreateBoardModalOpen] = useState(false);

  // Search state
  const [searchResults, setSearchResults] = useState<SearchResults>({
    cards: [],
    boards: [],
    workspaces: [],
  });
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const searchRef = useRef<HTMLDivElement>(null);
  const createDropdownRef = useRef<HTMLDivElement>(null);
  const mobileCreateDropdownRef = useRef<HTMLDivElement>(null);
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
      if (
        mobileCreateDropdownRef.current &&
        !mobileCreateDropdownRef.current.contains(event.target as Node)
      ) {
        setShowMobileCreateDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Debounced search function
  const performSearch = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults({ cards: [], boards: [], workspaces: [] });
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(query)}&limit=5`
      );

      if (response.ok) {
        const data = await response.json();
        console.log('Search results:', data); // Debug log
        setSearchResults({
          cards: data.cards || [],
          boards: data.boards || [],
          workspaces: data.workspaces || [],
        });
      } else {
        const errorData = await response.json();
        console.error('Search error response:', errorData); // Debug log
        setSearchError(errorData.error || 'Search failed');
        setSearchResults({ cards: [], boards: [], workspaces: [] });
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchError('Network error while searching');
      setSearchResults({ cards: [], boards: [], workspaces: [] });
    } finally {
      setIsSearching(false);
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm) {
        performSearch(searchTerm);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Filter search results based on active filter
  const filteredResults = {
    cards: searchResults.cards,
    boards: searchResults.boards,
    workspaces: searchResults.workspaces,
  };

  // Check if there are any results
  const hasResults =
    filteredResults.cards.length > 0 ||
    filteredResults.boards.length > 0 ||
    filteredResults.workspaces.length > 0;

  // Check if we have results for the active filter
  const hasFilteredResults = () => {
    switch (activeFilter) {
      case 'cards':
        return filteredResults.cards.length > 0;
      case 'boards':
        return filteredResults.boards.length > 0;
      case 'workspaces':
        return filteredResults.workspaces.length > 0;
      default:
        return hasResults;
    }
  };

  // Get category-specific no results message
  const getNoResultsMessage = () => {
    if (activeFilter === 'cards') {
      return `No cards found with "${searchTerm}"`;
    } else if (activeFilter === 'boards') {
      return `No boards found with "${searchTerm}"`;
    } else if (activeFilter === 'workspaces') {
      return `No workspaces found with "${searchTerm}"`;
    }
    return `No results found for "${searchTerm}"`;
  };

  const handleSearchFocus = () => {
    if (searchTerm) {
      setShowSearchResults(true);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (value && value.length >= 1) {
      setShowSearchResults(true);
    } else {
      setShowSearchResults(false);
      setSearchResults({ cards: [], boards: [], workspaces: [] });
      setSearchError(null);
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setShowSearchResults(false);
    setShowMobileSearchModal(false);
    setSearchResults({ cards: [], boards: [], workspaces: [] });
    setSearchError(null);
  };

  const handleMobileSearchOpen = () => {
    setShowMobileSearchModal(true);
  };

  const handleMobileSearchClose = () => {
    setShowMobileSearchModal(false);
    setSearchTerm('');
    setShowSearchResults(false);
    setSearchResults({ cards: [], boards: [], workspaces: [] });
    setSearchError(null);
  };

  // Handle mobile back button/gesture for search modal
  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 640px)').matches;
    if (!isMobile || !showMobileSearchModal) return;

    const handlePopState = () => {
      handleMobileSearchClose();
    };

    // Add history state when search modal opens
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => window.removeEventListener('popstate', handlePopState);
  }, [showMobileSearchModal]);

  if (!mounted) {
    return <div className='h-[68px]'></div>;
  }

  return (
    <>
      <header className='fixed top-0 left-0 right-0 superhero-header z-50'>
        <div className='container mx-auto px-4 py-2 sm:py-3'>
          <div className='flex items-center justify-between'>
            {/* Left section - Logo */}
            <div className='flex items-center'>
              <Link
                href='/'
                className='font-bold text-xl flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity'
              >
                <CheckSquare className='w-6 h-6 text-primary' />
                <span className='hidden md:block'>Taskmaster</span>
              </Link>
            </div>

            {/* Desktop Search Bar */}
            <div
              className='hidden md:flex items-center w-3/4 mx-auto px-4'
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
                    onClick={clearSearch}
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
                        Cards{' '}
                        {filteredResults.cards.length > 0 &&
                          `(${filteredResults.cards.length})`}
                      </button>
                      <button
                        className={`px-3 py-1.5 text-xs font-medium ${
                          activeFilter === 'boards'
                            ? 'text-primary border-b-2 border-primary'
                            : 'text-muted-foreground'
                        }`}
                        onClick={() => setActiveFilter('boards')}
                      >
                        Boards{' '}
                        {filteredResults.boards.length > 0 &&
                          `(${filteredResults.boards.length})`}
                      </button>
                      <button
                        className={`px-3 py-1.5 text-xs font-medium ${
                          activeFilter === 'workspaces'
                            ? 'text-primary border-b-2 border-primary'
                            : 'text-muted-foreground'
                        }`}
                        onClick={() => setActiveFilter('workspaces')}
                      >
                        Workspaces{' '}
                        {filteredResults.workspaces.length > 0 &&
                          `(${filteredResults.workspaces.length})`}
                      </button>
                    </div>

                    {/* Loading state */}
                    {isSearching && (
                      <div className='flex items-center justify-center py-4'>
                        <div className='animate-spin rounded-full h-6 w-6 border-b-2 border-primary'></div>
                        <span className='ml-2 text-sm text-muted-foreground'>
                          Searching...
                        </span>
                      </div>
                    )}

                    {/* Error state */}
                    {searchError && !isSearching && (
                      <div className='py-4 px-3 text-center'>
                        <div className='text-red-500 text-sm mb-2'>
                          {searchError}
                        </div>
                        <button
                          onClick={() => performSearch(searchTerm)}
                          className='text-xs text-primary hover:underline'
                        >
                          Try again
                        </button>
                      </div>
                    )}

                    {!isSearching &&
                    !searchError &&
                    searchTerm &&
                    searchTerm.length >= 2 ? (
                      hasFilteredResults() ? (
                        <>
                          {/* Cards Section */}
                          {(activeFilter === 'all' ||
                            activeFilter === 'cards') &&
                            filteredResults.cards.length > 0 && (
                              <div className='mb-3'>
                                <h3 className='text-xs font-semibold text-muted-foreground uppercase px-2 mb-1'>
                                  Cards
                                </h3>
                                <div className='space-y-0.5'>
                                  {filteredResults.cards.map((card) => (
                                    <Link
                                      key={card.id}
                                      href={`/board/${card.boardId}?card=${card.id}`}
                                      className='block px-2 py-1.5 hover:bg-muted/50 rounded-md transition-colors'
                                      onClick={() =>
                                        setShowSearchResults(false)
                                      }
                                    >
                                      <div className='flex items-start'>
                                        <div
                                          className='w-5 h-5 mr-2 mt-0.5 rounded'
                                          style={{
                                            backgroundColor: card.boardColor,
                                          }}
                                        ></div>
                                        <div className='flex-1'>
                                          <p className='text-sm text-foreground font-medium'>
                                            {card.title}
                                          </p>
                                          <p className='text-xs text-muted-foreground'>
                                            {card.board} • {card.list}
                                          </p>
                                          {card.description && (
                                            <p className='text-xs text-muted-foreground mt-1 line-clamp-1'>
                                              {card.description}
                                            </p>
                                          )}
                                        </div>
                                        <span className='text-xs text-muted-foreground whitespace-nowrap ml-2'>
                                          {new Date(
                                            card.updatedAt
                                          ).toLocaleDateString()}
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
                                      onClick={() =>
                                        setShowSearchResults(false)
                                      }
                                    >
                                      <div className='flex items-center'>
                                        <div
                                          className='w-5 h-5 mr-2 rounded'
                                          style={{
                                            backgroundColor: board.color,
                                          }}
                                        ></div>
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
                                          {new Date(
                                            board.lastActivityAt
                                          ).toLocaleDateString()}
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
                                  {filteredResults.workspaces.map(
                                    (workspace) => (
                                      <Link
                                        key={workspace.id}
                                        href={`/boards/${workspace.id}`}
                                        className='block px-2 py-1.5 hover:bg-muted/50 rounded-md transition-colors'
                                        onClick={() =>
                                          setShowSearchResults(false)
                                        }
                                      >
                                        <div className='flex items-center'>
                                          <div
                                            className='w-5 h-5 mr-2 rounded flex items-center justify-center text-white text-xs font-bold'
                                            style={{
                                              backgroundColor: workspace.color,
                                            }}
                                          >
                                            {workspace.letter}
                                          </div>
                                          <div className='flex-1'>
                                            <p className='text-sm text-foreground font-medium flex items-center'>
                                              {workspace.name}
                                              {workspace.isOwner && (
                                                <Users className='w-3.5 h-3.5 ml-1 text-blue-400' />
                                              )}
                                            </p>
                                            <p className='text-xs text-muted-foreground flex items-center'>
                                              <User className='w-3 h-3 mr-1' />
                                              {workspace.memberCount}{' '}
                                              {workspace.memberCount === 1
                                                ? 'member'
                                                : 'members'}
                                            </p>
                                          </div>
                                          <span className='text-xs text-muted-foreground whitespace-nowrap ml-2'>
                                            {new Date(
                                              workspace.updatedAt
                                            ).toLocaleDateString()}
                                          </span>
                                        </div>
                                      </Link>
                                    )
                                  )}
                                </div>
                              </div>
                            )}
                        </>
                      ) : (
                        <div className='py-5 px-3 text-center'>
                          <div className='flex flex-col items-center justify-center'>
                            <div className='relative mb-3'>
                              <div className='bg-orange-500/10 rounded-full p-3'>
                                <Search className='w-10 h-10 text-orange-500/60' />
                              </div>
                              <div className='absolute -bottom-1 -right-1 bg-orange-500/30 rounded-full p-1'>
                                <X className='w-5 h-5 text-orange-500' />
                              </div>
                            </div>
                            <p className='text-base font-medium text-foreground mb-1'>
                              {getNoResultsMessage()}
                            </p>
                            <p className='text-sm text-muted-foreground'>
                              Try different keywords or check your spelling
                            </p>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className='py-4 px-3 text-center'>
                        <div className='flex flex-col items-center justify-center'>
                          <div className='mb-3'>
                            <div className='bg-blue-500/10 rounded-full p-3'>
                              <Search className='w-8 h-8 text-blue-500/60' />
                            </div>
                          </div>
                          <p className='text-sm font-medium text-foreground mb-1'>
                            {searchTerm && searchTerm.length === 1
                              ? 'Keep typing to search...'
                              : 'Start typing to search'}
                          </p>
                          <p className='text-xs text-muted-foreground'>
                            Search for cards, boards, and workspaces
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Desktop Create Button */}
              <div
                className='relative ml-3 hidden md:block'
                ref={createDropdownRef}
              >
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
                  <div className='absolute top-full right-0 mt-2 w-80 bg-card border border-border rounded-lg shadow-2xl z-[60] overflow-hidden'>
                    {/* Board Creation Section */}
                    <div className='p-4 border-b border-border'>
                      <h3 className='text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3 px-1'>
                        CREATE BOARD
                      </h3>

                      <button
                        onClick={() => {
                          setIsCreateBoardModalOpen(true);
                          setShowCreateDropdown(false);
                        }}
                        className='w-full flex items-start gap-3 p-3 hover:bg-muted/50 rounded-lg transition-colors text-left group'
                      >
                        <div className='w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-purple-500/30 transition-colors'>
                          <LayoutGrid className='w-4 h-4 text-purple-400' />
                        </div>
                        <div className='flex-1'>
                          <h4 className='font-semibold text-sm text-foreground mb-1'>
                            Create board
                          </h4>
                          <p className='text-xs text-muted-foreground leading-relaxed'>
                            A board is made up of cards ordered on lists. Use it
                            to manage projects, track information, or organize
                            anything.
                          </p>
                        </div>
                      </button>
                    </div>

                    {/* Workspace Creation Section */}
                    <div className='p-4'>
                      <h3 className='text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3 px-1'>
                        CREATE WORKSPACE
                      </h3>

                      <button
                        onClick={() => {
                          setIsCreateWorkspaceModalOpen(true);
                          setShowCreateDropdown(false);
                        }}
                        className='w-full flex items-start gap-3 p-3 hover:bg-muted/50 rounded-lg transition-colors text-left group'
                      >
                        <div className='w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-green-500/30 transition-colors'>
                          <Briefcase className='w-4 h-4 text-green-400' />
                        </div>
                        <div className='flex-1'>
                          <h4 className='font-semibold text-sm text-foreground mb-1'>
                            Create workspace
                          </h4>
                          <p className='text-xs text-muted-foreground leading-relaxed'>
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

            {/* Mobile Actions */}
            <div className='flex items-center gap-2 md:hidden'>
              {/* Mobile Search Button */}
              <button
                className='p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors'
                onClick={handleMobileSearchOpen}
                aria-label='Search'
              >
                <Search className='w-5 h-5' />
              </button>

              {/* Mobile Create Button */}
              <div className='relative' ref={mobileCreateDropdownRef}>
                <button
                  className='p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors'
                  onClick={() =>
                    setShowMobileCreateDropdown(!showMobileCreateDropdown)
                  }
                  aria-label='Create'
                >
                  <Plus className='w-5 h-5' />
                </button>

                {/* Mobile Create Dropdown */}
                {showMobileCreateDropdown && (
                  <div className='absolute top-full right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden'>
                    <button
                      onClick={() => {
                        setIsCreateBoardModalOpen(true);
                        setShowMobileCreateDropdown(false);
                      }}
                      className='w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left'
                    >
                      <div className='w-6 h-6 bg-purple-500/20 rounded flex items-center justify-center'>
                        <LayoutGrid className='w-3 h-3 text-purple-400' />
                      </div>
                      <span className='text-sm font-medium'>Create board</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsCreateWorkspaceModalOpen(true);
                        setShowMobileCreateDropdown(false);
                      }}
                      className='w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left border-t border-border'
                    >
                      <div className='w-6 h-6 bg-green-500/20 rounded flex items-center justify-center'>
                        <Briefcase className='w-3 h-3 text-green-400' />
                      </div>
                      <span className='text-sm font-medium'>
                        Create workspace
                      </span>
                    </button>
                  </div>
                )}
              </div>

              <UserProfileMenu />
            </div>

            {/* Desktop Right section */}
            <div className='hidden md:flex items-center gap-4'>
              <UserProfileMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Search Modal */}
      {showMobileSearchModal && (
        <div className='fixed inset-0 z-[100] md:hidden'>
          {/* Backdrop */}
          <div
            className='absolute inset-0 bg-black/50 backdrop-blur-sm'
            onClick={handleMobileSearchClose}
          />

          {/* Modal Content */}
          <div className='relative z-10 flex flex-col h-full'>
            {/* Header */}
            <div className='bg-card border-b border-border p-4'>
              <div className='flex items-center gap-3'>
                <button
                  onClick={handleMobileSearchClose}
                  className='p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors'
                  aria-label='Close search'
                >
                  <X className='w-5 h-5' />
                </button>

                <div className='relative flex-1'>
                  <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground' />
                  <input
                    type='text'
                    placeholder='Search tasks, projects, etc...'
                    className='w-full pl-10 pr-4 py-3 text-foreground placeholder-muted-foreground rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all'
                    value={searchTerm}
                    onChange={handleSearchChange}
                    autoFocus
                  />
                  {searchTerm && (
                    <button
                      className='absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground hover:text-foreground'
                      onClick={clearSearch}
                      aria-label='Clear search'
                    >
                      <X className='w-4 h-4' />
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Tabs */}
              {searchTerm && searchTerm.length >= 2 && (
                <div className='flex border-b border-border mt-4 -mb-4'>
                  <button
                    className={`px-3 py-2 text-sm font-medium ${
                      activeFilter === 'all'
                        ? 'text-primary border-b-2 border-primary'
                        : 'text-muted-foreground'
                    }`}
                    onClick={() => setActiveFilter('all')}
                  >
                    All
                  </button>
                  <button
                    className={`px-3 py-2 text-sm font-medium ${
                      activeFilter === 'cards'
                        ? 'text-primary border-b-2 border-primary'
                        : 'text-muted-foreground'
                    }`}
                    onClick={() => setActiveFilter('cards')}
                  >
                    Cards{' '}
                    {filteredResults.cards.length > 0 &&
                      `(${filteredResults.cards.length})`}
                  </button>
                  <button
                    className={`px-3 py-2 text-sm font-medium ${
                      activeFilter === 'boards'
                        ? 'text-primary border-b-2 border-primary'
                        : 'text-muted-foreground'
                    }`}
                    onClick={() => setActiveFilter('boards')}
                  >
                    Boards{' '}
                    {filteredResults.boards.length > 0 &&
                      `(${filteredResults.boards.length})`}
                  </button>
                  <button
                    className={`px-3 py-2 text-sm font-medium ${
                      activeFilter === 'workspaces'
                        ? 'text-primary border-b-2 border-primary'
                        : 'text-muted-foreground'
                    }`}
                    onClick={() => setActiveFilter('workspaces')}
                  >
                    Workspaces{' '}
                    {filteredResults.workspaces.length > 0 &&
                      `(${filteredResults.workspaces.length})`}
                  </button>
                </div>
              )}
            </div>

            {/* Search Results */}
            <div className='flex-1 overflow-y-auto bg-background'>
              <div className='p-4'>
                {isSearching && (
                  <div className='flex items-center justify-center py-8'>
                    <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
                    <span className='ml-3 text-muted-foreground'>
                      Searching...
                    </span>
                  </div>
                )}

                {searchError && !isSearching && (
                  <div className='text-center py-8'>
                    <div className='text-red-500 mb-2'>{searchError}</div>
                    <button
                      onClick={() => performSearch(searchTerm)}
                      className='text-primary hover:underline'
                    >
                      Try again
                    </button>
                  </div>
                )}

                {!isSearching &&
                !searchError &&
                searchTerm &&
                searchTerm.length >= 2 ? (
                  hasFilteredResults() ? (
                    <div className='space-y-6'>
                      {/* Cards */}
                      {(activeFilter === 'all' || activeFilter === 'cards') &&
                        filteredResults.cards.length > 0 && (
                          <div>
                            <h3 className='text-sm font-semibold text-muted-foreground uppercase mb-3'>
                              Cards
                            </h3>
                            <div className='space-y-2'>
                              {filteredResults.cards.map((card) => (
                                <Link
                                  key={card.id}
                                  href={`/board/${card.boardId}?card=${card.id}`}
                                  className='block p-3 rounded-lg hover:bg-muted/50 transition-colors'
                                  onClick={handleMobileSearchClose}
                                >
                                  <div className='flex items-start gap-3'>
                                    <div
                                      className='w-4 h-4 mt-1 rounded'
                                      style={{
                                        backgroundColor: card.boardColor,
                                      }}
                                    />
                                    <div className='flex-1 min-w-0'>
                                      <p className='font-medium text-foreground truncate'>
                                        {card.title}
                                      </p>
                                      <p className='text-sm text-muted-foreground'>
                                        {card.board} • {card.list}
                                      </p>
                                      {card.description && (
                                        <p className='text-sm text-muted-foreground mt-1 line-clamp-2'>
                                          {card.description}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}

                      {/* Boards */}
                      {(activeFilter === 'all' || activeFilter === 'boards') &&
                        filteredResults.boards.length > 0 && (
                          <div>
                            <h3 className='text-sm font-semibold text-muted-foreground uppercase mb-3'>
                              Boards
                            </h3>
                            <div className='space-y-2'>
                              {filteredResults.boards.map((board) => (
                                <Link
                                  key={board.id}
                                  href={`/board/${board.id}`}
                                  className='block p-3 rounded-lg hover:bg-muted/50 transition-colors'
                                  onClick={handleMobileSearchClose}
                                >
                                  <div className='flex items-center gap-3'>
                                    <div
                                      className='w-4 h-4 rounded'
                                      style={{ backgroundColor: board.color }}
                                    />
                                    <div className='flex-1 min-w-0'>
                                      <div className='flex items-center gap-2'>
                                        <p className='font-medium text-foreground truncate'>
                                          {board.name}
                                        </p>
                                        {board.starred && (
                                          <Star className='w-4 h-4 text-yellow-400 fill-current flex-shrink-0' />
                                        )}
                                      </div>
                                      <p className='text-sm text-muted-foreground truncate'>
                                        {board.workspace}
                                      </p>
                                    </div>
                                  </div>
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}

                      {/* Workspaces */}
                      {(activeFilter === 'all' ||
                        activeFilter === 'workspaces') &&
                        filteredResults.workspaces.length > 0 && (
                          <div>
                            <h3 className='text-sm font-semibold text-muted-foreground uppercase mb-3'>
                              Workspaces
                            </h3>
                            <div className='space-y-2'>
                              {filteredResults.workspaces.map((workspace) => (
                                <Link
                                  key={workspace.id}
                                  href={`/boards/${workspace.id}`}
                                  className='block p-3 rounded-lg hover:bg-muted/50 transition-colors'
                                  onClick={handleMobileSearchClose}
                                >
                                  <div className='flex items-center gap-3'>
                                    <div
                                      className='w-4 h-4 rounded flex items-center justify-center text-white text-xs font-bold'
                                      style={{
                                        backgroundColor: workspace.color,
                                      }}
                                    >
                                      {workspace.letter}
                                    </div>
                                    <div className='flex-1 min-w-0'>
                                      <div className='flex items-center gap-2'>
                                        <p className='font-medium text-foreground truncate'>
                                          {workspace.name}
                                        </p>
                                        {workspace.isOwner && (
                                          <Users className='w-4 h-4 text-blue-400 flex-shrink-0' />
                                        )}
                                      </div>
                                      <p className='text-sm text-muted-foreground flex items-center'>
                                        <User className='w-3 h-3 mr-1' />
                                        {workspace.memberCount}{' '}
                                        {workspace.memberCount === 1
                                          ? 'member'
                                          : 'members'}
                                      </p>
                                    </div>
                                  </div>
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  ) : (
                    <div className='text-center py-12'>
                      <div className='relative mb-4'>
                        <div className='bg-orange-500/10 rounded-full p-4 inline-block'>
                          <Search className='w-8 h-8 text-orange-500/60' />
                        </div>
                        <div className='absolute -bottom-1 -right-1 bg-orange-500/30 rounded-full p-1'>
                          <X className='w-4 h-4 text-orange-500' />
                        </div>
                      </div>
                      <p className='text-lg font-medium text-foreground mb-2'>
                        {getNoResultsMessage()}
                      </p>
                      <p className='text-muted-foreground'>
                        Try different keywords or check your spelling
                      </p>
                    </div>
                  )
                ) : searchTerm && searchTerm.length === 1 ? (
                  <div className='text-center py-12'>
                    <div className='bg-blue-500/10 rounded-full p-4 inline-block mb-4'>
                      <Search className='w-8 h-8 text-blue-500/60' />
                    </div>
                    <p className='text-lg font-medium text-foreground mb-2'>
                      Keep typing to search...
                    </p>
                    <p className='text-muted-foreground'>
                      Search for cards, boards, and workspaces
                    </p>
                  </div>
                ) : (
                  <div className='text-center py-12'>
                    <div className='bg-blue-500/10 rounded-full p-4 inline-block mb-4'>
                      <Search className='w-8 h-8 text-blue-500/60' />
                    </div>
                    <p className='text-lg font-medium text-foreground mb-2'>
                      Start typing to search
                    </p>
                    <p className='text-muted-foreground'>
                      Search for cards, boards, and workspaces
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
