# Database consolidation plan (T2)

**Status: proposed — do not execute without confirming the data migration window.**

## Problem

Three parallel "database" implementations ship today:

| Implementation | Storage | UIs | Limits |
|---|---|---|---|
| `pages/Databases.jsx` (~1,070 lines) | One JSON blob (`{columns, rows}`) inside a `pages` doc with `is_database: true` | Own table/board/list | Whole dataset rewritten per cell edit; 1 MB doc ceiling; no per-record rules, realtime, relations, or row bodies |
| `pages/DatabaseDetail.jsx` + `components/database/*` | `databases` + `records` + `db_views` collections | Table/board/list/gallery | The full-featured model (schema, views, templates, row bodies, relations) |
| `pages/DocumentHub.jsx` (~1,284 lines) | Same records model | Third table/list variation | Duplicate of DatabaseDetail's UIs with hub-specific chrome |

Users see two different "database" products with different capabilities; engineering pays for every cell/filter/view feature three times.

## Target state

One storage model (`databases`/`records`/`db_views`) and one set of view components.
`/databases` becomes a gallery listing `databases` collection entries; opening one
routes to the existing `/database/:id` experience. Document Hub becomes a saved
configuration of the same components rather than a separate implementation.

## Migration steps

1. **Migration script** (`scripts/migrate-blob-databases.mjs`, Admin SDK, same pattern
   as `migrate-rbac-and-assignees.mjs`):
   - For each `pages` doc with `is_database: true`: parse `{columns, rows}`;
     create a `databases` doc (schema from `columns` — map `text/status/select/date/files/…`
     types to the records model's property types); create one `records` doc per row
     (`properties` keyed by generated property ids); mark the source page
     `migrated_to_database_id` and soft-delete it.
   - Idempotent: skip pages already carrying `migrated_to_database_id`.
2. **Routing**: `/databases` lists `databases` collection (minus the Document Hub DB),
   linking to `/database/:id`. Delete the blob table/board/list code from `Databases.jsx`.
3. **Document Hub**: replace its bespoke grid with `DatabaseTable`/`DatabaseBoard`
   configured by the hub's saved views; keep the hub-specific header/quick-actions.
4. **Cleanup**: remove `DB_PRESETS` blob shapes (recreate as records-model templates),
   delete dead CSV blob import/export in favor of the records-model equivalents.

## Risk & rollback

- Run the script against a copy first (`firebase firestore:export` or a test org).
- The source page docs are soft-deleted, not destroyed — rollback = clear
  `migrated_to_database_id` and undelete.
- Expected code reduction: ~1,500 lines.

## Effort

Script + routing: ~1 day. Document Hub refactor: 1–2 days. Test pass: half a day.
