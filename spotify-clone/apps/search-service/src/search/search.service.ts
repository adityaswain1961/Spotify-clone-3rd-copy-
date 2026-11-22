import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Redis from 'ioredis';
import { createHash } from 'crypto';
import { REDIS_CLIENT } from '@spotify/common';
import { assetUrl, hydrateSongs, PrismaService, SongDto } from '@spotify/prisma';
import { SearchType } from './dto/search-query.dto';

export interface ArtistResultDto {
  id: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
}

export interface PlaylistResultDto {
  id: string;
  title: string;
  description: string | null;
  ownerId: string;
  coverUrl: string | null;
}

export interface SearchResultDto {
  songs: SongDto[];
  artists: ArtistResultDto[];
  playlists: PlaylistResultDto[];
}

const CACHE_TTL_SECONDS = 60;

/**
 * Turn free text into a safe prefix tsquery: "lov son" -> "lov:* & son:*".
 * Only letters/digits survive, so user input can never break tsquery syntax.
 */
export function toPrefixQuery(q: string): string | null {
  const terms = q.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.slice(0, 8) ?? [];
  return terms.length ? terms.map((term) => `${term}:*`).join(' & ') : null;
}

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async search(q: string, type: SearchType, page: number, size: number): Promise<SearchResultDto> {
    const empty: SearchResultDto = { songs: [], artists: [], playlists: [] };
    const tsQuery = toPrefixQuery(q);
    if (!tsQuery) return empty;

    const cacheKey = `search:v2:${type}:${page}:${size}:${createHash('sha1').update(tsQuery).digest('hex')}`;
    const cached = await this.redis.get(cacheKey).catch(() => null);
    if (cached) return JSON.parse(cached) as SearchResultDto;

    const offset = (page - 1) * size;
    const want = (kind: SearchType) => type === 'all' || type === kind;
    const [songs, artists, playlists] = await Promise.all([
      want('song') ? this.searchSongs(tsQuery, size, offset) : [],
      want('artist') ? this.searchArtists(tsQuery, size, offset) : [],
      want('playlist') ? this.searchPlaylists(tsQuery, size, offset) : [],
    ]);

    const result: SearchResultDto = { songs, artists, playlists };
    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_SECONDS).catch(() => undefined);
    return result;
  }

  private async searchSongs(tsQuery: string, limit: number, offset: number): Promise<SongDto[]> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT s.id
      FROM songs s, to_tsquery('english', ${tsQuery}) query
      WHERE s.is_published = true AND s.search_vector @@ query
      ORDER BY ts_rank(s.search_vector, query) DESC, s.play_count DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    return hydrateSongs(this.prisma, rows.map((row) => row.id));
  }

  private async searchArtists(tsQuery: string, limit: number, offset: number): Promise<ArtistResultDto[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; stage_name: string; bio: string | null; avatar_key: string | null }>
    >(Prisma.sql`
      SELECT a.id, a.stage_name, a.bio, a.avatar_key
      FROM artists a, to_tsquery('english', ${tsQuery}) query
      WHERE a.search_vector @@ query
      ORDER BY ts_rank(a.search_vector, query) DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    return rows.map((row) => ({ id: row.id, name: row.stage_name, bio: row.bio, avatarUrl: assetUrl(row.avatar_key) }));
  }

  private async searchPlaylists(tsQuery: string, limit: number, offset: number): Promise<PlaylistResultDto[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; title: string; description: string | null; user_id: string; cover_key: string | null }>
    >(Prisma.sql`
      SELECT p.id, p.title, p.description, p.user_id, p.cover_key
      FROM playlists p, to_tsquery('english', ${tsQuery}) query
      WHERE p.is_public = true AND p.search_vector @@ query
      ORDER BY ts_rank(p.search_vector, query) DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      ownerId: row.user_id,
      coverUrl: assetUrl(row.cover_key),
    }));
  }
}
