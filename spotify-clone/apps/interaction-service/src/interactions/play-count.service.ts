import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import Redis from 'ioredis';
import { PrismaService } from '@spotify/prisma';

const PLAY_KEY_PATTERN = 'song:*:plays';

@Injectable()
export class PlayCountService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {}

  @Cron('*/5 * * * *')
  async flushPlayCounts(): Promise<void> {
    let cursor = '0';

    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', PLAY_KEY_PATTERN, 'COUNT', 200);
      cursor = nextCursor;

      if (!keys.length) continue;

      const deltas: Array<{ songId: string; delta: number; key: string }> = [];
      for (const key of keys) {
        const deltaStr = await this.redis.getdel(key);
        const delta = Number(deltaStr ?? 0);
        if (!Number.isFinite(delta) || delta <= 0) continue;

        const songId = this.parseSongId(key);
        if (!songId) continue;

        deltas.push({ songId, delta, key });
      }

      if (!deltas.length) continue;

      await this.prisma.$transaction(
        deltas.map(({ songId, delta }) =>
          this.prisma.song.update({
            where: { id: songId },
            data: { playCount: { increment: delta } },
          }),
        ),
      );
    } while (cursor !== '0');
  }

  private parseSongId(key: string): string | null {
    // key format: song:{songId}:plays
    const parts = key.split(':');
    if (parts.length !== 3) return null;
    return parts[0] === 'song' && parts[2] === 'plays' ? parts[1] : null;
  }
}

