'use client';

import { DashboardHeader } from './components/dashboard/header';
import { KanbanBoard } from './components/dashboard/kanban-board';
import { ProjectSidebar } from './components/dashboard/project-sidebar';
import { ProjectHeader } from './components/dashboard/project-header';
import { useState } from 'react';

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className='min-h-screen grid-pattern'>
      {/* Background decorations */}
      <div className='fixed inset-0 -z-10'>
        <div className='absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl' />
        <div className='absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-3xl' />
      </div>

      <DashboardHeader />

      <main className='flex h-[calc(100vh-5rem)] pt-20'>
        {/* Project Sidebar */}
        <ProjectSidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />

        {/* Main Content Area */}
        <div
          className={`flex-1 transition-all duration-300 ${
            sidebarOpen ? 'ml-64' : 'ml-0'
          }`}
        >
          <div className='h-full flex flex-col'>
            {/* Project Header with Navigation and Actions */}
            <ProjectHeader />

            {/* Project Board */}
            <div className='flex-1 overflow-hidden'>
              <KanbanBoard />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
