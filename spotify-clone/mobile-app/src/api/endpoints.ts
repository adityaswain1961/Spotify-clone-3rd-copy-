import { request } from './client';
import type {
  AudioQuality,
  AuthSession,
  AuthUser,
  MediaUrl,
  Page,
  PlaylistDetail,
  PlaylistSummary,
  SearchResult,
  Song,
  SongSection,
} from './types';

export const api = {
  login: (email: string, password: string) =>
    request<AuthSession>('/auth/login', { method: 'POST', body: { email, password }, auth: false }),

  register: (email: string, password: string, displayName: string) =>
    request<AuthSession>('/auth/register', { method: 'POST', body: { email, password, displayName }, auth: false }),

  refresh: (refreshToken: string) =>
    request<AuthSession>('/auth/refresh', { method: 'POST', body: { refreshToken }, auth: false }),

  logout: (refreshToken: string) =>
    request<{ success: true }>('/auth/logout', { method: 'POST', body: { refreshToken }, auth: false, timeoutMs: 5000 }),

  me: () => request<AuthUser>('/auth/me'),

  /** Whole home screen in one round-trip. */
  home: () => request<{ sections: SongSection[] }>('/recommendations/home'),

  search: (q: string, signal?: AbortSignal) =>
    request<SearchResult>(`/search?q=${encodeURIComponent(q)}&type=all&size=20`, { signal }),

  songs: (ids: string[]) => request<Song[]>(`/songs?ids=${ids.join(',')}`),

  myPlaylists: () => request<Page<PlaylistSummary>>('/playlists/me?size=100'),

  playlist: (id: string) => request<PlaylistDetail>(`/playlists/${id}`),

  createPlaylist: (title: string) =>
    request<PlaylistDetail>('/playlists', { method: 'POST', body: { title, isPublic: false } }),

  addToPlaylist: (playlistId: string, songId: string) =>
    request<PlaylistDetail>(`/playlists/${playlistId}/songs`, { method: 'POST', body: { songId } }),

  removeFromPlaylist: (playlistId: string, songId: string) =>
    request<PlaylistDetail>(`/playlists/${playlistId}/songs/${songId}`, { method: 'DELETE' }),

  likedSongs: () => request<Page<Song & { likedAt: string }>>('/interactions/me/likes?size=100'),

  likedSongIds: () => request<{ songIds: string[] }>('/interactions/me/likes/ids'),

  /** Idempotent: safe to replay after being queued offline. */
  setLike: (songId: string, liked: boolean) =>
    request<{ liked: boolean }>('/interactions/likes', { method: 'POST', body: { songId, liked } }),

  recordListens: (events: Array<{ songId: string; listenedAt: string }>) =>
    request<{ recorded: number }>('/interactions/listens', { method: 'POST', body: { events } }),

  /** Signed URLs for a whole queue in one call. */
  streamUrls: (ids: string[], quality: AudioQuality) =>
    request<{ items: MediaUrl[] }>('/songs/stream-urls', { method: 'POST', body: { ids, quality } }),

  downloadUrl: (id: string, quality: AudioQuality) =>
    request<MediaUrl>(`/songs/${id}/download?quality=${quality}`),
};
