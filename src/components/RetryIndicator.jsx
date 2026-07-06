import React, { useState, useEffect, useRef } from 'react';
import { queryClientInstance } from '@/lib/query-client';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * RetryIndicator — shows a subtle "Retrying…" pill whenever TanStack Query
 * is actively re-fetching a query that has already failed at least once.
 * Subscribes to the QueryCache directly so it works without any per-query config.
 */
export default function RetryIndicator() {
  const [retrying, setRetrying] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const cache = queryClientInstance.getQueryCache();

    const check = () => {
      const queries = cache.getAll();
      const hasRetrying = queries.some(
        q => q.state.fetchStatus === 'fetching' && q.state.fetchFailureCount > 0,
      );

      if (hasRetrying) {
        setRetrying(true);
        if (timerRef.current) clearTimeout(timerRef.current);
      } else if (retrying) {
        // Linger for 800 ms so the pill doesn't flash away immediately
        timerRef.current = setTimeout(() => setRetrying(false), 800);
      }
    };

    const unsub = cache.subscribe(check);
    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run the check whenever `retrying` flips so the linger timer works correctly
  useEffect(() => {
    if (!retrying) return;
    const cache = queryClientInstance.getQueryCache();
    const queries = cache.getAll();
    const stillRetrying = queries.some(
      q => q.state.fetchStatus === 'fetching' && q.state.fetchFailureCount > 0,
    );
    if (!stillRetrying) {
      timerRef.current = setTimeout(() => setRetrying(false), 800);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [retrying]);

  if (!retrying) return null;

  return (
    <div
      className={cn(
        'fixed bottom-16 right-4 z-50 flex items-center gap-1.5',
        'bg-background/90 backdrop-blur border border-border shadow-sm',
        'rounded-full px-3 py-1.5 text-xs text-muted-foreground',
        'animate-in fade-in slide-in-from-bottom-2 duration-200',
      )}
    >
      <Loader2 className="h-3 w-3 animate-spin" />
      Retrying…
    </div>
  );
}
