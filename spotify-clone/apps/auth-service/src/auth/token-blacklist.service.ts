import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';

const REFRESH_PREFIX = 'refresh:';
const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class TokenBlacklistService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async setRefreshToken(token: string, userId: string): Promise<void> {
    await this.redis.set(this.getRefreshKey(token), userId, 'EX', SEVEN_DAYS_SECONDS);
  }

  async getRefreshTokenUserId(token: string): Promise<string | null> {
    return this.redis.get(this.getRefreshKey(token));
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await this.redis.del(this.getRefreshKey(token));
  }

  private getRefreshKey(token: string): string {
    return `${REFRESH_PREFIX}${token}`;
  }
}
