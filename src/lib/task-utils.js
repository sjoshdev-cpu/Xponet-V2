// Task categories — replaces the old separate Master_Tracker /
// Trade_Task_Tracker spreadsheets with a single field on the Task itself, so
// every dashboard number is a live query filtered by category (no cross-sheet
// references, no #REF! failure mode). Tasks created before this field default
// to 'General' at read time via taskCategory().
export const TASK_CATEGORIES = ['General', 'Trade'];

/** A task's category, defaulting legacy/untagged tasks to 'General'. */
export function taskCategory(task) {
  return task?.category === 'Trade' ? 'Trade' : 'General';
}

// Shared helpers for working with task assignees.
//
// Tasks now support multiple assignees via `assignees: [{ email, name }]`.
// Older tasks (created before this feature) only have the legacy singular
// `assignee_email` / `assignee_name` fields. getAssignees() normalizes both
// shapes so every component can just call one function instead of each
// re-implementing the fallback logic.

/**
 * Returns a normalized array of { email, name } for a task, regardless of
 * whether it was created before or after multi-assignee support.
 */
export function getAssignees(task) {
  if (Array.isArray(task?.assignees) && task.assignees.length > 0) {
    return task.assignees;
  }
  if (task?.assignee_email) {
    return [{ email: task.assignee_email, name: task.assignee_name || '' }];
  }
  return [];
}

/** True if `email` is one of the task's assignees. */
export function isAssignedTo(task, email) {
  if (!email) return false;
  return getAssignees(task).some((a) => a.email === email);
}

/**
 * Builds the fields to persist on a task from a chosen assignees array.
 * Keeps legacy assignee_email/assignee_name in sync (set to the first
 * assignee) so any code that hasn't been migrated yet still works.
 */
export function buildAssigneeFields(assignees) {
  const list = Array.isArray(assignees) ? assignees : [];
  return {
    assignees: list,
    assignee_emails: list.map((a) => a.email).filter(Boolean),
    assignee_email: list[0]?.email || '',
    assignee_name: list[0]?.name || '',
  };
}

/** Initials for an avatar bubble, from a name or email. */
export function getInitials({ name, email } = {}) {
  const label = name || email || '';
  if (!label) return '?';
  if (!name && label.includes('@')) return label.charAt(0).toUpperCase();
  return label.split(' ').slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || '?';
}
