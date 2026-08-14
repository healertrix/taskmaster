// Shared shape + validation for board-level custom fields. One module so
// every write path (board settings' field editor, the card modal's value
// editor, both API routes) validates/coerces the same way — the jsonb
// columns behind this (custom_fields.definition, card_custom_field_values
// .value) have no DB-level type checking, so this is the one place that
// responsibility actually lives.

export type CustomFieldType = 'text' | 'number' | 'select' | 'checkbox' | 'date';

export interface CustomFieldOption {
  id: string;
  label: string;
}

export interface CustomFieldDefinition {
  type: CustomFieldType;
  // Only present for type: 'select'. Options carry their own stable id —
  // values reference the id, never the raw label — so renaming an option
  // later doesn't orphan cards that already picked it.
  options?: CustomFieldOption[];
}

export const CUSTOM_FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Select' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'date', label: 'Date' },
];

/**
 * Validates + coerces a raw value against a field's definition before it's
 * written. Returns the value to store (jsonb), or throws with a message
 * safe to surface to the user. Number is deliberately NOT type-enforced —
 * stored/rendered as plain text, per the explicit decision not to validate
 * numeric input for v1 — so it's handled identically to 'text' here.
 */
export function coerceCustomFieldValue(
  definition: CustomFieldDefinition,
  raw: unknown
): unknown {
  switch (definition.type) {
    case 'text':
    case 'number':
      if (typeof raw !== 'string') {
        throw new Error('Value must be text');
      }
      return raw;

    case 'checkbox':
      if (typeof raw !== 'boolean') {
        throw new Error('Value must be true or false');
      }
      return raw;

    case 'date':
      if (typeof raw !== 'string' || Number.isNaN(Date.parse(raw))) {
        throw new Error('Value must be a valid date');
      }
      return raw;

    case 'select': {
      if (typeof raw !== 'string') {
        throw new Error('Value must be an option id');
      }
      const options = definition.options || [];
      if (!options.some((o) => o.id === raw)) {
        throw new Error('Value must be one of this field\'s options');
      }
      return raw;
    }

    default:
      throw new Error('Unknown field type');
  }
}

/** Validates a field definition itself (board settings' field editor). */
export function validateCustomFieldDefinition(
  definition: CustomFieldDefinition
): void {
  const validTypes: CustomFieldType[] = ['text', 'number', 'select', 'checkbox', 'date'];
  if (!validTypes.includes(definition.type)) {
    throw new Error('Unknown field type');
  }
  if (definition.type === 'select') {
    const options = definition.options || [];
    if (options.length === 0) {
      throw new Error('A select field needs at least one option');
    }
    const ids = new Set(options.map((o) => o.id));
    if (ids.size !== options.length) {
      throw new Error('Option ids must be unique');
    }
    if (options.some((o) => !o.label.trim())) {
      throw new Error('Options cannot have an empty label');
    }
  }
}
