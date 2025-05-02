'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DashboardHeader } from '../../components/dashboard/header';
import {
  Star,
  User,
  Users,
  Plus,
  MoreHorizontal,
  Filter,
  Search,
  ChevronDown,
  Sparkles,
  Clock,
  CheckSquare,
  ArrowUp,
  Bug,
} from 'lucide-react';

// Define card/task type
interface Task {
  id: string;
  title: string;
  labels?: { color: string; text: string }[];
  assignees?: { initials: string; color: string }[];
  attachments?: number;
  comments?: number;
}

// Sample data for columns and cards
const initialColumns = [
  {
    id: 'review-pending',
    title: 'Review - Pending',
    cards: [
      {
        id: 'card1',
        title: '2nd Review @Clq',
        labels: [{ color: 'bg-red-500', text: 'Priority' }],
        assignees: [
          { initials: 'AN', color: 'bg-orange-500' },
          { initials: 'KV', color: 'bg-purple-500' },
        ],
      },
      {
        id: 'card2',
        title: 'fefesf',
      },
    ],
  },
  {
    id: 'android-pending',
    title: 'Android - Pending',
    cards: [
      {
        id: 'card3',
        title: 'Home Activity',
        labels: [{ color: 'bg-purple-500', text: 'Android' }],
      },
      {
        id: 'card4',
        title: 'Profile Activity',
        labels: [{ color: 'bg-purple-500', text: 'Android' }],
      },
      {
        id: 'card5',
        title: 'Theft Report Activity',
        labels: [{ color: 'bg-purple-500', text: 'Android' }],
      },
      {
        id: 'card6',
        title: 'Over Charging Report Activity',
        labels: [{ color: 'bg-purple-500', text: 'Android' }],
      },
      {
        id: 'card7',
        title: 'Duping Report Activity',
        labels: [{ color: 'bg-purple-500', text: 'Android' }],
      },
      {
        id: 'card8',
        title: 'Spot Details Activity',
        labels: [{ color: 'bg-purple-500', text: 'Android' }],
      },
      {
        id: 'card9',
        title: 'Places to go Activity',
        labels: [{ color: 'bg-purple-500', text: 'Android' }],
      },
    ],
  },
  {
    id: 'web-pending',
    title: 'Web - Pending',
    cards: [
      {
        id: 'card10',
        title: 'Nation Home Page',
        labels: [{ color: 'bg-green-500', text: 'Web' }],
      },
      {
        id: 'card11',
        title: 'State Home Page',
        labels: [{ color: 'bg-green-500', text: 'Web' }],
      },
      {
        id: 'card12',
        title: 'Analysis Page',
        labels: [{ color: 'bg-green-500', text: 'Web' }],
      },
      {
        id: 'card13',
        title: 'Requests Handling Page',
        labels: [{ color: 'bg-green-500', text: 'Web' }],
      },
      {
        id: 'card14',
        title: 'Police Home Page',
        labels: [{ color: 'bg-green-500', text: 'Web' }],
      },
    ],
  },
  {
    id: 'backend-pending',
    title: 'Backend - Pending',
    cards: [
      {
        id: 'card15',
        title: 'Authorization',
        labels: [{ color: 'bg-blue-500', text: 'Backend' }],
      },
      {
        id: 'card16',
        title: 'Hotel View and Tourist Spot',
        labels: [{ color: 'bg-blue-500', text: 'Backend' }],
        assignees: [{ initials: 'AN', color: 'bg-orange-500' }],
      },
      {
        id: 'card17',
        title:
          'Tourists List, Police Control Room, Police, State Supervisor List',
        labels: [{ color: 'bg-blue-500', text: 'Backend' }],
        assignees: [{ initials: 'KV', color: 'bg-purple-500' }],
      },
    ],
  },
  {
    id: 'references',
    title: 'References',
    cards: [
      {
        id: 'card18',
        title: 'GitHub References',
        labels: [{ color: 'bg-gray-500', text: 'Documentation' }],
        attachments: 3,
        comments: 3,
      },
      {
        id: 'card19',
        title: 'Excali Design',
        labels: [{ color: 'bg-green-500', text: 'Design' }],
        attachments: 1,
      },
      {
        id: 'card20',
        title: 'Figma Designs',
        labels: [{ color: 'bg-green-500', text: 'Design' }],
        attachments: 1,
      },
      {
        id: 'card21',
        title: 'DB Design',
        labels: [{ color: 'bg-green-500', text: 'Design' }],
        attachments: 1,
      },
    ],
  },
  {
    id: 'in-progress',
    title: 'In Progress',
    cards: [],
  },
];

