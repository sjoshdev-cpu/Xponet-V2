/**
 * Xponet Design System — single source of truth for visual tokens.
 * Import from here instead of hardcoding classes across files.
 */

// ─── Spacing ─────────────────────────────────────────────────────────────────
// Standard page header bar (icon + title + breadcrumbs + actions)
export const PAGE_HEADER_H       = 'h-[52px]';
// Horizontal padding used by every top-level page
export const PAGE_PX             = 'px-6';
// Vertical padding for the main content area
export const PAGE_PY             = 'py-8';
// Max-width for standard (non-full-width) content
export const CONTENT_MAX_W       = 'max-w-[900px]';

// ─── Typography ──────────────────────────────────────────────────────────────
export const HEADING_1 = 'text-2xl font-bold tracking-tight';
export const HEADING_2 = 'text-lg font-semibold';
export const LABEL_SM  = 'text-xs font-semibold uppercase tracking-wider text-muted-foreground';

// ─── Callout colours ─────────────────────────────────────────────────────────
// Used by BlockRenderer + SlashMenu previews + any inline callout UI.
// Each entry is a single Tailwind cn()-compatible string.
export const CALLOUT_COLORS = {
  blue:   'bg-blue-50   border-blue-200   dark:bg-blue-950/30   dark:border-blue-800   text-blue-900   dark:text-blue-100',
  yellow: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800 text-yellow-900 dark:text-yellow-100',
  red:    'bg-red-50    border-red-200    dark:bg-red-950/30    dark:border-red-800    text-red-900    dark:text-red-100',
  green:  'bg-green-50  border-green-200  dark:bg-green-950/30  dark:border-green-800  text-green-900  dark:text-green-100',
  purple: 'bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800 text-purple-900 dark:text-purple-100',
  gray:   'bg-muted     border-border     text-foreground',
  orange: 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800 text-orange-900 dark:text-orange-100',
};

// ─── Preset workspace icons ───────────────────────────────────────────────────
// Consistent icons used on the Templates gallery, Quick-add menus, and onboarding.
export const WORKSPACE_PRESETS = [
  { id: 'crm',       icon: '👥', label: 'CRM',            color: 'text-blue-600',   bg: 'bg-blue-50   dark:bg-blue-950/30' },
  { id: 'tasks',     icon: '✅', label: 'Task Tracker',   color: 'text-green-600',  bg: 'bg-green-50  dark:bg-green-950/30' },
  { id: 'bugs',      icon: '🐛', label: 'Bug Tracker',    color: 'text-red-600',    bg: 'bg-red-50    dark:bg-red-950/30' },
  { id: 'knowledge', icon: '📚', label: 'Knowledge Base', color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30' },
  { id: 'project',   icon: '📊', label: 'Project',        color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/30' },
  { id: 'meeting',   icon: '🗓️', label: 'Meetings',       color: 'text-teal-600',   bg: 'bg-teal-50   dark:bg-teal-950/30' },
  { id: 'wiki',      icon: '📖', label: 'Wiki',           color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
  { id: 'sop',       icon: '📋', label: 'SOPs',           color: 'text-gray-600',   bg: 'bg-gray-50   dark:bg-gray-900/50' },
  { id: 'hr',        icon: '🤝', label: 'HR & Hiring',    color: 'text-pink-600',   bg: 'bg-pink-50   dark:bg-pink-950/30' },
  { id: 'finance',   icon: '💰', label: 'Finance',        color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-950/30' },
];

// ─── Status badges (task / ticket) ───────────────────────────────────────────
export const STATUS_COLORS = {
  'To Do':       'bg-muted text-muted-foreground',
  'In Progress': 'bg-blue-100   text-blue-700   dark:bg-blue-950/50  dark:text-blue-300',
  'In Review':   'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300',
  'Blocked':     'bg-red-100    text-red-700    dark:bg-red-950/50   dark:text-red-300',
  'Done':        'bg-green-100  text-green-700  dark:bg-green-950/50 dark:text-green-300',
};

// ─── Priority badges ─────────────────────────────────────────────────────────
export const PRIORITY_COLORS = {
  'Low':      'bg-muted text-muted-foreground',
  'Medium':   'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-300',
  'High':     'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
  'Critical': 'bg-red-100    text-red-700    dark:bg-red-950/50   dark:text-red-300',
};
