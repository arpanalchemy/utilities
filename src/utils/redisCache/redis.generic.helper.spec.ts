import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { RedisGenericHelper } from './redis.generic.helper';
import { RedisInstance } from './redis.instance';

jest.mock('newrelic', () => ({
  addCustomAttribute: jest.fn(),
}));

describe('RedisGenericHelper', () => {
  let redisGenericHelper: RedisGenericHelper;
  let redisInstanceMock: RedisInstance;
  let loggerMock: Logger;
  let getClientSpy: jest.SpyInstance;

  beforeEach(async () => {
    redisInstanceMock = {
      getClient: jest.fn().mockResolvedValue({
        keys: jest.fn(),
        del: jest.fn(),
        set: jest.fn(),
        get: jest.fn(),
      }),
    } as any;

    loggerMock = {
      info: jest.fn(),
      error: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisGenericHelper,
        { provide: RedisInstance, useValue: redisInstanceMock },
        { provide: WINSTON_MODULE_PROVIDER, useValue: loggerMock },
      ],
    }).compile();

    redisGenericHelper = module.get<RedisGenericHelper>(RedisGenericHelper);
    getClientSpy = jest.spyOn(redisInstanceMock, 'getClient');
  });

  it('should be defined', () => {
    expect(redisGenericHelper).toBeDefined();
  });

  describe('createCacheKeyFromPayload', () => {
    it('should create a cache key from payload', () => {
      const payload = { id: 1, name: 'test' };
      const result = redisGenericHelper.createCacheKeyFromPayload(
        'module',
        payload,
      );
      expect(result).toBe('module_id_1_name_test');
    });

    it('should create a cache key with prefix', () => {
      const payload = { id: 1, name: 'test' };
      const result = redisGenericHelper.createCacheKeyFromPayload(
        'module',
        payload,
        'prefix',
      );
      expect(result).toBe('module_prefix_id_1_name_test');
    });
  });

  describe('deleteAssetDetailsCacheByAssetID', () => {
    it('should delete cache by asset ID', async () => {
      const keysMock = ['key1', 'key2'];

      const mockInstance = {
        get: jest.fn().mockResolvedValue(JSON.stringify('payload')),
        keys: jest.fn().mockResolvedValue(keysMock),
        del: jest.fn(),
      };
      jest
        .spyOn((redisGenericHelper as any).instance as any, 'getClient')
        .mockResolvedValue(mockInstance as any);

      await redisGenericHelper.deleteAssetDetailsCacheByAssetID(1);

      expect(getClientSpy).toHaveBeenCalled();
      expect(mockInstance.keys).toHaveBeenCalledWith(
        'asset_details_assetID_1*',
      );
      expect(mockInstance.del).toHaveBeenCalledTimes(keysMock.length);
    });
  });

  describe('deleteAssetDetailsCacheByPartnerID', () => {
    it('should delete cache by partner ID', async () => {
      const keysMock = ['key1', 'key2'];
      const mockInstance = {
        get: jest.fn().mockResolvedValue(JSON.stringify('payload')),
        keys: jest.fn().mockResolvedValue(keysMock),
        del: jest.fn(),
      };
      jest
        .spyOn((redisGenericHelper as any).instance as any, 'getClient')
        .mockResolvedValue(mockInstance as any);

      await redisGenericHelper.deleteAssetDetailsCacheByPartnerID(1);

      expect(getClientSpy).toHaveBeenCalled();
      expect(mockInstance.keys).toHaveBeenCalledWith(
        'asset_details_assetID_*_partnerID_*1*',
      );
      expect(mockInstance.del).toHaveBeenCalledTimes(keysMock.length);
    });
  });

  describe('storeAssetDetailsCache', () => {
    it('should store asset details in cache', async () => {
      const payload = { data: 'test' };
      const cacheKey = 'asset_details_assetID_1_partnerID_1_2';

      const mockInstance = {
        set: jest.fn(),
      };
      jest
        .spyOn((redisGenericHelper as any).instance as any, 'getClient')
        .mockResolvedValue(mockInstance as any);

      jest
        .spyOn(redisGenericHelper, 'createCacheKeyFromPayload')
        .mockReturnValue(cacheKey);

      await redisGenericHelper.storeAssetDetailsCache(1, [1, 2], payload);

      expect(getClientSpy).toHaveBeenCalled();
      expect(redisGenericHelper.createCacheKeyFromPayload).toHaveBeenCalledWith(
        'asset_details',
        { assetID: 1, partnerID: [1, 2] },
      );
      expect(mockInstance.set).toHaveBeenCalledWith(
        cacheKey,
        JSON.stringify(payload),
      );
    });
  });

  describe('getAssetDetailsCache', () => {
    it('should return null if cache does not exist', async () => {
      const cacheKey = 'asset_details_assetID_1_partnerID_1_2';

      const mockInstance = {
        get: jest.fn().mockResolvedValue(null),
      };
      jest
        .spyOn((redisGenericHelper as any).instance as any, 'getClient')
        .mockResolvedValue(mockInstance as any);

      mockInstance.get = jest.fn().mockResolvedValue(null);

      jest
        .spyOn(redisGenericHelper, 'createCacheKeyFromPayload')
        .mockReturnValue(cacheKey);

      await redisGenericHelper.getAssetDetailsCache(1, [1, 2]);

      expect(getClientSpy).toHaveBeenCalled();
      expect(redisGenericHelper.createCacheKeyFromPayload).toHaveBeenCalledWith(
        'asset_details',
        { assetID: 1, partnerID: [1, 2] },
      );
      expect(mockInstance.get).toHaveBeenCalledWith(cacheKey);
    });

    it('should return payload if cache exists', async () => {
      const cacheKey = 'asset_details_assetID_1_partnerID_1_2';
      const payload = { data: 'test' };

      const mockInstance = {
        get: jest.fn().mockResolvedValue(JSON.stringify(payload)),
      };
      jest
        .spyOn((redisGenericHelper as any).instance as any, 'getClient')
        .mockResolvedValue(mockInstance as any);

      jest
        .spyOn(redisGenericHelper, 'createCacheKeyFromPayload')
        .mockReturnValue(cacheKey);

      const result = await redisGenericHelper.getAssetDetailsCache(1, [1, 2]);

      expect(getClientSpy).toHaveBeenCalled();
      expect(redisGenericHelper.createCacheKeyFromPayload).toHaveBeenCalledWith(
        'asset_details',
        { assetID: 1, partnerID: [1, 2] },
      );
      expect(mockInstance.get).toHaveBeenCalledWith(cacheKey);
      expect(loggerMock.info).toHaveBeenCalledWith(
        `Cache exists for the key: ${cacheKey}`,
      );
      expect(result).toEqual(payload);
    });
  });

  describe('fetchOrSetCache', () => {
    it('should return cached data if it exists', async () => {
      const cacheKey = 'test_cache_key';
      const cachedData = { data: 'test' };

      const mockInstance = {
        get: jest.fn().mockResolvedValue(JSON.stringify(cachedData)),
        set: jest.fn(),
      };
      jest
        .spyOn((redisGenericHelper as any).instance, 'getClient')
        .mockResolvedValue(mockInstance);

      const result = await redisGenericHelper.fetchOrSetCache(
        cacheKey,
        jest.fn(),
      );

      expect(mockInstance.get).toHaveBeenCalledWith(cacheKey);
      expect(mockInstance.set).not.toHaveBeenCalled();
      expect(result).toEqual(cachedData);
    });

    it('should call callback and store the result if cache does not exist', async () => {
      const cacheKey = 'test_cache_key';
      const callbackResult = { data: 'fresh' };
      const mockCallback = jest.fn().mockResolvedValue(callbackResult);

      const mockInstance = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn(),
      };
      jest
        .spyOn((redisGenericHelper as any).instance, 'getClient')
        .mockResolvedValue(mockInstance);

      const result = await redisGenericHelper.fetchOrSetCache(
        cacheKey,
        mockCallback,
        300,
      );

      expect(mockInstance.get).toHaveBeenCalledWith(cacheKey);
      expect(mockCallback).toHaveBeenCalled();
      expect(mockInstance.set).toHaveBeenCalledWith(
        cacheKey,
        JSON.stringify(callbackResult),
        { EX: 300 },
      );
      expect(result).toEqual(callbackResult);
    });

    it('should use the default TTL if not provided', async () => {
      const cacheKey = 'test_cache_key';
      const callbackResult = { data: 'fresh' };
      const mockCallback = jest.fn().mockResolvedValue(callbackResult);

      const mockInstance = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn(),
      };
      jest
        .spyOn((redisGenericHelper as any).instance, 'getClient')
        .mockResolvedValue(mockInstance);

      (redisGenericHelper as any).TTL = 600;

      const result = await redisGenericHelper.fetchOrSetCache(
        cacheKey,
        mockCallback,
      );

      expect(mockInstance.get).toHaveBeenCalledWith(cacheKey);
      expect(mockCallback).toHaveBeenCalled();
      expect(mockInstance.set).toHaveBeenCalledWith(
        cacheKey,
        JSON.stringify(callbackResult),
        { EX: 600 },
      );
      expect(result).toEqual(callbackResult);
    });

    it('should return null and log error if an exception occurs', async () => {
      const cacheKey = 'test_cache_key';
      const errorMessage = 'Something went wrong';
      const mockCallback = jest.fn();

      const mockInstance = {
        get: jest.fn().mockRejectedValue(new Error(errorMessage)),
        set: jest.fn(),
      };
      jest
        .spyOn((redisGenericHelper as any).instance, 'getClient')
        .mockResolvedValue(mockInstance);

      jest
        .spyOn((redisGenericHelper as any).logger, 'error')
        .mockImplementation(() => {});

      const result = await redisGenericHelper.fetchOrSetCache(
        cacheKey,
        mockCallback,
      );

      expect((redisGenericHelper as any).logger.error).toHaveBeenCalledWith(
        `Error in fetchOrSetCache: ${errorMessage}`,
      );
      expect(result).toBeNull();
    });
  });

  describe('deleteCacheKey', () => {
    it('should delete cached key if it exists', async () => {
      const cacheKey = 'test_cache_key';

      const mockInstance = {
        keys: jest.fn().mockResolvedValue([cacheKey]), // Ensure it returns an array
        del: jest.fn(),
      };
      jest
        .spyOn((redisGenericHelper as any).instance, 'getClient')
        .mockResolvedValue(mockInstance);

      await redisGenericHelper.deleteCacheKey(cacheKey);

      expect(mockInstance.del).toHaveBeenCalledWith(cacheKey);
    });
  });

  describe('setCache', () => {
    it('should set cache with the given key and payload', async () => {
      const cacheKey = 'test_cache_key';
      const payload = { data: 'test' };
      const ttl = 300;

      const mockInstance = {
        set: jest.fn(),
      };
      jest
        .spyOn((redisGenericHelper as any).instance, 'getClient')
        .mockResolvedValue(mockInstance);

      await redisGenericHelper.setCacheByKey(cacheKey, payload, ttl);

      expect(mockInstance.set).toHaveBeenCalledWith(
        cacheKey,
        JSON.stringify(payload),
        { EX: ttl },
      );
    });
  });

  describe('getCache', () => {
    it('should return cached data if it exists', async () => {
      const cacheKey = 'test_cache_key';
      const payload = { data: 'test' };

      const mockInstance = {
        get: jest.fn().mockResolvedValue(JSON.stringify(payload)),
      };
      jest
        .spyOn((redisGenericHelper as any).instance, 'getClient')
        .mockResolvedValue(mockInstance);

      const result = await redisGenericHelper.getCacheByKey(cacheKey);

      expect(mockInstance.get).toHaveBeenCalledWith(cacheKey);
      expect(result).toEqual(payload);
    });
  });
});
