import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import * as entities from '@/api/firestoreClient';

/**
 * useDashboardStats(config) — the reusable stats-computation pattern behind
 * every dashboard page.
 *
 *   const { data, isLoading, byCollection } = useDashboardStats({
 *     collections: ['tasks', 'tickets'],
 *     org_id: currentOrg?.id,
 *     computeFn: ({ tasks, tickets }) => ({ ...derived stats... }),
 *   });
 *
 * - Runs one org-scoped useQuery per collection (via useQueries, so the count
 *   can vary without breaking the rules of hooks).
 * - Passes a { [collection]: rows[] } map to computeFn inside useMemo, so the
 *   derived stats only recompute when the underlying data changes.
 *
 * `collections` are the lowercase collection names the app already uses
 * ('tasks', 'tickets', 'records', 'databases', 'pages', ...). Each is mapped
 * to its entity via ENTITY_BY_COLLECTION below.
 *
 * Optional per-config `filters`: extra equality/array-contains clauses merged
 * into every collection query (e.g. { database_id } for a records-backed
 * dashboard). `org_id` is always applied when present.
 */

// collection name -> entity wrapper from firestoreClient
const ENTITY_BY_COLLECTION = {
  pages: entities.Page,
  tasks: entities.Task,
  tickets: entities.Ticket,
  comments: entities.Comment,
  notifications: entities.Notification,
  organizations: entities.Organization,
  databases: entities.Database,
  records: entities.DatabaseRecord,
  db_views: entities.DatabaseView,
  reminder_configs: entities.ReminderConfig,
};

export function useDashboardStats({ collections = [], org_id, filters = {}, computeFn, enabled = true }) {
  const active = !!org_id && enabled;

  const results = useQueries({
    queries: collections.map((name) => {
      const entity = ENTITY_BY_COLLECTION[name];
      const queryFilters = { ...(org_id ? { org_id } : {}), ...filters };
      return {
        queryKey: ['dashboard', name, org_id, filters],
        queryFn: () => {
          if (!entity) throw new Error(`useDashboardStats: unknown collection "${name}"`);
          return entity.filter(queryFilters);
        },
        enabled: active,
      };
    }),
  });

  const isLoading = active && results.some((r) => r.isLoading);
  const isError = results.some((r) => r.isError);

  // Stable dependency: the arrays returned by react-query keep identity between
  // renders unless the data changed, so this map is memo-safe.
  const byCollection = useMemo(() => {
    const map = {};
    collections.forEach((name, i) => { map[name] = results[i]?.data ?? []; });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collections.join(','), ...results.map((r) => r.data)]);

  const data = useMemo(
    () => (computeFn ? computeFn(byCollection) : byCollection),
    [computeFn, byCollection],
  );

  return { data, byCollection, isLoading, isError };
}
