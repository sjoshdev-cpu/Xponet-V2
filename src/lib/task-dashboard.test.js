import { describe, it, expect } from 'vitest';
import { computeTaskDashboardStats } from './task-dashboard.js';
import { taskCategory as _c } from './task-utils.js';

// Reproduce the last manually-maintained spreadsheet snapshot the user gave as
// the validation checkpoint: 83 overall, 25 general pending, 57 general
// completed, 18 general overdue. (82 general = 25 pending + 57 done; + 1 trade
// task => 83 overall.) This proves the category math matches the old sheet
// before cutting it over. The remaining 7 general-pending are not overdue.

const PAST = '2020-01-01';   // definitely overdue
const FUTURE = '2999-01-01'; // not overdue

describe('computeTaskDashboardStats — reproduces the old spreadsheet snapshot', () => {
  const tasks = [
    // 57 general completed
    ...Array.from({ length: 57 }, (_, i) => ({ id: `gd${i}`, status: 'Done', category: 'General' })),
    // 18 general pending + overdue
    ...Array.from({ length: 18 }, (_, i) => ({ id: `go${i}`, status: 'In Progress', category: 'General', due_date: PAST })),
    // 7 general pending, not overdue  (25 pending total)
    ...Array.from({ length: 7 }, (_, i) => ({ id: `gp${i}`, status: 'To Do', category: 'General', due_date: FUTURE })),
    // 1 trade task
    { id: 't0', status: 'To Do', category: 'Trade', due_date: FUTURE },
  ];

  const s = computeTaskDashboardStats(tasks);

  it('overall total = 83', () => expect(s.total).toBe(83));
  it('general pending = 25', () => expect(s.quick.generalPending).toBe(25));
  it('general completed = 57', () => expect(s.quick.generalCompleted).toBe(57));
  it('general overdue = 18', () => expect(s.quick.generalOverdue).toBe(18));

  it('overall completed = 57 and pending = 26 (incl. the trade task)', () => {
    expect(s.completed).toBe(57);
    expect(s.pending).toBe(26);
  });

  it('completion rate rounds 57/83 to 69%', () => expect(s.completionRate).toBe(69));

  it('trade columns are real numbers, never #REF!', () => {
    expect(s.quick.tradePending).toBe(1);
    expect(s.quick.tradeCompleted).toBe(0);
    expect(s.quick.tradeOverdue).toBe(0);
    for (const v of Object.values(s.quick)) expect(typeof v).toBe('number');
  });
});

describe('taskCategory default', () => {
  it('untagged tasks count as General', () => {
    expect(_c({})).toBe('General');
    expect(_c({ category: 'Trade' })).toBe('Trade');
  });
});
