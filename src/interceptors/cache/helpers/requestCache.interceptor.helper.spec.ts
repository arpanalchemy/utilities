import { RequestCacheHelper } from './requestCache.interceptor.helper';
import { RedisInstance } from '../../../utils/redisCache/redis.instance';

describe('RequestCacheHelper', () => {
  let requestCacheHelper: RequestCacheHelper;
  let mockRedisInstance: jest.Mocked<RedisInstance>;
  let mockHttpContext: any;
  let mockRedisClient: any;

  beforeEach(() => {
    // Mock Redis client
    mockRedisClient = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    // Mock RedisInstance
    mockRedisInstance = {
      getClient: jest.fn().mockResolvedValue(mockRedisClient),
    } as any;

    // Mock HTTP context (Request object)
    mockHttpContext = {
      url: '/api/test',
      method: 'GET',
      body: { param: 'value' },
      headers: {
        'x-api-key': 'test-api-key',
      },
    };

    requestCacheHelper = new RequestCacheHelper(
      mockRedisInstance,
      mockHttpContext,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create an instance and call getRequestKey', () => {
      expect(requestCacheHelper).toBeDefined();
      expect(requestCacheHelper['url']).toBeDefined();
    });

    it('should generate correct cache key with object body', () => {
      const helper = new RequestCacheHelper(mockRedisInstance, mockHttpContext);
      const expectedKey = 'url__GET_test-api-key_/api/test_{"param":"value"}';
      expect(helper['url']).toBe(expectedKey);
    });

    it('should generate correct cache key with string body', () => {
      const contextWithStringBody = {
        ...mockHttpContext,
        body: 'string-body',
      };
      const helper = new RequestCacheHelper(
        mockRedisInstance,
        contextWithStringBody,
      );
      const expectedKey = 'url__GET_test-api-key_/api/test_string-body';
      expect(helper['url']).toBe(expectedKey);
    });

    it('should generate correct cache key with null body', () => {
      const contextWithNullBody = {
        ...mockHttpContext,
        body: null,
      };
      const helper = new RequestCacheHelper(
        mockRedisInstance,
        contextWithNullBody,
      );
      const expectedKey = 'url__GET_test-api-key_/api/test_null';
      expect(helper['url']).toBe(expectedKey);
    });

    it('should generate correct cache key with undefined body', () => {
      const contextWithUndefinedBody = {
        ...mockHttpContext,
        body: undefined,
      };
      const helper = new RequestCacheHelper(
        mockRedisInstance,
        contextWithUndefinedBody,
      );
      const expectedKey = 'url__GET_test-api-key_/api/test_undefined';
      expect(helper['url']).toBe(expectedKey);
    });

    it('should use "NoSub" when x-api-key header is missing', () => {
      const contextWithoutApiKey = {
        ...mockHttpContext,
        headers: {},
      };
      const helper = new RequestCacheHelper(
        mockRedisInstance,
        contextWithoutApiKey,
      );
      const expectedKey = 'url__GET_NoSub_/api/test_{"param":"value"}';
      expect(helper['url']).toBe(expectedKey);
    });

    it('should handle different HTTP methods', () => {
      const contextWithPost = {
        ...mockHttpContext,
        method: 'POST',
      };
      const helper = new RequestCacheHelper(mockRedisInstance, contextWithPost);
      const expectedKey = 'url__POST_test-api-key_/api/test_{"param":"value"}';
      expect(helper['url']).toBe(expectedKey);
    });

    it('should handle complex URLs with query parameters', () => {
      const contextWithQuery = {
        ...mockHttpContext,
        url: '/api/test?param1=value1&param2=value2',
      };
      const helper = new RequestCacheHelper(
        mockRedisInstance,
        contextWithQuery,
      );
      const expectedKey =
        'url__GET_test-api-key_/api/test?param1=value1&param2=value2_{"param":"value"}';
      expect(helper['url']).toBe(expectedKey);
    });

    it('should handle nested object in body', () => {
      const contextWithNestedBody = {
        ...mockHttpContext,
        body: {
          user: {
            id: 1,
            name: 'John',
            preferences: {
              theme: 'dark',
              notifications: true,
            },
          },
        },
      };
      const helper = new RequestCacheHelper(
        mockRedisInstance,
        contextWithNestedBody,
      );
      const expectedBodyString = JSON.stringify(contextWithNestedBody.body);
      const expectedKey = `url__GET_test-api-key_/api/test_${expectedBodyString}`;
      expect(helper['url']).toBe(expectedKey);
    });
  });

  describe('getData', () => {
    it('should call redis client get method with correct key', async () => {
      const expectedData = { result: 'cached-data' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(expectedData));

      const result = await requestCacheHelper.getData();

      expect(mockRedisInstance.getClient).toHaveBeenCalledTimes(1);
      expect(mockRedisClient.get).toHaveBeenCalledWith(
        requestCacheHelper['url'],
      );
      expect(result).toBe(JSON.stringify(expectedData));
    });

    it('should return null when no cached data exists', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await requestCacheHelper.getData();

      expect(mockRedisInstance.getClient).toHaveBeenCalledTimes(1);
      expect(mockRedisClient.get).toHaveBeenCalledWith(
        requestCacheHelper['url'],
      );
      expect(result).toBeNull();
    });

    it('should handle redis client errors', async () => {
      const error = new Error('Redis connection failed');
      mockRedisClient.get.mockRejectedValue(error);

      await expect(requestCacheHelper.getData()).rejects.toThrow(
        'Redis connection failed',
      );
      expect(mockRedisInstance.getClient).toHaveBeenCalledTimes(1);
      expect(mockRedisClient.get).toHaveBeenCalledWith(
        requestCacheHelper['url'],
      );
    });

    it('should handle redis instance getClient errors', async () => {
      const error = new Error('Failed to get Redis client');
      mockRedisInstance.getClient.mockRejectedValue(error);

      await expect(requestCacheHelper.getData()).rejects.toThrow(
        'Failed to get Redis client',
      );
      expect(mockRedisInstance.getClient).toHaveBeenCalledTimes(1);
      expect(mockRedisClient.get).not.toHaveBeenCalled();
    });

    it('should return string data as is', async () => {
      const stringData = 'simple-string-data';
      mockRedisClient.get.mockResolvedValue(stringData);

      const result = await requestCacheHelper.getData();

      expect(result).toBe(stringData);
    });

    it('should return empty string when redis returns empty string', async () => {
      mockRedisClient.get.mockResolvedValue('');

      const result = await requestCacheHelper.getData();

      expect(result).toBe('');
    });
  });

  describe('private methods', () => {
    describe('getRequestKey', () => {
      it('should handle special characters in URL', () => {
        const contextWithSpecialChars = {
          ...mockHttpContext,
          url: '/api/test/special-chars!@#$%^&*()',
        };
        const helper = new RequestCacheHelper(
          mockRedisInstance,
          contextWithSpecialChars,
        );
        const expectedKey =
          'url__GET_test-api-key_/api/test/special-chars!@#$%^&*()_{"param":"value"}';
        expect(helper['url']).toBe(expectedKey);
      });

      it('should handle empty string body', () => {
        const contextWithEmptyBody = {
          ...mockHttpContext,
          body: '',
        };
        const helper = new RequestCacheHelper(
          mockRedisInstance,
          contextWithEmptyBody,
        );
        const expectedKey = 'url__GET_test-api-key_/api/test_';
        expect(helper['url']).toBe(expectedKey);
      });

      it('should handle array body', () => {
        const contextWithArrayBody = {
          ...mockHttpContext,
          body: [1, 2, 3, 'test'],
        };
        const helper = new RequestCacheHelper(
          mockRedisInstance,
          contextWithArrayBody,
        );
        const expectedKey = 'url__GET_test-api-key_/api/test_[1,2,3,"test"]';
        expect(helper['url']).toBe(expectedKey);
      });

      it('should handle boolean body', () => {
        const contextWithBooleanBody = {
          ...mockHttpContext,
          body: true,
        };
        const helper = new RequestCacheHelper(
          mockRedisInstance,
          contextWithBooleanBody,
        );
        const expectedKey = 'url__GET_test-api-key_/api/test_true';
        expect(helper['url']).toBe(expectedKey);
      });

      it('should handle number body', () => {
        const contextWithNumberBody = {
          ...mockHttpContext,
          body: 12345,
        };
        const helper = new RequestCacheHelper(
          mockRedisInstance,
          contextWithNumberBody,
        );
        const expectedKey = 'url__GET_test-api-key_/api/test_12345';
        expect(helper['url']).toBe(expectedKey);
      });
    });
  });
});
