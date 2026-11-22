import { create } from 'zustand';
import type { Song } from '@/api/types';

export type RepeatMode = 'none' | 'all' | 'single';

export interface PlayerState {
  queue: Song[];
  index: number;
  /** Whether the native player currently holds this queue (false after an app restart). */
  loaded: boolean;
  loading: boolean;
  isPlaying: boolean;
  isBuffering: boolean;
  position: number;
  duration: number;
  repeat: RepeatMode;
  error: string | null;
}

export const initialPlayerState: PlayerState = {
  queue: [],
  index: -1,
  loaded: false,
  loading: false,
  isPlaying: false,
  isBuffering: false,
  position: 0,
  duration: 0,
  repeat: 'none',
  error: null,
};

export const usePlayer = create<PlayerState>(() => initialPlayerState);

export function useCurrentSong(): Song | null {
  return usePlayer((state) => state.queue[state.index] ?? null);
}

export function useIsCurrentSong(songId: string): boolean {
  return usePlayer((state) => state.queue[state.index]?.id === songId);
}
