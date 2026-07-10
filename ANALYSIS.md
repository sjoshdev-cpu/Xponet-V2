# Xponet – Full Codebase Analysis

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture Overview](#architecture-overview)
3. [Tech Stack](#tech-stack)
4. [Repository Structure](#repository-structure)
5. [Core Modules and Components](#core-modules-and-components)
   - [Entry Points](#entry-points)
   - [Authentication](#authentication)
   - [Global State Management](#global-state-management)
   - [Data Model (Entities)](#data-model-entities)
   - [UI Layout](#ui-layout)
   - [Editor](#editor)
   - [Database / Document Hub](#database-document-hub)
   - [Task Management](#task-management)
   - [Ticketing System](#ticketing-system)
   - [Command Center](#command-center)
6. [Data Flow and State Management](#data-flow-and-state-management)
7. [Security and Permissions](#security-and-permissions)
8. [Performance Considerations](#performance-considerations)
9. [Testing Strategy](#testing-strategy)
10. [Build & Deployment](#build--deployment)
11. [Observability & Error Handling](#observability--error-handling)
12. [Extensibility & Future Work](#extensibility--future-work)
13. [Recommendations](#recommendations)

### 1. Project Overview
Xponet is a Notion‑style collaborative workspace built with **React 19** and **Vite**. It provides rich‑text page editing, hierarchical page organization, task management (Kanban & table), comment threads with @mentions, public page sharing, multi‑organisation support, file uploads via Cloudinary, and a suite of enterprise‑grade features such as role‑based access control (RBAC), multi‑assignee tasks, SLA‑driven support tickets, and a real‑time command‑center dashboard. The backend is serverless, relying on **Firebase Auth**, **Firestore**, and **Firebase Storage** for data persistence and authentication, while **Cloudinary** handles media uploads. The app is deployed on a GCP VM behind **Nginx** with TLS hardening.

### 2. Architecture Overview
The architecture follows a **client‑heavy, serverless** pattern:
- **Frontend**: Single‑page application (SPA) built with React, using React Router for routing, TanStack Query for data fetching/caching, and Tailwind CSS for styling. UI primitives are sourced from **shadcn/ui** (Radix UI) and **Sonner** for toasts.
- **State Management**: Global state is managed via React Contexts (`WorkspaceContext`, `PeekContext`, `AuthContext`). Local component state is handled with React hooks. Server state is cached with TanStack Query.
- **Data Layer**: A thin abstraction (`firestoreClient.js`) provides CRUD factories for each Firestore collection, ensuring a consistent API across entities. The `seedDocumentHub` script seeds initial data for the Document Hub feature.
- **Authentication**: Firebase Auth is wrapped in a custom `AuthContext` that also integrates with a Base44 identity provider for additional app metadata.
- **File Uploads**: Cloudinary unsigned uploads are performed via a utility (`cloudinary.js`) that reads environment variables.
- **Observability**: Sentry is initialized at the entry point (`src/main.jsx`) and error boundaries (`ErrorBoundary.jsx`) wrap critical UI sections.
- **Deployment**: Vite builds the SPA into `dist/`, which is served by Nginx with SPA rewrite rules. TLS is provisioned via a script in `deploy/setup-tls.sh`.

### 3. Tech Stack
| Layer | Technology | Version |
|---|---|---|
| Build tool | Vite | ^8.0 |
| UI framework | React | ^19.2 |
| Routing | React Router DOM | ^7.15 |
| Server state | TanStack React Query | ^5.100 |
| Virtualisation | @tanstack/react-virtual | ^3.13 |
| Styling | Tailwind CSS | ^3.4 |
| UI primitives | Radix UI (shadcn/ui) | ^1.4 |
| Icons | Lucide React | ^1.16 |
| Drag & Drop | @hello-pangea/dnd | ^18.0 |
| Toasts | Sonner | ^2.0 |
| Date utilities | date-fns | ^4.2 |
| Command palette | cmdk | ^1.1 |
| Charts | Recharts | ^3.8 |
| Carousel | Embla Carousel React | ^8.6 |
| Panels | react-resizable-panels | ^4.11 |
| Drawer | Vaul | ^1.1 |
| Auth | Firebase Auth | ^12.13 |
| Database | Firebase Firestore | ^12.13 |
| Storage | Firebase Storage | ^12.13 |
| File uploads | Cloudinary (REST) | – |
| Font | Geist Variable | @fontsource-variable/geist |

### 4. Repository Structure
The repository follows a conventional **src/** layout:
- `src/main.jsx` – React bootstrap, Sentry init.
- `src/App.jsx` – Root component, router, auth guard.
- `src/api/` – Firestore client factory, seeding scripts.
- `src/lib/` – Firebase init, Cloudinary helper, Auth context, query client, utilities.
- `src/contexts/` – Workspace and Peek contexts.
- `src/hooks/` – Custom hooks (mobile detection, presence tracking).
- `src/entities/` – JSON schemas for Firestore collections.
- `src/components/` – UI components grouped by domain (layout, editor, database, tasks, etc.).
- `src/pages/` – Route components (Login, Register, Home, PageEditor, Tasks, Tickets, CommandCenter, DocumentHub, etc.).
- `public/` – Static assets.
- `deploy/` – Nginx config and TLS setup scripts.
- Configuration files (`vite.config.js`, `tailwind.config.js`, `firebase.json`, `.env.example`).

### 5. Core Modules and Components

#### Entry Points
- **`src/main.jsx`**: Initializes Sentry, creates the React root, and renders `<App />`.
- **`src/App.jsx`**: Sets up `AuthProvider`, `QueryClientProvider`, and `BrowserRouter`. Defines route hierarchy with protected routes and error boundaries.

#### Authentication
- **`src/lib/AuthContext.jsx`**: Wraps the app, checks public settings, validates Firebase auth, and classifies auth errors (`auth_required`, `user_not_registered`). Exposes `useAuth()` hook.
- **`src/components/ProtectedRoute.jsx`**: Guard component that renders children only when authenticated.

#### Global State Management
- **`WorkspaceContext.jsx`**: Manages organisation data, current user, theme, sidebar state, and provides helper methods (`switchOrg`, `refreshOrgs`). Handles workspace initialization, including seeding the Document Hub.
- **`PeekContext.jsx`**: Controls the slide‑in peek panel for quick page previews.

#### Data Model (Entities)
JSON schemas in `src/entities/` define the shape of Firestore documents (Page, Task, Comment, Notification, Organization, Ticket, Database, Record, View). The `firestoreClient.js` factory creates a uniform CRUD API for each collection, ensuring consistent timestamp handling and author stamping via `withLastEditedBy`.

#### UI Layout
- **`WorkspaceLayout.jsx`**: Main shell with responsive sidebar, command palette, and content outlet.
- **`Sidebar.jsx`**: Virtualised page tree, navigation links, and quick actions. Supports expand/collapse, peek, and new page creation.
- **`PageHeader.jsx`**: Consistent header across pages with title, icon, breadcrumbs, and save status indicator.
- **`CommandPalette.jsx`**: Global search modal powered by `cmdk`.

#### Editor
- **`PageEditor.jsx`**: Rich‑text block editor with cover image, emoji picker, slash menu, floating toolbar, auto‑save (500 ms debounce), file uploads, comments, and visit tracking. Uses `BlockRenderer.jsx` to render 16 block types.
- **`SlashMenu.jsx`**, **`FloatingToolbar.jsx`**, **`EmojiPicker.jsx`**: UI helpers for block insertion and formatting.

#### Database / Document Hub
- **`DatabaseTable.jsx`, `DatabaseBoard.jsx`, `DatabaseGallery.jsx`, `DatabaseList.jsx`**: Multiple view modes for the Document Hub.
- **`AddPropertyModal.jsx`, `ColumnHeaderDropdown.jsx`, `CustomizeDatabaseSheet.jsx`**: Schema and view customization.
- **`RecordModal.jsx`, `PropertyEditor.jsx`**: Record detail editing.
- **`seedDocumentHub.js`**: Idempotent seeding of a default Document Hub database, sample views, and records.

#### Task Management
- **`KanbanBoard.jsx`**, **`TaskTable.jsx`**, **`QuickAddTask.jsx`**, **`TaskModal.jsx`**, **`WorkloadView.jsx`**: Full task lifecycle UI with drag‑and‑drop, sorting, filtering, and per‑assignee workload view.

#### Ticketing System
- **`Tickets.jsx`**, **`TicketDetail.jsx`**, **`NewTicketModal.jsx`**: Support ticket UI with SLA tracking, escalation workflow, activity log, and linked tasks/SOPs.

#### Command Center
- **`CommandCenter.jsx`**: Real‑time ops dashboard with KPI tiles, live queues (at‑risk, breached tickets, overdue tasks), and recent activity feed.

### 6. Data Flow and State Management
- **Data fetching**: TanStack Query (`useQuery`) is used throughout to fetch collections (`Page`, `Task`, `Ticket`, `Database`, etc.) with caching and automatic refetch on mutation.
- **Mutations**: `useMutation` with optimistic updates where appropriate (e.g., column visibility, task status). After a successful mutation, `queryClient.invalidateQueries` ensures UI consistency.
- **Realtime presence**: `usePresence.js` leverages Firebase Realtime Database to broadcast online/offline status.
- **Auth flow**: `AuthContext` checks auth on mount, then `WorkspaceContext` loads organisation data and seeds the Document Hub.
- **Routing**: React Router DOM v7 with nested routes; custom route wrappers (`PageEditorRoute`, `DatabaseDetailRoute`) reset error boundaries on navigation.

### 7. Security and Permissions
- **Firebase Security Rules** (`firestore.rules`) enforce per‑organisation data isolation and role‑based read/write permissions.
- **RBAC**: `WorkspaceContext` stores the current user's role within the organisation. UI components conditionally render actions based on role (e.g., admin‑only audit log, member management).
- **Public sharing**: Pages can be shared via a token and optional password, with server‑side validation before rendering.
- **Sentry**: Captures unhandled exceptions; error boundaries provide graceful degradation.
- **Environment secrets**: Firebase and Cloudinary credentials are stored in `.env` (excluded from version control). The production build hard‑codes Firebase config for the GCP VM.

### 8. Performance Considerations
- **Virtualisation**: The sidebar page tree and database tables use `@tanstack/react-virtual` to render only visible rows, reducing DOM size.
- **Debounced autosave**: Prevents excessive writes to Firestore.
- **Lazy loading**: Code‑splitting via Vite and dynamic imports for heavy components (e.g., Command Center).
- **Cache control**: TanStack Query caches data for the session; stale‑while‑revalidate patterns could be added for further optimisation.
- **Asset optimisation**: Tailwind JIT mode and Vite's CSS minification; Cloudinary serves optimized images.

### 9. Testing Strategy
The repository currently lacks explicit test files. Recommended additions:
- **Unit tests**: Use Jest + React Testing Library for pure component logic and utility functions.
- **Integration tests**: Test data fetching hooks with `msw` (Mock Service Worker) to simulate Firestore responses.
- **E2E tests**: Cypress or Playwright to cover critical user flows (login, page creation, task board interactions, ticket escalation).
- **CI pipeline**: Add GitHub Actions to run tests on push/PR.

### 10. Build & Deployment
- **Build**: `vite build` produces a static SPA in `dist/`. Tailwind CSS is processed via PostCSS.
- **Deployment**: `dist/` is served by Nginx on a GCP VM. `deploy/nginx.conf` contains SPA rewrite rules and TLS configuration. `deploy/setup-tls.sh` automates certificate provisioning (e.g., via Certbot).
- **Environment**: `.env.example` documents required variables (`VITE_FIREBASE_API_KEY`, `VITE_CLOUDINARY_CLOUD_NAME`, etc.).

### 11. Observability & Error Handling
- **Sentry**: Initialized in `src/main.jsx`; captures unhandled exceptions and performance traces.
- **ErrorBoundary.jsx**: Top‑level and section‑level error boundaries provide fallback UI and a reset mechanism.
- **Audit Log**: `src/lib/auditLog.js` writes audit events to Firestore; UI displayed in Settings > Audit Log (admin only).

### 12. Extensibility & Future Work
Potential areas for growth:
- **Server‑side functions**: Move heavy business logic (e.g., SLA calculations, audit log aggregation) to Cloud Functions for better security and performance.
- **Role hierarchy**: Introduce more granular permissions (e.g., per‑page edit rights beyond owner/editor/viewer).
- **Collaboration**: Real‑time collaborative editing via Firestore listeners or WebRTC.
- **Search**: Implement full‑text search with Algolia or Elastic for faster page/document lookup.
- **Mobile app**: React Native wrapper for native mobile experience.

### 13. Recommendations
1. **Add a test suite** – unit, integration, and E2E tests to protect against regressions.
2. **Introduce CI/CD** – GitHub Actions for linting, testing, and automated deployment to GCP.
3. **Refactor security rules** – ensure least‑privilege principle and add rule coverage tests.
4. **Document API contracts** – generate OpenAPI spec for any custom backend endpoints (e.g., Base44 integration).
5. **Performance audit** – run Lighthouse to identify any runtime bottlenecks, especially on large Document Hub tables.
6. **Improve onboarding** – add guided tours for new users (e.g., using `react-joyride`).
