import { format, parseISO, isValid } from 'date-fns';

// Combine date and time strings into a proper ISO datetime string.
//
// Date-only case (no timeStr) is written as literal UTC midnight
// ("...T00:00:00.000Z") instead of parsing "dateStr T 00:00" as the
// *creator's local* midnight and converting that to UTC. That conversion
// used to shift a date-only value into a non-midnight UTC instant for
// every timezone except UTC+0 — e.g. IST (UTC+5:30) local midnight becomes
// 18:30 UTC the day before — and every place that infers "does this value
// carry a real time?" by checking for a zero hour/minute would then see a
// non-zero one and wrongly show a phantom "at 5:30 AM"/"at 6:30 PM" on a
// date the user never attached a time to. Writing it as literal UTC
// midnight instead means it reads back as hour 0 for every viewer,
// everywhere — see the matching getUTCHours()/getUTCMinutes() checks below
// and in getRelativeDateTime/formatDateTime.
export function combineDateAndTime(
  dateStr?: string,
  timeStr?: string
): string | undefined {
  if (!dateStr) return undefined;

  if (!timeStr) {
    return `${dateStr}T00:00:00.000Z`;
  }

  // A real time was picked — this is the creator's local wall-clock time,
  // so convert it to a proper UTC instant the normal way.
  const combinedStr = `${dateStr}T${timeStr}:00`;

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

// Extract date part from datetime string. Uses UTC components rather than
// local ones — a date-only value is always stored as literal UTC midnight
// (see combineDateAndTime above), so reading it back via local
// getFullYear/getMonth/getDate would shift the calendar day for anyone not
// at UTC+0 (e.g. it'd read one day earlier for negative-offset timezones).
export function extractDate(datetimeStr?: string): string {
  if (!datetimeStr) return '';

  try {
    const date = parseISO(datetimeStr);
    if (isValid(date)) {
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const d = String(date.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  } catch (error) {
    console.warn('Invalid datetime string:', datetimeStr);
  }

  return '';
}

// Extract time part from datetime string. Returns '' for a date-only value
// (literal UTC midnight, see combineDateAndTime) instead of formatting it
// in the viewer's local zone — otherwise re-opening the date picker on a
// date-only field would pre-fill a phantom time (e.g. "05:30" for an IST
// viewer) that was never actually set.
export function extractTime(datetimeStr?: string): string {
  if (!datetimeStr) return '';

  try {
    const date = parseISO(datetimeStr);
    if (isValid(date)) {
      if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) {
        return '';
      }
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
      // Date-only values are always literal UTC midnight (see
      // combineDateAndTime) — check UTC hours/minutes, not local ones, or
      // this reads as "has a time" for every timezone except UTC+0.
      const hasTime = date.getUTCHours() !== 0 || date.getUTCMinutes() !== 0;
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

    // Same reasoning as formatDateTime above — check UTC hours/minutes,
    // since a date-only value is always literal UTC midnight.
    const hasTime = date.getUTCHours() !== 0 || date.getUTCMinutes() !== 0;
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
