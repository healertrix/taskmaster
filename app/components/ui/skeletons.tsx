import React from 'react';

// Card skeleton component
export const CardSkeleton = ({ delay = 0 }: { delay?: number }) => (
  <div
    className='animate-pulse bg-card border border-border/20 rounded-lg p-3 mb-6 last:mb-0 min-h-[80px]'
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className='space-y-3'>
      {/* Labels area */}
      <div className='flex gap-2'>
        <div className='h-4 bg-muted/50 rounded-full w-16' />
        <div className='h-4 bg-muted/50 rounded-full w-12' />
      </div>

      {/* Title */}
      <div className='space-y-2'>
        <div className='h-4 bg-muted/50 rounded w-full' />
        <div className='h-4 bg-muted/50 rounded w-3/4' />
      </div>

      {/* Footer */}
      <div className='flex justify-between items-center mt-4'>
        <div className='flex -space-x-2'>
          <div className='w-6 h-6 bg-muted/50 rounded-full' />
          <div className='w-6 h-6 bg-muted/50 rounded-full' />
        </div>
        <div className='flex gap-2'>
          <div className='w-4 h-4 bg-muted/50 rounded' />
          <div className='w-4 h-4 bg-muted/50 rounded' />
        </div>
      </div>
    </div>
  </div>
);

// List/Column skeleton component
export const ListSkeleton = ({
  cardCount = 2,
  delay = 0,
}: {
  cardCount?: number;
  delay?: number;
}) => (
  <div
    className='flex-shrink-0 w-72 animate-pulse'
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className='bg-card rounded-lg border border-border/20 overflow-hidden'>
      {/* List header */}
      <div className='p-3 border-b border-border/20'>
        <div className='flex items-center justify-between'>
          <div className='h-5 bg-muted/50 rounded w-28' />
          <div className='w-6 h-6 bg-muted/50 rounded-lg' />
        </div>
      </div>

      {/* List content */}
      <div className='p-3 space-y-3 min-h-[120px]'>
        {Array.from({ length: cardCount }).map((_, index) => (
          <CompactCardSkeleton key={index} delay={index * 50} />
        ))}

        {/* Add card button skeleton */}
        <div className='h-8 bg-muted/30 border-2 border-dashed border-muted/50 rounded-lg flex items-center justify-center'>
          <div className='w-16 h-3 bg-muted/50 rounded' />
        </div>
      </div>
    </div>
  </div>
);

// Board skeleton component
export const BoardSkeleton = () => (
  <div className='dot-pattern-dark flex flex-col h-auto'>
    {/* Header skeleton */}
    <div className='container mx-auto max-w-full px-4 pt-24 pb-4'>
      <div className='flex items-center justify-between mb-6 animate-pulse'>
        <div className='flex items-center gap-4'>
          <div className='w-9 h-9 bg-muted/50 rounded-lg' />
          <div className='flex items-center gap-3'>
            <div className='w-8 h-8 bg-muted/50 rounded-lg' />
            <div className='space-y-2'>
              <div className='h-6 w-40 bg-muted/50 rounded' />
              <div className='h-3 w-28 bg-muted/50 rounded' />
            </div>
          </div>
        </div>
        <div className='flex items-center gap-3'>
          <div className='w-8 h-8 bg-muted/50 rounded-lg' />
          <div className='flex items-center gap-2'>
            <div className='w-4 h-4 bg-muted/50 rounded' />
            <div className='w-20 h-3 bg-muted/50 rounded' />
          </div>
          <div className='w-8 h-8 bg-muted/50 rounded-lg' />
          <div className='w-8 h-8 bg-muted/50 rounded-lg' />
        </div>
      </div>
    </div>

    {/* Board content skeleton */}
    <div className='overflow-x-auto px-4 pb-6'>
      <div className='flex gap-4 min-w-max'>
        {/* List skeletons */}
        {Array.from({ length: 3 }).map((_, index) => (
          <CompactListSkeleton key={index} cardCount={2} delay={index * 100} />
        ))}

        {/* Add list skeleton */}
        <div
          className='flex-shrink-0 w-72 animate-pulse'
          style={{ animationDelay: '300ms' }}
        >
          <div className='h-24 bg-card/30 border-2 border-dashed border-border/50 rounded-lg flex flex-col items-center justify-center'>
            <div className='w-6 h-6 bg-muted/50 rounded-full mb-2' />
            <div className='h-3 w-16 bg-muted/50 rounded' />
          </div>
        </div>
      </div>
    </div>
  </div>
);

