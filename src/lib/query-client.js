import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
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
    mutations: {
      // Surface unhandled mutation errors to the console in dev
      onError: (error) => {
        if (import.meta.env.DEV) console.warn('[mutation]', error);
      },
    },
  },
});
