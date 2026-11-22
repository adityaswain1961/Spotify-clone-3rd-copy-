import { create } from 'zustand';
import type { Song } from '@/api/types';

interface SongActionsState {
  song: Song | null;
  /** Set when opened from a playlist the user owns, enabling "Remove from playlist". */
  playlistId?: string;
}

export const useSongActions = create<SongActionsState>(() => ({ song: null }));

export function openSongActions(song: Song, playlistId?: string): void {
  useSongActions.setState({ song, playlistId });
}

export function closeSongActions(): void {
  useSongActions.setState({ song: null, playlistId: undefined });
}