export default function BoardPage({ params }: { params: { id: string } }) {
  const [columns, setColumns] = useState(initialColumns);
  const boardName = 'TouristSprint1'; // Dynamically get this based on params.id in a real app

  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-900 to-indigo-800'>
      <DashboardHeader />

      <main className='pt-24 pb-16 px-4'>
        {/* Board Header */}
        <div className='max-w-screen-2xl mx-auto flex justify-between items-center mb-6'>
          <div className='flex items-center space-x-4'>
            <h1 className='text-xl font-bold text-white'>{boardName}</h1>
            <button
              className='text-white/70 hover:text-white'
              aria-label='Star board'
            >
              <Star className='w-5 h-5' />
            </button>
            <div className='h-6 border-l border-white/20'></div>
            <button className='flex items-center gap-1 px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-sm text-white/90'>
              <Users className='w-4 h-4' />
              <span>Share</span>
            </button>
          </div>

          <div className='flex items-center space-x-2'>
            <button className='flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-white/10 hover:bg-white/20 rounded'>
              <Filter className='w-4 h-4' />
              <span>Filters</span>
            </button>
            <div className='flex -space-x-2'>
              <div className='w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs ring-2 ring-blue-900'>
                AN
              </div>
              <div className='w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs ring-2 ring-blue-900'>
                KV
              </div>
              <button
                className='w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xs'
                aria-label='Add new member'
              >
                <Plus className='w-4 h-4' />
              </button>
            </div>
          </div>
        </div>

        {/* Board Content */}
        <div className='max-w-screen-2xl mx-auto overflow-x-auto pb-4'>
          <div className='flex gap-4 min-w-max'>
            {columns.map((column) => (
              <div key={column.id} className='w-72 flex-shrink-0'>
                {/* Column Header */}
                <div className='flex items-center justify-between mb-2 px-2'>
                  <h3 className='text-sm font-medium text-white'>
                    {column.title}
                  </h3>
                  <button
                    className='text-white/70 hover:text-white'
                    aria-label='More column options'
                  >
                    <MoreHorizontal className='w-4 h-4' />
                  </button>
                </div>

                {/* Cards Container */}
                <div className='space-y-2'>
                  {column.cards.map((card) => (
                    <div
                      key={card.id}
                      className='bg-white rounded-md shadow p-3 cursor-pointer hover:bg-gray-50'
                    >
                      {/* Card Labels */}
                      {card.labels && card.labels.length > 0 && (
                        <div className='flex flex-wrap gap-1 mb-2'>
                          {card.labels.map((label, i) => (
                            <span
                              key={i}
                              className={`${label.color} h-2 w-12 rounded-sm`}
                              title={label.text}
                            ></span>
                          ))}
                        </div>
                      )}

                      {/* Card Title */}
                      <h4 className='text-sm font-medium text-gray-800 mb-2'>
                        {card.title}
                      </h4>

                      {/* Card Footer - Metadata */}
                      {(card.assignees ||
                        card.attachments ||
                        card.comments) && (
                        <div className='flex items-center justify-between text-xs text-gray-500 mt-2'>
                          {/* Card Indicators */}
                          <div className='flex items-center gap-2'>
                            {card.attachments && (
                              <div
                                className='flex items-center gap-1'
                                title='Attachments'
                              >
                                <span>{card.attachments}</span>
                              </div>
                            )}
                            {card.comments && (
                              <div
                                className='flex items-center gap-1'
                                title='Comments'
                              >
                                <span>{card.comments}</span>
                              </div>
                            )}
                          </div>

                          {/* Assignees */}
                          {card.assignees && (
                            <div className='flex -space-x-2'>
                              {card.assignees.map((assignee, i) => (
                                <div
                                  key={i}
                                  className={`w-6 h-6 rounded-full ${assignee.color} flex items-center justify-center text-white text-xs ring-1 ring-white`}
                                  title={assignee.initials}
                                >
                                  {assignee.initials}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add Card Button */}
                  <button className='w-full px-3 py-2 text-sm text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded flex items-center justify-center'>
                    <Plus className='w-4 h-4 mr-1' />
                    Add a card
                  </button>
                </div>
              </div>
            ))}

            {/* Add Column Button */}
            <div className='w-72 flex-shrink-0'>
              <button className='w-full px-3 py-2.5 text-sm text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded flex items-center justify-center'>
                <Plus className='w-4 h-4 mr-1' />
                Add another list
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
