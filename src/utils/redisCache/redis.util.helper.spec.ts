import { Test } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { RedisUtilHelper } from './redis.util.helper';
import { RedisInstance } from './redis.instance';

describe('RedisUtilHelper test cases', () => {
  let module: RedisUtilHelper;

  beforeEach(async () => {
    const test = await Test.createTestingModule({
      providers: [
        RedisUtilHelper,
        {
          provide: RedisInstance,
          useValue: {
            getClient: () => {
              return {
                set: () => {},
                get: () => {},
              };
            },
          },
        },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: {
            error: () => {},
            info: () => {},
          },
        },
      ],
    }).compile();
    module = test.get<RedisUtilHelper>(RedisUtilHelper);
  });

  it('getCountFromRedis should call get method on redis instance and return parsed payload', async () => {
    const mockInstance = {
      get: jest.fn().mockResolvedValue(JSON.stringify('payload')),
    };
    jest
      .spyOn((module as any).instance as any, 'getClient')
      .mockResolvedValue(mockInstance as any);

    const result = await (module as any).getCountFromRedis('key');

    expect(mockInstance.get).toHaveBeenCalledWith('key');
    expect(result).toEqual('payload');
  });

  it('getCountFromRedis should return undefined when no payload found in redis instance', async () => {
    const mockInstance = {
      get: jest.fn().mockResolvedValue(null),
    };
    jest
      .spyOn((module as any).instance, 'getClient')
      .mockResolvedValue(mockInstance as any);

    const result = await (module as any).getCountFromRedis('key');

    expect(mockInstance.get).toHaveBeenCalledWith('key');
    expect(result).toBeUndefined();
  });

  it('setCountToRedis should call set method on redis instance with EX option', async () => {
    const mockInstance = {
      set: jest.fn(),
    };
    jest
      .spyOn((module as any).instance, 'getClient')
      .mockResolvedValue(mockInstance as any);

    await (module as any).setCountToRedis('key', 'payload');

    expect(mockInstance.set).toHaveBeenCalledWith(
      'key',
      JSON.stringify('payload'),
      { EX: 60 * 60 * 24 },
    );
  });

  it('setCountToRedis should call set method on redis instance with KEEPTTL option', async () => {
    const mockInstance = {
      set: jest.fn(),
    };
    jest
      .spyOn((module as any).instance as any, 'getClient')
      .mockResolvedValue(mockInstance as any);

    await (module as any).updateCountInRedis('key', 'payload');

    expect(mockInstance.set).toHaveBeenCalledWith(
      'key',
      JSON.stringify('payload'),
      { KEEPTTL: true },
    );
  });

  it('setCacheValue should increment cache value when existing cache value is less than 2', async () => {
    const moduleID = 1;
    const type = 'someType';
    const docSubType = 'someDocSubType';
    const cacheKey = '1_someType_someDocSubType';

    jest.spyOn(module as any, 'getCountFromRedis').mockResolvedValue('1');

    const updateCountInRedisSpy = jest
      .spyOn(module as any, 'updateCountInRedis')
      .mockResolvedValue(undefined);

    const result = await module.setCacheValue(cacheKey);

    expect(updateCountInRedisSpy).toHaveBeenCalledWith(cacheKey, '2');
    expect(result).toBe(2);
  });

  it('setCacheValue should set cache value to 1 when no existing cache value', async () => {
    const moduleID = 1;
    const type = 'someType';
    const docSubType = 'someDocSubType';
    const cacheKey = '1_someType_someDocSubType';

    jest.spyOn(module as any, 'getCountFromRedis').mockResolvedValue(null);

    const setCountToRedisSpy = jest
      .spyOn(module as any, 'setCountToRedis')
      .mockResolvedValue(undefined);

    const result = await module.setCacheValue(cacheKey);

    expect(setCountToRedisSpy).toHaveBeenCalledWith(cacheKey, '1', undefined);
    expect(result).toBe(1);

    setCountToRedisSpy.mockRestore();
  });

  it('resetCacheValue should reset cache value to 0 when existing cache value is found', async () => {
    const cacheKey = '1_someType_someDocSubType';
    jest.spyOn(module as any, 'getCountFromRedis').mockResolvedValue('2');
    const updateCountInRedisSpy = jest
      .spyOn(module as any, 'updateCountInRedis')
      .mockResolvedValue(undefined);
    const result = await module.resetCacheValue(cacheKey);
    expect(updateCountInRedisSpy).toHaveBeenCalledWith(cacheKey, '0');
    expect(result).toBe(undefined);
  });
});
