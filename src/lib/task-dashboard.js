// Pure stats logic for the Week-on-Week Task Dashboard, extracted so it can be
// unit-tested against the old spreadsheet's snapshot numbers without rendering.
// Every figure is derived from ONE task list filtered by category — there are
// no cross-collection references, so no value can ever be #REF!-equivalent.

import { isPast, isThisWeek } from 'date-fns';
import { getAssignees, taskCategory } from '@/lib/task-utils';

const DONE = 'Done';

export function ownerOf(task) {
  const a = getAssignees(task)[0];
  if (a && (a.name || a.email)) return { key: a.email || a.name, name: a.name || a.email };
  return { key: '__unassigned__', name: 'Unassigned' };
}

export const isOverdue = (t) =>
  t.status !== DONE && t.due_date && isPast(new Date(t.due_date));

/** Group tasks by owner → [{ name, count }] sorted desc. */
export function byOwnerDesc(tasks) {
  const map = new Map();
  for (const t of tasks) {
    const { key, name } = ownerOf(t);
    const cur = map.get(key) || { name, count: 0 };
    cur.count += 1;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/**
 * Like byOwnerDesc but keeps each owner's actual tasks, so the Owner Snapshot
 * can list the pending items alongside the per-owner count.
 * → [{ name, count, tasks: [...] }] sorted desc by count.
 */
export function byOwnerDetailed(tasks) {
  const map = new Map();
  for (const t of tasks) {
    const { key, name } = ownerOf(t);
    const cur = map.get(key) || { name, count: 0, tasks: [] };
    cur.count += 1;
    cur.tasks.push(t);
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/**
 * computeTaskDashboardStats(tasks, now?) — all dashboard figures.
 * `now` is injectable for deterministic tests.
 */
export function computeTaskDashboardStats(tasks, now = new Date()) {
  const withCat = tasks.map((t) => ({ ...t, _cat: taskCategory(t) }));
  const general = withCat.filter((t) => t._cat === 'General');
  const trade = withCat.filter((t) => t._cat === 'Trade');

  const done = (list) => list.filter((t) => t.status === DONE);
  const pending = (list) => list.filter((t) => t.status !== DONE);
  const overdue = (list) => list.filter(isOverdue);

  const total = withCat.length;
  const completed = done(withCat).length;
  const overdueAll = overdue(withCat);

  const doneThisWeek = withCat.filter(
    (t) => t.status === DONE && t.updated_at && isThisWeek(new Date(t.updated_at), { weekStartsOn: 1 }),
  );

  return {
    total,
    pending: pending(withCat).length,
    completed,
    completionRate: total ? Math.round((completed / total) * 100) : 0,
    overdue: overdueAll.length,
    topDefaulter: byOwnerDesc(overdueAll)[0] || null,
    topCloser: byOwnerDesc(doneThisWeek)[0] || null,
    generalTasks: general,
    tradeTasks: trade,
    ownerSnapshot: byOwnerDetailed(pending(withCat)),
    quick: {
      generalPending: pending(general).length,
      tradePending: pending(trade).length,
      generalCompleted: done(general).length,
      tradeCompleted: done(trade).length,
      generalOverdue: overdue(general).length,
      tradeOverdue: overdue(trade).length,
    },
  };
}
