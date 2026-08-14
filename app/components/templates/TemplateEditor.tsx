'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Plus,
  X,
  GripVertical,
  LayoutGrid,
  Tag,
  ListChecks,
  Loader2,
} from 'lucide-react';
import {
  CUSTOM_FIELD_TYPES,
  type CustomFieldType,
} from '@/utils/customFields';
import {
  newTemplateList,
  newTemplateLabel,
  newTemplateCustomField,
  genId,
  type TemplateStructure,
  type TemplateList,
  type TemplateLabel,
  type TemplateCustomField,
} from '@/utils/boardTemplates';

// Small, fixed palette — same idea as LabelModal's LABEL_COLORS but not
// importing that file's full curated set (dark/soft/neutral categories,
// custom color picker) to keep a template's label editor lightweight;
// a template label just needs *a* color, not the full picker experience
// a live board's label editor offers.
const TEMPLATE_LABEL_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#84cc16',
  '#10b981', '#3b82f6', '#8b5cf6', '#ec4899',
];

interface TemplateEditorProps {
  name: string;
  onNameChange: (name: string) => void;
  structure: TemplateStructure;
  onStructureChange: (structure: TemplateStructure) => void;
}

// One flat page — lists, labels, custom fields all editable together,
// no staged/gated flow. A template has no cards, so there's nothing that
// could be "incomplete" in a way worth surfacing; it's always safe to
// save partway through and come back later, same as any other simple
// settings form in this app.
export function TemplateEditor({
  name,
  onNameChange,
  structure,
  onStructureChange,
}: TemplateEditorProps) {
  const updateLists = (lists: TemplateList[]) =>
    onStructureChange({ ...structure, lists });
  const updateLabels = (labels: TemplateLabel[]) =>
    onStructureChange({ ...structure, labels });
  const updateCustomFields = (customFields: TemplateCustomField[]) =>
    onStructureChange({ ...structure, customFields });

  // Enter-to-add-and-continue for lists/labels — same pattern as the
  // custom fields' Select-options editor: add a new row right after the
  // current one and focus it, so hitting Enter repeatedly builds the
  // list top-to-bottom without reaching for the "Add" button each time.
  const listInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const labelInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [focusListId, setFocusListId] = useState<string | null>(null);
  const [focusLabelId, setFocusLabelId] = useState<string | null>(null);

  useEffect(() => {
    if (focusListId) {
      listInputRefs.current[focusListId]?.focus();
      setFocusListId(null);
    }
  }, [focusListId]);

  useEffect(() => {
    if (focusLabelId) {
      labelInputRefs.current[focusLabelId]?.focus();
      setFocusLabelId(null);
    }
  }, [focusLabelId]);

  const addList = (afterIndex?: number) => {
    const list = newTemplateList();
    if (afterIndex == null) {
      updateLists([...structure.lists, list]);
    } else {
      const next = [...structure.lists];
      next.splice(afterIndex + 1, 0, list);
      updateLists(next);
    }
    setFocusListId(list.id);
  };

  const addLabel = (afterIndex?: number) => {
    // Random, not a deterministic cycle through the palette by position —
    // editing an existing label always shows whatever's actually saved
    // (the color input is a plain controlled input bound to label.color),
    // this only decides the starting point for a brand new one. Picked
    // from TEMPLATE_LABEL_COLORS specifically (not a fully random RGB) so
    // it's always vibrant, never a dull/muddy random color — the swatch
    // still opens the native picker for any custom color afterward.
    const label = newTemplateLabel(
      '',
      TEMPLATE_LABEL_COLORS[Math.floor(Math.random() * TEMPLATE_LABEL_COLORS.length)]
    );
    if (afterIndex == null) {
      updateLabels([...structure.labels, label]);
    } else {
      const next = [...structure.labels];
      next.splice(afterIndex + 1, 0, label);
      updateLabels(next);
    }
    setFocusLabelId(label.id);
  };

  return (
    <div className='space-y-8'>
      {/* Name */}
      <div>
        <label className='block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2'>
          Template name
        </label>
        <input
          type='text'
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder='e.g. Sprint board'
          className='w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors'
        />
      </div>

      {/* Lists */}
      <div>
        <div className='flex items-center gap-2 mb-3'>
          <LayoutGrid className='w-4 h-4 text-muted-foreground' />
          <h3 className='text-sm font-medium text-foreground'>Lists</h3>
        </div>
        <div className='space-y-2'>
          {structure.lists.map((list, index) => (
            <div key={list.id} className='flex items-center gap-2'>
              <GripVertical className='w-4 h-4 text-muted-foreground/40 flex-shrink-0' />
              <input
                type='text'
                ref={(el) => {
                  listInputRefs.current[list.id] = el;
                }}
                value={list.name}
                onChange={(e) => {
                  const next = [...structure.lists];
                  next[index] = { ...list, name: e.target.value };
                  updateLists(next);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addList(index);
                  }
                }}
                placeholder='List name — Enter to add another'
                className='flex-1 min-w-0 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50'
              />
              <button
                onClick={() => updateLists(structure.lists.filter((l) => l.id !== list.id))}
                className='p-2 text-muted-foreground hover:text-destructive transition-colors'
              >
                <X className='w-4 h-4' />
              </button>
            </div>
          ))}
          <button
            onClick={() => addList()}
            className='flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors'
          >
            <Plus className='w-3.5 h-3.5' /> Add list
          </button>
        </div>
      </div>

      {/* Labels */}
      <div>
        <div className='flex items-center gap-2 mb-3'>
          <Tag className='w-4 h-4 text-muted-foreground' />
          <h3 className='text-sm font-medium text-foreground'>Labels</h3>
        </div>
        <div className='space-y-2'>
          {structure.labels.map((label, index) => (
            <div key={label.id} className='flex items-center gap-2'>
              <div className='relative flex-shrink-0'>
                <input
                  type='color'
                  value={label.color}
                  onChange={(e) => {
                    const next = [...structure.labels];
                    next[index] = { ...label, color: e.target.value };
                    updateLabels(next);
                  }}
                  className='w-9 h-9 rounded-lg border-0 cursor-pointer opacity-0 absolute inset-0 z-10'
                />
                <div
                  className='w-9 h-9 rounded-lg border border-border'
                  style={{ backgroundColor: label.color }}
                />
              </div>
              <input
                type='text'
                ref={(el) => {
                  labelInputRefs.current[label.id] = el;
                }}
                value={label.name}
                onChange={(e) => {
                  const next = [...structure.labels];
                  next[index] = { ...label, name: e.target.value };
                  updateLabels(next);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addLabel(index);
                  }
                }}
                placeholder='Label name — Enter to add another'
                className='flex-1 min-w-0 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50'
              />
              <button
                onClick={() => updateLabels(structure.labels.filter((l) => l.id !== label.id))}
                className='p-2 text-muted-foreground hover:text-destructive transition-colors'
              >
                <X className='w-4 h-4' />
              </button>
            </div>
          ))}
          <button
            onClick={() => addLabel()}
            className='flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors'
          >
            <Plus className='w-3.5 h-3.5' /> Add label
          </button>
        </div>
      </div>

      {/* Custom fields */}
      <div>
        <div className='flex items-center gap-2 mb-3'>
          <ListChecks className='w-4 h-4 text-muted-foreground' />
          <h3 className='text-sm font-medium text-foreground'>Custom fields</h3>
        </div>
        <div className='space-y-3'>
          {structure.customFields.map((field, index) => (
            <div key={field.id} className='p-3 bg-muted/30 rounded-lg space-y-2'>
              <div className='flex items-center gap-2'>
                <input
                  type='text'
                  value={field.name}
                  onChange={(e) => {
                    const next = [...structure.customFields];
                    next[index] = { ...field, name: e.target.value };
                    updateCustomFields(next);
                  }}
                  placeholder='Field name'
                  className='flex-1 min-w-0 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50'
                />
                <button
                  onClick={() =>
                    updateCustomFields(structure.customFields.filter((f) => f.id !== field.id))
                  }
                  className='p-2 text-muted-foreground hover:text-destructive transition-colors'
                >
                  <X className='w-4 h-4' />
                </button>
              </div>
              <div className='flex flex-wrap gap-2'>
                {CUSTOM_FIELD_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => {
                      const next = [...structure.customFields];
                      next[index] = {
                        ...field,
                        definition:
                          t.value === 'select'
                            ? { type: t.value, options: field.definition.options || [] }
                            : { type: t.value },
                      };
                      updateCustomFields(next);
                    }}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                      field.definition.type === t.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {field.definition.type === 'select' && (
                <div className='space-y-1.5 pt-1'>
                  {(field.definition.options || []).map((option, optIndex) => (
                    <div key={option.id} className='flex items-center gap-2'>
                      <input
                        type='text'
                        value={option.label}
                        onChange={(e) => {
                          const options = [...(field.definition.options || [])];
                          options[optIndex] = { ...option, label: e.target.value };
                          const next = [...structure.customFields];
                          next[index] = { ...field, definition: { ...field.definition, options } };
                          updateCustomFields(next);
                        }}
                        placeholder='Option label'
                        className='flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50'
                      />
                      <button
                        onClick={() => {
                          const options = (field.definition.options || []).filter(
                            (o) => o.id !== option.id
                          );
                          const next = [...structure.customFields];
                          next[index] = { ...field, definition: { ...field.definition, options } };
                          updateCustomFields(next);
                        }}
                        className='p-1 text-muted-foreground hover:text-destructive transition-colors'
                      >
                        <X className='w-3.5 h-3.5' />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const options = [
                        ...(field.definition.options || []),
                        { id: genId(), label: '' },
                      ];
                      const next = [...structure.customFields];
                      next[index] = { ...field, definition: { ...field.definition, options } };
                      updateCustomFields(next);
                    }}
                    className='flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors'
                  >
                    <Plus className='w-3 h-3' /> Add option
                  </button>
                </div>
              )}
            </div>
          ))}
          <button
            onClick={() =>
              updateCustomFields([...structure.customFields, newTemplateCustomField()])
            }
            className='flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors'
          >
            <Plus className='w-3.5 h-3.5' /> Add custom field
          </button>
        </div>
      </div>
    </div>
  );
}
