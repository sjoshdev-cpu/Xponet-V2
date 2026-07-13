import { QueryClient, MutationCache } from '@tanstack/react-query';
import { toast } from 'sonner';

export const queryClientInstance = new QueryClient({
  // Safety net: any mutation without its own onError still tells the user
  // the write failed instead of silently lying with optimistic UI. Mutations
  // that handle their own errors (e.g. PageEditor's conflict toast) also run
  // this — sonner dedupes near-identical toasts, and a duplicate beats silence.
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if (import.meta.env.DEV) console.warn('[mutation]', error);
      if (!mutation.options.onError) {
        const denied = error?.code === 'permission-denied';
        toast.error(denied ? "You don't have permission to do that" : 'Change could not be saved', {
          description: denied ? undefined : String(error?.message || error).slice(0, 140),
        });
      }
    },
  }),
  defaultOptions: {
    queries: {
      // Collaboration freshness: refetch when the user returns to the tab,
      // and poll visible queries once a minute so other members' edits show
      // up without a manual reload. Hot collections (tasks) additionally use
      // live onSnapshot listeners. Polling pauses in background tabs.
      refetchOnWindowFocus: true,
      refetchInterval: 60_000,
      // Retry up to 2 times; skip retrying on 4xx client errors
      retry: (failureCount, error) => {
        if (failureCount >= 2) return false;
        const status = error?.code ?? error?.status;
        if (status && String(status).startsWith('4')) return false;
        return true;
      },
      // Exponential back-off: 1 s → 2 s → capped at 30 s
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
    },
  },
});
