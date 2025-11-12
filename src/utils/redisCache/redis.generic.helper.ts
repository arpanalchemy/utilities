import { Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { RedisInstance } from './redis.instance';
import { CacheTrack } from '../../decorators/cache/cacheTrack.decorator';
import { EXTERNAL_API_VALUES, EXTERNAL_API_FOR_STATUS } from '../../constants';
@Injectable()
export class RedisGenericHelper {
  @Inject()
  private readonly instance: RedisInstance;

  @Inject(WINSTON_MODULE_PROVIDER)
  private readonly logger: Logger;

  private TTL = 60 * 60 * 24;

  createCacheKeyFromPayload(
    module,
    payload: { [id: string]: boolean | string | number | number[] | string[] },
    prefix = '',
  ): string {
    if (!payload) return module;
    let ordered = Object.keys(payload)
      .sort()
      .reduce((obj, key) => {
        obj[key] = payload[key];
        return obj;
      }, {});
    ordered = Object.keys(ordered)
      .map((key) => {
        if (Array.isArray(ordered[key])) {
          return `${key}_${
            ordered[key].length > 0 ? ordered[key].join('_') : ''
          }`;
        } else {
          return `${key}_${ordered[key]}`;
        }
      })
      .join('_');
    if (typeof ordered === 'string') {
      if (!prefix) {
        return `${module}_${ordered}`;
      }
      return `${module}_${prefix}_${ordered}`;
    } else {
      return '';
    }
  }

  async deleteAssetDetailsCacheByAssetID(assetID: number): Promise<void> {
    const instance = await this.instance.getClient();
    const existingKeys = await instance.keys(
      `asset_details_assetID_${assetID}*`,
    );
    await Promise.all(existingKeys.map((key) => instance.del(key)));
  }

  async deleteAssetDetailsCacheByPartnerID(partnerID: number): Promise<void> {
    const instance = await this.instance.getClient();
    const existingKeys = await instance.keys(
      `asset_details_assetID_*_partnerID_*${partnerID}*`,
    );
    await Promise.all(existingKeys.map((key) => instance.del(key)));
  }

  async storeAssetDetailsCache(
    assetID: number,
    partnerIDs: number[],
    payload: any,
  ): Promise<void> {
    const cacheKey = this.createCacheKeyFromPayload('asset_details', {
      assetID,
      partnerID: partnerIDs,
    });
    const instance = await this.instance.getClient();
    await instance.set(cacheKey, JSON.stringify(payload));
  }

  @CacheTrack('asset_details')
  async getAssetDetailsCache(
    assetID: number,
    partnerIDs: number[],
  ): Promise<any | null> {
    const cacheKey = this.createCacheKeyFromPayload('asset_details', {
      assetID,
      partnerID: partnerIDs,
    });
    const instance = await this.instance.getClient();
    const payload = await instance.get(cacheKey);
    if (!payload || typeof payload !== 'string') {
      this.logger.info('Nothing in Cache, cache miss');
      return;
    }
    this.logger.info(`Cache exists for the key: ${cacheKey}`);
    return JSON.parse(payload);
  }

  async fetchOrSetCache(
    cacheKey: string,
    callbackFun: () => Promise<any>,
    ttl?: number,
  ): Promise<any | null> {
    try {
      cacheKey = this.createCacheKeyFromPayload(cacheKey, null);

      // Fetch the Redis client once and reuse
      const instance = await this.instance.getClient();

      // Check if the key exists in cache
      let response = await instance.get(cacheKey);
      if (!response || typeof response !== 'string') {
        this.logger.info(
          `Cache not exists for the key, so creating new: ${cacheKey}`,
        );

        // Execute the callback to get fresh data
        response = await callbackFun();

        // Store the result in cache with a TTL (default or provided)
        await instance.set(cacheKey, JSON.stringify(response), {
          EX: ttl ?? this.TTL,
        });
      } else {
        // Parse the cached response
        response = JSON.parse(response);
      }

      return response;
    } catch (error) {
      this.logger.error(`Error in fetchOrSetCache: ${error.message}`);
      return null; // Optionally, you can handle errors based on your app's requirements
    }
  }

  async deleteCacheKey(key: string): Promise<void> {
    const instance = await this.instance.getClient();
    const existingKeys = (await instance.keys(key)) || []; // Default to an empty array
    await Promise.all(existingKeys.map((key) => instance.del(key)));
  }

  async deleteCacheByKey(cacheKey: string): Promise<void> {
    const instance = await this.instance.getClient();
    await instance.del(cacheKey);
  }

  async incrementExternalApiFaultCounter(
    key: EXTERNAL_API_FOR_STATUS,
  ): Promise<void> {
    const instance = await this.instance.getClient();
    const values = EXTERNAL_API_VALUES[key];
    const existingKey = await instance.get(`STATUS_API_${key}`);
    let keyToUse = `STATUS_API_${key}`;
    let newPayload = {
      status: 'SUCCESS',
      count: 1,
      last_Failed_at: new Date(),
    };
    let ttl = values.timeToExpire;
    if (existingKey && typeof existingKey === 'string') {
      let payload = JSON.parse(existingKey);
      let newCount = payload.count + 1;
      let status = payload.status;
      if (newCount >= values.count) {
        status = 'FAILED';
      }
      newPayload = {
        status,
        count: newCount,
        last_Failed_at: new Date(),
      };
      await instance.set(keyToUse, JSON.stringify(newPayload), {
        KEEPTTL: true,
      });
    } else {
      await instance.set(keyToUse, JSON.stringify(newPayload), {
        EX: ttl,
      });
    }
  }

  async getThirdPartyApiStatus(key?: String): Promise<any | null> {
    const instance = await this.instance.getClient();
    let response = {};
    if (key) {
      const payload = await instance.get(`STATUS_API_${key}`);
      if (!payload || typeof payload !== 'string') {
        return response;
      }
      let parsedPayload = JSON.parse(payload);
      response = {
        [`${key}`]: parsedPayload?.status ?? 'SUCCESS',
      };
      return response;
    } else {
      let allKeys = Object.keys(EXTERNAL_API_VALUES);
      for (let key of allKeys) {
        response[key] = 'SUCCESS';
      }
      const existingKey = await instance.keys(`STATUS_API_*`);
      if (existingKey) {
        for (let redisKey of existingKey) {
          const payload = await instance.get(redisKey);
          if (!payload || typeof payload !== 'string') {
            continue;
          }
          const parsedPayload = JSON.parse(payload);
          const statusKey = redisKey.replace('STATUS_API_', '');
          response[statusKey] = parsedPayload.status;
        }
      }
      return response;
    }
  }

  async setCacheByKey(
    cacheKey: string,
    payload: any,
    ttl?: number,
  ): Promise<void> {
    try {
      // get logger instance
      this.logger.info('Getting redis instance.');
      const instance = await this.instance.getClient();

      // set cache in redis
      this.logger.info(
        `Setting cache in Redis.\nWhere CacheKey:- ${cacheKey}\nhas response:-  ${payload}.`,
      );
      await instance.set(cacheKey, JSON.stringify(payload), {
        EX: ttl ?? this.TTL,
      });
    } catch (error) {
      this.logger.error(
        `Error while getting redis instance or setting reponse.\n Error:- ${JSON.stringify(
          error,
        )}`,
      );
    }
  }

  async getCacheByKey(cacheKey: string): Promise<any> {
    try {
      // get logger instance
      this.logger.info('Getting redis instance.');
      const instance = await this.instance.getClient();

      // set cache in redis
      this.logger.info(`Fetching cache from Redis for key ${cacheKey}.`);

      const response = await instance.get(cacheKey);

      if (!response || typeof response !== 'string') {
        this.logger.info(`No resposne found for the key: ${cacheKey}`);
        return null;
      }

      return JSON.parse(response);
    } catch (error) {
      this.logger.error(
        `Error while getting cache for the given key: ${cacheKey}.`,
      );
    }
  }
}
