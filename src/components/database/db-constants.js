// ─── Property type metadata ───────────────────────────────────────────────────
export const PROPERTY_TYPES = {
  title:        { label: 'Title',        icon: 'Type' },
  text:         { label: 'Text',         icon: 'AlignLeft' },
  number:       { label: 'Number',       icon: 'Hash' },
  select:       { label: 'Select',       icon: 'ChevronDown' },
  multi_select: { label: 'Multi-select', icon: 'Tags' },
  status:       { label: 'Status',       icon: 'CircleDot' },
  date:         { label: 'Date',         icon: 'Calendar' },
  person:       { label: 'Person',       icon: 'User' },
  checkbox:     { label: 'Checkbox',     icon: 'CheckSquare2' },
  url:          { label: 'URL',          icon: 'Link' },
  email:        { label: 'Email',        icon: 'Mail' },
  phone:        { label: 'Phone',        icon: 'Phone' },
  relation:     { label: 'Relation',     icon: 'ArrowRightLeft' },
  rollup:       { label: 'Rollup',       icon: 'Sigma' },
  formula:      { label: 'Formula',      icon: 'FunctionSquare' },
};

// ─── Select option colors ──────────────────────────────────────────────────────
export const OPTION_COLORS = ['gray','red','orange','yellow','green','blue','purple','pink','brown','teal','dark','light'];

// ─── 12-swatch color palette (4 × 3 grid) used by the color picker ────────────
export const COLOR_PALETTE = [
  { key: 'gray',   label: 'Gray',   hex: '#6B7280' },
  { key: 'brown',  label: 'Brown',  hex: '#92400E' },
  { key: 'orange', label: 'Orange', hex: '#D97706' },
  { key: 'yellow', label: 'Yellow', hex: '#D69E2E' },
  { key: 'green',  label: 'Green',  hex: '#059669' },
  { key: 'teal',   label: 'Teal',   hex: '#0D9488' },
  { key: 'blue',   label: 'Blue',   hex: '#2563EB' },
  { key: 'purple', label: 'Purple', hex: '#7C3AED' },
  { key: 'pink',   label: 'Pink',   hex: '#DB2777' },
  { key: 'red',    label: 'Red',    hex: '#DC2626' },
  { key: 'dark',   label: 'Dark',   hex: '#1F2937' },
  { key: 'light',  label: 'Light',  hex: '#F3F4F6' },
];

/** Returns the hex string for a color key, or the key itself if already a hex. */
export function colorHex(key) {
  if (!key) return '#6B7280';
  if (key.startsWith('#')) return key;
  return COLOR_PALETTE.find(c => c.key === key)?.hex ?? '#6B7280';
}

export const OPTION_COLORS_HEX = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16'];

export function getOptionBadgeTextClass(color) {
  const hex = colorHex(color);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.65 ? 'text-slate-900' : 'text-white';
}

export function getOptionBadgeClasses(color) {
  return OPTION_COLOR_CLASSES[color] ?? getOptionBadgeTextClass(color);
}

export function getOptionBadgeStyle(color) {
  return OPTION_COLOR_CLASSES[color] ? undefined : { backgroundColor: colorHex(color) };
}

// ─── Default options for newly-created Status properties ──────────────────────
export const DEFAULT_STATUS_OPTIONS = [
  { id: 's_not_started', name: 'Not started', color: 'gray'  },
  { id: 's_in_progress', name: 'In progress', color: 'blue'  },
  { id: 's_done',        name: 'Done',        color: 'green' },
];

export const OPTION_COLOR_CLASSES = {
  gray:   'bg-gray-100   text-gray-700   dark:bg-gray-800   dark:text-gray-300',
  red:    'bg-red-100    text-red-700    dark:bg-red-950/50  dark:text-red-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-300',
  green:  'bg-green-100  text-green-700  dark:bg-green-950/50  dark:text-green-300',
  blue:   'bg-blue-100   text-blue-700   dark:bg-blue-950/50   dark:text-blue-300',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300',
  pink:   'bg-pink-100   text-pink-700   dark:bg-pink-950/50   dark:text-pink-300',
  brown:  'bg-amber-100  text-amber-900  dark:bg-amber-950/50  dark:text-amber-200',
  teal:   'bg-teal-100   text-teal-700   dark:bg-teal-950/50   dark:text-teal-300',
  dark:   'bg-gray-800   text-gray-100   dark:bg-gray-900      dark:text-gray-200',
  light:  'bg-gray-50    text-gray-600   border border-gray-200 dark:bg-gray-700 dark:text-gray-200',
};

