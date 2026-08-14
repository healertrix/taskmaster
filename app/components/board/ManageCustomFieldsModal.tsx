'use client';

import { useEffect, useRef, useState } from 'react';
import {
  X,
  Plus,
  Edit2,
  Trash2,
  ListChecks,
  AlertTriangle,
  GripVertical,
} from 'lucide-react';
import {
  CUSTOM_FIELD_TYPES,
  type CustomFieldDefinition,
  type CustomFieldType,
} from '@/utils/customFields';
import type { CustomField } from '@/hooks/useBoardCustomFields';

interface ManageCustomFieldsModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  fields: CustomField[];
  isLoading: boolean;
  onFieldsChanged: () => void; // refetch() from useBoardCustomFields
}

const EMPTY_OPTION = () => ({
  id:
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `opt_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  label: '',
});

export default function ManageCustomFieldsModal({
  isOpen,
  onClose,
  boardId,
  fields,
  isLoading,
  onFieldsChanged,
}: ManageCustomFieldsModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  const [options, setOptions] = useState<{ id: string; label: string }[]>([
    EMPTY_OPTION(),
  ]);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    field: CustomField;
    cardCount: number | null;
  } | null>(null);

  const optionInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [focusOptionId, setFocusOptionId] = useState<string | null>(null);

  useEffect(() => {
    if (focusOptionId) {
      optionInputRefs.current[focusOptionId]?.focus();
      setFocusOptionId(null);
    }
  }, [focusOptionId]);

  if (!isOpen) return null;

  const resetForm = () => {
    setIsCreating(false);
    setEditingFieldId(null);
    setName('');
    setType('text');
    setOptions([EMPTY_OPTION()]);
    setFormError(null);
  };

  const startCreate = () => {
    resetForm();
    setIsCreating(true);
  };

  const startEdit = (field: CustomField) => {
    setIsCreating(false);
    setEditingFieldId(field.id);
    setName(field.name);
    setType(field.definition.type);
    setOptions(
      field.definition.options?.length
        ? field.definition.options.map((o) => ({ ...o }))
        : [EMPTY_OPTION()]
    );
    setFormError(null);
  };

  const buildDefinition = (): CustomFieldDefinition => {
    if (type === 'select') {
      return {
        type,
        options: options
          .filter((o) => o.label.trim())
          .map((o) => ({ id: o.id, label: o.label.trim() })),
      };
    }
    return { type };
  };

  const submitForm = async () => {
    if (!name.trim()) {
      setFormError('Field name is required');
      return;
    }
    const definition = buildDefinition();
    if (definition.type === 'select' && !definition.options?.length) {
      setFormError('Add at least one option');
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      const url = editingFieldId
        ? `/api/boards/${boardId}/custom-fields/${editingFieldId}`
        : `/api/boards/${boardId}/custom-fields`;
      const response = await fetch(url, {
        method: editingFieldId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), definition }),
      });

      if (!response.ok) {
        const data = await response.json();
        setFormError(data.error || 'Failed to save field');
        return;
      }

      onFieldsChanged();
      resetForm();
    } catch (error) {
      console.error('Failed to save custom field:', error);
      setFormError('Failed to save field. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const requestDelete = async (field: CustomField) => {
    setDeleteConfirm({ field, cardCount: null });
    try {
      const response = await fetch(
        `/api/boards/${boardId}/custom-fields/${field.id}`
      );
      if (response.ok) {
        const data = await response.json();
        setDeleteConfirm({ field, cardCount: data.cardCount ?? 0 });
      }
    } catch (error) {
      console.error('Failed to count affected cards:', error);
      setDeleteConfirm({ field, cardCount: 0 });
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/boards/${boardId}/custom-fields/${deleteConfirm.field.id}`,
        { method: 'DELETE' }
      );
      if (response.ok) {
        onFieldsChanged();
        setDeleteConfirm(null);
      }
    } catch (error) {
      console.error('Failed to delete custom field:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateOption = (id: string, label: string) => {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, label } : o)));
  };

  // afterIndex is passed when triggered by Enter inside a specific option
  // input — inserts right after that row and focuses it, so hitting Enter
  // repeatedly builds a list top-to-bottom instead of always appending to
  // the end regardless of which row you're on.
  const addOption = (afterIndex?: number) => {
    const newOption = EMPTY_OPTION();
    setOptions((prev) => {
      if (afterIndex == null) return [...prev, newOption];
      const next = [...prev];
      next.splice(afterIndex + 1, 0, newOption);
      return next;
    });
    setFocusOptionId(newOption.id);
  };

  const removeOption = (id: string) =>
    setOptions((prev) =>
      prev.length > 1 ? prev.filter((o) => o.id !== id) : prev
    );

  const showForm = isCreating || editingFieldId !== null;

  return (
    <>
      <div className='fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4'>
        <div className='bg-card/90 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-sm sm:max-w-lg max-h-[85vh] border border-border overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200'>
          {/* Header */}
          <div className='relative bg-primary/10 p-6 border-b border-border'>
            <div className='flex items-center gap-3'>
              <div className='w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center'>
                <ListChecks className='w-5 h-5 text-primary' />
              </div>
              <div>
                <h2 className='text-xl font-semibold text-foreground'>
                  Custom fields
                </h2>
                <p className='text-sm text-muted-foreground'>
                  Fields defined here are available on every card in this board
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className='absolute top-4 right-4 p-2 hover:bg-muted rounded-xl transition-colors'
              title='Close'
            >
              <X className='w-5 h-5' />
            </button>
          </div>

          <div className='flex flex-col h-full'>
            <div className='flex-1 max-h-[60vh] overflow-y-auto'>
              <div className='p-6 space-y-6'>
                {!showForm && (
                  <div className='space-y-3'>
                    {isLoading ? (
                      Array.from({ length: 2 }).map((_, i) => (
                        <div
                          key={i}
                          className='h-14 bg-muted rounded-xl animate-pulse'
                        />
                      ))
                    ) : fields.length > 0 ? (
                      fields.map((field) => (
                        <div
                          key={field.id}
                          className='group flex items-center gap-3'
                        >
                          {/* min-w-0 on the flex item — without it, `truncate`
                              is a no-op: a flex child's default min-width is
                              `auto`, so it never shrinks below its content's
                              natural width and long names pushed the edit/
                              delete buttons off-screen instead of eliding
                              with "...". Same fix Trello/Jira use for this. */}
                          <div className='flex-1 min-w-0 flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/40 min-h-[44px]'>
                            <GripVertical className='w-4 h-4 text-muted-foreground/40 flex-shrink-0' />
                            <span
                              className='font-medium text-sm text-foreground truncate min-w-0'
                              title={field.name}
                            >
                              {field.name}
                            </span>
                            <span className='text-xs text-muted-foreground ml-auto flex-shrink-0'>
                              {
                                CUSTOM_FIELD_TYPES.find(
                                  (t) => t.value === field.definition.type
                                )?.label
                              }
                            </span>
                          </div>
                          <div className='flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                            <button
                              onClick={() => startEdit(field)}
                              className='p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground'
                              title='Edit field'
                            >
                              <Edit2 className='w-4 h-4' />
                            </button>
                            <button
                              onClick={() => requestDelete(field)}
                              className='p-2 hover:bg-destructive/10 rounded-lg transition-colors text-muted-foreground hover:text-destructive'
                              title='Delete field'
                            >
                              <Trash2 className='w-4 h-4' />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className='text-center py-8'>
                        <div className='w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-3'>
                          <ListChecks className='w-8 h-8 text-muted-foreground' />
                        </div>
                        <p className='text-sm text-muted-foreground'>
                          No custom fields yet
                        </p>
                        <p className='text-xs text-muted-foreground mt-1'>
                          Create one to start tracking extra info on cards
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {showForm && (
                  <div className='space-y-4'>
                    <div className='flex items-center justify-between'>
                      <h3 className='text-lg font-semibold text-foreground'>
                        {editingFieldId ? 'Edit field' : 'New field'}
                      </h3>
                      <button
                        onClick={resetForm}
                        className='p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground'
                        title='Cancel'
                      >
                        <X className='w-4 h-4' />
                      </button>
                    </div>

                    <div className='space-y-2'>
                      <label className='text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                        Type
                      </label>
                      {/* Locked once a field exists — changing a field's
                          type after cards already hold values in its old
                          shape (a Select's option ids, a Checkbox's
                          boolean) would leave those values meaningless.
                          Only the name (and a Select's own option labels)
                          stay editable. */}
                      {editingFieldId ? (
                        <div className='px-3 py-1.5 text-xs font-medium rounded-lg bg-muted/60 text-muted-foreground inline-block'>
                          {CUSTOM_FIELD_TYPES.find((t) => t.value === type)?.label}
                          <span className='ml-1.5 opacity-60'>
                            (can&rsquo;t be changed)
                          </span>
                        </div>
                      ) : (
                        <div className='flex flex-wrap gap-2'>
                          {CUSTOM_FIELD_TYPES.map((t) => (
                            <button
                              key={t.value}
                              onClick={() => setType(t.value)}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                type === t.value
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                              }`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <input
                      type='text'
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder='Field name (e.g. Hours estimate)'
                      className='w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors'
                    />

                    {type === 'select' && (
                      <div className='space-y-2'>
                        <label className='text-xs font-medium text-muted-foreground uppercase tracking-wider'>
                          Options
                        </label>
                        {options.map((option, index) => (
                          <div key={option.id} className='flex items-center gap-2'>
                            <input
                              type='text'
                              ref={(el) => {
                                optionInputRefs.current[option.id] = el;
                              }}
                              value={option.label}
                              onChange={(e) =>
                                updateOption(option.id, e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addOption(index);
                                }
                              }}
                              placeholder='Option label — Enter to add another'
                              className='flex-1 px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors text-sm'
                            />
                            <button
                              onClick={() => removeOption(option.id)}
                              disabled={options.length === 1}
                              className='p-2 text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed transition-colors'
                              title='Remove option'
                            >
                              <X className='w-4 h-4' />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => addOption()}
                          className='flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors'
                        >
                          <Plus className='w-3.5 h-3.5' /> Add option
                        </button>
                      </div>
                    )}

                    {formError && (
                      <p className='text-sm text-destructive'>{formError}</p>
                    )}

                    <button
                      onClick={submitForm}
                      disabled={isSaving || !name.trim()}
                      className='w-full py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      {isSaving
                        ? 'Saving...'
                        : editingFieldId
                        ? 'Save changes'
                        : 'Create field'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {!showForm && (
              <div className='sticky bottom-0 bg-card/95 backdrop-blur-xl border-t border-border p-4'>
                <button
                  onClick={startCreate}
                  className='w-full flex items-center justify-center gap-3 py-3 bg-primary/10 hover:bg-primary/15 rounded-xl border border-dashed border-primary/30 hover:border-primary/50 transition-colors group'
                >
                  <div className='w-8 h-8 bg-primary/10 group-hover:bg-primary/20 rounded-lg flex items-center justify-center transition-colors'>
                    <Plus className='w-4 h-4 text-primary' />
                  </div>
                  <span className='text-sm font-medium text-primary'>
                    Add a custom field
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className='fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4'>
          <div className='bg-card/90 backdrop-blur-xl rounded-xl shadow-2xl border border-border max-w-md w-full animate-in fade-in-50 zoom-in-95 duration-200'>
            <div className='p-6'>
              <div className='flex items-center gap-3 mb-4'>
                <div className='w-10 h-10 bg-destructive/15 rounded-full flex items-center justify-center'>
                  <AlertTriangle className='w-5 h-5 text-destructive' />
                </div>
                <div>
                  <h3 className='text-lg font-semibold text-foreground'>
                    Delete &ldquo;{deleteConfirm.field.name}&rdquo;?
                  </h3>
                  <p className='text-sm text-muted-foreground'>
                    This action cannot be undone
                  </p>
                </div>
              </div>

              <p className='text-sm text-foreground mb-6'>
                {deleteConfirm.cardCount === null ? (
                  'Checking how many cards use this field...'
                ) : deleteConfirm.cardCount > 0 ? (
                  <>
                    This will remove it from{' '}
                    <span className='font-medium'>
                      {deleteConfirm.cardCount} card
                      {deleteConfirm.cardCount === 1 ? '' : 's'}
                    </span>
                    .
                  </>
                ) : (
                  'No cards currently have a value set for this field.'
                )}
              </p>

              <div className='flex gap-3 justify-end'>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className='px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border hover:border-primary/50 rounded-md transition-colors'
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={isSaving || deleteConfirm.cardCount === null}
                  className='flex items-center gap-2 px-4 py-2 text-sm font-medium text-destructive-foreground bg-destructive hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors'
                >
                  {isSaving ? (
                    <>
                      <div className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className='w-4 h-4' />
                      Delete field
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
