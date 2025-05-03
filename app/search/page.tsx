'use client';

import { useState, useEffect } from 'react';
import { DashboardHeader } from '../components/dashboard/header';
import {
  Search,
  Star,
  Clock,
  Filter,
  ChevronUp,
  ChevronDown,
  X,
  SlidersHorizontal,
  Calendar,
  LayoutList,
  Bookmark,
  Info,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

// Mock search results data
const searchResultsData = {
  cards: [
    {
      id: 'card1',
      name: 'Tourists List, Police Control Room, Police, State Supervisor List',
      board: 'TouristSprint1: Web - Pending',
      boardColor: 'bg-blue-600',
      updatedAt: 'yesterday',
    },
    {
      id: 'card2',
      name: 'Hotel View and Tourist Spot',
      board: 'TouristSprint1: Backend - Pending',
      boardColor: 'bg-indigo-600',
      updatedAt: '3 years ago',
    },
    {
      id: 'card3',
      name: 'Models Creation',
      board: 'TouristSprint1: Backend - Complete',
      description:
        'Database Schema is as enclosed Tourist: - FName, Lname - Phone Number - Nationality - Passport Number - Password - ApiKey Police Control Room: - Room id - Superintendent - Lat/Longitude - Phone Number...',
      boardColor: 'bg-green-600',
      updatedAt: '3 years ago',
    },
    {
      id: 'card4',
      name: 'Figma Design',
      board: 'TouristSprint1: Web - Complete',
      description:
        'https://www.figma.com/file/R54k5nlaERWTNODBTBG6Tc/tourist-app?node-id=0%3A1',
      boardColor: 'bg-purple-600',
      updatedAt: '3 years ago',
    },
    {
      id: 'card5',
      name: 'Figma Design',
      board: 'TouristSprint1: Android - Complete',
      boardColor: 'bg-red-600',
      updatedAt: '3 years ago',
    },
    {
      id: 'card6',
      name: 'Figma Designs',
      board: 'TouristSprint1: References',
      boardColor: 'bg-amber-600',
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
      color: 'bg-blue-600',
    },
  ],
};

const filterOptions = {
  lastUpdated: ['Last 24 hours', 'Last week', 'Last month', 'Last year'],
  boards: [
    'TouristSprint1',
    'Daily Task Management Template | Trello',
    'Remote Team Hub',
    'Kanban Template',
  ],
};

export default function SearchPage() {
  const searchParams = useSearchParams();
  const queryFromUrl = searchParams?.get('q') || '';
  const filterFromUrl = searchParams?.get('filter') || '';

  const [searchTerm, setSearchTerm] = useState(queryFromUrl);
  const [activeTab, setActiveTab] = useState('cards');
  const [expandedSections, setExpandedSections] = useState({
    lastUpdated: true,
    boards: true,
    starredBoards: true,
    cardDescriptions: true,
    closedBoards: false,
  });
  const [filters, setFilters] = useState({
    lastUpdated: '',
    boards: [],
    onlyStarredBoards: filterFromUrl === 'starred',
    includeCardDescriptions: true,
    includeClosedBoards: false,
  });
  const [sortOrder, setSortOrder] = useState('updated');

  // Set the active tab based on the filter parameter
  useEffect(() => {
    if (filterFromUrl === 'starred' || filterFromUrl === 'recent') {
      setActiveTab('boards');
    }
  }, [filterFromUrl]);

  // Filter cards based on filters and search term
  const filteredCards = searchResultsData.cards.filter((card) => {
    if (!searchTerm) return true;

    if (card.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return true;
    }

    if (
      filters.includeCardDescriptions &&
      card.description &&
      card.description.toLowerCase().includes(searchTerm.toLowerCase())
    ) {
      return true;
    }

    return false;
  });

  // Filter boards based on filters and search term
  const filteredBoards = searchResultsData.boards.filter((board) => {
    if (!searchTerm) return true;

    if (filters.onlyStarredBoards && !board.starred) {
      return false;
    }

    return board.name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const clearFilters = () => {
    setFilters({
      lastUpdated: '',
      boards: [],
      onlyStarredBoards: false,
      includeCardDescriptions: true,
      includeClosedBoards: false,
    });
  };

  // Apply a filter
  const toggleLastUpdatedFilter = (filter: string) => {
    setFilters((prev) => ({
      ...prev,
      lastUpdated: prev.lastUpdated === filter ? '' : filter,
    }));
  };

  const toggleBoardFilter = (board: string) => {
    setFilters((prev) => {
      const updatedBoards = prev.boards.includes(board)
        ? prev.boards.filter((b) => b !== board)
        : [...prev.boards, board];

      return {
        ...prev,
        boards: updatedBoards,
      };
    });
  };

  const toggleStarredFilter = () => {
    setFilters((prev) => ({
      ...prev,
      onlyStarredBoards: !prev.onlyStarredBoards,
    }));
  };

  const toggleCardDescriptions = () => {
    setFilters((prev) => ({
      ...prev,
      includeCardDescriptions: !prev.includeCardDescriptions,
    }));
  };

  const toggleClosedBoards = () => {
    setFilters((prev) => ({
      ...prev,
      includeClosedBoards: !prev.includeClosedBoards,
    }));
  };

  return (
    <div className='min-h-screen dot-pattern-dark'>
      <DashboardHeader />

      <main className='container mx-auto max-w-7xl pt-24 pb-16'>
        <div className='px-4 mb-6'>
          <h1 className='text-2xl font-bold text-foreground mb-2'>
            Search Results
          </h1>

          {/* Search Bar */}
          <div className='flex items-center w-full mb-6 mt-4'>
            <div className='relative flex-1'>
              <Search className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground' />
              <input
                type='text'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder='Search boards, cards, and more...'
                className='w-full pl-12 pr-4 py-3 rounded-lg bg-background/90 shadow-md border border-border focus:outline-none focus:ring-2 focus:ring-primary text-foreground'
              />
              {searchTerm && (
                <button
                  className='absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground hover:text-foreground'
                  onClick={() => setSearchTerm('')}
                  aria-label='Clear search'
                >
                  <X className='w-5 h-5' />
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className='border-b border-border mb-6'>
            <div className='flex'>
              <button
                onClick={() => setActiveTab('cards')}
                className={`px-4 py-2 font-medium text-sm transition-colors ${
                  activeTab === 'cards'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Cards {filteredCards.length > 0 && `(${filteredCards.length})`}
              </button>
              <button
                onClick={() => setActiveTab('boards')}
                className={`px-4 py-2 font-medium text-sm transition-colors ${
                  activeTab === 'boards'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Boards{' '}
                {filteredBoards.length > 0 && `(${filteredBoards.length})`}
              </button>
            </div>
          </div>
        </div>

        <div className='flex gap-6 px-4'>
          {/* Sidebar Filters */}
          <div className='w-64 flex-shrink-0'>
            <div className='glass-dark rounded-xl p-4 sticky top-24'>
              <div className='flex items-center justify-between mb-4'>
                <h2 className='text-sm font-semibold text-foreground flex items-center gap-2'>
                  <Filter className='w-4 h-4' />
                  Filter Results
                </h2>
                {(filters.lastUpdated !== '' ||
                  filters.boards.length > 0 ||
                  filters.onlyStarredBoards ||
                  !filters.includeCardDescriptions ||
                  filters.includeClosedBoards) && (
                  <button
                    onClick={clearFilters}
                    className='text-xs text-primary hover:underline'
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Sort Order Section */}
              <div className='mb-4'>
                <div className='flex items-center justify-between mb-2'>
                  <h3 className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
                    Sort Results
                  </h3>
                </div>
                <div className='space-y-1.5'>
                  <button
                    className={`w-full text-left px-3 py-1.5 text-xs rounded-md ${
                      sortOrder === 'updated'
                        ? 'bg-primary/20 text-primary'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSortOrder('updated')}
                  >
                    By last updated
                  </button>
                  <button
                    className={`w-full text-left px-3 py-1.5 text-xs rounded-md ${
                      sortOrder === 'name'
                        ? 'bg-primary/20 text-primary'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSortOrder('name')}
                  >
                    By name
                  </button>
                </div>
              </div>

              {/* Filter by Last Updated Section */}
              <div className='mb-4 border-t border-border pt-4'>
                <div
                  className='flex items-center justify-between cursor-pointer'
                  onClick={() => toggleSection('lastUpdated')}
                >
                  <h3 className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
                    Filter by Last Updated
                  </h3>
                  {expandedSections.lastUpdated ? (
                    <ChevronUp className='w-4 h-4 text-muted-foreground' />
                  ) : (
                    <ChevronDown className='w-4 h-4 text-muted-foreground' />
                  )}
                </div>
                {expandedSections.lastUpdated && (
                  <div className='mt-2 space-y-1.5'>
                    {filterOptions.lastUpdated.map((option) => (
                      <button
                        key={option}
                        className={`w-full text-left px-3 py-1.5 text-xs rounded-md ${
                          filters.lastUpdated === option
                            ? 'bg-primary/20 text-primary'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => toggleLastUpdatedFilter(option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Filter by Board Section */}
              <div className='mb-4 border-t border-border pt-4'>
                <div
                  className='flex items-center justify-between cursor-pointer'
                  onClick={() => toggleSection('boards')}
                >
                  <h3 className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
                    Filter by Board
                  </h3>
                  {expandedSections.boards ? (
                    <ChevronUp className='w-4 h-4 text-muted-foreground' />
                  ) : (
                    <ChevronDown className='w-4 h-4 text-muted-foreground' />
                  )}
                </div>
                {expandedSections.boards && (
                  <div className='mt-2 space-y-1.5'>
                    {filterOptions.boards.map((board) => (
                      <div
                        key={board}
                        className={`flex items-center px-3 py-1.5 text-xs rounded-md ${
                          filters.boards.includes(board)
                            ? 'bg-primary/20 text-primary'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <input
                          type='checkbox'
                          id={`board-${board}`}
                          checked={filters.boards.includes(board)}
                          onChange={() => toggleBoardFilter(board)}
                          className='mr-2 h-3 w-3'
                        />
                        <label
                          htmlFor={`board-${board}`}
                          className='flex-1 cursor-pointer'
                        >
                          {board}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Starred Boards Filter */}
              <div className='mb-4 border-t border-border pt-4'>
                <div
                  className='flex items-center justify-between cursor-pointer'
                  onClick={() => toggleSection('starredBoards')}
                >
                  <h3 className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
                    Starred Boards
                  </h3>
                  {expandedSections.starredBoards ? (
                    <ChevronUp className='w-4 h-4 text-muted-foreground' />
                  ) : (
                    <ChevronDown className='w-4 h-4 text-muted-foreground' />
                  )}
                </div>
                {expandedSections.starredBoards && (
                  <div className='mt-2'>
                    <div className='flex items-center px-3 py-1.5 text-xs rounded-md hover:bg-muted/50'>
                      <input
                        type='checkbox'
                        id='starred-boards'
                        checked={filters.onlyStarredBoards}
                        onChange={toggleStarredFilter}
                        className='mr-2 h-3 w-3'
                      />
                      <label
                        htmlFor='starred-boards'
                        className='flex-1 cursor-pointer'
                      >
                        Only include results from Starred Boards
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Card Descriptions Filter */}
              <div className='mb-4 border-t border-border pt-4'>
                <div
                  className='flex items-center justify-between cursor-pointer'
                  onClick={() => toggleSection('cardDescriptions')}
                >
                  <h3 className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
                    Card Descriptions
                  </h3>
                  {expandedSections.cardDescriptions ? (
                    <ChevronUp className='w-4 h-4 text-muted-foreground' />
                  ) : (
                    <ChevronDown className='w-4 h-4 text-muted-foreground' />
                  )}
                </div>
                {expandedSections.cardDescriptions && (
                  <div className='mt-2'>
                    <div className='flex items-center px-3 py-1.5 text-xs rounded-md hover:bg-muted/50'>
                      <input
                        type='checkbox'
                        id='card-descriptions'
                        checked={filters.includeCardDescriptions}
                        onChange={toggleCardDescriptions}
                        className='mr-2 h-3 w-3'
                      />
                      <label
                        htmlFor='card-descriptions'
                        className='flex-1 cursor-pointer'
                      >
                        Include card descriptions in search
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Closed Boards Filter */}
              <div className='border-t border-border pt-4'>
                <div
                  className='flex items-center justify-between cursor-pointer'
                  onClick={() => toggleSection('closedBoards')}
                >
                  <h3 className='text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
                    Closed Boards and Archived Cards
                  </h3>
                  {expandedSections.closedBoards ? (
                    <ChevronUp className='w-4 h-4 text-muted-foreground' />
                  ) : (
                    <ChevronDown className='w-4 h-4 text-muted-foreground' />
                  )}
                </div>
                {expandedSections.closedBoards && (
                  <div className='mt-2'>
                    <div className='flex items-center px-3 py-1.5 text-xs rounded-md hover:bg-muted/50'>
                      <input
                        type='checkbox'
                        id='closed-boards'
                        checked={filters.includeClosedBoards}
                        onChange={toggleClosedBoards}
                        className='mr-2 h-3 w-3'
                      />
                      <label
                        htmlFor='closed-boards'
                        className='flex-1 cursor-pointer'
                      >
                        Do not show Closed boards and Archived cards
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Search Results */}
          <div className='flex-1'>
            {!searchTerm && (
              <div className='flex items-center justify-center h-full'>
                <div className='text-center max-w-md mx-auto p-8'>
                  <div className='mx-auto w-24 h-24 bg-muted/30 rounded-full flex items-center justify-center mb-6'>
                    <Search className='w-12 h-12 text-muted-foreground opacity-30' />
                  </div>
                  <h2 className='text-2xl font-semibold mb-3 text-foreground'>
                    Start searching
                  </h2>
                  <p className='text-muted-foreground mb-6'>
                    Enter keywords in the search box above to find cards,
                    boards, or workspaces.
                  </p>
                  <div className='bg-muted/30 p-4 rounded-lg'>
                    <h3 className='font-medium text-sm mb-2 flex items-center'>
                      <Info className='w-4 h-4 mr-2 text-primary' />
                      Search tips
                    </h3>
                    <ul className='text-sm text-muted-foreground text-left space-y-2'>
                      <li className='flex items-start'>
                        <span className='mr-2'>•</span>
                        <span>
                          Use specific keywords related to your cards or boards
                        </span>
                      </li>
                      <li className='flex items-start'>
                        <span className='mr-2'>•</span>
                        <span>
                          Filter results using the options on the left
                        </span>
                      </li>
                      <li className='flex items-start'>
                        <span className='mr-2'>•</span>
                        <span>
                          Switch between cards and boards using the tabs above
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {searchTerm &&
              filteredCards.length === 0 &&
              filteredBoards.length === 0 && (
                <div className='flex items-center justify-center h-full'>
                  <div className='text-center max-w-md mx-auto p-8 bg-card border border-border rounded-xl shadow-lg'>
                    <div className='relative mx-auto w-24 h-24 mb-6'>
                      <div className='absolute inset-0 bg-red-500/10 rounded-full flex items-center justify-center'>
                        <Search className='w-12 h-12 text-red-500/60' />
                      </div>
                      <div className='absolute right-0 bottom-0 w-10 h-10 bg-red-500/30 rounded-full flex items-center justify-center'>
                        <X className='w-6 h-6 text-red-500' />
                      </div>
                    </div>
                    <h2 className='text-2xl font-semibold mb-3 text-foreground'>
                      No results found
                    </h2>
                    <p className='text-muted-foreground mb-6'>
                      We couldn't find anything matching{' '}
                      <span className='text-red-400 font-medium'>
                        "{searchTerm}"
                      </span>
                    </p>
                    <div className='bg-background/60 p-4 rounded-lg border border-border'>
                      <h3 className='font-medium text-sm mb-2 flex items-center'>
                        <Info className='w-4 h-4 mr-2 text-primary' />
                        Suggestions
                      </h3>
                      <ul className='text-sm text-muted-foreground text-left space-y-2'>
                        <li className='flex items-start'>
                          <span className='mr-2'>•</span>
                          <span>Check your spelling</span>
                        </li>
                        <li className='flex items-start'>
                          <span className='mr-2'>•</span>
                          <span>
                            Try using different or more general keywords
                          </span>
                        </li>
                        <li className='flex items-start'>
                          <span className='mr-2'>•</span>
                          <span>Adjust or clear your search filters</span>
                        </li>
                        <li className='flex items-start'>
                          <span className='mr-2'>•</span>
                          <span>
                            Try including closed boards and archived cards
                          </span>
                        </li>
                      </ul>
                    </div>
                    <button
                      onClick={clearFilters}
                      className='mt-4 flex items-center gap-2 mx-auto px-3 py-2 bg-background/90 border border-border text-foreground hover:bg-muted/30 rounded-md transition-colors'
                    >
                      <Filter className='w-4 h-4 text-primary' />
                      <span>Clear all filters</span>
                    </button>
                  </div>
                </div>
              )}

            {searchTerm &&
              (filteredCards.length > 0 || filteredBoards.length > 0) &&
              activeTab === 'cards' && (
                <div className='bg-card border border-border rounded-xl overflow-hidden shadow-md'>
                  <div className='p-4 bg-muted/30 border-b border-border'>
                    <h2 className='text-sm font-semibold text-foreground'>
                      Cards ({filteredCards.length})
                    </h2>
                  </div>

                  {filteredCards.length > 0 ? (
                    <div className='divide-y divide-border'>
                      {filteredCards.map((card) => (
                        <div
                          key={card.id}
                          className='p-4 hover:bg-muted/20 transition-colors'
                        >
                          <div className='flex items-start'>
                            <div
                              className={`mt-1 w-5 h-5 ${card.boardColor} rounded flex-shrink-0`}
                            ></div>
                            <div className='ml-3 flex-1'>
                              <Link
                                href={`/card/${card.id}`}
                                className='font-medium text-foreground hover:text-primary'
                              >
                                {card.name}
                              </Link>
                              <p className='text-sm text-muted-foreground mt-1'>
                                {card.board}
                              </p>
                              {card.description &&
                                filters.includeCardDescriptions && (
                                  <p className='text-sm text-muted-foreground mt-2 line-clamp-2'>
                                    {card.description}
                                  </p>
                                )}
                            </div>
                            <div className='text-xs text-muted-foreground whitespace-nowrap ml-3'>
                              Updated {card.updatedAt}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className='p-10 text-center'>
                      <div className='max-w-md mx-auto'>
                        <div className='relative mb-4 mx-auto w-20 h-20 bg-muted/30 rounded-full flex items-center justify-center'>
                          <Search className='w-10 h-10 text-muted-foreground opacity-40' />
                          <div className='absolute -right-1 -bottom-1 w-8 h-8 bg-muted/50 rounded-full flex items-center justify-center'>
                            <X className='w-5 h-5 text-muted-foreground' />
                          </div>
                        </div>
                        <h3 className='text-xl font-medium text-foreground mb-2'>
                          No cards found
                        </h3>
                        <p className='text-sm text-muted-foreground mb-6'>
                          We couldn't find any cards matching your search
                          criteria. Try adjusting your search term or filters.
                        </p>
                        <div className='space-y-3'>
                          <div className='bg-muted/30 p-3 rounded-lg text-left'>
                            <h4 className='text-sm font-medium text-foreground flex items-center mb-2'>
                              <Info className='w-4 h-4 mr-2 text-primary' />
                              Search tips
                            </h4>
                            <ul className='text-sm text-muted-foreground space-y-2'>
                              <li className='flex items-start'>
                                <span className='mr-2'>•</span>
                                Check your spelling
                              </li>
                              <li className='flex items-start'>
                                <span className='mr-2'>•</span>
                                Try more general keywords
                              </li>
                              <li className='flex items-start'>
                                <span className='mr-2'>•</span>
                                Try adjusting your filters
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

            {searchTerm &&
              (filteredCards.length > 0 || filteredBoards.length > 0) &&
              activeTab === 'boards' && (
                <div className='bg-card border border-border rounded-xl overflow-hidden shadow-md'>
                  <div className='p-4 bg-muted/30 border-b border-border'>
                    <h2 className='text-sm font-semibold text-foreground'>
                      Boards ({filteredBoards.length})
                    </h2>
                  </div>

                  {filteredBoards.length > 0 ? (
                    <div className='divide-y divide-border'>
                      {filteredBoards.map((board) => (
                        <div
                          key={board.id}
                          className='p-4 hover:bg-muted/20 transition-colors'
                        >
                          <div className='flex items-center'>
                            <div
                              className={`w-10 h-10 ${board.color} rounded-md flex-shrink-0 flex items-center justify-center`}
                            >
                              <LayoutList className='w-5 h-5 text-white' />
                            </div>
                            <div className='ml-3 flex-1'>
                              <div className='flex items-center'>
                                <Link
                                  href={`/board/${board.id}`}
                                  className='font-medium text-foreground hover:text-primary'
                                >
                                  {board.name}
                                </Link>
                                {board.starred && (
                                  <Star className='w-4 h-4 ml-2 text-yellow-400 fill-current' />
                                )}
                              </div>
                              <p className='text-sm text-muted-foreground mt-1'>
                                {board.workspace}
                              </p>
                            </div>
                            <div className='text-xs text-muted-foreground whitespace-nowrap'>
                              Updated {board.updatedAt}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className='p-10 text-center'>
                      <div className='max-w-md mx-auto'>
                        <div className='relative mb-4 mx-auto w-20 h-20 bg-muted/30 rounded-full flex items-center justify-center'>
                          <LayoutList className='w-10 h-10 text-muted-foreground opacity-40' />
                          <div className='absolute -right-1 -bottom-1 w-8 h-8 bg-muted/50 rounded-full flex items-center justify-center'>
                            <X className='w-5 h-5 text-muted-foreground' />
                          </div>
                        </div>
                        <h3 className='text-xl font-medium text-foreground mb-2'>
                          No boards found
                        </h3>
                        <p className='text-sm text-muted-foreground mb-6'>
                          We couldn't find any boards matching your search
                          criteria. Try adjusting your search term or filters.
                        </p>
                        <div className='space-y-3'>
                          <div className='bg-muted/30 p-3 rounded-lg text-left'>
                            <h4 className='text-sm font-medium text-foreground flex items-center mb-2'>
                              <Info className='w-4 h-4 mr-2 text-primary' />
                              Search tips
                            </h4>
                            <ul className='text-sm text-muted-foreground space-y-2'>
                              <li className='flex items-start'>
                                <span className='mr-2'>•</span>
                                Try removing board filters
                              </li>
                              <li className='flex items-start'>
                                <span className='mr-2'>•</span>
                                Include closed boards in your search
                              </li>
                              <li className='flex items-start'>
                                <span className='mr-2'>•</span>
                                Try more general keywords
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
          </div>
        </div>
      </main>
    </div>
  );
}
