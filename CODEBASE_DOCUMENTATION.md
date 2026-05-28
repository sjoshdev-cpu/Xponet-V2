# Xponet – Codebase Documentation

> Last updated: May 28, 2026 (post-session: column management, shared DB components, pageRouter)

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
14. [File Upload System](#14-file-upload-system)
15. [Design System](#15-design-system)
16. [Styling](#16-styling)
17. [Utilities & Helpers](#17-utilities--helpers)
18. [Build & Deployment Configuration](#18-build--deployment-configuration)
19. [Environment Variables](#19-environment-variables)
20. [Firestore Security Rules](#20-firestore-security-rules)
21. [Key Data Flows](#21-key-data-flows)
22. [Route Map](#22-route-map)
23. [Document Hub Feature](#23-document-hub-feature)

---

## 1. Project Overview

**Xponet** is a Notion-style collaborative workspace application built with React + Vite. Core capabilities:

- Create and edit rich-text pages using a block-based editor
- Organise pages in an unlimited-depth hierarchy
- Manage tasks in Kanban or table views
- Leave threaded comments with `@mention` notifications
- Share individual pages publicly (with optional password)
- Multi-organisation (workspace) support with member roles
- Upload and attach files (images, PDFs, documents) via Cloudinary
- Light / Dark / System theme

The backend is provided by **Firebase** (Auth + Firestore) and **Cloudinary** (file uploads). No custom server code exists in this repo. The app is deployed to **Firebase Hosting** at https://xponet-f6f56.web.app.

Core capabilities:

- Create and edit rich-text pages using a block-based editor
- Organise pages in an unlimited-depth hierarchy
- Manage tasks in Kanban or table views
- **Support tickets** with SLA tracking, escalation workflow, and Linear-style UX
- **Command Center** real-time ops console with KPI tiles and live queues
- Leave threaded comments with `@mention` notifications
- Share individual pages publicly (with optional password)
- Peek panel — open any page in a slide-in panel without losing the current context
- Multi-organisation (workspace) support with member roles
- Upload and attach files (images, PDFs, documents) via Cloudinary
- Light / Dark / System theme

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Build tool | Vite | ^8.0 |
| UI framework | React | ^19 |
| Routing | React Router DOM | ^7 |
| Server state | TanStack React Query | ^5 |
| Virtualisation | @tanstack/react-virtual | ^3 |
| Styling | Tailwind CSS | ^3.4 |
| UI primitives | Radix UI (via shadcn/ui) | various |
| Icons | Lucide React | ^1.16 |
| Drag & Drop | @hello-pangea/dnd | ^18 |
| Toasts | Sonner | ^2 |
| Date utilities | date-fns | ^4 |
| Command palette | cmdk | ^1 |
| Auth | Firebase Auth | ^11 |
| Database | Firebase Firestore | ^11 |
| Hosting | Firebase Hosting | — |
| File uploads | Cloudinary (unsigned upload) | REST API |

---

## 3. Repository Structure

```
xponet-base44/
├── index.html
├── vite.config.js              # cssMinify: false (LightningCSS workaround)
├── firebase.json               # Hosting: public=dist, SPA rewrites
├── firestore.rules
├── .firebaserc                 # Project alias → xponet-f6f56
├── .env                        # Firebase + Cloudinary env vars
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── src/
    ├── App.jsx                      # Root component + router
    ├── main.jsx                     # ReactDOM.createRoot entry
    ├── index.css                    # Tailwind directives + CSS variables
    ├── api/
    │   ├── firestoreClient.js       # Firestore entity factory (Page, Task, Database, etc.) + withLastEditedBy helper
    │   ├── seedDocumentHub.js       # Idempotent Document Hub seeding (DB, views, sample records)
    │   └── base44Client.js          # Legacy Base44 SDK client (unused)
    ├── lib/
    │   ├── firebase.js              # Firebase app init; exports auth, db, storage
    │   ├── cloudinary.js            # Cloudinary upload utility
    │   ├── AuthContext.jsx          # Auth state provider + useAuth()
    │   ├── app-params.js            # Runtime config (env / URL / localStorage)
    │   ├── query-client.js          # TanStack QueryClient instance
    │   ├── pageRouter.js            # Smart page-to-route resolver (getPageRoute)
    │   ├── utils.js                 # cn() helper, isIframe
    │   ├── utils.ts                 # Typed version of cn()
    │   └── PageNotFound.jsx         # 404 page
    ├── contexts/
    │   ├── WorkspaceContext.jsx     # Org, user, theme, sidebar state
    │   └── PeekContext.jsx          # Peek panel state (peekPageId, openPeek, closePeek)
    ├── hooks/
    │   ├── use-mobile.jsx           # useIsMobile() hook
    │   └── usePresence.js           # Firebase Realtime presence tracking
    ├── utils/
    │   └── index.ts                 # createPageUrl() helper
    ├── entities/                    # JSON schemas for entity shapes
    │   ├── Page.json
    │   ├── Task.json
    │   ├── Comment.json
    │   ├── Notification.json
    │   ├── Organization.json
    │   ├── Ticket.json              # Support ticket entity (F26)
    │   ├── Database.json            # Document Hub database entity
    │   ├── Record.json              # Document Hub database record
    │   └── View.json                # Document Hub saved view
    ├── components/
    │   ├── AuthLayout.jsx           # Centered card shell for auth pages
    │   ├── GoogleIcon.jsx           # Google "G" SVG logo
    │   ├── ProtectedRoute.jsx       # Auth guard (renders Outlet or redirect)
    │   ├── UserNotRegisteredError.jsx
    │   ├── database/
    │   │   ├── AddPropertyModal.jsx        # Shared "Add a property" dialog (Databases + DocumentHub)
    │   │   ├── ColumnHeaderDropdown.jsx    # Shared column-header hover dropdown (Sort/Hide/Delete)
    │   │   ├── CustomizeDatabaseSheet.jsx  # Right-side sheet: toggle column visibility per view
    │   │   ├── DatabaseTable.jsx           # Generic reusable database table view
    │   │   ├── DatabaseBoard.jsx           # Kanban board view for databases
    │   │   ├── DatabaseGallery.jsx         # Gallery/card view for databases
    │   │   ├── DatabaseList.jsx            # List view for databases
    │   │   ├── FilterSortBar.jsx           # Filter + sort controls bar
    │   │   ├── PropertyEditor.jsx          # Property value editor
    │   │   ├── RecordModal.jsx             # Full record detail modal
    │   │   ├── CellEditor.jsx              # Inline cell editor
    │   │   ├── CellRenderer.jsx            # Cell display renderer
    │   │   ├── LinkedDatabaseBlock.jsx     # Embeddable database block
    │   │   ├── db-constants.js             # Database type/property constants
    │   │   └── db-utils.js                 # Database utility helpers
    │   ├── layout/
    │   │   ├── WorkspaceLayout.jsx  # App shell (sidebar + outlet)
    │   │   ├── Sidebar.jsx          # Left nav + page tree (virtualised)
    │   │   ├── CommandPalette.jsx   # Cmd+K search modal
    │   │   └── PageHeader.jsx       # Shared page-level header bar (F23)
    │   ├── editor/
    │   │   ├── BlockRenderer.jsx    # Renders one block (16 types)
    │   │   ├── SlashMenu.jsx        # "/" command dropdown
    │   │   ├── FloatingToolbar.jsx  # Text-selection format toolbar
    │   │   ├── CoverImage.jsx       # Page cover (gradients / URL)
    │   │   └── EmojiPicker.jsx      # Emoji selector popover
    │   ├── page/
    │   │   ├── CommentsSection.jsx  # Threaded comments + @mentions
    │   │   └── PeekPanel.jsx        # Slide-in page peek panel (F24)
    │   ├── tasks/
    │   │   ├── KanbanBoard.jsx      # Drag-and-drop status columns
    │   │   ├── TaskCard.jsx         # Compact task card
    │   │   ├── TaskModal.jsx        # Create / edit task dialog
    │   │   └── TaskTable.jsx        # Sortable task table (virtualised)
    │   └── ui/
    │       ├── FileUploadButton.jsx # Cloudinary upload button component
    │       ├── UploadedFilePreview.jsx  # File preview card (image/doc)
    │       └── …                   # shadcn/ui primitives (button, dialog, etc.)
    └── pages/
        ├── Login.jsx
        ├── Register.jsx
        ├── ForgotPassword.jsx
        ├── ResetPassword.jsx
        ├── Home.jsx
        ├── PageEditor.jsx           # Main rich-text editor page (with file uploads)
        ├── Tasks.jsx
        ├── Inbox.jsx
        ├── Trash.jsx
        ├── Settings.jsx
        ├── Templates.jsx
        ├── SharedPage.jsx           # Public page viewer
        ├── Tickets.jsx              # Support tickets list (F26)
        ├── TicketDetail.jsx         # Full-page ticket detail (F26)
        ├── CommandCenter.jsx        # Real-time ops dashboard (F27)
        └── DocumentHub.jsx          # Notion-style document database hub (F28)
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

### `src/lib/firebase.js`

Initialises the Firebase app from environment variables and exports three service singletons:

| Export | Type | Purpose |
|---|---|---|
| `auth` | `Auth` | Firebase Authentication instance |
| `db` | `Firestore` | Firestore database instance (named `"xponet"`) |
| `storage` | `Storage` | Firebase Storage instance (requires Blaze plan to activate) |

### `src/api/firestoreClient.js`

A `makeEntity(collectionName)` factory that generates a uniform CRUD interface for each Firestore collection. All entities share the same five methods:

| Method | Signature | Description |
|---|---|---|
| `filter` | `(queryObj?)` | Converts `{ key: value }` pairs into Firestore `where()` clauses; returns `[{ id, ...data }]` |
| `get` | `(id)` | Fetches a single document by ID; returns `{ id, ...data }` or `null` |
| `create` | `(data)` | Adds a document with `created_at` and `updated_at` server timestamps |
| `update` | `(id, data)` | Merges fields and refreshes `updated_at` |
| `delete` | `(id)` | Hard-deletes the document |

Firestore `Timestamp` fields are automatically converted to JS `Date` objects via `convertTimestamps()`.

**Exported entities:**

```js
export const Page           = makeEntity('pages');
export const Task           = makeEntity('tasks');
export const Comment        = makeEntity('comments');
export const Notification   = makeEntity('notifications');
export const Organization   = makeEntity('organizations');
export const Ticket         = makeEntity('tickets');
export const Database       = makeEntity('databases');       // Document Hub database
export const DatabaseRecord = makeEntity('records');          // Document Hub record row
export const DatabaseView   = makeEntity('db_views');         // Document Hub saved view
```

**`withLastEditedBy(payload, user)`** helper:

```js
export function withLastEditedBy(payload, user) {
  return {
    ...payload,
    last_edited_by_email: user?.email || '',
    last_edited_by_name:  user?.full_name || user?.email || '',
  };
}
```

Used to stamp authorship on every `Page.create()` / `Page.update()` call site across the app. Applied in `PageEditor`, `Sidebar`, `WorkspaceLayout`, `PeekPanel`, `Databases`, `Templates`, `UseTemplateDialog`, and `SaveAsTemplateDialog`.

### `src/api/seedDocumentHub.js`

Idempotent seeding module for the Document Hub feature. All functions are safe to call multiple times; they short-circuit if data already exists.

| Export | Signature | Description |
|---|---|---|
| `findDocumentHub(orgId)` | `(orgId) → DB \| null` | Returns the existing Document Hub DB record or null |
| `seedHubViews(dbId, orgId, userEmail)` | async | Creates 3 default views if none exist for this DB |
| `seedHubRecords(dbId, orgId, userEmail)` | async | Creates 3 sample records + pages if none exist |
| `seedDocumentHub(orgId, userEmail)` | async | Full idempotent seed: DB → views → records. No-op if DB already exists |
| `deleteSampleData(orgId)` | async | Deletes all records + pages where `is_sample: true` for this org |

**Database schema (`DB_SCHEMA` property definitions):**

| Key | Type | Options |
|---|---|---|
| `title` | `title` | — |
| `category` | `select` | `strategy doc`, `proposal`, `customer research` |
| `reviewers` | `people` | — |
| `created_time` | `created_time` | — |
| `created_by` | `created_by` | — |
| `last_edited_time` | `last_edited_time` | — |
| `last_edited_by` | `last_edited_by` | — |

**Default visible columns:** `['category','created_by','created_time','last_edited_by','last_edited_time']` — `reviewers` is off by default.

**Three seeded views:**

| Name | Filters | Sort | Group By |
|---|---|---|---|
| All Docs | none | `last_edited_time` desc | — |
| My Docs | `created_by` eq `userEmail` | `last_edited_time` desc | — |
| By Category | none | `category` asc | `category` |

### `src/api/base44Client.js`

Legacy file from the original Base44 backend integration. Currently unused — retained for reference only.

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
Firebase auth.currentUser
  → Organization.filter({})               get all orgs
  → filter to orgs user owns / is member of
  → if none found:
      create default org
      create "Getting Started" page (onboarding blocks)
      create "Quick Note" page (blank)
  → restore last-used org from localStorage
  → seedDocumentHub(activeOrg.id, firebaseUser.email)   ← idempotent; no-op if already seeded
  → setLoading(false)
```

**Exposed values:**

| Value | Description |
|---|---|
| `user` | Current Firebase user |
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

### `src/contexts/PeekContext.jsx` (F24)

Manages the Peek panel state. Accessible via `usePeek()`.

| Value | Type | Description |
|---|---|---|
| `peekPageId` | string or null | ID of the page currently open in the peek panel |
| `openPeek(pageId)` | function | Sets `peekPageId`; renders `<PeekPanel>` at the app root |
| `closePeek()` | function | Sets `peekPageId` to null; hides the panel |

`PeekProvider` is mounted inside `WorkspaceWrapper` in `App.jsx`, wrapping all authenticated pages. `<PeekPanel>` is rendered at the root level so it can slide over any page without being clipped.

---

## 8. Data Model (Entities)

All entities are defined as JSON schemas in `src/entities/` and mapped to Firestore collections by `firestoreClient.js`. Firestore collection names are the lowercase plural of the entity name (e.g. `pages`, `tasks`, `comments`).

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
| `database_id` | string | ID of the Document Hub DB this page belongs to |
| `record_id` | string | ID of the linked `DatabaseRecord` (set after record creation) |
| `category` | string or null | Document category (`strategy doc`, `proposal`, `customer research`) |
| `reviewers` | array | `[{ email, name }]` — people assigned as reviewers |
| `created_by_email` | string | Author email (write-once) |
| `created_by_name` | string | Author display name (write-once) |
| `last_edited_by_email` | string | Last editor email (stamped by `withLastEditedBy` on every save) |
| `last_edited_by_name` | string | Last editor display name |

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

### Ticket (`src/entities/Ticket.json`)

### Database (`src/entities/Database.json`) — Document Hub

Represents a structured document database (Notion-style).

| Field | Type | Notes |
|---|---|---|
| `name` | string | **Required** — e.g. `"Document Hub"` |
| `org_id` | string | **Required** — workspace scope |
| `schema` | array | Property definitions: `[{ key, type, options? }]` |
| `created_by_email` | string | |

### Record (`src/entities/Record.json`) — Document Hub

One row in a Document Hub database. Linked 1-to-1 with a `Page`.

| Field | Type | Notes |
|---|---|---|
| `database_id` | string | **Required** — parent DB |
| `page_id` | string | **Required** — linked page |
| `org_id` | string | **Required** |
| `properties` | object | `{ title, category, reviewers, … }` — mirrors page fields |
| `is_sample` | boolean | `true` for seeded demo records; used by "Delete sample pages" |
| `created_by_email` / `created_by_name` | string | Write-once author |
| `last_edited_by_email` / `last_edited_by_name` | string | Updated on every page save |

### View (`src/entities/View.json`) — Document Hub

A named, saved configuration for displaying a Document Hub database.

| Field | Type | Notes |
|---|---|---|
| `database_id` | string | **Required** — parent DB |
| `org_id` | string | **Required** |
| `name` | string | Display name (e.g. `"All Docs"`, `"My Docs"`, `"By Category"`) |
| `order` | number | Tab ordering (0, 1, 2) |
| `filters` | array | `[{ propertyKey, operator, value }]` |
| `sorts` | array | `[{ propertyKey, direction: 'asc'\|'desc' }]` |
| `groupBy` | object or null | `{ propertyKey }` — enables grouped section view |
| `visibleColumns` | array | `string[]` of property keys visible in this view |

---

### Ticket (`src/entities/Ticket.json`)

Support ticket entity introduced in F26.

| Field | Type | Notes |
|---|---|---|
| `title` | string | **Required** |
| `org_id` | string | **Required** |
| `description` | string | |
| `status` | enum | `Open`, `In Progress`, `Waiting on Client`, `Resolved`, `Closed` |
| `severity` | enum | `Low`, `Medium`, `High`, `Critical` |
| `sla_tier` | enum | `Standard` (72 h), `Priority` (24 h), `Emergency` (4 h) |
| `sla_due_at` | string | ISO 8601; computed client-side on creation from `sla_tier` |
| `assigned_to` | string | Assignee email |
| `assigned_to_name` | string | Assignee display name |
| `client_name` | string | Name of the client / customer |
| `escalated` | boolean | Whether the ticket is currently escalated |
| `escalated_at` | string | ISO 8601 timestamp of escalation |
| `escalated_to` | string | Email of the escalation target |
| `escalated_to_name` | string | Display name of the escalation target |
| `escalation_reason` | string | Free-text reason for escalation |
| `linked_sop_id` | string | ID of a linked SOP page |
| `linked_page_id` | string | ID of a linked page |
| `linked_page_title` | string | Title of the linked page |
| `linked_tasks` | array | Array of Task IDs linked to this ticket |
| `tags` | array | String tags |
| `activity` | array | `[{ type, note, by_email, by_name, at }]` — append-only audit log |
| `created_by_email` | string | |
| `created_by_name` | string | |

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

### `src/pages/PageEditor.jsx` (~570 lines)
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
| File upload | `<FileUploadButton>` in toolbar (hidden when locked); uploads go to Cloudinary `xponet/pages/` folder |
| Attachments panel | `attachments` state; uploaded files shown as `<UploadedFilePreview>` cards below the editor; images also auto-inserted as image blocks |
| Comments | `<CommentsSection pageId orgId>` docked below attachments |
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

Uses `<PageHeader icon="⚙️" title="Settings" />` for the consistent top bar.

### `src/pages/SharedPage.jsx`
Public-facing read-only page viewer. Reads `:token` URL param, queries `Page.filter({ share_token: token })`. If `share_password` is set, shows a password input gate before rendering block content.

### `src/pages/Tickets.jsx` (F26)

Linear-style support tickets list. Entry point to the ticket management module.

**View tabs:** All · Open · In Progress · Waiting on Client · Escalated · At Risk · Breached · Resolved

**SLA constants:**
```js
SLA_TIERS = { Standard: 72, Priority: 24, Emergency: 4 }  // hours
```

**`slaStatus(ticket)`** → `'breached' | 'at_risk' | 'ok' | null`
- `breached` — `sla_due_at` is in the past
- `at_risk` — time remaining ≤ 25 % of the SLA window

**Key sub-components:**

| Component | Description |
|---|---|
| `NewTicketModal` | Dialog to create a ticket; fields: title, description, severity, SLA tier, assignee (from org members), client name; auto-computes `sla_due_at`; writes initial `activity` entry |
| `TicketRow` | Table row with severity badge, status badge, SLA timer; quick-escalate action; colored row background for breached / at-risk tickets |
| `SlaTimer` | Countdown display relative to `sla_due_at` |
| `SeverityBadge` | Color-coded severity pill (Low / Medium / High / Critical) |
| `StatusBadge` | Status pill |

**Sort order:** escalated + breached tickets first, then `created_at` descending.

**Keyboard shortcuts:** `n` = open New Ticket modal · `/` = focus search input.

### `src/pages/TicketDetail.jsx` (F26)

Full-page detail view for a single ticket.

**Layout:**
- Top bar: back button → `/tickets`, inline status select, Escalate button, Resolve button
- Left body (main): 4 tabs
- Right sidebar (256 px): assignee select, severity select, SLA block, client, created-by + date

**Tabs:**

| Tab | Content |
|---|---|
| Overview | Description, client name, tags, add-note text area |
| Activity | `ActivityLog` sorted descending; each entry has type icon, note, author, relative time |
| Linked Tasks | Renders task rows for each ID in `ticket.linked_tasks` |
| Linked SOPs | Renders linked page card via `ticket.linked_page_id` |

**Sub-components:**

| Component | Description |
|---|---|
| `EscalationBanner` | Yellow banner shown when `ticket.escalated === true`; shows escalatee, time, reason, de-escalate link |
| `EscalateModal` | Dialog to select a team member + enter a reason; calls `Ticket.update` with escalation fields + appends activity entry |
| `SlaBlock` | Color-coded SLA summary in the right sidebar (breached = red, at risk = orange, ok = green) |

All updates via `useMutation` append to the `ticket.activity` array.

### `src/pages/CommandCenter.jsx` (F27)

### `src/pages/DocumentHub.jsx` (F28)

Notion-style collaborative document database. Entry point to the Document Hub feature.

**Layout:** Full-height flex column — toolbar row → scrollable records table → sticky "Get started" footer bar.

**Three view tabs** (persisted as `DatabaseView` records):

| Tab | Behaviour |
|---|---|
| All Docs | All records, sorted by `last_edited_time` desc |
| My Docs | Filtered to records where `created_by_email === currentUser.email` |
| By Category | Grouped by `category` with collapsible `GroupSection` rows |

**Seeding on mount:** Three `useQuery` hooks each carry a safety-net seed call:
- DB query → if DB missing, calls `seedDocumentHub(orgId, user?.email)` then re-fetches
- Records query → if empty, calls `seedHubRecords(dbId, orgId, user?.email)` then re-fetches
- Views query → if empty, calls `seedHubViews(dbId, orgId, user?.email)` then re-fetches

All three queries are gated with `enabled: !!orgId` / `enabled: !!dbId` to prevent premature Firestore calls.

**Inline new-document row ("New" button):**

Clicking **New** appends a `PendingRow` to the table in place. The user types a title and commits with Enter/Tab (or cancels with Escape). On commit:
1. `Page.create(…)` — `title`, `org_id`, `database_id`, `record_id:null`, `category:null`, `reviewers:[]`, `is_deleted:false`, `is_template:false`, full `created_by_*` / `last_edited_by_*` fields
2. `DatabaseRecord.create(…)` — `database_id`, `page_id`, `org_id`, `properties:{title,category:null,reviewers:[]}`, authorship fields
3. `Page.update(page.id, { record_id: record.id })` — back-link
4. Query invalidated; the pending row disappears and the real record renders in its place.

The title cell in the committed row is a `<Link to="/page/:id">` with an `ExternalLink` icon that appears on hover.

**Interactive cells (inline editing):**

| Component | Column | Mechanism |
|---|---|---|
| `CategoryCell` | `category` | Popover with 3 options + "None"; optimistic `DatabaseRecord.update` |
| `ReviewersCell` | `reviewers` | Popover multi-select from `orgMembers`; avatar stack capped at 3 shown |
| `PropertyCell` | all others | Read-only display; timestamps use `format(date, 'MMM d, yyyy h:mm a')` |

**Grouping (By Category view):** `groupedData` is a `Map<string, record[]>` built client-side. Each group renders as a `GroupSection` — collapsible chevron row with colored pill + count badge.

**"Customize" sheet:** Opens `<CustomizeDatabaseSheet>` which lets users toggle column visibility per view. Changes persist to `DatabaseView.visibleColumns` via optimistic mutation.

**Column management:**

| Action | Mechanism |
|---|---|
| Add property | `+` button in table `<thead>` opens `<AddPropertyModal>`; on confirm, writes new field to `Database.schema` and appends the key to every view's `visibleColumns` |
| Hide property | `ColumnHeaderDropdown` → "Hide property"; removes key from the active view's `visibleColumns` only (schema unchanged) |
| Delete property | `ColumnHeaderDropdown` → "Delete"; removes field from `Database.schema` and from every view's `visibleColumns`. Structural columns (`title`, `category`, `reviewers`, `created_time`, `created_by`, `last_edited_time`, `last_edited_by`) are non-deletable — dropdown omits the delete item for them |
| Sort by column | `ColumnHeaderDropdown` → "Sort ascending" / "Sort descending"; writes `[{ propertyKey, direction }]` to `activeView.sorts` via `DatabaseView.update` |

All column mutations use `useMutation` with `queryClient.invalidateQueries` on success.

**"Get started" footer bar (sticky, bottom):**

| Button | Behaviour |
|---|---|
| Delete sample pages | Calls `deleteSampleData(orgId)`; disabled when no `is_sample` records remain |
| Tour | Opens Tour `<Dialog>` explaining the three views, creating docs, and customising columns |
| Customize | Opens `CustomizeDatabaseSheet` |

**`src/components/database/CustomizeDatabaseSheet.jsx`**

Right-side `<Sheet>` for toggling per-view column visibility.

- Title: "Customize Document Hub" — Subtitle: "Select features to turn on or off"
- "Doc name" row shown as always-on with a disabled `<Switch>`
- Toggleable properties (in order): Created time, Category, Last edited by, Last updated time, Reviewers
- Toggle fires `DatabaseView.update(viewId, { visibleColumns })` with full optimistic UI (cancel, snapshot, update, rollback, invalidate)
- Footer: "Changes are saved automatically per view."

**PageEditor autosave → record sync:**

Whenever `saveMutation` fires with `'content' in data` and `page.record_id` is set:
```js
await DatabaseRecord.update(page.record_id, {
  'properties.title': data.title ?? page?.title ?? '',  // dot-notation merge
  last_edited_by_email: ...,
  last_edited_by_name: ...,
});
```
This keeps the Document Hub table title and last-edited columns in sync as the user types.

**Data sources:**
- `useQuery(['tickets', orgId])` → all org tickets
- `useQuery(['tasks', orgId])` → all org tasks

**Computed stats (via `useMemo`):**

| Stat | Derivation |
|---|---|
| `openTickets` | Tickets with status not `Resolved` or `Closed` |
| `breached` | Tickets where `slaStatus() === 'breached'` |
| `escalated` | Tickets where `escalated === true` |
| `atRisk` | Tickets where `slaStatus() === 'at_risk'` |
| `overdueTasks` | Tasks with `status !== 'Done'` and `due_date < today` |
| `avgSev` | Average `SEVERITY_WEIGHT` score across open tickets (1–4 scale) |
| `recentActivity` | All ticket activity entries from the last 7 days, sorted descending |

**Layout sections:**

1. **Alert banners** — `CalloutBanner` in danger (breached) or warning (escalated) variant
2. **KPI tiles** (6, responsive grid) — each links to the relevant filtered view
3. **Live Queues** (two-column) — At Risk / Breached · Escalations
4. **Secondary Queues** (two-column) — Overdue Tasks · Recent Activity (last 7 days)

**Key sub-components:** `KpiTile`, `TicketQueueRow`, `TaskQueueRow`, `QueueCard`, `CalloutBanner`

---

## 10. Layout Components

### `src/components/layout/WorkspaceLayout.jsx`
The authenticated app shell:
- Detects mobile breakpoint (< 768 px): collapses sidebar, shows hamburger button
- Mobile: renders a dim overlay when sidebar is open; tapping overlay closes sidebar
- Desktop: sidebar and main content sit side-by-side in a flex row (`h-screen overflow-hidden`)
- Hosts `<CommandPalette>` opened by `Cmd+K` / `Ctrl+K`

### `src/components/layout/PageHeader.jsx` (F23)

Shared top-bar component used by all main pages to establish a consistent visual identity.

| Prop | Type | Description |
|---|---|---|
| `icon` | string | Emoji rendered left of the title |
| `title` | string | Page heading |
| `badge` | ReactNode | Optional badge element appended to the title (e.g., overdue count) |
| `actions` | ReactNode | Right-aligned action slot (buttons, inputs, etc.) |
| `breadcrumbs` | array | `[{ label, href? }]` rendered with `ChevronRight` separators |
| `saveStatus` | `'saving'` or `'saved'` | Shows a `Loader2` or `Check` icon |
| `className` | string | Additional Tailwind classes |

Fixed height: `52px`. Renders `border-b border-border`.

### `src/components/layout/Sidebar.jsx` (~350 lines)
Left navigation panel (260 px wide). Sections top to bottom:

1. **Workspace header** – org icon + name (links to `/settings`), collapse button
2. **Search** – opens CommandPalette; shows keyboard shortcut hint
3. **Nav links** – Home, Inbox (with unread count badge), Tasks, Templates, Trash (with count badge), **Tickets**, **Command Center**, **Document Hub**
4. **Private pages** – collapsible section; pages created by the current user, not shared, with no parent
5. **Shared pages** – collapsible section; pages with `is_shared: true` and no parent
6. **New Page** button (bottom)
7. **Settings** link (bottom)

**Virtualisation (F22):** The page tree is fully virtualised using `@tanstack/react-virtual`. A flat list of `PageRow` items is built by walking the page tree in order (respecting expand state); `useVirtualizer` renders only visible rows. Expand state is tracked in a `Set<string>` at the Sidebar level to survive re-renders.

`PageRow` – the virtualised row component for a single page item:
- Expand/collapse children button (shows when the page has children)
- Link navigates to `/page/:id`
- Hover reveals a More menu (Delete, Duplicate) and a + subpage button
- **Peek button** (`PanelRightOpen` icon) — calls `openPeek(page.id)` from `PeekContext`
- Indented by `8 + level * 16` pixels

### `src/components/layout/CommandPalette.jsx`
Full-screen modal search using `cmdk`. Queries all pages in the current org, filters by title in real time. Selecting a result navigates to `/page/:id` and closes the palette.

### `src/components/page/PeekPanel.jsx` (F24)

Slide-in panel that opens a page in a preview pane without navigating away.

**Trigger:** `openPeek(pageId)` from `usePeek()`. Called from the Sidebar hover action.

**Layout:**
- Fixed right panel, 520 px wide (`max-w-[90vw]`)
- Enters / exits with CSS `transform: translateX(...)` transition
- Semi-transparent backdrop with `backdrop-blur-[1px]` — clicking it calls `closePeek()`
- Escape key also closes the panel

**Panel header:**
- Close (`X`) button
- External link button → `closePeek()` + navigate to `/page/:id` (full editor)
- Read / Edit toggle

**Panel body:**
- **Edit mode:** `EmojiPicker` icon, editable title `<input>`, last-edited hint, `BlockRenderer` components for each block
- **Read mode:** icon, `<h1>` title, `BlockRenderer` (read-only)
- Auto-save: `_.debounce(800 ms)` saves title, icon, and serialised `content` via `Page.update()`
- "Open full page" CTA button at the bottom of the content area

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
- **Virtualisation (F22):** uses `@tanstack/react-virtual` to render only visible rows via an overridden `display: block` tbody; each `<tr>` uses `display: table` with explicit column widths for correct alignment.

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

## 14. File Upload System

File uploads are handled entirely via **Cloudinary** on the free Spark tier (25 GB storage, 25 GB bandwidth/month, no credit card required). Firebase Storage is configured in code but unavailable on the Firebase free plan.

### `src/lib/cloudinary.js`

Central upload utility. All Cloudinary credentials come from environment variables.

**`uploadToCloudinary(file, folder?)`**

- POSTs a `FormData` request to `https://api.cloudinary.com/v1_1/{cloudName}/auto/upload`
- Uses unsigned upload with the `xponet_uploads` preset
- Auto-detects resource type (image / video / raw) via the `/auto/upload` endpoint
- Returns:

```js
{
  url: string,           // HTTPS secure URL
  publicId: string,      // Cloudinary public ID
  resourceType: string,  // 'image' | 'video' | 'raw'
  format: string,        // file extension
  bytes: number,         // file size in bytes
  originalFilename: string
}
```

**`getCloudinaryUrl(publicId, { width, height, crop? })`**

Generates a Cloudinary transformation URL (crop, resize). Defaults to `crop: 'fill'`.

---

### `src/components/ui/FileUploadButton.jsx`

Reusable upload trigger button.

| Prop | Type | Default | Description |
|---|---|---|---|
| `onUpload` | `(result) => void` | — | Called with the Cloudinary result object on success |
| `folder` | string | `"xponet"` | Cloudinary folder path |
| `accept` | string | `"image/*,application/pdf,.doc,.docx,.txt"` | MIME type filter for the file picker |
| `label` | string | `"Attach File"` | Button text |
| `variant` | string | `"outline"` | shadcn/ui button variant |
| `size` | string | `"sm"` | shadcn/ui button size |

Behaviour:
- Hidden `<input type="file">` triggered by the button
- 10 MB client-side size guard (shows toast error if exceeded)
- Spinner replaces the paperclip icon during upload
- `toast.success` / `toast.error` from Sonner on completion

---

### `src/components/ui/UploadedFilePreview.jsx`

Renders a single uploaded file as a preview card.

| Prop | Type | Description |
|---|---|---|
| `file` | Cloudinary result object | The upload result from `uploadToCloudinary()` |
| `onRemove` | `(file) => void` | Optional; shows a ✕ button in the top-right corner |

Behaviour:
- **Images** (`resourceType === 'image'`): shows a 64×64 thumbnail
- **Documents**: shows a `FileText` icon placeholder
- Displays filename, file size in KB, and a "Download" link (opens in new tab)

---

### Integration in `PageEditor.jsx`

```
User clicks "Upload" button in toolbar
  → FileUploadButton opens file picker
  → File selected → size check → uploadToCloudinary(file, 'xponet/pages')
  → Cloudinary returns result
  → handleUpload(result):
      setAttachments(prev => [...prev, result])
      if result.resourceType === 'image':
          insert image block { id, type: 'image', url: result.url, content: '' }
          debouncedSave() to persist the new block
  → Attachments panel re-renders with UploadedFilePreview cards
```

---

## 15. Design System

### `src/lib/design-system.js` (F23)

Central design tokens and shared constants consumed across pages and components.

**Spacing tokens:**
```js
PAGE_HEADER_H  = 'h-[52px]'
PAGE_PX        = 'px-6'
PAGE_PY        = 'py-6'
CONTENT_MAX_W  = 'max-w-[700px]'
```

**Typography tokens:**
```js
HEADING_1 = 'text-2xl font-bold tracking-tight'
HEADING_2 = 'text-lg font-semibold'
LABEL_SM  = 'text-xs font-medium text-muted-foreground uppercase tracking-wider'
```

**`CALLOUT_COLORS`** — map of 7 named colors (blue, yellow, red, green, purple, gray, orange) to full Tailwind class strings combining `bg-*`, `border-*`, and `text-*`. Used by `BlockRenderer` for callout blocks.

**`WORKSPACE_PRESETS`** — 10 preset workspace type definitions: `{ id, icon, label, color, bg }`. Used in the org creation flow.

**`STATUS_COLORS`** / **`PRIORITY_COLORS`** — badge class maps for task status and priority values.

---

## 16. Styling

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

## 17. Utilities & Helpers

| File | Export | Description |
|---|---|---|
| `src/lib/utils.js` | `cn(...inputs)` | `clsx` + `tailwind-merge` class merger; also exports `isIframe` boolean |
| `src/lib/utils.ts` | `cn(...inputs)` | Typed version of the above |
| `src/lib/query-client.js` | `queryClientInstance` | Shared `QueryClient`; `refetchOnWindowFocus: false`, `retry: 1` |
| `src/lib/pageRouter.js` | `getPageRoute(page, databases)` | Resolves the correct client-side route for a page. Returns `/document-hub/:dbId` for database containers and their record pages, or `/page/:id` for regular pages. Used in Sidebar, Home, and CommandPalette. |
| `src/hooks/use-mobile.jsx` | `useIsMobile()` | Returns `true` if `window.innerWidth < 768`; reactive via `matchMedia` |
| `src/utils/index.ts` | `createPageUrl(name)` | Converts a page name to a URL path slug |
| `src/lib/PageNotFound.jsx` | default component | 404 UI; shows an admin-only hint if the authenticated user has role `admin` |

---

## 18. Build & Deployment Configuration

### `vite.config.js`

```js
plugins: [react()]                     // @vitejs/plugin-react
resolve.alias: { '@': path.resolve(__dirname, './src') }  // @/... import alias
build.cssMinify: false                 // LightningCSS incompatible with Tailwind v4 --spacing()
```

> **Note:** Vite 8 defaults to LightningCSS for CSS minification, which cannot parse Tailwind v4's `--spacing()` function syntax. Setting `cssMinify: false` bypasses this and is safe for production.

### `firebase.json`

```json
{
  "firestore": { "rules": "firestore.rules" },
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```

- `public: "dist"` — points Firebase Hosting at the Vite build output directory
- SPA rewrite — all routes fall through to `index.html` for client-side routing

### `.firebaserc`

Links this directory to the Firebase project `xponet-f6f56`. Generated by `firebase init`.

### Live URL

**https://xponet-f6f56.web.app**

To rebuild and redeploy:

```bash
npm run build
firebase deploy --only hosting
```

### `package.json` Scripts

| Script | Command | Purpose |
|---|---|---|
| `dev` | `vite` | Start dev server at localhost:5173 |
| `build` | `vite build` | Production bundle output to `dist/` |
| `preview` | `vite preview` | Serve the production build locally |
| `lint` | `eslint .` | Run ESLint across the project |

---

## 19. Environment Variables

All environment variables are defined in `.env` at the project root and accessed via `import.meta.env`.

| Variable | Used by | Purpose |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | `src/lib/firebase.js` | Firebase project API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | `src/lib/firebase.js` | Firebase Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | `src/lib/firebase.js` | Firebase project ID (`xponet-f6f56`) |
| `VITE_FIREBASE_STORAGE_BUCKET` | `src/lib/firebase.js` | Firebase Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `src/lib/firebase.js` | FCM sender ID |
| `VITE_FIREBASE_APP_ID` | `src/lib/firebase.js` | Firebase app ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | `src/lib/firebase.js` | Google Analytics measurement ID |
| `VITE_CLOUDINARY_CLOUD_NAME` | `src/lib/cloudinary.js` | Cloudinary cloud name (`dv6empf1r`) |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | `src/lib/cloudinary.js` | Unsigned upload preset name (`xponet_uploads`) |

---

## 20. Firestore Security Rules

`firestore.rules` was completely rewritten in F25. All rules enforce org-scoped isolation via helper functions; no collection is publicly writable without authentication.

### Helper Functions

| Function | Description |
|---|---|
| `isAuthed()` | `request.auth != null` |
| `myEmail()` | `request.auth.token.email` |
| `isOrgMember(orgId)` | Reads the org document and checks that `myEmail()` is in `memberEmails` array |
| `pageHasNoPerms(data)` | True if the page has no `permissions` array |
| `isPageOwner(data)` | Email appears in `permissions` with `role == 'owner'` |
| `isPageEditor(data)` | Email appears in `permissions` with `role == 'owner'` or `'editor'` |
| `notEscalatingPerms(existingData)` | Prevents a non-owner from upgrading their own permission role |
| `isPubliclyShared(data)` | `data.is_shared == true` |
| `hasString(data, field)` | `field in data && data[field] is string && data[field].size() > 0` |

### Per-Collection Rules Summary

| Collection | Read | Create | Update | Delete |
|---|---|---|---|---|
| `organizations` | org member only | any authed user | member (cannot remove self from `memberEmails`) | `false` |
| `pages` | public share read (no auth) OR org member | org member + valid `org_id` | `isPageEditor` + `notEscalatingPerms` | `isPageOwner` |
| `tasks` | org member | org member + valid `org_id` + `title` | org member | org member |
| `tickets` | org member | org member + valid `org_id` + `title` | org member | org member |
| `comments` | org member | org member + valid fields | author only (`author_email == myEmail()`) | author only |
| `notifications` | recipient only | any authed user | recipient only | recipient only |
| `databases`, `records`, `views` | org member | org member | org member | org member |
| `presence/{userId}` | any authed user | `request.auth.uid == userId` | same uid | same uid |

---

## 21. Key Data Flows

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

### Document Hub Seeding (First Login)

```
WorkspaceContext.initWorkspace()
  → … org resolved …
  → seedDocumentHub(activeOrg.id, firebaseUser.email)
      → Database.filter({ name:'Document Hub', org_id })  → if found: return null (no-op)
      → else: Database.create({ name:'Document Hub', schema: DB_SCHEMA, … })
      → seedHubViews(dbId, orgId, userEmail)
          → DatabaseView.filter({ database_id: dbId })  → if any: return
          → DatabaseView.create x3  (All Docs, My Docs, By Category)
      → seedHubRecords(dbId, orgId, userEmail)
          → DatabaseRecord.filter({ database_id: dbId })  → if any: return
          → Page.create + DatabaseRecord.create x3  (sample docs with is_sample:true)
  → setLoading(false)
```

### Document Hub — New Document

```
User clicks "New" in DocumentHub.jsx
  → createNew mutation
  → Page.create({ title:'Untitled', org_id, database_id, record_id:null,
                  category:null, reviewers:[], is_deleted:false, is_template:false,
                  created_by_email, created_by_name, last_edited_by_* })
  → DatabaseRecord.create({ database_id, page_id:page.id, org_id,
                             properties:{ title:'Untitled', category:null, reviewers:[] },
                             created_by_*, last_edited_by_* })
  → Page.update(page.id, { record_id: record.id })   ← back-link
  → navigate('/page/<page.id>')
```

### Page Title Edit → Record Sync

```
User renames a hub page in PageEditor
  → updateTitle(newTitle) → debouncedSave(data incl. title + content)
  → saveMutation.mutationFn(data)
      → Page.update(pageId, data)
      → if page.record_id && 'content' in data:
            DatabaseRecord.update(page.record_id, {
              'properties.title': data.title,     ← dot-notation Firestore merge
              last_edited_by_email,
              last_edited_by_name
            })
  → DocumentHub table shows updated title on next render
```

### First-Login Workspace Creation

```
WorkspaceContext.initWorkspace()
  → Firebase auth.currentUser  →  user object
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

## 22. Route Map

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
| `/tickets` | `Tickets` | **Yes** | Support ticket list (F26) |
| `/tickets/:ticketId` | `TicketDetail` | **Yes** | Full ticket detail + activity (F26) |
| `/command-center` | `CommandCenter` | **Yes** | Real-time ops dashboard (F27) |
| `/document-hub` | `DocumentHub` | **Yes** | Notion-style document database hub (F28) |
| `/document-hub/:databaseId` | `DocumentHub` | **Yes** | Same component; `:databaseId` used to fetch a specific DB directly (bypasses name lookup) |
| `*` | `PageNotFound` | No | 404 fallback |

---

*End of documentation.*

---

## 23. Document Hub Feature

The Document Hub (F28) is a first-class Notion-style document database embedded into the Xponet workspace. It gives teams a structured home for strategy docs, proposals, and customer research.

### Architecture overview

```
Firestore collections
  databases/   ← one DB per org named "Document Hub"
  records/     ← one record per document (mirrors page fields)
  db_views/    ← saved view configurations (filters, sorts, groupBy, visibleColumns)
  pages/       ← one page per document (rich-text editor content)
```

The DB and views are seeded **idempotently** at login by `WorkspaceContext` via `seedDocumentHub.js`. The `DocumentHub.jsx` page also carries safety-net seed calls in each `useQuery.queryFn` so late arrivals (cold cache) are handled gracefully.

### Data relationships

```
Database (1)
  ├── DatabaseRecord (N)  ──►  Page (1:1, via record.page_id / page.record_id)
  └── DatabaseView (N)    — "All Docs", "My Docs", "By Category"
```

### Key files

| File | Role |
|---|---|
| `src/api/seedDocumentHub.js` | Idempotent seeder: DB, views, sample records |
| `src/api/firestoreClient.js` | `Database`, `DatabaseRecord`, `DatabaseView` entities + `withLastEditedBy` |
| `src/pages/DocumentHub.jsx` | Main page: tabs, table, inline row creation, column management, footer, tour |
| `src/components/database/AddPropertyModal.jsx` | Shared dialog for adding a new property; `COL_TYPES` catalogue exported for reuse |
| `src/components/database/ColumnHeaderDropdown.jsx` | Shared column-header hover dropdown (Sort asc/desc · Hide · Delete) |
| `src/components/database/CustomizeDatabaseSheet.jsx` | Per-view column visibility sheet |
| `src/lib/pageRouter.js` | `getPageRoute(page, databases)` — routes database/record pages to `/document-hub/:id` |
| `src/contexts/WorkspaceContext.jsx` | Calls `seedDocumentHub` on every login |
| `src/pages/PageEditor.jsx` | Syncs `properties.title` + `last_edited_by_*` to record on autosave |

### Shared database components

#### `src/components/database/AddPropertyModal.jsx`

Shared dialog for adding a new property to a database. Used by both `Databases.jsx` and `DocumentHub.jsx`.

**Exports:**
- `COL_TYPES` — named export; array of 12 property type definitions `{ value, label, icon, color }`. Can be imported independently for custom type UIs.
- `AddPropertyModal` — default export; props: `{ open, onClose, onAdd }`.
  - `onAdd` receives `{ id: string, label: string, type: string, options?: string[] }` where `id` is `` `c_${Date.now()}` ``.
  - DocumentHub callers remap `id` → `key` before writing to Firestore schema.
  - Select / multi-select types show an extra "Options" text field (comma-separated).

**Property types catalogue (12 types):**

| value | label | icon |
|---|---|---|
| `text` | Text | AlignLeft |
| `number` | Number | Hash |
| `select` | Select | ToggleLeft |
| `multiselect` | Multi-select | Columns3 |
| `status` | Status | Check |
| `date` | Date | Calendar |
| `person` | Person | User |
| `files` | Files & media | FileText |
| `url` | URL | Link |
| `email` | Email | Mail |
| `phone` | Phone | Phone |
| `checkbox` | Checkbox | Check |

#### `src/components/database/ColumnHeaderDropdown.jsx`

Shared column-header hover dropdown. The trigger button is invisible (`opacity-0`) until the parent `<th>` is hovered — the parent must carry `className="group/th"`.

| Prop | Type | Description |
|---|---|---|
| `onSortAsc` | function (optional) | Sort this column ascending |
| `onSortDesc` | function (optional) | Sort this column descending |
| `onHide` | function (optional) | Hide this column in the active view |
| `onDelete` | function (optional) | Permanently delete this property |

Sections render conditionally: the sort section appears only when at least one sort callback is provided; a separator between Hide and Delete appears only when both are present. The Delete item uses `text-destructive` styling.

### `src/lib/pageRouter.js`

Smart routing helper — resolves the correct client-side route for any page document.

```js
export function getPageRoute(page, databases = []) { … }
```

**Routing rules (in priority order):**

| Condition | Route |
|---|---|
| `page.is_database === true` and matching `Database` record found | `/document-hub/:dbId` |
| `page.is_database === true` but DB not loaded yet | `/document-hub` (fallback) |
| `page.database_id` is set (record inside a database) | `/document-hub/:databaseId` |
| Otherwise | `/page/:id` |

Used in `Sidebar.jsx`, `Home.jsx`, and `CommandPalette.jsx` to ensure clicks on database-linked pages open the Document Hub rather than the generic page editor.

### `withLastEditedBy` adoption

All `Page.create()` and `Page.update()` calls across the codebase wrap their payload with `withLastEditedBy(payload, user)` to ensure `last_edited_by_email` and `last_edited_by_name` are always set. Affected files:

- `PageEditor.jsx` — all save paths (content, icon, share, lock, move, permissions, duplicate)
- `Sidebar.jsx` — delete, duplicate, create child, new page
- `WorkspaceLayout.jsx` — new page from layout button
- `PeekPanel.jsx` — debounced saves
- `Databases.jsx` — database page updates
- `Templates.jsx` — un-template action
- `UseTemplateDialog.jsx` — template instantiation
- `SaveAsTemplateDialog.jsx` — save-as-template action
