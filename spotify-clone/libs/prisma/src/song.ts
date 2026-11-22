import { Prisma, PrismaClient } from '@prisma/client';

/**
 * The single song shape every service returns. Keeping one contract means the
 * mobile app can cache, render and download any song the same way no matter
 * which endpoint it came from.
 */
export interface SongDto {
  id: string;
  title: string;
  durationSec: number;
  artistId: string;
  artistName: string;
  albumId: string | null;
  coverUrl: string | null;
  genres: string[];
  playCount: number;
  /** Size in bytes of each rendition, so the app can show download sizes up front. */
  sizes: { low: number | null; high: number | null };
}

export const songSelect = {
  id: true,
  title: true,
  duration: true,
  coverImageKey: true,
  genres: true,
  albumId: true,
  playCount: true,
  audioLowBytes: true,
  audioHighBytes: true,
  artist: { select: { id: true, stageName: true } },
} satisfies Prisma.SongSelect;

export type SongRow = Prisma.SongGetPayload<{ select: typeof songSelect }>;

/** Only songs that finished transcoding are visible to listeners. */
export const playableSongWhere = {
  isPublished: true,
} satisfies Prisma.SongWhereInput;

/**
 * Public URL for an image key (covers, avatars).
 * With ASSETS_BASE_URL set (CDN / bucket website) it is absolute; otherwise it is
 * served by media-service through the gateway and returned as a gateway-relative path.
 */
export function assetUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (/^https?:\/\//.test(key)) return key;
  const base = (process.env.ASSETS_BASE_URL ?? '/songs/assets').replace(/\/$/, '');
  return `${base}/${key}`;
}

export function toSongDto(row: SongRow): SongDto {
  return {
    id: row.id,
    title: row.title,
    durationSec: row.duration,
    artistId: row.artist.id,
    artistName: row.artist.stageName,
    albumId: row.albumId,
    coverUrl: assetUrl(row.coverImageKey),
    genres: row.genres,
    playCount: row.playCount,
    sizes: { low: row.audioLowBytes, high: row.audioHighBytes },
  };
}

/** Fetch songs by id in one query, preserving the requested order and dropping unplayable ones. */
export async function hydrateSongs(prisma: PrismaClient, ids: string[]): Promise<SongDto[]> {
  const unique = [...new Set(ids)];
  if (!unique.length) return [];

  const rows = await prisma.song.findMany({
    where: { id: { in: unique }, ...playableSongWhere },
    select: songSelect,
  });
  const byId = new Map(rows.map((row) => [row.id, toSongDto(row)]));
  return unique.map((id) => byId.get(id)).filter((song): song is SongDto => Boolean(song));
}