// ─── Database presets ──────────────────────────────────────────────────────────
export const DB_PRESETS = {
  blank: {
    name: 'Untitled Database',
    icon: '📋',
    schema: [{ id: 'title', name: 'Name', type: 'title' }],
  },
  crm: {
    name: 'CRM',
    icon: '👥',
    schema: [
      { id: 'title',        name: 'Name',         type: 'title' },
      { id: 'company',      name: 'Company',       type: 'text' },
      { id: 'status',       name: 'Status',        type: 'select', options: [
        { id: 'lead',      label: 'Lead',      color: 'blue' },
        { id: 'prospect',  label: 'Prospect',  color: 'yellow' },
        { id: 'customer',  label: 'Customer',  color: 'green' },
        { id: 'churned',   label: 'Churned',   color: 'red' },
      ]},
      { id: 'email',        name: 'Email',         type: 'email' },
      { id: 'last_contact', name: 'Last Contact',  type: 'date' },
    ],
  },
  tasks: {
    name: 'Tasks',
    icon: '✅',
    schema: [
      { id: 'title',    name: 'Name',     type: 'title' },
      { id: 'status',   name: 'Status',   type: 'status', options: [
        { id: 'not_started', label: 'Not started', color: 'gray' },
        { id: 'in_progress', label: 'In progress', color: 'blue' },
        { id: 'done',        label: 'Done',        color: 'green' },
      ]},
      { id: 'priority', name: 'Priority', type: 'select', options: [
        { id: 'low',    label: 'Low',    color: 'gray' },
        { id: 'medium', label: 'Medium', color: 'yellow' },
        { id: 'high',   label: 'High',   color: 'orange' },
        { id: 'urgent', label: 'Urgent', color: 'red' },
      ]},
      { id: 'due_date', name: 'Due date', type: 'date' },
      { id: 'assignee', name: 'Assignee', type: 'person' },
    ],
  },
  bug_tracker: {
    name: 'Bug Tracker',
    icon: '🐛',
    schema: [
      { id: 'title',    name: 'Title',       type: 'title' },
      { id: 'status',   name: 'Status',      type: 'status', options: [
        { id: 'open',        label: 'Open',        color: 'red' },
        { id: 'in_progress', label: 'In progress', color: 'blue' },
        { id: 'resolved',    label: 'Resolved',    color: 'green' },
        { id: 'closed',      label: 'Closed',      color: 'gray' },
      ]},
      { id: 'priority', name: 'Priority',    type: 'select', options: [
        { id: 'low',      label: 'Low',      color: 'gray' },
        { id: 'medium',   label: 'Medium',   color: 'yellow' },
        { id: 'high',     label: 'High',     color: 'orange' },
        { id: 'critical', label: 'Critical', color: 'red' },
      ]},
      { id: 'reporter', name: 'Reported by', type: 'person' },
      { id: 'created',  name: 'Created',     type: 'date' },
    ],
  },
  knowledge_base: {
    name: 'Knowledge Base',
    icon: '📚',
    schema: [
      { id: 'title',    name: 'Title',          type: 'title' },
      { id: 'category', name: 'Category',        type: 'select', options: [
        { id: 'guide',     label: 'Guide',     color: 'blue' },
        { id: 'reference', label: 'Reference', color: 'purple' },
        { id: 'tutorial',  label: 'Tutorial',  color: 'green' },
        { id: 'faq',       label: 'FAQ',        color: 'yellow' },
      ]},
      { id: 'author',   name: 'Author',          type: 'person' },
      { id: 'status',   name: 'Status',          type: 'status', options: [
        { id: 'draft',     label: 'Draft',      color: 'gray' },
        { id: 'review',    label: 'In review',  color: 'yellow' },
        { id: 'published', label: 'Published',  color: 'green' },
      ]},
      { id: 'pub_date', name: 'Published date',  type: 'date' },
    ],
  },
};

// ─── Filter operators by property type ────────────────────────────────────────
export const FILTER_OPS_FOR = {
  title:        ['contains', 'not_contains', 'equals', 'not_equals', 'is_empty', 'is_not_empty'],
  text:         ['contains', 'not_contains', 'equals', 'not_equals', 'is_empty', 'is_not_empty'],
  number:       ['equals', 'not_equals', 'greater', 'less', 'gte', 'lte', 'is_empty', 'is_not_empty'],
  select:       ['equals', 'not_equals', 'is_empty', 'is_not_empty'],
  multi_select: ['contains', 'not_contains', 'is_empty', 'is_not_empty'],
  status:       ['equals', 'not_equals', 'is_empty', 'is_not_empty'],
  date:         ['equals', 'before', 'after', 'is_empty', 'is_not_empty'],
  checkbox:     ['is_checked', 'is_not_checked'],
  person:       ['equals', 'is_empty', 'is_not_empty'],
  relation:     ['is_not_empty', 'is_empty'],
  email:        ['contains', 'equals', 'is_empty', 'is_not_empty'],
  url:          ['contains', 'equals', 'is_empty', 'is_not_empty'],
  phone:        ['contains', 'equals', 'is_empty', 'is_not_empty'],
};

export const OP_LABELS = {
  contains:      'contains',
  not_contains:  "doesn't contain",
  equals:        'is',
  not_equals:    'is not',
  greater:       '>',
  less:          '<',
  gte:           '≥',
  lte:           '≤',
  is_empty:      'is empty',
  is_not_empty:  'is not empty',
  before:        'before',
  after:         'after',
  is_checked:    'is checked',
  is_not_checked:'is not checked',
};

export const ROLLUP_FUNS = ['count', 'count_values', 'sum', 'avg', 'min', 'max', 'percent_checked'];

export const VIEW_TYPES = [
  { type: 'table',   label: 'Table',   icon: 'Table2' },
  { type: 'board',   label: 'Board',   icon: 'Columns3' },
  { type: 'list',    label: 'List',    icon: 'List' },
  { type: 'gallery', label: 'Gallery', icon: 'LayoutGrid' },
];
