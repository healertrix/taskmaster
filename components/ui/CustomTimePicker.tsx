'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Clock, ChevronUp, ChevronDown } from 'lucide-react';

interface CustomTimePickerProps {
  value: string;
  onChange: (time: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
}

export function CustomTimePicker({
  value,
  onChange,
  label,
  placeholder = 'Select time',
  className = '',
}: CustomTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hours, setHours] = useState('12');
  const [minutes, setMinutes] = useState('00');
  const [period, setPeriod] = useState('AM');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Parse existing value
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':');
      const hour24 = parseInt(h);
      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
      const periodValue = hour24 >= 12 ? 'PM' : 'AM';

      setHours(hour12.toString().padStart(2, '0'));
      setMinutes(m);
      setPeriod(periodValue);
    }
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTime = () => {
    if (!value) return placeholder;
    const [h, m] = value.split(':');
    const hour24 = parseInt(h);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const periodValue = hour24 >= 12 ? 'PM' : 'AM';
    return `${hour12}:${m} ${periodValue}`;
  };

  const updateTime = (
    newHours: string,
    newMinutes: string,
    newPeriod: string
  ) => {
    // Default empty values when saving
    const finalHours = newHours === '' ? '01' : newHours;
    const finalMinutes = newMinutes === '' ? '00' : newMinutes;

    const hour24 =
      newPeriod === 'AM'
        ? finalHours === '12'
          ? 0
          : parseInt(finalHours)
        : finalHours === '12'
        ? 12
        : parseInt(finalHours) + 12;

    const timeString = `${hour24.toString().padStart(2, '0')}:${finalMinutes}`;
    onChange(timeString);
  };

  const incrementHours = () => {
    const currentHours = hours === '' ? '01' : hours;
    const newHours =
      currentHours === '12'
        ? '01'
        : (parseInt(currentHours) + 1).toString().padStart(2, '0');
    setHours(newHours);
    updateTime(newHours, minutes, period);
  };

  const decrementHours = () => {
    const currentHours = hours === '' ? '01' : hours;
    const newHours =
      currentHours === '01'
        ? '12'
        : (parseInt(currentHours) - 1).toString().padStart(2, '0');
    setHours(newHours);
    updateTime(newHours, minutes, period);
  };

  const incrementMinutes = () => {
    const currentMinutes = minutes === '' ? '00' : minutes;
    const newMinutes =
      currentMinutes === '59'
        ? '00'
        : (parseInt(currentMinutes) + 1).toString().padStart(2, '0');
    setMinutes(newMinutes);
    updateTime(hours, newMinutes, period);
  };

  const decrementMinutes = () => {
    const currentMinutes = minutes === '' ? '00' : minutes;
    const newMinutes =
      currentMinutes === '00'
        ? '59'
        : (parseInt(currentMinutes) - 1).toString().padStart(2, '0');
    setMinutes(newMinutes);
    updateTime(hours, newMinutes, period);
  };

  const togglePeriod = () => {
    const newPeriod = period === 'AM' ? 'PM' : 'AM';
    setPeriod(newPeriod);
    updateTime(hours, minutes, newPeriod);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type='button'
        onClick={() => setIsOpen(!isOpen)}
        className='w-full flex items-center justify-between px-4 py-3 text-sm border border-border rounded-xl bg-background text-foreground hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 group'
      >
        <div className='flex items-center gap-3'>
          <Clock className='w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors' />
          <span
            className={
              value ? 'text-foreground font-medium' : 'text-muted-foreground'
            }
          >
            {formatTime()}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className='absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200'>
          <div className='p-4'>
            <div className='text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider'>
              {label}
            </div>

            <div className='flex items-center justify-center gap-2'>
              {/* Hours */}
              <div className='flex flex-col items-center'>
                <button
                  type='button'
                  onClick={incrementHours}
                  className='p-1 hover:bg-muted rounded-md transition-colors'
                  title='Increase hours'
                  aria-label='Increase hours'
                >
                  <ChevronUp className='w-4 h-4' />
                </button>
                <input
                  type='text'
                  value={hours}
                  onChange={(e) => {
                    let value = e.target.value.replace(/\D/g, '');

                    // Limit to 2 characters max
                    if (value.length > 2) {
                      value = value.slice(0, 2);
                    }

                    // Always update the display (allow empty)
                    setHours(value);

                    // Don't call updateTime during typing - only on blur or done
                  }}
                  onFocus={(e) => e.target.select()}
                  onBlur={() => {
                    // Update time when user finishes typing in hours field
                    let finalHours = hours === '' ? '01' : hours;
                    const finalMinutes = minutes === '' ? '00' : minutes;

                    // Handle hours > 12 with modulo and auto-switch AM/PM
                    let numHours = parseInt(finalHours);
                    let newPeriod = period;

                    if (numHours > 12) {
                      // Switch to PM for hours 13-23
                      if (numHours >= 13 && numHours <= 23) {
                        newPeriod = 'PM';
                        setPeriod('PM');
                      }
                      // Handle modulo conversion
                      numHours = numHours % 12;
                      if (numHours === 0) numHours = 12; // 12, 24, 36... should become 12
                      finalHours = numHours.toString();
                      setHours(finalHours); // Update display
                    }

                    // Validate hours (should be 1-12 after modulo)
                    if (numHours >= 1 && numHours <= 12) {
                      updateTime(
                        finalHours.padStart(2, '0'),
                        finalMinutes.padStart(2, '0'),
                        newPeriod
                      );
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      // Update time and close on Enter
                      let finalHours = hours === '' ? '01' : hours;
                      const finalMinutes = minutes === '' ? '00' : minutes;

                      // Handle hours > 12 with modulo and auto-switch AM/PM
                      let numHours = parseInt(finalHours);
                      let newPeriod = period;

                      if (numHours > 12) {
                        // Switch to PM for hours 13-23
                        if (numHours >= 13 && numHours <= 23) {
                          newPeriod = 'PM';
                          setPeriod('PM');
                        }
                        // Handle modulo conversion
                        numHours = numHours % 12;
                        if (numHours === 0) numHours = 12;
                        finalHours = numHours.toString();
                        setHours(finalHours);
                      }

                      if (numHours >= 1 && numHours <= 12) {
                        updateTime(
                          finalHours.padStart(2, '0'),
                          finalMinutes.padStart(2, '0'),
                          newPeriod
                        );
                      }
                      setIsOpen(false);
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      incrementHours();
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      decrementHours();
                    }
                  }}
                  className='w-12 h-12 flex items-center justify-center bg-primary/10 rounded-lg text-lg font-bold text-primary my-1 text-center border-0 outline-none focus:ring-2 focus:ring-primary/50 focus:bg-primary/20 transition-all'
                  maxLength={2}
                  title='Type hours (1-12)'
                  aria-label='Hours input'
                />
                <button
                  type='button'
                  onClick={decrementHours}
                  className='p-1 hover:bg-muted rounded-md transition-colors'
                  title='Decrease hours'
                  aria-label='Decrease hours'
                >
                  <ChevronDown className='w-4 h-4' />
                </button>
              </div>

              {/* Separator */}
              <div className='text-2xl font-bold text-muted-foreground mx-2'>
                :
              </div>

              {/* Minutes */}
              <div className='flex flex-col items-center'>
                <button
                  type='button'
                  onClick={incrementMinutes}
                  className='p-1 hover:bg-muted rounded-md transition-colors'
                  title='Increase minutes'
                  aria-label='Increase minutes'
                >
                  <ChevronUp className='w-4 h-4' />
                </button>
                <input
                  type='text'
                  value={minutes}
                  onChange={(e) => {
                    let value = e.target.value.replace(/\D/g, '');

                    // Limit to 2 characters max
                    if (value.length > 2) {
                      value = value.slice(0, 2);
                    }

                    // Always update the display (allow empty)
                    setMinutes(value);

                    // Don't call updateTime during typing - only on blur or done
                  }}
                  onFocus={(e) => e.target.select()}
                  onBlur={() => {
                    // Update time when user finishes typing in minutes field
                    const finalHours = hours === '' ? '01' : hours;
                    let finalMinutes = minutes === '' ? '00' : minutes;

                    // Handle minutes > 59 by capping at 59
                    let numMinutes = parseInt(finalMinutes);
                    if (numMinutes > 59) {
                      numMinutes = 59;
                      finalMinutes = '59';
                      setMinutes(finalMinutes); // Update display
                    }

                    // Validate minutes (should be 0-59 after capping)
                    if (numMinutes >= 0 && numMinutes <= 59) {
                      updateTime(
                        finalHours.padStart(2, '0'),
                        finalMinutes.padStart(2, '0'),
                        period
                      );
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      // Update time and close on Enter
                      const finalHours = hours === '' ? '01' : hours;
                      let finalMinutes = minutes === '' ? '00' : minutes;

                      // Handle minutes > 59 by capping at 59
                      let numMinutes = parseInt(finalMinutes);
                      if (numMinutes > 59) {
                        numMinutes = 59;
                        finalMinutes = '59';
                        setMinutes(finalMinutes);
                      }

                      if (numMinutes >= 0 && numMinutes <= 59) {
                        updateTime(
                          finalHours.padStart(2, '0'),
                          finalMinutes.padStart(2, '0'),
                          period
                        );
                      }
                      setIsOpen(false);
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      incrementMinutes();
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      decrementMinutes();
                    }
                  }}
                  className='w-12 h-12 flex items-center justify-center bg-primary/10 rounded-lg text-lg font-bold text-primary my-1 text-center border-0 outline-none focus:ring-2 focus:ring-primary/50 focus:bg-primary/20 transition-all'
                  maxLength={2}
                  title='Type minutes (0-59)'
                  aria-label='Minutes input'
                />
                <button
                  type='button'
                  onClick={decrementMinutes}
                  className='p-1 hover:bg-muted rounded-md transition-colors'
                  title='Decrease minutes'
                  aria-label='Decrease minutes'
                >
                  <ChevronDown className='w-4 h-4' />
                </button>
              </div>

              {/* AM/PM */}
              <div className='flex flex-col items-center ml-3'>
                <button
                  type='button'
                  onClick={togglePeriod}
                  className={`w-12 h-6 flex items-center justify-center rounded-md text-xs font-semibold transition-colors ${
                    period === 'AM'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  AM
                </button>
                <button
                  type='button'
                  onClick={togglePeriod}
                  className={`w-12 h-6 flex items-center justify-center rounded-md text-xs font-semibold transition-colors mt-1 ${
                    period === 'PM'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  PM
                </button>
              </div>
            </div>

            {/* Quick time options */}
            <div className='mt-4 pt-3 border-t border-border'>
              <div className='grid grid-cols-4 gap-2'>
                {[
                  { label: '9 AM', value: '09:00' },
                  { label: '12 PM', value: '12:00' },
                  { label: '3 PM', value: '15:00' },
                  { label: '6 PM', value: '18:00' },
                ].map((preset) => (
                  <button
                    key={preset.value}
                    type='button'
                    onClick={() => {
                      onChange(preset.value);
                      setIsOpen(false);
                    }}
                    className='px-2 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded-md transition-colors text-center'
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
