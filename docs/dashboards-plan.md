# Department dashboards — build plan

The reusable foundation is shipped and the Task Dashboard (spec #11) proves the
pattern end-to-end. This document sequences the remaining 10 dashboards so each
is a bounded, verifiable increment rather than one giant speculative drop.

## What's already in place (reuse for every dashboard)

- **`useDashboardStats({ collections, org_id, filters, computeFn })`** —
  `src/hooks/useDashboardStats.js`. One org-scoped query per collection,
  memoized `computeFn`.
- **`KpiTile` / `QueueCard` / `CalloutBanner`** — `src/components/dashboard/`
  (`KpiTile` now also takes a `delta` prop for day/week-over-week indicators).
- **`DASHBOARD_ROLES` + `getDashboardRole` + `canAccessDashboard`** —
  `src/lib/permissions.js`. Gate a route with `RoleProtectedRoute` and a nav
  link with `canAccessDashboard(currentOrg, user.email, DASHBOARD_ROLES.X)`.
- **`dept_dashboard` DB preset** + `seedDocumentHub`-style idempotent seeding
  as the template for each new department database.
- **Task `category` field** (`General` / `Trade`) — Trade Ops dashboards filter
  the same Task set instead of a second tracker.

The build pattern for each is identical: *(optional) seed a Document Hub
database → a page on `useDashboardStats` with KPI tiles → a `groupBy`-per-owner
view for manager rollups → a gated route + nav link.*

---

## Group A — ready now (new database + KPI page, no new infrastructure)

These need only a seeded records-model database and the foundation above. Each
is ~1 file plus a seed helper. Safe to build back-to-back.

| # | Dashboard | Route | New "Document Hub" DB (schema) |
|---|---|---|---|
| 3 | **Legal** | `/dashboard/legal` | Legal Matters: matter_title, matter_type(select), counterparty, status, risk_level(select), owner(person), deadline(date), renewal_date(date) |
| 8 | **MIS** | `/dashboard/mis` | Report Requests: request_title, requester(person), department(select), status, requested_date, due_date, report_type(select) |
| 9 | **Trade Ops — head** | `/dashboard/trade-ops` | Trade Exceptions: trade_id, exception_type(select), status, value_at_risk(number), analyst(person), trade_date, resolved_date |
| 10 | **Trade Ops — analyst** | `/dashboard/trade-ops-mine` | *(none — filtered view of Trade Exceptions where analyst = me)* |
| 6 | **Back office** | `/dashboard/back-office` | Resolutions: case_id, case_type(select), status, assigned_to(person), priority(select) — `aging_days` computed client-side |
| 1 | **Executive** | `/dashboard/executive` | Workstreams: name, owner(person), status(On Track/At Risk/Blocked), budget_planned(number), budget_actual(number), next_milestone(date) |

Notes:
- #9/#10 are the head/analyst pair — build #9, then #10 is the same query
  scoped to `analyst === currentUser.email` (mirrors the Task Dashboard's
  owner grouping). #1's "% milestones hit" KPI can pull from the Task
  Dashboard's completion logic rather than a separate calc.
- "Deadline/aging past due" alerts reuse `CalloutBanner` (danger) with the
  same shape as CommandCenter's breached-ticket banner.

---

## Group B — needs one data-model decision first

Buildable, but each hinges on a choice better made explicitly than guessed.

| # | Dashboard | Decision needed |
|---|---|---|
| 2 | **Finance** (`/dashboard/finance`) | Approval turnaround requires an **`approved_at` timestamp written on the status→Approved transition**. Decide where that write lives (a records `onChange` hook, or a small field the UI stamps). Until then, ship the other KPIs and leave turnaround as "—". Recharts bar chart (spend by department) is ready. |
| 4 | **Call center — head** (`/command-center/call-center`) | **Are calls tickets, or a separate `Call` entity?** CSAT / handle_time / channel / agent / abandoned don't exist on Ticket today. Recommend a dedicated `calls` collection (cleaner than overloading Ticket) + a `supervisor_email` field. This unblocks #5 too. |
| 5 | **Call center — supervisors** (`/dashboard/call-center-team`) | Depends entirely on #4's data model; then it's a `supervisor_email === me` scoped view. |

---

## Group C — needs cross-cutting infrastructure

Valuable but touch more than one dashboard; schedule deliberately.

| # | Dashboard | Infrastructure |
|---|---|---|
| 7 | **Engineering** (`/dashboard/engineering`) | Cycle-time-by-effort needs a **`status_changed_at` (or a transitions log) written on every task status change** — a cross-cutting change to task updates, not a dashboard-local one. Also a `category='bug'`/tag field. The board view reuses the existing Kanban. Sentry error counts: decide the source — Sentry's API from the agent server, or a webhook-fed `incidents` collection (don't hardcode a new tracker). |

---

## Recommended order

1. **Group A, in listed order** (Legal → MIS → Trade Ops head → Trade Ops
   analyst → Back Office → Executive). Each ships independently; by the third
   the remaining ones are largely copy-adapt.
2. **Decide the call-center data model** (#4), then build #4 + #5 together.
3. **Finance** (#2) once the `approved_at` decision is made.
4. **Engineering** (#7) last, bundled with the `status_changed_at` change so
   cycle-time works from day one.

The "other roles" table (HR, Compliance, IT, Client Success, Procurement) all
fall into Group A — a seeded database + a KPI page — once the above are done.

## Wiring checklist per dashboard

- [ ] Seed helper (idempotent, `seedDocumentHub`-style) for the department DB
- [ ] `src/pages/<Name>Dashboard.jsx` using `useDashboardStats` + shared tiles
- [ ] Lazy route in `App.jsx` under a `RoleProtectedRoute`
- [ ] Gated nav link in `Sidebar.jsx` via `canAccessDashboard(...)`
- [ ] A `groupBy`-per-owner rollup for manager views
- [ ] (If new fields) surface them in the relevant create/edit UI
