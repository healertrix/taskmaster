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
  Paperclip,
  MessageSquare,
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

// Map old colors to new superhero theme colors
const labelColors = {
  'bg-red-500': 'bg-primary text-primary-foreground',
  'bg-purple-500': 'bg-violet-500 text-white',
  'bg-green-500': 'bg-secondary text-secondary-foreground',
  'bg-blue-500': 'bg-blue-500 text-white',
  'bg-gray-500': 'bg-muted text-muted-foreground',
};

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

// Helper function to get a column style based on ID
const getColumnStyle = (id: string) => {
  const styles = {
    'review-pending': 'bg-accent/20 border-accent/50',
    'android-pending': 'bg-violet-500/20 border-violet-500/50',
    'web-pending': 'bg-secondary/20 border-secondary/50',
    'backend-pending': 'bg-blue-500/20 border-blue-500/50',
    references: 'bg-muted/20 border-muted/50',
    'in-progress': 'bg-primary/20 border-primary/50',
  };

  return styles[id as keyof typeof styles] || 'bg-muted/20 border-muted/50';
};

export default function BoardPage({ params }: { params: { id: string } }) {
  const [columns, setColumns] = useState(initialColumns);
  const boardName = 'TouristSprint1'; // Dynamically get this based on params.id in a real app

  return (
    <div className='h-screen overflow-hidden dot-pattern-dark flex flex-col'>
      <DashboardHeader />

      <main className='flex-1 flex flex-col overflow-hidden'>
        {/* Board Header */}
        <div className='max-w-screen-2xl w-full mx-auto flex justify-between items-center py-4 px-6'>
          <div className='flex items-center space-x-4'>
            <h1 className='text-xl font-bold text-foreground bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent'>
              {boardName}
            </h1>
            <button
              className='text-muted-foreground hover:text-accent transition-colors'
              aria-label='Star board'
            >
              <Star className='w-5 h-5' />
            </button>
            <div className='h-6 border-l border-border'></div>
            <button className='btn btn-outline flex items-center gap-1 text-sm'>
              <Users className='w-4 h-4' />
              <span>Share</span>
            </button>
          </div>

          <div className='flex items-center space-x-3'>
            <button className='btn btn-outline flex items-center gap-1.5 text-sm'>
              <Filter className='w-4 h-4' />
              <span>Filters</span>
            </button>
            <div className='flex -space-x-2'>
              <div className='w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white text-xs font-bold ring-2 ring-background'>
                AN
              </div>
              <div className='w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold ring-2 ring-background'>
                KV
              </div>
              <button
                className='w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-muted-foreground text-xs transition-colors'
                aria-label='Add new member'
              >
                <Plus className='w-4 h-4' />
              </button>
            </div>
          </div>
        </div>

        {/* Board Content - Taking remaining height with fixed sizing */}
        <div className='flex-1 overflow-hidden'>
          {/* Horizontal scrolling container */}
          <div className='h-full overflow-x-auto pb-2 px-6'>
            <div className='flex gap-5 min-w-max h-full py-3'>
              {columns.map((column) => (
                <div
                  key={column.id}
                  className='w-80 h-full flex flex-col flex-shrink-0'
                >
                  {/* Column Header with themed styling */}
                  <div
                    className={`flex items-center justify-between px-4 py-3 rounded-t-lg ${getColumnStyle(
                      column.id
                    )}`}
                  >
                    <h3 className='text-sm font-medium text-foreground flex items-center'>
                      {column.title}
                      <span className='ml-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/20 px-1.5 text-xs font-bold text-primary shadow-sm'>
                        {column.cards.length}
                      </span>
                    </h3>
                    <button
                      className='text-muted-foreground hover:text-foreground transition-colors'
                      aria-label='More column options'
                    >
                      <MoreHorizontal className='w-4 h-4' />
                    </button>
                  </div>

                  {/* Cards Container - Scrollable within column */}
                  <div
                    className={`flex-1 bg-card/50 backdrop-blur-sm border-x border-b border-border rounded-b-lg p-3 space-y-2.5 overflow-y-auto custom-scrollbar`}
                  >
                    {column.cards.map((card) => (
                      <div
                        key={card.id}
                        className='card p-3 cursor-pointer task-card-hover'
                      >
                        {/* Card Labels */}
                        {card.labels && card.labels.length > 0 && (
                          <div className='flex flex-wrap gap-1.5 mb-2.5'>
                            {card.labels.map((label, i) => (
                              <span
                                key={i}
                                className={`badge ${
                                  labelColors[
                                    label.color as keyof typeof labelColors
                                  ] || 'bg-muted text-muted-foreground'
                                }`}
                                title={label.text}
                              >
                                {label.text}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Card Title */}
                        <h4 className='text-sm font-medium text-foreground mb-2.5'>
                          {card.title}
                        </h4>

                        {/* Card Footer - Metadata */}
                        {(card.assignees ||
                          card.attachments ||
                          card.comments) && (
                          <div className='flex items-center justify-between text-xs text-muted-foreground mt-3 pt-2 border-t border-border/30'>
                            {/* Card Indicators */}
                            <div className='flex items-center gap-3'>
                              {card.attachments && (
                                <div
                                  className='flex items-center gap-1'
                                  title='Attachments'
                                >
                                  <Paperclip className='w-3.5 h-3.5' />
                                  <span>{card.attachments}</span>
                                </div>
                              )}
                              {card.comments && (
                                <div
                                  className='flex items-center gap-1'
                                  title='Comments'
                                >
                                  <MessageSquare className='w-3.5 h-3.5' />
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
                                    className={`w-6 h-6 rounded-full ${
                                      assignee.color === 'bg-orange-500'
                                        ? 'bg-gradient-to-br from-orange-500 to-amber-600'
                                        : 'bg-gradient-to-br from-purple-500 to-violet-600'
                                    } flex items-center justify-center text-white text-xs font-bold ring-1 ring-background`}
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
                    <button className='w-full px-3 py-2 text-sm text-muted-foreground hover:text-primary bg-muted/20 hover:bg-primary/5 rounded-lg border border-dashed border-border/50 hover:border-primary/50 transition-colors flex items-center justify-center'>
                      <Plus className='w-4 h-4 mr-1.5' />
                      Add a card
                    </button>
                  </div>
                </div>
              ))}

              {/* Add Column Button */}
              <div className='w-80 flex-shrink-0 self-start mt-1 pt-1'>
                <button className='w-full px-3 py-3 text-sm text-muted-foreground hover:text-primary bg-card/30 hover:bg-primary/5 rounded-lg border border-dashed border-border/50 hover:border-primary/50 transition-colors flex items-center justify-center'>
                  <Plus className='w-4 h-4 mr-1.5' />
                  Add another list
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(var(--muted), 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(var(--primary), 0.3);
        }
      `}</style>
    </div>
  );
}
