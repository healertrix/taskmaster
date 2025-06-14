import { format, parseISO, isValid } from 'date-fns';

// Combine date and time strings into a proper ISO datetime string
export function combineDateAndTime(
  dateStr?: string,
  timeStr?: string
): string | undefined {
  if (!dateStr) return undefined;

  // If no time is specified, use 00:00 (midnight) to represent date-only
  const time = timeStr || '00:00';
  const combinedStr = `${dateStr}T${time}:00`;

  try {
    const date = parseISO(combinedStr);
    if (isValid(date)) {
      return date.toISOString();
    }
  } catch (error) {
    console.warn('Invalid date/time combination:', { dateStr, timeStr });
  }

  return undefined;
}

// Extract date part from datetime string
export function extractDate(datetimeStr?: string): string {
  if (!datetimeStr) return '';

  try {
    const date = parseISO(datetimeStr);
    if (isValid(date)) {
      return format(date, 'yyyy-MM-dd');
    }
  } catch (error) {
    console.warn('Invalid datetime string:', datetimeStr);
  }

  return '';
}

// Extract time part from datetime string
export function extractTime(datetimeStr?: string): string {
  if (!datetimeStr) return '';

  try {
    const date = parseISO(datetimeStr);
    if (isValid(date)) {
      return format(date, 'HH:mm');
    }
  } catch (error) {
    console.warn('Invalid datetime string:', datetimeStr);
  }

  return '';
}

// Format datetime for display with optional time
export function formatDateTime(
  datetimeStr?: string,
  options?: {
    includeTime?: boolean;
    includeYear?: boolean;
    forceShowTime?: boolean;
  }
): string {
  if (!datetimeStr) return '';

  const {
    includeTime = true,
    includeYear = false,
    forceShowTime = false,
  } = options || {};

  try {
    const date = parseISO(datetimeStr);
    if (isValid(date)) {
      // Check if time is specified (not midnight/00:00)
      const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
      const shouldShowTime = forceShowTime || (includeTime && hasTime);

      let formatStr = includeYear ? 'MMM dd, yyyy' : 'MMM dd';
      if (shouldShowTime) {
        formatStr += " 'at' h:mm a";
      }
      return format(date, formatStr);
    }
  } catch (error) {
    console.warn('Invalid datetime string:', datetimeStr);
  }

  return '';
}

// Get relative time description (Today, Tomorrow, etc.) with optional time
export function getRelativeDateTime(datetimeStr?: string): string {
  if (!datetimeStr) return '';

  try {
    const date = parseISO(datetimeStr);
    if (!isValid(date)) return '';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Check if time is specified (not midnight/00:00)
    const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
    const timeStr = hasTime ? ` at ${format(date, 'h:mm a')}` : '';

    if (diffDays === 0) return `Today${timeStr}`;
    if (diffDays === 1) return `Tomorrow${timeStr}`;
    if (diffDays === -1) return `Yesterday${timeStr}`;
    if (diffDays > 1 && diffDays <= 7) return `${diffDays} days${timeStr}`;
    if (diffDays < -1 && diffDays >= -7)
      return `${Math.abs(diffDays)} days ago${timeStr}`;

    return hasTime
      ? format(date, "MMM dd 'at' h:mm a")
      : format(date, 'MMM dd');
  } catch (error) {
    console.warn('Invalid datetime string:', datetimeStr);
    return '';
  }
}

// Check if a datetime is overdue
export function isOverdue(datetimeStr?: string): boolean {
  if (!datetimeStr) return false;

  try {
    const date = parseISO(datetimeStr);
    if (isValid(date)) {
      return date.getTime() < new Date().getTime();
    }
  } catch (error) {
    console.warn('Invalid datetime string:', datetimeStr);
  }

  return false;
}

// Check if a datetime is due soon (within 24 hours)
export function isDueSoon(datetimeStr?: string): boolean {
  if (!datetimeStr) return false;

  try {
    const date = parseISO(datetimeStr);
    if (isValid(date)) {
      const now = new Date();
      const diffTime = date.getTime() - now.getTime();
      const diffHours = diffTime / (1000 * 60 * 60);
      return diffHours > 0 && diffHours <= 24;
    }
  } catch (error) {
    console.warn('Invalid datetime string:', datetimeStr);
  }

  return false;
}
