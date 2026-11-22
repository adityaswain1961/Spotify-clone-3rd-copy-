/** Mirrors the backend contract (libs/prisma/src/song.ts and service DTOs). */

export type AudioQuality = 'low' | 'high';

export interface Song {
  id: string;
  title: string;
  durationSec: number;
  artistId: string;
  artistName: string;
  albumId: string | null;
  coverUrl: string | null;
  genres: string[];
  playCount: number;
  sizes: { low: number | null; high: number | null };
}

export interface AuthUser {
  id: string;
  email: string;
  role: 'LISTENER' | 'ARTIST';
  displayName: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}

export interface MediaUrl {
  songId: string;
  quality: AudioQuality;
  url: string;
  mimeType: string;
  sizeBytes: number | null;
  expiresAt: string;
}

export interface SongSection {
  id: string;
  title: string;
  items: Song[];
}

export interface PlaylistSummary {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  ownerId: string;
  coverUrl: string | null;
  songCount: number;
  updatedAt: string;
}

export interface PlaylistDetail extends PlaylistSummary {
  songs: Song[];
}

export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
}

export interface ArtistResult {
  id: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
}

export interface PlaylistResult {
  id: string;
  title: string;
  description: string | null;
  ownerId: string;
  coverUrl: string | null;
}

export interface SearchResult {
  songs: Song[];
  artists: ArtistResult[];
  playlists: PlaylistResult[];
}
