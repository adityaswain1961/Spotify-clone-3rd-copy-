import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { api } from '@/api/endpoints';
import type { Page, Song } from '@/api/types';
import { prefetchStreamUrls } from '@/player/stream-urls';
import { mutationKeys, queryKeys } from '@/query/keys';

/** Warm signed stream URLs for the first songs of any list the user is looking at. */
function usePrefetchStreams(songs: Song[] | undefined, limit = 30): void {
  const ids = songs?.slice(0, limit).map((song) => song.id).join(',');
  useEffect(() => {
    if (songs?.length) prefetchStreamUrls(songs.slice(0, limit));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);
}

export function useHome() {
  const query = useQuery({ queryKey: queryKeys.home, queryFn: api.home });
  const firstOfEachSection = useMemo(
    () => query.data?.sections.flatMap((section) => section.items.slice(0, 6)),
    [query.data],
  );
  usePrefetchStreams(firstOfEachSection);
  return query;
}

export function useSearch(q: string) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: queryKeys.search(trimmed),
    queryFn: ({ signal }) => api.search(trimmed, signal),
    enabled: trimmed.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    meta: { persist: false },
  });
}

export function useMyPlaylists() {
  return useQuery({ queryKey: queryKeys.myPlaylists, queryFn: api.myPlaylists });
}

export function usePlaylist(id: string) {
  const query = useQuery({ queryKey: queryKeys.playlist(id), queryFn: () => api.playlist(id) });
  usePrefetchStreams(query.data?.songs);
  return query;
}

export function useLikedSongs() {
  const query = useQuery({ queryKey: queryKeys.likedSongs, queryFn: api.likedSongs });
  usePrefetchStreams(query.data?.items);
  return query;
}

export function useLikedIds(): Set<string> {
  const { data } = useQuery({ queryKey: queryKeys.likedIds, queryFn: api.likedSongIds, staleTime: 5 * 60_000 });
  return useMemo(() => new Set(data?.songIds ?? []), [data]);
}

/**
 * Optimistic like/unlike. Offline, the mutation pauses, is persisted with the cache
 * and replays on reconnect; it sends the desired state, so replays are idempotent.
 */
export function useSetLike() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: mutationKeys.like,
    mutationFn: ({ songId, liked }: { songId: string; liked: boolean; song?: Song }) => api.setLike(songId, liked),
    onMutate: async ({ songId, liked, song }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.likedIds }),
        queryClient.cancelQueries({ queryKey: queryKeys.likedSongs }),
      ]);
      const previousIds = queryClient.getQueryData<{ songIds: string[] }>(queryKeys.likedIds);
      const previousSongs = queryClient.getQueryData<Page<Song>>(queryKeys.likedSongs);

      queryClient.setQueryData<{ songIds: string[] }>(queryKeys.likedIds, (current) => {
        const ids = (current?.songIds ?? []).filter((id) => id !== songId);
        return { songIds: liked ? [songId, ...ids] : ids };
      });
      queryClient.setQueryData<Page<Song>>(queryKeys.likedSongs, (current) => {
        if (!current) return current;
        const items = current.items.filter((item) => item.id !== songId);
        return {
          ...current,
          items: liked && song ? [song, ...items] : items,
          total: current.total + (liked ? 1 : -1),
        };
      });
      return { previousIds, previousSongs };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousIds) queryClient.setQueryData(queryKeys.likedIds, context.previousIds);
      if (context?.previousSongs) queryClient.setQueryData(queryKeys.likedSongs, context.previousSongs);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['likes'] });
    },
  });
}

export function useCreatePlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => api.createPlaylist(title),
    onSuccess: (playlist) => {
      queryClient.setQueryData(queryKeys.playlist(playlist.id), playlist);
      void queryClient.invalidateQueries({ queryKey: queryKeys.myPlaylists });
    },
  });
}

export function useAddToPlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ playlistId, songId }: { playlistId: string; songId: string }) => api.addToPlaylist(playlistId, songId),
    onSuccess: (playlist) => {
      queryClient.setQueryData(queryKeys.playlist(playlist.id), playlist);
      void queryClient.invalidateQueries({ queryKey: queryKeys.myPlaylists });
    },
  });
}

export function useRemoveFromPlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ playlistId, songId }: { playlistId: string; songId: string }) =>
      api.removeFromPlaylist(playlistId, songId),
    onSuccess: (playlist) => {
      queryClient.setQueryData(queryKeys.playlist(playlist.id), playlist);
      void queryClient.invalidateQueries({ queryKey: queryKeys.myPlaylists });
    },
  });
}
