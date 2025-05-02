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

  return (
    <div className='min-h-screen bg-[#f9fafc]'>
      <DashboardHeader />

      <main className='container mx-auto max-w-6xl px-4 pt-28 pb-16'>
        {/* Sidebar and Main Content */}
        <div className='flex gap-8'>
          {/* Sidebar */}
          <div className='w-60 flex-shrink-0'>
            <nav className='space-y-1'>
              <Link
                href='/'
                className='flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-md'
              >
                <Layout className='w-4 h-4' />
                Boards
              </Link>
              <button className='flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-100'>
                <Users className='w-4 h-4' />
                Members
              </button>
              <button className='flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-100'>
                <Settings className='w-4 h-4' />
                Settings
              </button>
            </nav>

            <div className='mt-8'>
              <h3 className='px-3 text-sm font-medium text-gray-500'>
                Workspaces
              </h3>
              <div className='mt-2 space-y-1'>
                {workspaces.map((workspace) => (
                  <div key={workspace.id} className='space-y-1'>
                    <button className='flex items-center justify-between w-full px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-100'>
                      <div className='flex items-center gap-2'>
                        <div
                          className={`w-8 h-8 ${workspace.color} rounded flex items-center justify-center text-white`}
                        >
                          {workspace.initial}
                        </div>
                        <span>{workspace.name}</span>
                      </div>
                      <ChevronDown className='w-4 h-4' />
                    </button>
                  </div>
                ))}

                <button className='flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-100'>
                  <Plus className='w-4 h-4' />
                  Create Workspace
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className='flex-1'>
            {/* Search */}
            <div className='relative mb-6'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400' />
              <input
                type='text'
                placeholder='Search boards...'
                className='w-full pl-12 pr-4 py-3 text-base border border-gray-200 rounded-lg'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Recent Boards */}
            <div className='mb-8'>
              <div className='flex items-center justify-between mb-4'>
                <h2 className='text-lg font-medium text-gray-900 flex items-center gap-2'>
                  <Clock className='w-5 h-5 text-gray-700' />
                  Recent Boards
                </h2>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                {recentBoards.map((board) => (
                  <Link
                    key={board.id}
                    href={`/board/${board.id}`}
                    className='group relative h-24 rounded-lg bg-white shadow-sm border border-gray-200 hover:shadow-md transition-all'
                  >
                    <div className={`h-2 ${board.color} rounded-t-lg`}></div>
                    <div className='p-4 flex items-start justify-between'>
                      <h3 className='font-medium text-gray-900'>
                        {board.name}
                      </h3>
                      <button
                        className={`${
                          board.starred ? 'text-yellow-400' : 'text-gray-300'
                        } hover:text-yellow-400`}
                        aria-label='Star board'
                      >
                        <Star className='w-4 h-4' />
                      </button>
                    </div>
                  </Link>
                ))}

                <button className='h-24 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-all'>
                  <Plus className='w-5 h-5 mr-2' />
                  Create New Board
                </button>
              </div>
            </div>

            {/* Workspaces with Boards */}
            {workspaces.map((workspace) => (
              <div key={workspace.id} className='mb-8'>
                <div className='flex items-center justify-between mb-4'>
                  <h2 className='text-lg font-medium text-gray-900 flex items-center gap-2'>
                    <div
                      className={`w-6 h-6 ${workspace.color} rounded text-white flex items-center justify-center text-xs`}
                    >
                      {workspace.initial}
                    </div>
                    {workspace.name} Workspace
                  </h2>
                  <button
                    className='text-gray-500 hover:text-gray-700'
                    aria-label='More workspace options'
                  >
                    <MoreHorizontal className='w-5 h-5' />
                  </button>
                </div>

                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                  {workspace.boards.map((board) => (
                    <Link
                      key={board.id}
                      href={`/board/${board.id}`}
                      className='group relative h-24 rounded-lg bg-white shadow-sm border border-gray-200 hover:shadow-md transition-all'
                    >
                      <div className={`h-2 ${board.color} rounded-t-lg`}></div>
                      <div className='p-4'>
                        <h3 className='font-medium text-gray-900'>
                          {board.name}
                        </h3>
                      </div>
                    </Link>
                  ))}

                  <button className='h-24 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-all'>
                    <Plus className='w-5 h-5 mr-2' />
                    Create New Board
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
