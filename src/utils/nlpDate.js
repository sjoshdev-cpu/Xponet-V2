/**
 * Natural-language date parsing helpers.
 * All functions return ISO date strings (YYYY-MM-DD) or null.
 */

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function fmt(d) {
  return d.toISOString().split('T')[0];
}

export function parseNaturalDate(text) {
  if (!text) return null;
  const lower = text.trim().toLowerCase();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (lower === 'today') return fmt(today);

  if (lower === 'tomorrow') {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return fmt(d);
  }

  if (lower === 'yesterday') {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return fmt(d);
  }

  if (lower === 'next week') {
    const d = new Date(today);
    d.setDate(d.getDate() + 7);
    return fmt(d);
  }

  if (lower === 'end of week' || lower === 'this week') {
    const d = new Date(today);
    const daysUntilFriday = (5 - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + daysUntilFriday);
    return fmt(d);
  }

  // "next monday", "next friday", etc.
  const nextDayMatch = lower.match(/^next\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (nextDayMatch) {
    const targetDay = DAYS.indexOf(nextDayMatch[1]);
    const d = new Date(today);
    let diff = (targetDay - d.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    d.setDate(d.getDate() + diff);
    return fmt(d);
  }

  // "this monday", "monday", etc.
  const thisDayMatch = lower.match(/^(?:this\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (thisDayMatch) {
    const targetDay = DAYS.indexOf(thisDayMatch[1]);
    const d = new Date(today);
    const diff = (targetDay - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + diff);
    return fmt(d);
  }

  // "in N days"
  const inDays = lower.match(/^in\s+(\d+)\s+days?$/);
  if (inDays) {
    const d = new Date(today);
    d.setDate(d.getDate() + parseInt(inDays[1], 10));
    return fmt(d);
  }

  // "in N weeks"
  const inWeeks = lower.match(/^in\s+(\d+)\s+weeks?$/);
  if (inWeeks) {
    const d = new Date(today);
    d.setDate(d.getDate() + parseInt(inWeeks[1], 10) * 7);
    return fmt(d);
  }

  // Try native Date parsing as fallback (handles ISO strings, "Dec 25", etc.)
  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) return fmt(parsed);

  return null;
}

/**
 * Scan a task title for an embedded date phrase.
 * Returns { cleanTitle, dueDate } — cleanTitle has the phrase removed.
 */
export function extractDateFromTitle(title) {
  if (!title) return { cleanTitle: title, dueDate: null };

  const patterns = [
    /\b(end of week|next week|this week|today|tomorrow|yesterday)\b/i,
    /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\bthis\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\bin\s+\d+\s+days?\b/i,
    /\bin\s+\d+\s+weeks?\b/i,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      const dateStr = parseNaturalDate(match[0]);
      if (dateStr) {
        const cleanTitle = title.replace(match[0], '').replace(/\s{2,}/g, ' ').trim();
        return { cleanTitle, dueDate: dateStr };
      }
    }
  }

  return { cleanTitle: title, dueDate: null };
}

/**
 * Scan a task title for an @Mention and return the assignee name.
 * Returns { cleanTitle, assigneeName }.
 */
export function extractMentionFromTitle(title) {
  if (!title) return { cleanTitle: title, assigneeName: null };

  // Match @Word or @"First Last" or @First Last (up to 3 words)
  const match = title.match(/@([A-Za-z][A-Za-z\s]{0,28}?)(?=\s|$)/);
  if (match) {
    const assigneeName = match[1].trim();
    const cleanTitle = title.replace(match[0], '').replace(/\s{2,}/g, ' ').trim();
    return { cleanTitle, assigneeName };
  }

  return { cleanTitle: title, assigneeName: null };
}

export const DATE_SHORTCUT_LABELS = ['today', 'tomorrow', 'next monday', 'next friday', 'next week', 'in 3 days'];
