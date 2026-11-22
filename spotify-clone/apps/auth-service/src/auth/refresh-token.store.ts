import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { envInt, REDIS_CLIENT } from '@spotify/common';

const PREFIX = 'refresh:';

/** Opaque refresh tokens stored in Redis. Long-lived so offline listeners are not logged out. */
@Injectable()
export class RefreshTokenStore {
  private readonly ttlSeconds = envInt('REFRESH_TOKEN_TTL_DAYS', 30) * 24 * 60 * 60;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async save(token: string, userId: string): Promise<void> {
    await this.redis.set(PREFIX + token, userId, 'EX', this.ttlSeconds);
  }

  /** Atomically read-and-delete, so a refresh token can be redeemed exactly once. */
  async consume(token: string): Promise<string | null> {
    return this.redis.getdel(PREFIX + token);
  }

  async revoke(token: string): Promise<void> {
    await this.redis.del(PREFIX + token);
  }
}
