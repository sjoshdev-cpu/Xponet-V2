// Built-in page templates — no Firestore persistence needed.
// Each template produces a `blocks` array (JSON.stringify'd → Page.content)
// and optional `title` / `icon` defaults.

const b = (type, content, extra = {}) => ({
  id: `t_${type}_${Math.random().toString(36).slice(2, 8)}`,
  type,
  content,
  ...extra,
});

export const TEMPLATE_CATEGORIES = [
  { id: 'all',       label: 'All' },
  { id: 'blank',     label: 'Blank' },
  { id: 'work',      label: 'Work' },
  { id: 'personal',  label: 'Personal' },
  { id: 'docs',      label: 'Docs & wikis' },
  { id: 'projects',  label: 'Projects' },
  { id: 'meetings',  label: 'Meetings' },
];

export const PAGE_TEMPLATES = [
  // ── Blank ────────────────────────────────────────────────────────────────────
  {
    id: 'blank',
    category: 'blank',
    title: 'Blank page',
    description: 'Start with a completely empty page.',
    icon: '📄',
    previewIcon: '📄',
    getBlocks: () => [
      b('paragraph', ''),
    ],
  },

  // ── Meetings ─────────────────────────────────────────────────────────────────
  {
    id: 'meeting-notes',
    category: 'meetings',
    title: 'Meeting notes',
    description: 'Capture attendees, agenda, and action items in one place.',
    icon: '🗒️',
    previewIcon: '🗒️',
    getBlocks: () => [
      b('callout', 'Record key decisions and follow-ups from your meeting.', { color: 'blue', emoji: '📌' }),
      b('heading2', 'Attendees'),
      b('paragraph', ''),
      b('heading2', 'Agenda'),
      b('numbered', 'Topic 1'),
      b('numbered', 'Topic 2'),
      b('numbered', 'Topic 3'),
      b('heading2', 'Notes'),
      b('paragraph', ''),
      b('heading2', 'Action items'),
      b('todo', 'Owner – Task description', { checked: false }),
      b('todo', 'Owner – Task description', { checked: false }),
    ],
  },

  // ── Projects ─────────────────────────────────────────────────────────────────
  {
    id: 'project-brief',
    category: 'projects',
    title: 'Project brief',
    description: 'Define goals, timeline, and team for a new project.',
    icon: '🚀',
    previewIcon: '🚀',
    getBlocks: () => [
      b('callout', 'Share this brief with your team before kickoff.', { color: 'green', emoji: '🚀' }),
      b('heading2', 'Goals'),
      b('paragraph', 'What does success look like?'),
      b('heading2', 'Scope'),
      b('paragraph', 'What is in scope? What is out of scope?'),
      b('heading2', 'Timeline'),
      b('paragraph', ''),
      b('heading2', 'Team'),
      b('paragraph', ''),
      b('heading2', 'Open questions'),
      b('todo', '', { checked: false }),
    ],
  },

  // ── Docs ─────────────────────────────────────────────────────────────────────
  {
    id: 'sop',
    category: 'docs',
    title: 'Standard operating procedure',
    description: 'Document a repeatable process with numbered steps.',
    icon: '📋',
    previewIcon: '📋',
    getBlocks: () => [
      b('callout', 'Keep this document up to date as the process evolves.', { color: 'yellow', emoji: '⚠️' }),
      b('heading2', 'Purpose'),
      b('paragraph', 'Describe why this procedure exists.'),
      b('heading2', 'Scope'),
      b('paragraph', 'Who does this apply to?'),
      b('heading2', 'Steps'),
      b('numbered', 'Step one'),
      b('numbered', 'Step two'),
      b('numbered', 'Step three'),
      b('heading2', 'Roles & responsibilities'),
      b('paragraph', ''),
      b('heading2', 'References'),
      b('paragraph', ''),
    ],
  },

  // ── Personal ─────────────────────────────────────────────────────────────────
  {
    id: 'weekly-planner',
    category: 'personal',
    title: 'Weekly planner',
    description: 'Plan your week day-by-day with to-dos and notes.',
    icon: '📅',
    previewIcon: '📅',
    getBlocks: () => [
      b('callout', 'Review on Monday morning and retrospect on Friday.', { color: 'purple', emoji: '📅' }),
      ...['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].flatMap((day) => [
        b('heading3', day),
        b('todo', '', { checked: false }),
        b('paragraph', ''),
      ]),
    ],
  },

  // ── Work ─────────────────────────────────────────────────────────────────────
  {
    id: 'bug-report',
    category: 'work',
    title: 'Bug report',
    description: 'Document a bug with summary, steps to reproduce, and expected vs actual behaviour.',
    icon: '🐛',
    previewIcon: '🐛',
    getBlocks: () => [
      b('callout', 'Fill in all sections before filing the ticket.', { color: 'red', emoji: '🐛' }),
      b('heading2', 'Summary'),
      b('paragraph', 'One-line description of the bug.'),
      b('heading2', 'Environment'),
      b('paragraph', 'OS / Browser / Version:'),
      b('heading2', 'Steps to reproduce'),
      b('numbered', 'Step 1'),
      b('numbered', 'Step 2'),
      b('numbered', 'Step 3'),
      b('heading2', 'Expected behaviour'),
      b('paragraph', ''),
      b('heading2', 'Actual behaviour'),
      b('paragraph', ''),
      b('heading2', 'Screenshots / Logs'),
      b('paragraph', ''),
    ],
  },
];
