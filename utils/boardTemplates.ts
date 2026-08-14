// Shared shape + light validation for board templates. One module so the
// template editor UI and every API route that reads/writes a template's
// `structure` agree on the same shape — same reasoning as
// utils/customFields.ts, but simpler: a template's jsonb column is edited
// as one whole document (no per-item API, no concurrent editors), so
// there's no per-value coercion step to centralize, just a shape check.

import type { CustomFieldDefinition } from './customFields';

export interface TemplateList {
  id: string; // client-generated, template-internal only — see note below
  name: string;
}

export interface TemplateLabel {
  id: string; // client-generated, template-internal only
  name: string;
  color: string;
}

export interface TemplateCustomField {
  id: string; // client-generated, template-internal only
  name: string;
  definition: CustomFieldDefinition;
}

// These ids exist purely so the editor has stable React keys for
// add/remove/reorder within one editing session — they're never read by
// anything outside the template itself. Applying a template to create a
// real board discards them entirely and inserts fresh board-scoped rows
// (lists.number, labels.id, custom_fields.id) via the normal creation
// paths, exactly as if a user had added each one by hand.
export interface TemplateStructure {
  lists: TemplateList[];
  labels: TemplateLabel[];
  customFields: TemplateCustomField[];
}

export const EMPTY_TEMPLATE_STRUCTURE: TemplateStructure = {
  lists: [],
  labels: [],
  customFields: [],
};

export function genId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function newTemplateList(name = ''): TemplateList {
  return { id: genId(), name };
}

export function newTemplateLabel(name = '', color = '#3b82f6'): TemplateLabel {
  return { id: genId(), name, color };
}

export function newTemplateCustomField(
  name = '',
  definition: CustomFieldDefinition = { type: 'text' }
): TemplateCustomField {
  return { id: genId(), name, definition };
}

/** Validates a structure shape before it's written. Throws with a message safe to surface to the user. */
export function validateTemplateStructure(structure: TemplateStructure): void {
  if (!Array.isArray(structure.lists) || !Array.isArray(structure.labels) || !Array.isArray(structure.customFields)) {
    throw new Error('Invalid template structure');
  }
  if (structure.lists.some((l) => !l.name.trim())) {
    throw new Error('Lists cannot have an empty name');
  }
  if (structure.labels.some((l) => !l.name.trim() || !l.color)) {
    throw new Error('Labels need a name and a color');
  }
  if (structure.customFields.some((f) => !f.name.trim())) {
    throw new Error('Custom fields cannot have an empty name');
  }
}
