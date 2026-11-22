import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import Redis from 'ioredis';
import { PinoLoggerService, REDIS_CLIENT } from '@spotify/common';
import { PrismaService } from '@spotify/prisma';

const PLAY_KEY_PATTERN = 'song:*:plays';

/** Batches play-count increments in Redis and flushes them to Postgres every 5 minutes. */
@Injectable()
export class PlayCountService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly logger: PinoLoggerService,
  ) {}

  @Cron('*/5 * * * *')
  async flushPlayCounts(): Promise<void> {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', PLAY_KEY_PATTERN, 'COUNT', 200);
      cursor = nextCursor;
      if (!keys.length) continue;

      const pipeline = this.redis.pipeline();
      for (const key of keys) pipeline.getdel(key);
      const results = (await pipeline.exec()) ?? [];

      const updates = keys
        .map((key, index) => ({ songId: key.split(':')[1], delta: Number(results[index]?.[1] ?? 0) }))
        .filter(({ songId, delta }) => songId && Number.isFinite(delta) && delta > 0);
      if (!updates.length) continue;

      try {
        // updateMany: a deleted song must not fail the whole batch.
        await this.prisma.$transaction(
          updates.map(({ songId, delta }) =>
            this.prisma.song.updateMany({ where: { id: songId }, data: { playCount: { increment: delta } } }),
          ),
        );
      } catch (error) {
        // Put the counts back so they are retried on the next run.
        const restore = this.redis.pipeline();
        for (const { songId, delta } of updates) restore.incrby(`song:${songId}:plays`, delta);
        await restore.exec();
        this.logger.error('Failed to flush play counts', { error: error instanceof Error ? error.message : String(error) });
      }
    } while (cursor !== '0');
  }
}
