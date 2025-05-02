'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DashboardHeader } from './components/dashboard/header';
import {
  Plus,
  Search,
  Star,
  Clock,
  User,
  Users,
  Settings,
  MoreHorizontal,
  ChevronDown,
  Layout,
} from 'lucide-react';

// Sample data for boards
const recentBoards = [
  {
    id: 'board1',
    name: 'TaskmasterSprint1',
    color: 'bg-blue-600',
    starred: true,
  },
  {
    id: 'board2',
    name: 'Website Redesign',
    color: 'bg-purple-600',
    starred: false,
  },
  {
    id: 'board3',
    name: 'Mobile App Development',
    color: 'bg-green-600',
    starred: false,
  },
];

const workspaces = [
  {
    id: 'ws1',
    name: 'Taskmaster',
    initial: 'T',
    color: 'bg-blue-600',
    boards: [
      { id: 'board1', name: 'TaskmasterSprint1', color: 'bg-blue-600' },
      { id: 'board4', name: 'Project Planning', color: 'bg-yellow-600' },
      { id: 'board5', name: 'Marketing Campaign', color: 'bg-red-600' },
    ],
  },
  {
    id: 'ws2',
    name: 'Personal Projects',
    initial: 'P',
    color: 'bg-green-600',
    boards: [
      { id: 'board6', name: 'Travel Plans', color: 'bg-indigo-600' },
      { id: 'board7', name: 'Reading List', color: 'bg-pink-600' },
    ],
  },
];

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');

  // TODO: Replace with actual user data
  const currentUser = {
    name: 'Superhero User',
    avatar: '', // Leave empty for initial/icon display
  };

  return (
    // Use the dark dot pattern for the body background
    <div className='min-h-screen dot-pattern-dark'>
      <DashboardHeader />

      <main className='container mx-auto max-w-7xl px-4 pt-24 pb-16'>
        {' '}
        {/* Increased top padding for fixed header */}
        {/* Sidebar and Main Content */}
        <div className='flex gap-8'>
          {/* Sidebar - Using dark glass effect */}
          <div className='w-64 flex-shrink-0'>
            <div className='glass-dark rounded-xl p-4 sticky top-24'>
              {' '}
              {/* Added sticky positioning */}
              <nav className='space-y-1.5'>
                <Link
                  href='/'
                  className='nav-item-active flex items-center gap-2.5 w-full text-sm font-medium'
                >
                  <Layout className='w-4 h-4' />
                  Boards
                </Link>
                <button className='nav-item flex items-center gap-2.5 w-full text-sm'>
                  <Users className='w-4 h-4' />
                  Members
                </button>
                <button className='nav-item flex items-center gap-2.5 w-full text-sm'>
                  <Settings className='w-4 h-4' />
                  Settings
                </button>
              </nav>
              <div className='mt-8'>
                <h3 className='px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
                  Workspaces
                </h3>
                <div className='mt-3 space-y-1.5'>
                  {workspaces.map((workspace) => (
                    <div key={workspace.id} className='space-y-1.5'>
                      <button className='nav-item flex items-center justify-between w-full text-sm'>
                        <div className='flex items-center gap-2.5'>
                          <div
                            className={`w-7 h-7 ${workspace.color} rounded-lg flex items-center justify-center text-sm font-bold text-white shadow-md`}
                          >
                            {workspace.initial}
                          </div>
                          <span className='font-medium'>{workspace.name}</span>
                        </div>
                        <ChevronDown className='w-4 h-4 text-muted-foreground' />
                      </button>
                    </div>
                  ))}

                  <button className='btn btn-ghost flex items-center gap-2 w-full text-sm justify-start px-3'>
                    <Plus className='w-4 h-4' />
                    Create Workspace
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className='flex-1'>
            {/* Search - Reusing input styling */}
            <div className='relative mb-8'>
              <Search className='absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground' />
              <input
                type='text'
                placeholder='Search boards...'
                className='w-full pl-12 pr-4 py-3 text-base input'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Recent Boards Section */}
            <section className='mb-12'>
              <div className='flex items-center justify-between mb-5'>
                <h2 className='text-xl font-semibold text-foreground flex items-center gap-2'>
                  <Clock className='w-5 h-5 text-secondary' />{' '}
                  {/* Using secondary color */}
                  Recent Boards
                </h2>
                <button className='btn btn-ghost text-sm'>View All</button>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'>
                {/* Board Cards - Applying new card styles */}
                {recentBoards.map((board) => (
                  <Link
                    key={board.id}
                    href={`/board/${board.id}`}
                    className='group relative block p-5 rounded-xl card card-hover h-32 overflow-hidden'
                  >
                    {/* Using absolute positioning for color bar */}
                    <div
                      className={`absolute top-0 left-0 right-0 h-1.5 ${board.color}`}
                    ></div>
                    <div className='relative z-10 flex flex-col justify-between h-full'>
                      <h3 className='font-semibold text-foreground'>
                        {board.name}
                      </h3>
                      <div className='flex justify-end'>
                        <button
                          className={`p-1 rounded-full transition-colors ${
                            board.starred
                              ? 'text-accent'
                              : 'text-muted-foreground/50 opacity-0 group-hover:opacity-100'
                          } hover:text-accent hover:bg-accent/10`}
                          onClick={(e) => {
                            e.preventDefault(); /* TODO: Add starring logic */
                          }}
                          aria-label='Star board'
                        >
                          <Star
                            className='w-4 h-4'
                            fill={board.starred ? 'currentColor' : 'none'}
                          />
                        </button>
                      </div>
                    </div>
                  </Link>
                ))}

                {/* Create New Board Card */}
                <button className='h-32 rounded-xl border-2 border-dashed border-border/50 hover:border-primary bg-card/30 hover:bg-card/50 flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition-all group card-hover'>
                  <div className='w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors'>
                    <Plus className='w-5 h-5 text-primary' />
                  </div>
                  <span className='font-medium text-sm'>Create New Board</span>
                </button>
              </div>
            </section>

            {/* Workspaces Section */}
            {workspaces.map((workspace) => (
              <section key={workspace.id} className='mb-12'>
                <div className='flex items-center justify-between mb-5'>
                  <h2 className='text-xl font-semibold text-foreground flex items-center gap-2.5'>
                    <div
                      className={`w-6 h-6 ${workspace.color} rounded-lg text-white flex items-center justify-center text-xs font-bold shadow-md`}
                    >
                      {workspace.initial}
                    </div>
                    {workspace.name} Workspace
                  </h2>
                  <button
                    className='p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
                    aria-label='More workspace options'
                  >
                    <MoreHorizontal className='w-5 h-5' />
                  </button>
                </div>

                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'>
                  {workspace.boards.map((board) => (
                    <Link
                      key={board.id}
                      href={`/board/${board.id}`}
                      className='group relative block p-5 rounded-xl card card-hover h-32 overflow-hidden'
                    >
                      <div
                        className={`absolute top-0 left-0 right-0 h-1.5 ${board.color}`}
                      ></div>
                      <div className='relative z-10'>
                        <h3 className='font-semibold text-foreground'>
                          {board.name}
                        </h3>
                        {/* Potential placeholder for members or stats */}
                      </div>
                    </Link>
                  ))}

                  {/* Create New Board (in workspace) */}
                  <button className='h-32 rounded-xl border-2 border-dashed border-border/50 hover:border-primary bg-card/30 hover:bg-card/50 flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition-all group card-hover'>
                    <div className='w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors'>
                      <Plus className='w-5 h-5 text-primary' />
                    </div>
                    <span className='font-medium text-sm'>
                      Create New Board
                    </span>
                  </button>
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
