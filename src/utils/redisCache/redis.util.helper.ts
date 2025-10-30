import { Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { RedisInstance } from './redis.instance';

@Injectable()
export class RedisUtilHelper {
  @Inject()
  private readonly instance: RedisInstance;

  @Inject(WINSTON_MODULE_PROVIDER)
  private readonly logger: Logger;

  async getCountFromRedis(key: string): Promise<any | null> {
    try {
      const instance = await this.instance.getClient();
      const payload = await instance.get(key);
      if (!payload) {
        this.logger.info('Nothing in Cache, route expired');
        return;
      }
      this.logger.info(`Cache exists for the key: ${key}`);
      return JSON.parse(payload);
    } catch (e) {
      this.logger.error(e.toString());
    }
  }

  private async updateCountInRedis(key: string, payload: any): Promise<void> {
    try {
      const instance = await this.instance.getClient();
      await instance.set(key, JSON.stringify(payload), {
        KEEPTTL: true,
      });
    } catch (e) {
      this.logger.error(e.toString());
    }
  }

  private async setCountToRedis(
    key: string,
    payload: any,
    ttl?: number,
  ): Promise<void> {
    try {
      const instance = await this.instance.getClient();
      await instance.set(key, JSON.stringify(payload), {
        EX: ttl || 60 * 60 * 24,
      });
    } catch (e) {
      this.logger.error(e.toString());
    }
  }

  async setCacheValue(cacheKey: string, ttl?: number): Promise<number> {
    // fetch doc count from redis
    const existingCacheValue = await this.getCountFromRedis(cacheKey);

    // if key found in redis, inc it by 1
    if (existingCacheValue) {
      const count = Number(existingCacheValue);
      await this.updateCountInRedis(cacheKey, String(count + 1));
      return count + 1;
    } else {
      // if key not found in redis, set it to 1
      await this.setCountToRedis(cacheKey, String(1), ttl);
      return 1;
    }
  }

  async resetCacheValue(cacheKey: string, ttl?: number): Promise<void> {
    // fetch doc count from redis
    const existingCacheValue = await this.getCountFromRedis(cacheKey);

    // if key found in redis, inc it by 1
    if (existingCacheValue) {
      const count = Number(existingCacheValue);
      await this.updateCountInRedis(cacheKey, String(0));
      return;
    } else {
      // if key not found in redis, set it to 1
      await this.setCountToRedis(cacheKey, String(0), ttl);
      return;
    }
  }
}
