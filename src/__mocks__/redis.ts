import { RedisClientOptions } from '@redis/client';

export const createClient = (params: RedisClientOptions): any => {
  return {
    emits: {},
    async connect() {
      this.emits['connect']();
      return null;
    },
    on(type, fn) {
      this.emits[type] = fn;
    },
    quit() {
      return null;
    },
  };
};
