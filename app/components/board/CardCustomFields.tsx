'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ListChecks, Loader2, Check, ChevronDown, Calendar, X } from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  isSameDay,
  isSameMonth,
} from 'date-fns';
import { useBoardCustomFields } from '@/hooks/useBoardCustomFields';
import type { CustomField } from '@/hooks/useBoardCustomFields';

interface FieldValue {
  id: string;
  field_id: string;
  value: unknown;
}

interface CardCustomFieldsProps {
  boardId: string;
  cardId: string;
  // Joined directly into the board's initial lists/cards fetch (see
  // app/api/lists/route.ts) — when the parent already has this, there's
  // zero reason to make a second round trip just to re-fetch what's
  // already in memory. This was the real cause of custom fields visibly
  // lagging behind every other section: labels/members arrive the same
  // way (pre-loaded on the card object), but values here previously had
  // no equivalent and always cold-fetched on every single card open.
  initialValues?: FieldValue[];
  // Feeds CardModal's hasActiveSaveOperations()/close-warning-modal — the
  // same pattern title/description/dates/etc. already use (see
  // handleSaveTitle: an in-flight save is still optimistic — the UI
  // updates immediately, this flag doesn't gate that — it only decides
  // whether closing mid-save shows a warning instead of closing silently,
  // which custom fields never had.
  onSavingChange?: (isSaving: boolean) => void;
}

