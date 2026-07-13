import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * useLiveCollection(entity, filters, queryKey, enabled)
 *
 * Subscribes to a Firestore collection via entity.listen() (onSnapshot) and
 * pushes every change straight into the react-query cache under `queryKey`.
 * Pair it with an existing useQuery on the same key: the query provides the
 * initial load/loading state, the listener keeps it live afterwards — edits
 * made by other workspace members appear without a refetch or reload.
 *
 * `filters` uses the same shape as entity.filter():
 *   { org_id: '...', assignee_emails: { arrayContains: email } }
 *
 * Serialize-key the filters via JSON so the effect re-subscribes only when
 * they actually change value, not identity.
 */
export function useLiveCollection(entity, filters, queryKey, enabled = true) {
  const queryClient = useQueryClient();
  const filtersJson = JSON.stringify(filters ?? {});
  const keyJson = JSON.stringify(queryKey ?? []);

  useEffect(() => {
    if (!enabled) return;
    const parsedFilters = JSON.parse(filtersJson);
    const parsedKey = JSON.parse(keyJson);
    return entity.listen(parsedFilters, (docs) => {
      queryClient.setQueryData(parsedKey, docs);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, filtersJson, keyJson, enabled, queryClient]);
}
