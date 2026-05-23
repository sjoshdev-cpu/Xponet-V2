# Xponet – Codebase Documentation

> Last updated: May 21, 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Repository Structure](#3-repository-structure)
4. [Entry Points](#4-entry-points)
5. [Backend / API](#5-backend--api)
6. [Authentication](#6-authentication)
7. [Global State – WorkspaceContext](#7-global-state--workspacecontext)
8. [Data Model (Entities)](#8-data-model-entities)
9. [Pages (Routes)](#9-pages-routes)
10. [Layout Components](#10-layout-components)
11. [Editor Components](#11-editor-components)
12. [Task Components](#12-task-components)
13. [Shared / Auth UI Components](#13-shared--auth-ui-components)
14. [Styling](#14-styling)
15. [Utilities & Helpers](#15-utilities--helpers)
16. [Build Configuration](#16-build-configuration)
17. [Key Data Flows](#17-key-data-flows)
18. [Route Map](#18-route-map)

---

## 1. Project Overview

**Xponet** is a Notion-style collaborative workspace application built with React + Vite. Core capabilities:

- Create and edit rich-text pages using a block-based editor
- Organise pages in an unlimited-depth hierarchy
- Manage tasks in Kanban or table views
- Leave threaded comments with `@mention` notifications
- Share individual pages publicly (with optional password)
- Multi-organisation (workspace) support with member roles
- Light / Dark / System theme

The backend is entirely provided by **Base44** – a BaaS platform that handles authentication, a document database, and serverless functions. No custom server code exists in this repo.

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Build tool | Vite | ^8.0 |
| UI framework | React | ^19 |
| Routing | React Router DOM | ^7 |
| Server state | TanStack React Query | ^5 |
| Styling | Tailwind CSS | ^3.4 |
| UI primitives | Radix UI (via shadcn/ui) | various |
| Icons | Lucide React | ^1.16 |
| Drag & Drop | @hello-pangea/dnd | ^18 |
| Toasts | Sonner | ^2 |
| Date utilities | date-fns | ^4 |
| Command palette | cmdk | ^1 |
| Backend / Auth / DB | Base44 SDK (`@base44/sdk`) | ^0.8 |

---

## 3. Repository Structure

```
xponet-base44/
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── src/
    ├── App.jsx                      # Root component + router
    ├── main.jsx                     # ReactDOM.createRoot entry
    ├── index.css                    # Tailwind directives + CSS variables
    ├── api/
    │   └── base44Client.js          # Base44 SDK singleton
    ├── lib/
    │   ├── AuthContext.jsx          # Auth state provider + useAuth()
    │   ├── app-params.js            # Runtime config (env / URL / localStorage)
    │   ├── query-client.js          # TanStack QueryClient instance
    │   ├── utils.js                 # cn() helper, isIframe
    │   ├── utils.ts                 # Typed version of cn()
    │   └── PageNotFound.jsx         # 404 page
    ├── contexts/
    │   └── WorkspaceContext.jsx     # Org, user, theme, sidebar state
    ├── hooks/
    │   └── use-mobile.jsx           # useIsMobile() hook
    ├── utils/
    │   └── index.ts                 # createPageUrl() helper
    ├── entities/                    # JSON schemas for Base44 entities
    │   ├── Page.json
    │   ├── Task.json
    │   ├── Comment.json
    │   ├── Notification.json
    │   └── Organization.json
    ├── components/
    │   ├── AuthLayout.jsx           # Centered card shell for auth pages
    │   ├── GoogleIcon.jsx           # Google "G" SVG logo
    │   ├── ProtectedRoute.jsx       # Auth guard (renders Outlet or redirect)
    │   ├── UserNotRegisteredError.jsx
    │   ├── layout/
    │   │   ├── WorkspaceLayout.jsx  # App shell (sidebar + outlet)
    │   │   ├── Sidebar.jsx          # Left nav + page tree
    │   │   └── CommandPalette.jsx   # Cmd+K search modal
    │   ├── editor/
    │   │   ├── BlockRenderer.jsx    # Renders one block (16 types)
    │   │   ├── SlashMenu.jsx        # "/" command dropdown
    │   │   ├── FloatingToolbar.jsx  # Text-selection format toolbar
    │   │   ├── CoverImage.jsx       # Page cover (gradients / URL)
    │   │   └── EmojiPicker.jsx      # Emoji selector popover
    │   ├── page/
    │   │   └── CommentsSection.jsx  # Threaded comments + @mentions
    │   ├── tasks/
    │   │   ├── KanbanBoard.jsx      # Drag-and-drop status columns
    │   │   ├── TaskCard.jsx         # Compact task card
    │   │   ├── TaskModal.jsx        # Create / edit task dialog
    │   │   └── TaskTable.jsx        # Sortable task table
    │   └── ui/                      # shadcn/ui primitives (button, dialog, etc.)
    └── pages/
        ├── Login.jsx
        ├── Register.jsx
        ├── ForgotPassword.jsx
        ├── ResetPassword.jsx
        ├── Home.jsx
        ├── PageEditor.jsx           # Main rich-text editor page
        ├── Tasks.jsx
        ├── Inbox.jsx
        ├── Trash.jsx
        ├── Settings.jsx
        ├── Templates.jsx
        └── SharedPage.jsx           # Public page viewer
```

---

## 4. Entry Points

### `src/main.jsx`
Standard React 19 bootstrap. Mounts `<App />` into `#root` and imports `index.css`.

### `src/App.jsx`
The root component. Provider nesting order:

```
AuthProvider
  └── QueryClientProvider
        └── BrowserRouter
              └── AuthenticatedApp
                    └── Routes
```

`AuthenticatedApp` reads `useAuth()` and:
- Renders a fullscreen spinner while `isLoadingAuth || isLoadingPublicSettings`
- Renders `<UserNotRegisteredError>` on `authError.type === 'user_not_registered'`
- Calls `navigateToLogin()` on `auth_required`
- Otherwise renders the full route tree

Protected routes use `WorkspaceWrapper` which composes `WorkspaceProvider` → `WorkspaceLayout`.

---

## 5. Backend / API

### `src/api/base44Client.js`

Exports a single `base44` client created with `createClient()` from `@base44/sdk`. All config values come from `appParams`.

Key methods used across the app:

| Method | Purpose |
|---|---|
| `base44.auth.me()` | Returns the authenticated user object |
| `base44.auth.logout(redirectUrl?)` | Logs out and optionally redirects |
| `base44.auth.redirectToLogin(returnUrl)` | Redirects to Base44 login |
| `base44.entities.Page.filter(query)` | Query pages |
| `base44.entities.Page.create(data)` | Create a page |
| `base44.entities.Page.update(id, data)` | Update a page |
| `base44.entities.Page.delete(id)` | Hard-delete a page |
| *(same pattern for Task, Comment, Notification, Organization)* | |

### `src/lib/app-params.js`

Reads runtime config in priority order:

```
URL query param  →  localStorage (cached)  →  .env variable  →  null
```

Keys are stored in `localStorage` with a `base44_` prefix. Special behaviour:

- `?clear_access_token=true` wipes the stored token and redirects cleanly
- `?access_token=...` is consumed and removed from the URL (via `history.replaceState`)

**Environment variables:**

| Variable | Purpose |
|---|---|
| `VITE_BASE44_APP_ID` | Identifies which Base44 app to connect to |
| `VITE_BASE44_FUNCTIONS_VERSION` | Serverless functions version |
| `VITE_BASE44_APP_BASE_URL` | Base URL for the Base44 app |

---

## 6. Authentication

### `src/lib/AuthContext.jsx`

`AuthProvider` wraps the entire app. On mount it runs `checkAppState()`:

1. **Fetch public settings** – `GET /api/apps/public/prod/public-settings/by-id/{appId}` to verify the app is reachable.
2. **Check user** – if `appParams.token` is present, calls `base44.auth.me()` to hydrate `user`.
3. **Error classification** – 403 responses are classified into typed errors:
   - `auth_required` – user is not logged in
   - `user_not_registered` – logged in but not enrolled in this app
   - `unknown` – any other failure

**Exposed via `useAuth()`:**

| Value | Type | Description |
|---|---|---|
| `user` | object or null | Authenticated user from Base44 |
| `isAuthenticated` | boolean | |
| `isLoadingAuth` | boolean | Auth check in progress |
| `isLoadingPublicSettings` | boolean | App settings check in progress |
| `authError` | `{type, message}` or null | Typed error |
| `appPublicSettings` | object or null | Base44 app metadata |
| `authChecked` | boolean | Auth check has completed at least once |
| `logout(redirect?)` | function | Clears user state |
| `navigateToLogin()` | function | Redirects to Base44 login |
| `checkUserAuth()` | function | Re-runs auth check |
| `checkAppState()` | function | Re-runs full app state check |

### `src/components/ProtectedRoute.jsx`

Renders `<Outlet />` when `isAuthenticated`, renders `unauthenticatedElement` otherwise. Shows `<UserNotRegisteredError>` for that specific error type.

---

## 7. Global State – WorkspaceContext

### `src/contexts/WorkspaceContext.jsx`

Manages everything below the auth layer. Accessible via `useWorkspace()`.

**Initialisation flow (`initWorkspace`):**

```
base44.auth.me()
  → Organization.filter({})               get all orgs
  → filter to orgs user owns / is member of
  → if none found:
      create default org
      create "Getting Started" page (onboarding blocks)
      create "Quick Note" page (blank)
  → restore last-used org from localStorage
  → setLoading(false)
```

**Exposed values:**

| Value | Description |
|---|---|
| `user` | Current Base44 user |
| `currentOrg` | Active organisation object |
| `orgs` | All orgs the user belongs to |
| `loading` | Workspace init in progress |
| `sidebarOpen` / `setSidebarOpen` | Sidebar visibility |
| `theme` | `'light'`, `'dark'`, or `'system'` |
| `setTheme(t)` | Persists to localStorage + toggles `.dark` on `<html>` |
| `switchOrg(org)` | Changes active org, persists to localStorage |
| `refreshOrgs()` | Re-fetches org list |
| `initWorkspace()` | Re-runs full init |

**Theme logic:**

- `'dark'` → adds `.dark` to `document.documentElement`
- `'light'` → removes `.dark`
- `'system'` → reads `window.matchMedia('(prefers-color-scheme: dark)')`, listens for changes

---

## 8. Data Model (Entities)

All entities are defined as JSON schemas in `src/entities/`. The Base44 SDK generates CRUD from these at runtime.

### Page (`src/entities/Page.json`)

The central entity. Represents a document, database, or template.

| Field | Type | Notes |
|---|---|---|
| `title` | string | **Required** |
| `org_id` | string | **Required** – workspace scope |
| `icon` | string | Emoji character |
| `cover_url` | string | Gradient name or image URL |
| `content` | string | JSON-serialised block array |
| `parent_id` | string | Enables nested page hierarchy |
| `is_database` | boolean | Enables database view |
| `database_preset` | enum | `knowledge_base`, `project_tracker`, `meeting_notes`, `crm`, `bug_tracker`, `content_calendar`, `tasks`, `custom` |
| `is_shared` | boolean | Public sharing enabled |
| `share_token` | string | URL token for public access |
| `share_password` | string | Optional password gate |
| `is_favorite` | boolean | Starred in Home dashboard |
| `is_deleted` | boolean | Soft-delete flag |
| `deleted_at` | datetime | ISO 8601 deletion timestamp |
| `is_template` | boolean | Listed on Templates page |
| `template_name` | string | Display name in template gallery |
| `is_locked` | boolean | Prevents editing |
| `is_full_width` | boolean | Full-width layout toggle |
| `font_style` | `sans`, `serif`, or `mono` | Per-page font family |
| `permissions` | array | `[{ email, role: owner/editor/viewer }]` |
| `last_visited_by` | array | `[{ email, timestamp }]` |

### Task (`src/entities/Task.json`)

| Field | Type | Notes |
|---|---|---|
| `title` | string | **Required** |
| `org_id` | string | **Required** |
| `description` | string | |
| `status` | enum | `Backlog`, `To Do`, `In Progress`, `In Review`, `Done` |
| `priority` | enum | `Low`, `Medium`, `High`, `Urgent` |
| `assignee_email` | string | |
| `assignee_name` | string | |
| `due_date` | date | ISO 8601 date |
| `effort` | enum | `XS`, `S`, `M`, `L`, `XL` |

### Comment (`src/entities/Comment.json`)

| Field | Type | Notes |
|---|---|---|
| `page_id` | string | **Required** |
| `org_id` | string | **Required** |
| `content` | string | **Required** – raw text; `@email` mentions parsed client-side |
| `parent_comment_id` | string | Threading – reply to another comment |
| `author_name` | string | |
| `author_email` | string | |
| `is_resolved` | boolean | |

### Notification (`src/entities/Notification.json`)

| Field | Type | Notes |
|---|---|---|
| `recipient_email` | string | **Required** |
| `type` | enum | `mention`, `task_assigned`, `page_shared`, `comment_reply`, `invited` |
| `title` | string | **Required** |
| `body` | string | |
| `page_id` | string | |
| `org_id` | string | **Required** |
| `is_read` | boolean | Default `false` |
| `sender_email` / `sender_name` | string | |

### Organization (`src/entities/Organization.json`)

| Field | Type | Notes |
|---|---|---|
| `name` | string | **Required** |
| `owner_email` | string | **Required** |
| `icon` | string | Emoji |
| `members` | array | `[{ email, role: admin/member, full_name }]` |

---

## 9. Pages (Routes)

### `src/pages/Login.jsx`
Email + password sign-in form plus a "Continue with Google" OAuth button. Calls `base44.auth` methods. Wrapped in `<AuthLayout>`.

### `src/pages/Register.jsx`
Two-step registration:
1. Email, password, full name
2. OTP verification code (sent by Base44 to the provided email)

On success, redirects to `/`.

### `src/pages/ForgotPassword.jsx`
Single-field form. Submits the email address to trigger a Base44 password reset email.

### `src/pages/ResetPassword.jsx`
Reads a `token` query parameter from the URL. Lets the user set a new password with confirmation. Token is validated server-side by Base44.

### `src/pages/Home.jsx`
Dashboard landing page. Sections:
- Personalised greeting (Good morning / afternoon / evening based on local time)
- Quick-action buttons: New Page, Tasks, Templates, Settings
- **Favourites** – pages where `is_favorite: true`
- **Recent** – pages sorted by latest `last_visited_by` entry

### `src/pages/PageEditor.jsx` (~550 lines)
The main editing experience.

| Feature | Implementation detail |
|---|---|
| Cover image | `<CoverImage>` – 12 gradient presets or a custom image URL |
| Page icon | `<EmojiPicker>` popover triggered by clicking the icon |
| Breadcrumbs | Traverses `parent_id` chain upward through the loaded page list |
| Full-width toggle | Stored in `page.is_full_width`; toggles `max-w-3xl` constraint |
| Font toggle | Stored in `page.font_style`; passed as prop to each `<BlockRenderer>` |
| Lock page | Stored in `page.is_locked`; disables all `contentEditable` blocks |
| Share page | Dialog toggles `is_shared`, generates `share_token`, optional password |
| Block editor | Array of block objects, each rendered by `<BlockRenderer>` |
| Slash menu | Typing `/` triggers `<SlashMenu>` at the cursor position |
| Floating toolbar | Text selection triggers `<FloatingToolbar>` |
| Auto-save | 500 ms debounce → `useMutation` → `Page.update(id, { content })` |
| Comments | `<CommentsSection pageId orgId>` docked below the content area |
| Visit tracking | Updates `last_visited_by` on mount |

### `src/pages/Tasks.jsx`
Fetches all tasks for `currentOrg`. Three tab views:

| Tab | Component |
|---|---|
| Board | `<KanbanBoard>` – drag-and-drop columns per status value |
| Table | `<TaskTable>` – sortable and filterable rows |
| My Tasks | `<TaskTable>` filtered to `assignee_email === user.email` |

New Task button opens `<TaskModal>`.

### `src/pages/Inbox.jsx`
Fetches all `Notification` records for `user.email`. Filter tabs: All, Mentions, Comments, Assignments. "Mark all read" bulk action. Clicking a notification navigates to its linked page.

### `src/pages/Trash.jsx`
Lists pages where `is_deleted: true`. Per-item actions:
- **Restore** – `Page.update(id, { is_deleted: false })`
- **Delete Forever** – `Page.delete(id)` (hard delete, not recoverable)

### `src/pages/Templates.jsx`
6 built-in template definitions with pre-populated block content:
- Meeting Notes
- Project Brief
- Weekly Update
- Decision Log
- Bug Report
- Retrospective

"Use Template" creates a new `Page` from the template's block array and navigates to it.

### `src/pages/Settings.jsx`
Three tabs:

| Tab | Content |
|---|---|
| Account | Display name, email (read-only), Logout button |
| Workspace | Org name + icon editor, member list, invite by email, role toggle, remove member |
| Appearance | Light / Dark / System theme radio buttons |

### `src/pages/SharedPage.jsx`
Public-facing read-only page viewer. Reads `:token` URL param, queries `Page.filter({ share_token: token })`. If `share_password` is set, shows a password input gate before rendering block content.

---

## 10. Layout Components

### `src/components/layout/WorkspaceLayout.jsx`
The authenticated app shell:
- Detects mobile breakpoint (< 768 px): collapses sidebar, shows hamburger button
- Mobile: renders a dim overlay when sidebar is open; tapping overlay closes sidebar
- Desktop: sidebar and main content sit side-by-side in a flex row (`h-screen overflow-hidden`)
- Hosts `<CommandPalette>` opened by `Cmd+K` / `Ctrl+K`

### `src/components/layout/Sidebar.jsx` (~320 lines)
Left navigation panel (260 px wide). Sections top to bottom:

1. **Workspace header** – org icon + name (links to `/settings`), collapse button
2. **Search** – opens CommandPalette; shows keyboard shortcut hint
3. **Nav links** – Home, Inbox (with unread count badge), Tasks, Templates, Trash (with count badge)
4. **Private pages** – collapsible section; pages created by the current user, not shared, with no parent
5. **Shared pages** – collapsible section; pages with `is_shared: true` and no parent
6. **New Page** button (bottom)
7. **Settings** link (bottom)

`PageTreeItem` – recursive component for the page tree:
- Expand/collapse children button (shows when the page has children)
- Link navigates to `/page/:id`
- Hover reveals a More menu (Delete, Duplicate) and a + subpage button
- Indented by `8 + level * 16` pixels

### `src/components/layout/CommandPalette.jsx`
Full-screen modal search using `cmdk`. Queries all pages in the current org, filters by title in real time. Selecting a result navigates to `/page/:id` and closes the palette.

---

## 11. Editor Components

### `src/components/editor/BlockRenderer.jsx`

Renders a single block. Each block has the shape:

```json
{
  "id": "unique-string",
  "type": "paragraph",
  "content": "text content"
}
```

**Supported block types:**

| Type | Rendered as |
|---|---|
| `paragraph` | Editable `div` |
| `heading1` | `text-3xl font-bold` editable div |
| `heading2` | `text-2xl font-semibold` editable div |
| `heading3` | `text-xl font-semibold` editable div |
| `bullet` | Dot bullet + editable text |
| `numbered` | Number label + editable text (`block.number` tracks position) |
| `todo` | Checkbox + editable text; toggling `checked` fires `onChange` |
| `quote` | Left border + italic editable text |
| `code` | Dark monospace block |
| `divider` | `<hr>` separator |
| `callout` | Colored card with emoji picker + 6 color options |
| `toggle` | Collapsible section; renders nested `children` blocks recursively |
| `image` | URL input + `<img>` + editable caption |
| `table` | Editable rows/columns grid |
| `columns` | Two-column flex layout |
| `math` | Math expression placeholder block |
| `embed` | `<iframe>` with URL input |

Each block shows a drag handle (`GripVertical`) and delete button on hover.

**`EditableText` (internal component):**
A `contentEditable` `div` or inline element that:
- Syncs `innerText` from React state only on first render (avoids cursor-jump on re-render)
- Fires `onChange(text)` on every `input` event
- Suppresses `Enter` creating a `<br>` for block-level tags (new block handled at editor level)

### `src/components/editor/SlashMenu.jsx`
Appears when `/` is typed at the start of or inside an empty block. Lists all 16 block types with icon, label, and description. Keyboard navigable (ArrowUp / ArrowDown / Enter / Escape). Selecting an option calls `onSelect(type)`, which the editor uses to transform or insert the block.

### `src/components/editor/FloatingToolbar.jsx`
Anchored above the current text selection. Buttons:

| Button | Action |
|---|---|
| Bold / Italic / Underline / Strikethrough / Code | `document.execCommand` |
| Text color | 8 color swatches |
| Highlight | 6 background color swatches |
| Link | Prompts for URL, wraps selection in `<a>` |

### `src/components/editor/CoverImage.jsx`
Renders the full-width page header cover area. Two modes:
- **Gradient** – 12 named presets: Dawn, Ocean, Forest, Sunset, etc.
- **URL** – text input for a custom image URL

Visibility is hover-triggered. Fires `onChange(value)` where value is a gradient name or URL string.

### `src/components/editor/EmojiPicker.jsx`
Popover with ~100 common emojis. Fires `onSelect(emoji)`. Used for page icon (left of page title) and callout block emoji.

---

## 12. Task Components

### `src/components/tasks/KanbanBoard.jsx`
Uses `@hello-pangea/dnd`. One `Droppable` column per status value (`Backlog`, `To Do`, `In Progress`, `In Review`, `Done`). Dragging a `TaskCard` between columns fires `onTaskUpdate({ status: destinationColumnId })`.

### `src/components/tasks/TaskCard.jsx`
Compact card showing:
- Task title
- Priority badge (colour-coded: Urgent = red, High = orange, Medium = blue, Low = gray)
- Assignee initials avatar
- Due date label

Clicking a card opens `<TaskModal>` in edit mode.

### `src/components/tasks/TaskModal.jsx`
A `<Dialog>` with a full task editing form. Fields:
- Title (text input)
- Description (textarea)
- Status (Select)
- Priority (Select)
- Assignee email + name (text inputs)
- Due date (date input)
- Effort (Select)

Supports both create and update modes via `onSave` prop.

### `src/components/tasks/TaskTable.jsx`
Tabular view. Columns: Title, Status, Priority, Assignee, Due Date, Effort. Features:
- Click any row → opens `TaskModal` in edit mode
- Sortable column headers (click to sort asc/desc)
- Checkbox per row for multi-select
- Bulk delete action on selected tasks

---

## 13. Shared / Auth UI Components

### `src/components/AuthLayout.jsx`
Centered card layout wrapper for all auth pages. Props:

| Prop | Type | Purpose |
|---|---|---|
| `icon` | Lucide icon component | Rendered in a colored badge above the title |
| `title` | string | Main heading |
| `subtitle` | string | Muted subheading |
| `footer` | ReactNode | Small text below the card (e.g. "Already have an account?") |
| `children` | ReactNode | Form content |

### `src/components/GoogleIcon.jsx`
Inline SVG of the Google "G" multi-colour logo. Accepts a `className` prop (default `w-5 h-5`).

### `src/components/ProtectedRoute.jsx`
Auth guard for protected routes.

| Auth state | Renders |
|---|---|
| `isLoadingAuth` or `!authChecked` | `fallback` prop (default: fullscreen spinner) |
| `authError.type === 'user_not_registered'` | `<UserNotRegisteredError>` |
| `!isAuthenticated` | `unauthenticatedElement` prop (typically `<Navigate to="/login">`) |
| Authenticated | `<Outlet>` |

### `src/components/UserNotRegisteredError.jsx`
Full-page error state shown when a user is authenticated with Base44 but not enrolled in this specific app. Lists three remediation steps and advises contacting the admin.

---

## 14. Styling

### Tailwind Configuration (`tailwind.config.js`)

```js
darkMode: ["class"]   // toggled by adding .dark to <html>
content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"]
plugins: [require("tailwindcss-animate")]
```

All semantic colours use CSS custom properties:

```js
primary:    'hsl(var(--primary))'
background: 'hsl(var(--background))'
// ... all design tokens follow the same pattern
```

Custom tokens defined in `theme.extend`:

| Token group | Examples |
|---|---|
| Border radius | `lg`, `md`, `sm` referencing `--radius` CSS var |
| Sidebar | `sidebar-background`, `sidebar-foreground`, `sidebar-accent`, `sidebar-border` |
| Chart | `chart-1` through `chart-5` |
| Animations | `accordion-down`, `accordion-up` (for Radix Collapsible) |

### CSS Variables (`src/index.css`)

Google Fonts imported: **Inter** (sans-serif weights 300–700) and **JetBrains Mono** (400, 500).

All design tokens defined as HSL values:
- `:root { ... }` – light mode defaults
- `.dark { ... }` – dark mode overrides

Key variables include:
```css
--background, --foreground
--card, --card-foreground
--primary, --primary-foreground
--muted, --muted-foreground
--border, --input, --ring
--radius
--font-sans, --font-serif, --font-mono
--sidebar-background, --sidebar-foreground, --sidebar-accent ...
```

The `empty-placeholder::before` pseudo-element provides grey placeholder text in `contentEditable` blocks when they are empty.

### PostCSS (`postcss.config.js`)
```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} }
}
```

---

## 15. Utilities & Helpers

| File | Export | Description |
|---|---|---|
| `src/lib/utils.js` | `cn(...inputs)` | `clsx` + `tailwind-merge` class merger; also exports `isIframe` boolean |
| `src/lib/utils.ts` | `cn(...inputs)` | Typed version of the above |
| `src/lib/query-client.js` | `queryClientInstance` | Shared `QueryClient`; `refetchOnWindowFocus: false`, `retry: 1` |
| `src/hooks/use-mobile.jsx` | `useIsMobile()` | Returns `true` if `window.innerWidth < 768`; reactive via `matchMedia` |
| `src/utils/index.ts` | `createPageUrl(name)` | Converts a page name to a URL path slug |
| `src/lib/PageNotFound.jsx` | default component | 404 UI; shows an admin-only hint if the authenticated user has role `admin` |

---

## 16. Build Configuration

### `vite.config.js`

```js
plugins: [react()]                     // @vitejs/plugin-react
resolve.alias: { '@': path.resolve(__dirname, './src') }  // @/... import alias
```

### `package.json` Scripts

| Script | Command | Purpose |
|---|---|---|
| `dev` | `vite` | Start dev server at localhost:5173 |
| `build` | `vite build` | Production bundle output to `dist/` |
| `preview` | `vite preview` | Serve the production build locally |
| `lint` | `eslint .` | Run ESLint across the project |

---

## 17. Key Data Flows

### Page Save (Auto-save)

```
User types in a block
  → BlockRenderer fires onChange(updatedBlock)
  → PageEditor replaces block in blocks array (React state)
  → useEffect detects blocks change → clears previous debounce timer
  → after 500 ms delay: useMutation fires
  → base44.entities.Page.update(id, {
        content:      JSON.stringify(blocks),
        title:        currentTitle,
        icon:         currentIcon,
        cover_url:    currentCover,
        is_full_width, font_style
    })
```

### Comment Submission with @mention Notifications

```
User types and submits comment in CommentsSection
  → extractMentions(text) returns array of @email addresses found in text
  → Comment.create({
        page_id, org_id, content,
        author_name, author_email,
        parent_comment_id  (if reply)
    })
  → for each mentioned email:
        Notification.create({
            recipient_email: mentionedEmail,
            type: 'mention',
            title: `${authorName} mentioned you`,
            body: text,
            page_id, org_id
        })
  → queryClient.invalidateQueries(['comments', pageId])
```

### First-Login Workspace Creation

```
WorkspaceContext.initWorkspace()
  → base44.auth.me()  →  user object
  → Organization.filter({})  →  filter to user's orgs (owner or member)
  → if orgs.length === 0:
        Organization.create({
            name: "<user>'s Workspace",
            icon: '🏠',
            owner_email: user.email,
            members: [{ email, role: 'admin', full_name }]
        })
        Page.create("Getting Started with Xponet")   // callout + todo blocks
        Page.create("Quick Note")                     // blank paragraph
  → setCurrentOrg(lastSavedOrgId || firstOrg)
  → setLoading(false)
```

### Theme Toggle

```
User selects theme in Settings  →  WorkspaceContext.setTheme(value)
  → localStorage.setItem('xponet-theme', value)
  → 'dark'   →  document.documentElement.classList.add('dark')
  → 'light'  →  classList.remove('dark')
  → 'system' →  check matchMedia('prefers-color-scheme: dark'), add/remove .dark
                 add event listener to react to OS-level changes
  → Tailwind dark: variants activate or deactivate across all components
```

### Sidebar Page Tree Rendering

```
Sidebar mounts / currentOrg changes
  → useQuery(['pages', orgId])  →  Page.filter({ org_id: currentOrg.id })
  → activePages  = pages where !is_deleted && !is_template
  → privatePages = activePages where !is_shared && !parent_id && created_by === user.email
  → sharedPages  = activePages where is_shared && !parent_id
  → PageTreeItem renders each top-level page
      → children = activePages where parent_id === page.id  (recursive)
      → toggleOpen state controls whether children are visible
```

### Public Page Viewing

```
User visits /shared/:token
  → SharedPage reads token from useParams()
  → Page.filter({ share_token: token })  →  page object
  → if page.share_password is set:
        show password input form
        on submit: compare entered password client-side
        on match: setUnlocked(true)
  → render page blocks via <BlockRenderer> (read-only, no onChange handlers)
```

---

## 18. Route Map

| Path | Component | Auth Required | Notes |
|---|---|---|---|
| `/login` | `Login` | No | |
| `/register` | `Register` | No | Two-step: form + OTP |
| `/forgot-password` | `ForgotPassword` | No | |
| `/reset-password` | `ResetPassword` | No | Requires `?token=` query param |
| `/shared/:token` | `SharedPage` | No | Public read-only page viewer |
| `/` | `Home` | **Yes** | Dashboard |
| `/page/:pageId` | `PageEditor` | **Yes** | Block-based rich-text editor |
| `/inbox` | `Inbox` | **Yes** | Notification centre |
| `/trash` | `Trash` | **Yes** | Soft-deleted pages |
| `/settings` | `Settings` | **Yes** | Account / workspace / appearance |
| `/templates` | `Templates` | **Yes** | Template gallery |
| `/tasks` | `Tasks` | **Yes** | Task management (Board / Table / My Tasks) |
| `*` | `PageNotFound` | No | 404 fallback |

---

*End of documentation.*