// Renders one row per board-defined field (even if this card has no value
// yet — the field's existence should be discoverable, not hidden until
// filled in), between Timeline and Checklists in the card modal.
export function CardCustomFields({
  boardId,
  cardId,
  initialValues,
  onSavingChange,
}: CardCustomFieldsProps) {
  const { fields, isLoading: isLoadingFields } = useBoardCustomFields(boardId);
  const [values, setValues] = useState<FieldValue[]>(initialValues || []);
  const [isLoadingValues, setIsLoadingValues] = useState(!initialValues);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>('');
  const [openPickerFieldId, setOpenPickerFieldId] = useState<string | null>(null);
  // A count, not a bool — saveValue/clearValue can overlap (e.g. blurring
  // one field while a previous save is still in flight), so "saving" only
  // turns false once every in-flight write has actually finished.
  const inFlightCountRef = useRef(0);
  const markSaveStart = () => {
    inFlightCountRef.current += 1;
    onSavingChange?.(true);
  };
  const markSaveEnd = () => {
    inFlightCountRef.current = Math.max(0, inFlightCountRef.current - 1);
    if (inFlightCountRef.current === 0) onSavingChange?.(false);
  };

  useEffect(() => {
    let cancelled = false;

    // initialValues (from the parent's already-loaded card object) is only
    // ever a snapshot from whenever the board's lists were last fetched —
    // once you save an edit here, nothing tells that parent state about
    // it, so reopening the same card handed back the *stale* snapshot
    // (even an empty array still counts as "provided") and it silently
    // overwrote whatever had actually been saved. Paint it immediately for
    // speed (no loading flash), but always reconcile with a real fetch
    // right after — the fetch is the source of truth, initialValues is
    // just a head start on it, never a substitute for it.
    if (initialValues) {
      setValues(initialValues);
      setIsLoadingValues(false);
    } else {
      setIsLoadingValues(true);
    }

    const fetchValues = async () => {
      try {
        const response = await fetch(`/api/cards/${cardId}/custom-fields`);
        const data = await response.json();
        if (!cancelled && response.ok) setValues(data.values || []);
      } catch (error) {
        console.error('Error fetching card custom field values:', error);
      } finally {
        if (!cancelled) setIsLoadingValues(false);
      }
    };
    fetchValues();
    return () => {
      cancelled = true;
    };
    // initialValues intentionally excluded — it's only consulted once per
    // mount for the instant paint, not re-applied on every parent re-render
    // (which would otherwise re-introduce the same staleness this fixes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  const valueByFieldId = useMemo(() => {
    const map = new Map<string, unknown>();
    values.forEach((v) => map.set(v.field_id, v.value));
    return map;
  }, [values]);

  // Optimistic write: the UI reflects the change immediately (this is what
  // was "too slow" before — every save waited on the network round-trip
  // before anything on screen moved) and only rolls back if the request
  // actually fails.
  const applyLocalValue = (fieldId: string, value: unknown | undefined) => {
    setValues((prev) => {
      const rest = prev.filter((v) => v.field_id !== fieldId);
      if (value === undefined) return rest;
      return [...rest, { id: fieldId, field_id: fieldId, value }];
    });
  };

  const saveValue = async (fieldId: string, value: unknown) => {
    const previous = valueByFieldId.get(fieldId);
    applyLocalValue(fieldId, value);
    markSaveStart();
    try {
      const response = await fetch(
        `/api/cards/${cardId}/custom-fields/${fieldId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value }),
        }
      );
      if (!response.ok) throw new Error('save failed');
      const data = await response.json();
      // Reconcile with the server row (real id/updated_at) without waiting
      // for it before showing the change.
      setValues((prev) => {
        const rest = prev.filter((v) => v.field_id !== fieldId);
        return [...rest, data.fieldValue];
      });
    } catch (error) {
      console.error('Error saving custom field value:', error);
      applyLocalValue(fieldId, previous);
    } finally {
      markSaveEnd();
    }
  };

  const clearValue = async (fieldId: string) => {
    const previous = valueByFieldId.get(fieldId);
    applyLocalValue(fieldId, undefined);
    markSaveStart();
    try {
      const response = await fetch(
        `/api/cards/${cardId}/custom-fields/${fieldId}`,
        { method: 'DELETE' }
      );
      if (!response.ok) throw new Error('clear failed');
    } catch (error) {
      console.error('Error clearing custom field value:', error);
      applyLocalValue(fieldId, previous);
    } finally {
      markSaveEnd();
    }
  };

  if (!isLoadingFields && fields.length === 0) return null;

  const startEdit = (fieldId: string, currentValue: unknown) => {
    setEditingFieldId(fieldId);
    setDraft(typeof currentValue === 'string' ? currentValue : '');
  };

  const cancelEdit = () => {
    setEditingFieldId(null);
    setDraft('');
  };

  const commitTextDraft = (fieldId: string) => {
    if (!draft.trim()) {
      clearValue(fieldId);
    } else {
      saveValue(fieldId, draft);
    }
    cancelEdit();
  };

  return (
    <div className='mb-6'>
      <div className='flex items-center gap-2 mb-3'>
        <ListChecks className='w-4 h-4 text-muted-foreground' />
        <h3 className='text-sm font-medium text-foreground'>Custom fields</h3>
      </div>

      <div className='bg-muted/30 rounded-xl p-4 space-y-1'>
        {isLoadingFields || isLoadingValues ? (
          <div className='flex items-center justify-center py-4'>
            <Loader2 className='w-4 h-4 animate-spin text-muted-foreground' />
          </div>
        ) : (
          fields.map((field) => {
            const rawValue = valueByFieldId.get(field.id);
            const isEditing = editingFieldId === field.id;

            return (
              <div key={field.id} className='flex items-center gap-2.5 py-1'>
                {/* Balanced against the value side (was w-28, too narrow —
                    fixed-width name column with its own truncate+title,
                    same "ellipsis, never scroll" fix as the manage-fields
                    list, not a flex-shrinking column that starves the
                    value input either. */}
                <span
                  className='text-xs font-medium text-muted-foreground w-24 sm:w-36 flex-shrink-0 truncate'
                  title={field.name}
                >
                  {field.name}
                </span>

                {field.definition.type === 'checkbox' && (
                  <button
                    onClick={() => saveValue(field.id, rawValue !== true)}
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors flex-shrink-0 ${
                      rawValue === true
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {rawValue === true && <Check className='w-3.5 h-3.5' />}
                  </button>
                )}

                {field.definition.type === 'select' && (
                  <SelectFieldValue
                    field={field}
                    value={typeof rawValue === 'string' ? rawValue : null}
                    isOpen={openPickerFieldId === field.id}
                    onOpen={() => setOpenPickerFieldId(field.id)}
                    onClose={() => setOpenPickerFieldId(null)}
                    onSelect={(optionId) => {
                      setOpenPickerFieldId(null);
                      if (optionId) saveValue(field.id, optionId);
                      else clearValue(field.id);
                    }}
                  />
                )}

                {field.definition.type === 'date' && (
                  <DateFieldValue
                    value={typeof rawValue === 'string' ? rawValue : null}
                    isOpen={openPickerFieldId === field.id}
                    onOpen={() => setOpenPickerFieldId(field.id)}
                    onClose={() => setOpenPickerFieldId(null)}
                    onSelect={(dateStr) => {
                      setOpenPickerFieldId(null);
                      if (dateStr) saveValue(field.id, dateStr);
                      else clearValue(field.id);
                    }}
                  />
                )}

                {field.definition.type === 'number' &&
                  (isEditing ? (
                    <input
                      type='text'
                      inputMode='decimal'
                      autoFocus
                      value={draft}
                      onChange={(e) => {
                        // Digits, one optional leading minus, one optional
                        // decimal point — same restriction whether typed
                        // or pasted, since onChange fires either way.
                        const next = e.target.value;
                        if (/^-?\d*\.?\d*$/.test(next)) setDraft(next);
                      }}
                      onBlur={() => commitTextDraft(field.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitTextDraft(field.id);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      className='flex-1 min-w-0 text-sm font-mono text-left bg-background border border-primary/50 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-primary/50'
                    />
                  ) : (
                    <button
                      onClick={() => startEdit(field.id, rawValue)}
                      className='flex-1 min-w-0 text-left text-sm font-mono text-foreground hover:bg-muted/50 rounded-lg px-2.5 py-1 transition-colors truncate'
                    >
                      {rawValue != null && rawValue !== '' ? (
                        String(rawValue)
                      ) : (
                        <span className='text-muted-foreground font-sans'>
                          + Add value
                        </span>
                      )}
                    </button>
                  ))}

                {field.definition.type === 'text' &&
                  (isEditing ? (
                    <input
                      type='text'
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => commitTextDraft(field.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitTextDraft(field.id);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      className='flex-1 min-w-0 text-sm bg-background border border-primary/50 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-primary/50'
                    />
                  ) : (
                    <button
                      onClick={() => startEdit(field.id, rawValue)}
                      className='flex-1 min-w-0 text-left text-sm text-foreground hover:bg-muted/50 rounded-lg px-2.5 py-1 transition-colors truncate'
                    >
                      {rawValue != null && rawValue !== '' ? (
                        String(rawValue)
                      ) : (
                        <span className='text-muted-foreground'>+ Add value</span>
                      )}
                    </button>
                  ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// --- Select: a styled popover instead of a native <select>, matching the
// workspace/board picker pattern already used in AIChatWidget. ---
function SelectFieldValue({
  field,
  value,
  isOpen,
  onOpen,
  onClose,
  onSelect,
}: {
  field: CustomField;
  value: string | null;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSelect: (optionId: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const options = field.definition.options || [];
  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  return (
    <div ref={containerRef} className='relative flex-1 min-w-0'>
      <button
        onClick={() => (isOpen ? onClose() : onOpen())}
        className='w-full flex items-center justify-between gap-2 text-sm bg-background border border-border rounded-lg px-2.5 py-1 hover:border-primary/50 transition-colors'
      >
        <span
          className={selected ? 'text-foreground truncate' : 'text-muted-foreground'}
        >
          {selected ? selected.label : '+ Add value'}
        </span>
        <ChevronDown className='w-3.5 h-3.5 text-muted-foreground flex-shrink-0' />
      </button>

      {isOpen && (
        <div className='absolute left-0 right-0 mt-1.5 bg-popover border border-border rounded-lg shadow-2xl z-20 overflow-hidden py-1 max-h-52 overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-100'>
          {value && (
            <button
              onClick={() => onSelect(null)}
              className='w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted/50 transition-colors'
            >
              <X className='w-3 h-3' /> Clear value
            </button>
          )}
          {options.length === 0 ? (
            <p className='px-3 py-3 text-xs text-muted-foreground text-center'>
              No options defined for this field.
            </p>
          ) : (
            options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => onSelect(opt.id)}
                className='w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors'
              >
                <span className='truncate'>{opt.label}</span>
                {opt.id === value && (
                  <Check className='w-3.5 h-3.5 text-primary flex-shrink-0' />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// --- Date: a compact single-month calendar popover instead of the native
// browser date input (whose look is entirely OS-dependent and inconsistent
// with the rest of the app's UI). ---
function DateFieldValue({
  value,
  isOpen,
  onOpen,
  onClose,
  onSelect,
}: {
  value: string | null;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSelect: (dateStr: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedDate = value ? new Date(value) : null;
  const [viewMonth, setViewMonth] = useState(
    () => selectedDate || new Date()
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const days = useMemo(() => {
    const start = startOfMonth(viewMonth);
    const firstGridDay = new Date(start);
    firstGridDay.setDate(firstGridDay.getDate() - start.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(firstGridDay);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [viewMonth]);

  return (
    <div ref={containerRef} className='relative flex-1 min-w-0'>
      <button
        onClick={() => (isOpen ? onClose() : onOpen())}
        className='w-full flex items-center gap-2 text-sm bg-background border border-border rounded-lg px-2.5 py-1 hover:border-primary/50 transition-colors'
      >
        <Calendar className='w-3.5 h-3.5 text-muted-foreground flex-shrink-0' />
        <span className={selectedDate ? 'text-foreground' : 'text-muted-foreground'}>
          {selectedDate ? format(selectedDate, 'MMM d, yyyy') : '+ Add value'}
        </span>
      </button>

      {isOpen && (
        <div className='absolute left-0 mt-1.5 w-72 bg-popover border border-border rounded-lg shadow-2xl z-20 p-3 animate-in fade-in-0 zoom-in-95 duration-100'>
          <div className='flex items-center justify-between mb-2'>
            <button
              onClick={() => setViewMonth((m) => subMonths(m, 1))}
              className='p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground'
            >
              <ChevronDown className='w-3.5 h-3.5 rotate-90' />
            </button>
            <span className='text-sm font-medium text-foreground'>
              {format(viewMonth, 'MMMM yyyy')}
            </span>
            <button
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              className='p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground'
            >
              <ChevronDown className='w-3.5 h-3.5 -rotate-90' />
            </button>
          </div>

          <div className='grid grid-cols-7 gap-1 mb-1'>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div
                key={i}
                className='text-center text-[10px] font-medium text-muted-foreground py-1'
              >
                {d}
              </div>
            ))}
          </div>
          <div className='grid grid-cols-7 gap-1'>
            {days.map((day, i) => {
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const inMonth = isSameMonth(day, viewMonth);
              return (
                <button
                  key={i}
                  onClick={() => onSelect(format(day, 'yyyy-MM-dd'))}
                  className={`aspect-square rounded-md text-xs flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-primary text-primary-foreground font-medium'
                      : inMonth
                      ? 'text-foreground hover:bg-muted'
                      : 'text-muted-foreground/40 hover:bg-muted/50'
                  }`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          {selectedDate && (
            <button
              onClick={() => onSelect(null)}
              className='w-full flex items-center justify-center gap-1.5 mt-2 pt-2 border-t border-border text-xs text-muted-foreground hover:text-destructive transition-colors'
            >
              <X className='w-3 h-3' /> Clear date
            </button>
          )}
        </div>
      )}
    </div>
  );
}
