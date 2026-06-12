import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '@spotify/prisma';
import { createHash } from 'crypto';
import { SearchType } from './dto/search-query.dto';

function hashQuery(q: string): string {
  return createHash('sha256').update(q).digest('hex').slice(0, 16);
}

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async search(q: string, type: SearchType, page: number, size: number) {
    const normalizedQ = q.trim();
    const safeType: SearchType = type ?? 'all';
    const safePage = Math.max(1, page || 1);
    const safeSize = Math.min(Math.max(1, size || 10), 50);
    const offset = (safePage - 1) * safeSize;

    const cacheKey = `search:${safeType}:${hashQuery(normalizedQ)}:${safePage}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const result =
      safeType === 'song'
        ? await this.searchSongs(normalizedQ, safeSize, offset)
        : safeType === 'artist'
          ? await this.searchArtists(normalizedQ, safeSize, offset)
          : safeType === 'playlist'
            ? await this.searchPlaylists(normalizedQ, safeSize, offset)
            : {
                songs: await this.searchSongs(normalizedQ, safeSize, offset),
                artists: await this.searchArtists(normalizedQ, safeSize, offset),
                playlists: await this.searchPlaylists(normalizedQ, safeSize, offset),
              };

    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 30);
    return result;
  }

  private async searchSongs(q: string, limit: number, offset: number) {
    return this.prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        duration: number;
        cover_image_key: string | null;
        hls_manifest_key: string;
        is_published: boolean;
        artist_id: string;
        rank: number;
      }>
    >(Prisma.sql`
      SELECT
        s.id,
        s.title,
        s.duration,
        s.cover_image_key,
        s.hls_manifest_key,
        s.is_published,
        s.artist_id,
        ts_rank(s.search_vector, query) AS rank
      FROM songs s, plainto_tsquery('english', ${q}) query
      WHERE s.search_vector @@ query AND s.is_published = true
      ORDER BY rank DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
  }

  private async searchArtists(q: string, limit: number, offset: number) {
    return this.prisma.$queryRaw<
      Array<{
        id: string;
        stage_name: string;
        bio: string | null;
        avatar_key: string | null;
        rank: number;
      }>
    >(Prisma.sql`
      SELECT
        a.id,
        a.stage_name,
        a.bio,
        a.avatar_key,
        ts_rank(a.search_vector, query) AS rank
      FROM artists a, plainto_tsquery('english', ${q}) query
      WHERE a.search_vector @@ query
      ORDER BY rank DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
  }

  private async searchPlaylists(q: string, limit: number, offset: number) {
    return this.prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        description: string | null;
        cover_key: string | null;
        is_public: boolean;
        user_id: string;
        rank: number;
      }>
    >(Prisma.sql`
      SELECT
        p.id,
        p.title,
        p.description,
        p.cover_key,
        p.is_public,
        p.user_id,
        ts_rank(p.search_vector, query) AS rank
      FROM playlists p, plainto_tsquery('english', ${q}) query
      WHERE p.search_vector @@ query AND p.is_public = true
      ORDER BY rank DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
  }
}

