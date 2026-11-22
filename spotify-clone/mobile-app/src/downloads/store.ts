import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { AudioQuality, Song } from '@/api/types';

export type DownloadStatus = 'queued' | 'downloading' | 'done' | 'error';

export interface DownloadItem {
  song: Song;
  status: DownloadStatus;
  quality: AudioQuality;
  bytes: number;
  hasCover: boolean;
  error?: string;
  addedAt: number;
  completedAt?: number;
}

interface DownloadsState {
  items: Record<string, DownloadItem>;
  hydrated: boolean;
}

/** Persisted index of downloads. Only status changes are written - never progress ticks. */
export const useDownloads = create<DownloadsState>()(
  persist((): DownloadsState => ({ items: {}, hydrated: false }), {
    name: 'downloads.v1',
    storage: createJSONStorage(() => AsyncStorage),
    partialize: ({ items }) => ({ items }),
    onRehydrateStorage: () => () => useDownloads.setState({ hydrated: true }),
  }),
);

/** Transient 0..1 progress per song, kept out of storage so updates stay cheap. */
export const useDownloadProgress = create<Record<string, number>>(() => ({}));

export function updateDownload(songId: string, patch: Partial<DownloadItem>): void {
  useDownloads.setState((state) => {
    const current = state.items[songId];
    if (!current) return state;
    return { items: { ...state.items, [songId]: { ...current, ...patch } } };
  });
}

// Paths are rebuilt from the song id on every launch: on iOS the absolute app
// container path changes between app updates, so stored absolute URIs would break.
export function downloadsDirectory(): Directory {
  return new Directory(Paths.document, 'downloads');
}

export function audioFileFor(songId: string): File {
  return new File(downloadsDirectory(), `${songId}.m4a`);
}

export function coverFileFor(songId: string): File {
  return new File(downloadsDirectory(), `${songId}.jpg`);
}

export function isDownloaded(songId: string): boolean {
  return useDownloads.getState().items[songId]?.status === 'done';
}

/** file:// URI of a finished download, or null. */
export function localAudioUri(songId: string): string | null {
  return isDownloaded(songId) ? audioFileFor(songId).uri : null;
}

export function localCoverUri(songId: string): string | null {
  const item = useDownloads.getState().items[songId];
  return item?.status === 'done' && item.hasCover ? coverFileFor(songId).uri : null;
}

/** Finished downloads, newest first. */
export function useDownloadedSongs(): Song[] {
  return useDownloads(
    useShallow((state) =>
      Object.values(state.items)
        .filter((item) => item.status === 'done')
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
        .map((item) => item.song),
    ),
  );
}

/** Queued, active and failed downloads, oldest first. */
export function usePendingDownloads(): DownloadItem[] {
  return useDownloads(
    useShallow((state) =>
      Object.values(state.items)
        .filter((item) => item.status !== 'done')
        .sort((a, b) => a.addedAt - b.addedAt),
    ),
  );
}

export function useDownloadedBytes(): number {
  return useDownloads((state) =>
    Object.values(state.items).reduce((sum, item) => sum + (item.status === 'done' ? item.bytes : 0), 0),
  );
}

/** Hook: status of one song's download (re-renders only when that song changes). */
export function useDownloadStatus(songId: string): DownloadStatus | null {
  return useDownloads((state) => state.items[songId]?.status ?? null);
}

export function useIsDownloaded(songId: string): boolean {
  return useDownloads((state) => state.items[songId]?.status === 'done');
}
