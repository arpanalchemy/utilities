import { Injectable } from '@nestjs/common';
import { RedisClientType } from 'redis';
import { createClient } from 'redis-mock';

@Injectable()
export class RedisInstanceMock {
  private client: RedisClientType;
  private async connect(): Promise<void> {
    this.client = createClient({ url: 'test' });
    return null;
  }
  async getClient(): Promise<RedisClientType> {
    await this.connect();
    return this.client;
  }
}