// List View skeleton — mirrors ListView.tsx's own row layout (leading
// checkbox slot | name | dates | assignees) so a user who's remembered into
// List View sees a shape that matches what's about to load in, instead of
// the kanban-shaped BoardSkeleton flashing first.
export const BoardListViewSkeleton = () => (
  <div className='dot-pattern-dark flex flex-col h-auto'>
    {/* Header skeleton — same shape as BoardSkeleton's */}
    <div className='container mx-auto max-w-full px-4 pt-24 pb-4'>
      <div className='flex items-center justify-between mb-6 animate-pulse'>
        <div className='flex items-center gap-4'>
          <div className='w-9 h-9 bg-muted/50 rounded-lg' />
          <div className='flex items-center gap-3'>
            <div className='w-8 h-8 bg-muted/50 rounded-lg' />
            <div className='space-y-2'>
              <div className='h-6 w-40 bg-muted/50 rounded' />
              <div className='h-3 w-28 bg-muted/50 rounded' />
            </div>
          </div>
        </div>
        <div className='flex items-center gap-3'>
          <div className='w-8 h-8 bg-muted/50 rounded-lg' />
          <div className='flex items-center gap-2'>
            <div className='w-4 h-4 bg-muted/50 rounded' />
            <div className='w-20 h-3 bg-muted/50 rounded' />
          </div>
          <div className='w-8 h-8 bg-muted/50 rounded-lg' />
          <div className='w-8 h-8 bg-muted/50 rounded-lg' />
        </div>
      </div>
    </div>

    {/* List content skeleton */}
    <div className='flex-1 px-4 sm:px-6 py-4'>
      <div className='max-w-6xl mx-auto space-y-3 pb-8 animate-pulse'>
        {/* Column header row placeholder */}
        <div className='hidden lg:grid grid-cols-[3rem_1fr_7rem_5rem_1.75rem] bg-card/95 border border-border/50 rounded-xl'>
          <div />
          <div className='pl-4 pr-3 py-2'>
            <div className='h-3 w-10 bg-muted/50 rounded' />
          </div>
          <div className='px-2 py-2 border-l border-border/30' />
          <div className='px-2 py-2 border-l border-border/30' />
          <div />
        </div>

        {Array.from({ length: 3 }).map((_, sectionIndex) => (
          <div
            key={sectionIndex}
            className='bg-card/60 border border-border/50 rounded-xl overflow-hidden'
          >
            {/* Section header */}
            <div className='flex items-center gap-2 pl-2 pr-3 py-3'>
              <div className='w-4 h-4 bg-muted/50 rounded' />
              <div className='h-4 w-32 bg-muted/50 rounded' />
            </div>

            {/* Rows */}
            <div className='border-t border-border/40'>
              {Array.from({ length: 2 }).map((_, rowIndex) => (
                <div
                  key={rowIndex}
                  className='grid grid-cols-[3rem_1fr_7rem_5rem_1.75rem] items-center border-b border-border/30 last:border-b-0 py-2.5'
                >
                  <div className='pl-2'>
                    <div className='w-5 h-5 rounded-full bg-muted/50' />
                  </div>
                  <div className='pl-4 pr-3'>
                    <div className='h-4 bg-muted/50 rounded w-2/3' />
                  </div>
                  <div className='hidden md:flex justify-center'>
                    <div className='h-3 w-10 bg-muted/50 rounded' />
                  </div>
                  <div className='flex justify-center'>
                    <div className='w-6 h-6 rounded-full bg-muted/50' />
                  </div>
                  <div />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Workspace boards page — List view skeleton, mirrors the list-row markup
// used there (color dot + name/description + last-activity + star) so the
// loading state matches a remembered "list" preference instead of always
// flashing the grid-card skeleton.
export const WorkspaceBoardsListSkeleton = () => (
  <div className='bg-card/70 border border-border/50 rounded-2xl overflow-hidden divide-y divide-border/40 animate-pulse'>
    {Array.from({ length: 5 }).map((_, index) => (
      <div
        key={index}
        className='flex items-center gap-3 px-4 py-3'
        style={{ animationDelay: `${index * 50}ms` }}
      >
        <div className='w-2.5 h-2.5 rounded-full bg-muted/50 flex-shrink-0' />
        <div className='min-w-0 flex-1 space-y-2'>
          <div className='h-4 bg-muted/50 rounded w-1/3' />
          <div className='h-3 bg-muted/50 rounded w-1/2' />
        </div>
        <div className='hidden sm:block h-3 w-16 bg-muted/50 rounded flex-shrink-0' />
        <div className='w-4 h-4 bg-muted/50 rounded-full flex-shrink-0' />
      </div>
    ))}
  </div>
);

// Compact card skeleton for dense layouts
export const CompactCardSkeleton = ({ delay = 0 }: { delay?: number }) => (
  <div
    className='animate-pulse bg-card border border-border/20 rounded-lg p-2 mb-3 last:mb-0 min-h-[60px]'
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className='space-y-2'>
      <div className='h-3 bg-muted/50 rounded w-full' />
      <div className='h-3 bg-muted/50 rounded w-2/3' />
      <div className='flex justify-between items-center mt-2'>
        <div className='w-4 h-4 bg-muted/50 rounded-full' />
        <div className='flex gap-1'>
          <div className='w-3 h-3 bg-muted/50 rounded' />
          <div className='w-3 h-3 bg-muted/50 rounded' />
        </div>
      </div>
    </div>
  </div>
);

// List skeleton with compact cards
export const CompactListSkeleton = ({
  cardCount = 5,
  delay = 0,
}: {
  cardCount?: number;
  delay?: number;
}) => (
  <div
    className='flex-shrink-0 w-72 animate-pulse'
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className='bg-card rounded-lg border border-border/20 overflow-hidden'>
      <div className='p-3 border-b border-border/20'>
        <div className='h-5 bg-muted/50 rounded w-24' />
      </div>
      <div className='p-3 space-y-2 min-h-[150px]'>
        {Array.from({ length: cardCount }).map((_, index) => (
          <CompactCardSkeleton key={index} delay={index * 50} />
        ))}
      </div>
    </div>
  </div>
);

// Homepage My tasks/Team tasks widget — matches HomeOverview's actual row
// shape (title | board+workspace | [assignees |] due date) instead of a
// generic spinner, so the loading state doesn't look like a completely
// different, older component from the one it's about to become. The
// assignees column only exists on Team tasks (see MY_TASK_ROW_GRID_COLS/
// TEAM_TASK_ROW_GRID_COLS in HomeOverview.tsx — My tasks is implicitly
// always you, so that column is skipped there, not shown empty).
export const TaskRowSkeleton = ({
  delay = 0,
  showAssignees = true,
}: {
  delay?: number;
  showAssignees?: boolean;
}) => (
  <div
    className={`animate-pulse flex flex-col sm:grid ${
      showAssignees ? 'sm:grid-cols-[1fr_9rem_4.5rem_3.75rem]' : 'sm:grid-cols-[1fr_9rem_3.75rem]'
    } sm:items-center gap-1 sm:gap-3 px-2 py-2`}
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className='flex items-center gap-2'>
      <div className='w-1.5 h-1.5 rounded-full bg-muted/50 flex-shrink-0' />
      <div className='h-3.5 bg-muted/50 rounded w-2/3' />
    </div>
    <div className='hidden sm:block space-y-1'>
      <div className='h-2.5 bg-muted/50 rounded w-3/4' />
      <div className='h-2 bg-muted/40 rounded w-1/2' />
    </div>
    {showAssignees && (
      <div className='hidden sm:flex sm:justify-center -space-x-1.5'>
        <div className='w-5 h-5 rounded-full bg-muted/50 ring-2 ring-card' />
        <div className='w-5 h-5 rounded-full bg-muted/50 ring-2 ring-card' />
      </div>
    )}
    <div className='hidden sm:block h-2.5 bg-muted/50 rounded w-10 justify-self-end' />
  </div>
);

export const TaskRowListSkeleton = ({
  count = 4,
  showAssignees = true,
}: {
  count?: number;
  showAssignees?: boolean;
}) => (
  <div className='space-y-0.5'>
    {Array.from({ length: count }).map((_, index) => (
      <TaskRowSkeleton key={index} delay={index * 60} showAssignees={showAssignees} />
    ))}
  </div>
);

// /profile/tasks' bigger padded-card row shape.
export const TaskCardRowSkeleton = ({ delay = 0 }: { delay?: number }) => (
  <div
    className='animate-pulse flex items-center gap-4 p-4 bg-card/50 border border-border/50 rounded-2xl'
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className='w-2.5 h-2.5 rounded-full bg-muted/50 flex-shrink-0' />
    <div className='flex-1 min-w-0 space-y-2'>
      <div className='h-4 bg-muted/50 rounded w-2/3' />
      <div className='h-3 bg-muted/40 rounded w-1/3' />
    </div>
    <div className='flex -space-x-1.5 flex-shrink-0'>
      <div className='w-6 h-6 rounded-full bg-muted/50 ring-2 ring-card' />
      <div className='w-6 h-6 rounded-full bg-muted/50 ring-2 ring-card' />
    </div>
    <div className='h-5 w-14 bg-muted/50 rounded-full flex-shrink-0' />
  </div>
);

export const TaskCardRowListSkeleton = ({ count = 6 }: { count?: number }) => (
  <div className='space-y-2.5'>
    {Array.from({ length: count }).map((_, index) => (
      <TaskCardRowSkeleton key={index} delay={index * 50} />
    ))}
  </div>
);
