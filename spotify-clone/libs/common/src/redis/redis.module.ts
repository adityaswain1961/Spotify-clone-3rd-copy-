import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export function createRedisClient(): Redis {
  return new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    // Fail fast instead of queueing commands forever when Redis is down.
    maxRetriesPerRequest: 2,
    enableAutoPipelining: true,
  });
}

@Global()
@Module({
  providers: [{ provide: REDIS_CLIENT, useFactory: createRedisClient }],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}
