'use client';

import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  X,
  CalendarDays,
  Save,
  ChevronDown,
  ChevronUp,
  Trash2,
  Edit,
} from 'lucide-react';
import { CustomTimePicker } from './CustomTimePicker';
import { format, isAfter, isBefore, isEqual, startOfDay } from 'date-fns';

interface DateTimeRangePickerProps {
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  onSaveDateTime: (dates: {
    startDate?: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
  }) => void;
  onClose: () => void;
  isLoading?: boolean;
  initialSelection?: 'start' | 'due'; // New prop to set initial selection
}

export function DateTimeRangePicker({
  startDate,
  endDate,
  startTime,
  endTime,
  onSaveDateTime,
  onClose,
  isLoading = false,
  initialSelection = 'due',
}: DateTimeRangePickerProps) {
  const [selectedStartDate, setSelectedStartDate] = useState(startDate || '');
  const [selectedEndDate, setSelectedEndDate] = useState(endDate || '');
  const [selectedStartTime, setSelectedStartTime] = useState(startTime || '');
  const [selectedDueTime, setSelectedDueTime] = useState(endTime || '');
  const [calendarView, setCalendarView] = useState(new Date());
  const [isSelectingStart, setIsSelectingStart] = useState(
    initialSelection === 'start'
  ); // Set based on prop

  // Generate calendar days
  const generateCalendarDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 41);

    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      days.push(new Date(d));
    }

    return days;
  };

  const calendarDays = generateCalendarDays(calendarView);

  const isDateInRange = (date: Date) => {
    if (!selectedStartDate || !selectedEndDate) return false;
    const start = new Date(selectedStartDate);
    const end = new Date(selectedEndDate);
    return date >= start && date <= end;
  };

  const isDateSelected = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return dateStr === selectedStartDate || dateStr === selectedEndDate;
  };

  const handleDateClick = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');

    if (isSelectingStart) {
      setSelectedStartDate(dateStr);
      setIsSelectingStart(false);
      if (selectedEndDate && isBefore(new Date(selectedEndDate), date)) {
        setSelectedEndDate('');
      }
    } else {
      if (selectedStartDate && isBefore(date, new Date(selectedStartDate))) {
        setSelectedStartDate(dateStr);
        setSelectedEndDate(selectedStartDate);
      } else {
        setSelectedEndDate(dateStr);
      }
    }
  };

  const navigateCalendar = (direction: 'prev' | 'next') => {
    const newDate = new Date(calendarView);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCalendarView(newDate);
  };

  const getDayClasses = (date: Date) => {
    const isToday = isEqual(startOfDay(date), startOfDay(new Date()));
    const isCurrentMonth = date.getMonth() === calendarView.getMonth();
    const isSelected = isDateSelected(date);
    const isInRange = isDateInRange(date);

    let classes =
      'w-8 h-8 text-sm flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200 ';

    if (!isCurrentMonth) {
      classes += 'text-muted-foreground/40 ';
    } else {
      classes += 'text-foreground ';
    }

    if (isSelected) {
      classes += 'bg-primary text-primary-foreground font-semibold shadow-md ';
    } else if (isInRange) {
      classes += 'bg-primary/20 text-primary-foreground ';
    } else if (isToday) {
      classes += 'bg-accent text-accent-foreground font-medium ';
    } else {
      classes += 'hover:bg-accent hover:text-accent-foreground ';
    }

    return classes;
  };

  const handleSave = () => {
    if (
      selectedStartDate &&
      selectedEndDate &&
      isBefore(new Date(selectedEndDate), new Date(selectedStartDate))
    ) {
      alert('End date cannot be before start date');
      return;
    }

    onSaveDateTime({
      startDate: selectedStartDate || undefined,
      endDate: selectedEndDate || undefined,
      startTime: selectedStartTime || undefined,
      endTime: selectedDueTime || undefined,
    });
  };

  const handleRemoveAll = () => {
    onSaveDateTime({
      startDate: undefined,
      endDate: undefined,
      startTime: undefined,
      endTime: undefined,
    });
  };

  const handleClearStartDate = () => {
    setSelectedStartDate('');
    setSelectedStartTime('');
  };

  const handleClearDueDate = () => {
    setSelectedEndDate('');
    setSelectedDueTime('');
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    return format(new Date(dateStr), 'MMM dd, yyyy');
  };

  // Add keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        handleSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true); // Use capture phase
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [selectedStartDate, selectedEndDate, selectedStartTime, selectedDueTime]);

  return (
    <div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4'>
      <div className='bg-card border border-border rounded-xl shadow-2xl w-full max-w-md h-[600px] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200'>
        {/* Compact Header */}
        <div className='bg-gradient-to-r from-primary to-primary/80 px-4 py-3'>
          <div className='flex items-center justify-between text-white'>
            <div className='flex items-center gap-2'>
              <CalendarDays className='w-5 h-5' />
              <h3 className='text-lg font-semibold'>Dates</h3>
              <div className='hidden sm:flex items-center gap-1 ml-3 text-xs text-white/70'>
                <kbd className='px-1.5 py-0.5 bg-white/20 rounded text-xs'>
                  Ctrl+Enter
                </kbd>
                <span>to save</span>
                <span className='mx-1'>•</span>
                <kbd className='px-1.5 py-0.5 bg-white/20 rounded text-xs'>
                  Esc
                </kbd>
                <span>to close</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className='p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200'
              title='Close date picker (Esc)'
              aria-label='Close date picker'
            >
              <X className='w-4 h-4' />
            </button>
          </div>
        </div>

        <div className='p-4 space-y-4 flex-1 overflow-y-auto'>
          {/* Date Selection Summary */}
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <button
                onClick={() => setIsSelectingStart(true)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isSelectingStart
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className='w-3 h-3 bg-green-500 rounded'></div>
                Start Date {selectedStartDate && '✓'}
              </button>
              <button
                onClick={() => setIsSelectingStart(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  !isSelectingStart
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className='w-3 h-3 bg-red-500 rounded'></div>
                Due Date {selectedEndDate && '✓'}
              </button>
            </div>

            {/* Selected dates display */}
            {(selectedStartDate || selectedEndDate) && (
              <div className='bg-muted/50 rounded-lg p-3 text-sm space-y-2'>
                {selectedStartDate && (
                  <div className='flex items-center justify-between'>
                    <div className='flex-1'>
                      <span className='text-muted-foreground'>Start: </span>
                      <span className='font-medium'>
                        {formatDisplayDate(selectedStartDate)}
                        {selectedStartTime && ` at ${selectedStartTime}`}
                      </span>
                    </div>
                    <button
                      onClick={handleClearStartDate}
                      className='ml-2 p-1 text-muted-foreground hover:text-destructive transition-colors'
                      title='Clear start date'
                    >
                      <X className='w-3 h-3' />
                    </button>
                  </div>
                )}
                {selectedEndDate && (
                  <div className='flex items-center justify-between'>
                    <div className='flex-1'>
                      <span className='text-muted-foreground'>Due: </span>
                      <span className='font-medium'>
                        {formatDisplayDate(selectedEndDate)}
                        {selectedDueTime && ` at ${selectedDueTime}`}
                      </span>
                    </div>
                    <button
                      onClick={handleClearDueDate}
                      className='ml-2 p-1 text-muted-foreground hover:text-destructive transition-colors'
                      title='Clear due date'
                    >
                      <X className='w-3 h-3' />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Compact Calendar */}
          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <h4 className='text-sm font-semibold text-foreground'>
                {format(calendarView, 'MMMM yyyy')}
              </h4>
              <div className='flex gap-1'>
                <button
                  onClick={() => navigateCalendar('prev')}
                  className='p-1.5 hover:bg-muted rounded-md transition-colors'
                  title='Previous month'
                  aria-label='Previous month'
                >
                  ←
                </button>
                <button
                  onClick={() => navigateCalendar('next')}
                  className='p-1.5 hover:bg-muted rounded-md transition-colors'
                  title='Next month'
                  aria-label='Next month'
                >
                  →
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className='space-y-1'>
              <div className='grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground'>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day) => (
                  <div key={day} className='py-1'>
                    {day}
                  </div>
                ))}
              </div>
              <div className='grid grid-cols-7 gap-1'>
                {calendarDays.map((date, index) => (
                  <button
                    key={index}
                    onClick={() => handleDateClick(date)}
                    className={getDayClasses(date)}
                  >
                    {date.getDate()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Time Options */}
          {(selectedStartDate || selectedEndDate) && (
            <div className='border-t border-border pt-4'>
              <div className='flex items-center gap-2 mb-3'>
                <Clock className='w-4 h-4 text-muted-foreground' />
                <h4 className='text-sm font-medium text-foreground'>
                  Add Times
                </h4>
              </div>

              <div className='space-y-3'>
                {/* Start Time */}
                {selectedStartDate && (
                  <div className='relative'>
                    <div className='flex items-center justify-between mb-2'>
                      <label className='text-sm text-foreground'>
                        Start Time
                      </label>
                      {selectedStartTime && (
                        <button
                          onClick={() => setSelectedStartTime('')}
                          className='text-xs text-muted-foreground hover:text-destructive transition-colors'
                          title='Clear start time'
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <CustomTimePicker
                      value={selectedStartTime}
                      onChange={setSelectedStartTime}
                      label='Start Time'
                      placeholder='Select start time'
                    />
                  </div>
                )}

                {/* Due Time */}
                {selectedEndDate && (
                  <div className='relative'>
                    <div className='flex items-center justify-between mb-2'>
                      <label className='text-sm text-foreground'>
                        Due Time
                      </label>
                      {selectedDueTime && (
                        <button
                          onClick={() => setSelectedDueTime('')}
                          className='text-xs text-muted-foreground hover:text-destructive transition-colors'
                          title='Clear due time'
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <CustomTimePicker
                      value={selectedDueTime}
                      onChange={setSelectedDueTime}
                      label='Due Time'
                      placeholder='Select due time'
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons - Fixed at bottom */}
        <div className='flex justify-between items-center p-4 border-t border-border bg-card'>
          <button
            onClick={handleRemoveAll}
            className='flex items-center gap-2 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors'
            disabled={isLoading}
            title='Remove all dates'
          >
            <Trash2 className='w-4 h-4' />
            Remove All
          </button>

          <div className='flex gap-2'>
            <button
              onClick={onClose}
              className='px-3 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-medium rounded-md transition-colors'
              disabled={isLoading}
              title='Cancel (Esc)'
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading || (!selectedStartDate && !selectedEndDate)}
              className='flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              title='Save dates (Ctrl+Enter)'
            >
              {isLoading ? (
                <>
                  <div className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                  Saving...
                </>
              ) : (
                <>
                  <Save className='w-4 h-4' />
                  Save
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
