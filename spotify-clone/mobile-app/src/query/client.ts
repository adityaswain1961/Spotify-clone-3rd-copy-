import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';
import { ApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { onSignOut } from '@/auth/session';
import { mutationKeys } from './keys';

const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Show cached data instantly, revalidate in the background after a minute.
      staleTime: 60_000,
      // Must be >= persist maxAge, otherwise restored data is garbage-collected right away.
      gcTime: ONE_WEEK,
      retry: (failures, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failures < 2;
      },
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 2,
    },
  },
});

/**
 * Persist the query cache so every screen opens instantly from disk - including
 * offline. Bump `buster` whenever the API response shapes change.
 */
export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'query-cache',
  throttleTime: 2000,
});

export const persistOptions = {
  persister: queryPersister,
  maxAge: ONE_WEEK,
  buster: 'v1',
  dehydrateOptions: {
    shouldDehydrateQuery: (query: { state: { status: string }; meta?: Record<string, unknown> }) =>
      query.state.status === 'success' && query.meta?.persist !== false,
  },
};

// Likes made offline are persisted as paused mutations and replayed when back online.
// The payload is the desired state (not a toggle), so replays are always safe.
queryClient.setMutationDefaults(mutationKeys.like, {
  mutationFn: ({ songId, liked }: { songId: string; liked: boolean }) => api.setLike(songId, liked),
  scope: { id: 'likes' },
});

// Refetch stale queries when the app returns to the foreground.
AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));

onSignOut(() => {
  queryClient.cancelQueries();
  queryClient.clear();
  void queryPersister.removeClient();
});
