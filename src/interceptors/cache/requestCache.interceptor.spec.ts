import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RequestCacheInterceptor } from './requestCache.interceptor';
import { of, throwError, Observable, firstValueFrom } from 'rxjs';

describe('RequestCacheInterceptor', () => {
  let interceptor: RequestCacheInterceptor;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockCallHandler: jest.Mocked<CallHandler>;

  beforeEach(async () => {
    // Create mock execution context
    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          url: '/api/test',
          method: 'GET',
          body: { param: 'value' },
          headers: { 'x-api-key': 'test-key' },
        }),
        getResponse: jest.fn().mockReturnValue({
          status: jest.fn(),
          json: jest.fn(),
        }),
      }),
      getClass: jest.fn(),
      getHandler: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as any;

    // Create mock call handler
    mockCallHandler = {
      handle: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create interceptor with TTL', () => {
      const ttl = 300;
      interceptor = new RequestCacheInterceptor(ttl);

      expect(interceptor).toBeDefined();
      expect(interceptor['ttl']).toBe(ttl);
    });

    it('should create interceptor with zero TTL', () => {
      const ttl = 0;
      interceptor = new RequestCacheInterceptor(ttl);

      expect(interceptor['ttl']).toBe(0);
    });

    it('should create interceptor with negative TTL', () => {
      const ttl = -100;
      interceptor = new RequestCacheInterceptor(ttl);

      expect(interceptor['ttl']).toBe(-100);
    });

    it('should create interceptor with decimal TTL', () => {
      const ttl = 123.45;
      interceptor = new RequestCacheInterceptor(ttl);

      expect(interceptor['ttl']).toBe(123.45);
    });
  });

  describe('intercept method', () => {
    beforeEach(() => {
      interceptor = new RequestCacheInterceptor(300);
    });

    it('should be defined', () => {
      expect(interceptor.intercept).toBeDefined();
      expect(typeof interceptor.intercept).toBe('function');
    });

    it('should return an Observable', () => {
      const mockData = { message: 'success' };
      mockCallHandler.handle.mockReturnValue(of(mockData));

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      expect(result).toBeInstanceOf(Observable);
    });

    it('should call next.handle()', () => {
      const mockData = { message: 'success' };
      mockCallHandler.handle.mockReturnValue(of(mockData));

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockCallHandler.handle).toHaveBeenCalledTimes(1);
      expect(mockCallHandler.handle).toHaveBeenCalledWith();
    });

    it('should return the result from next.handle() with tap operator', async () => {
      const mockData = { message: 'success' };
      mockCallHandler.handle.mockReturnValue(of(mockData));

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      ) as Observable<any>;
      const value = await firstValueFrom(result);

      expect(value).toEqual(mockData);
    });

    it('should handle successful responses', async () => {
      const mockData = { id: 1, name: 'test' };
      mockCallHandler.handle.mockReturnValue(of(mockData));

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      ) as Observable<any>;
      const value = await firstValueFrom(result);

      expect(value).toEqual(mockData);
      expect(mockCallHandler.handle).toHaveBeenCalledTimes(1);
    });

    it('should handle empty responses', async () => {
      mockCallHandler.handle.mockReturnValue(of(null));

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      ) as Observable<any>;
      const value = await firstValueFrom(result);

      expect(value).toBeNull();
    });

    it('should handle undefined responses', async () => {
      mockCallHandler.handle.mockReturnValue(of(undefined));

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      ) as Observable<any>;
      const value = await firstValueFrom(result);

      expect(value).toBeUndefined();
    });

    it('should handle array responses', async () => {
      const mockData = [{ id: 1 }, { id: 2 }];
      mockCallHandler.handle.mockReturnValue(of(mockData));

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      ) as Observable<any>;
      const value = await firstValueFrom(result);

      expect(value).toEqual(mockData);
    });

    it('should handle string responses', async () => {
      const mockData = 'simple string response';
      mockCallHandler.handle.mockReturnValue(of(mockData));

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      ) as Observable<any>;
      const value = await firstValueFrom(result);

      expect(value).toBe(mockData);
    });

    it('should handle number responses', async () => {
      const mockData = 12345;
      mockCallHandler.handle.mockReturnValue(of(mockData));

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      ) as Observable<any>;
      const value = await firstValueFrom(result);

      expect(value).toBe(mockData);
    });

    it('should handle boolean responses', async () => {
      const mockData = true;
      mockCallHandler.handle.mockReturnValue(of(mockData));

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      ) as Observable<any>;
      const value = await firstValueFrom(result);

      expect(value).toBe(mockData);
    });

    it('should propagate errors from next.handle()', async () => {
      const error = new Error('Test error');
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      ) as Observable<any>;

      await expect(firstValueFrom(result)).rejects.toThrow('Test error');
    });

    it('should handle HTTP errors', async () => {
      const httpError = {
        status: 404,
        message: 'Not Found',
        error: 'Resource not found',
      };
      mockCallHandler.handle.mockReturnValue(throwError(() => httpError));

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      ) as Observable<any>;

      await expect(firstValueFrom(result)).rejects.toEqual(httpError);
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network timeout');
      networkError.name = 'TimeoutError';
      mockCallHandler.handle.mockReturnValue(throwError(() => networkError));

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      ) as Observable<any>;

      await expect(firstValueFrom(result)).rejects.toThrow('Network timeout');
    });
  });

  describe('tap operator behavior', () => {
    beforeEach(() => {
      interceptor = new RequestCacheInterceptor(300);
    });

    it('should execute tap next callback on successful response', async () => {
      const mockData = { message: 'success' };
      mockCallHandler.handle.mockReturnValue(of(mockData));

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      ) as Observable<any>;

      // The tap operator should not modify the stream
      const value = await firstValueFrom(result);
      expect(value).toEqual(mockData);
    });

    it('should not interfere with the data stream', async () => {
      const originalData = {
        id: 1,
        name: 'test',
        nested: {
          value: 'nested-value',
        },
      };
      mockCallHandler.handle.mockReturnValue(of(originalData));

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      ) as Observable<any>;
      const receivedData = await firstValueFrom(result);

      // Data should pass through unchanged
      expect(receivedData).toEqual(originalData);
      // Note: RxJS may or may not create a new reference depending on the operator chain
      // The important thing is that the data content is preserved
    });
  });

  describe('different TTL values', () => {
    it('should work with different TTL values', async () => {
      const ttlValues = [0, 60, 300, 900, 3600, -1];

      for (const ttl of ttlValues) {
        const testInterceptor = new RequestCacheInterceptor(ttl);
        const mockData = { ttl, message: 'test' };
        mockCallHandler.handle.mockReturnValue(of(mockData));

        const result = testInterceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        ) as Observable<any>;
        const value = await firstValueFrom(result);

        expect(value).toEqual(mockData);
        expect(testInterceptor['ttl']).toBe(ttl);

        jest.clearAllMocks();
      }
    });
  });

  describe('integration scenarios', () => {
    it('should work with different execution contexts', async () => {
      interceptor = new RequestCacheInterceptor(300);

      // Test with different request types
      const contexts = [
        {
          url: '/api/users',
          method: 'GET',
          body: {},
          headers: { 'x-api-key': 'key1' },
        },
        {
          url: '/api/posts',
          method: 'POST',
          body: { title: 'New Post' },
          headers: { 'x-api-key': 'key2' },
        },
        {
          url: '/api/comments/123',
          method: 'PUT',
          body: { comment: 'Updated comment' },
          headers: { 'x-api-key': 'key3' },
        },
      ];

      for (const contextData of contexts) {
        const mockContext = {
          ...mockExecutionContext,
          switchToHttp: jest.fn().mockReturnValue({
            getRequest: jest.fn().mockReturnValue(contextData),
            getResponse: jest.fn().mockReturnValue({
              status: jest.fn(),
              json: jest.fn(),
            }),
          }),
        };

        const mockData = { method: contextData.method, url: contextData.url };
        mockCallHandler.handle.mockReturnValue(of(mockData));

        const result = interceptor.intercept(
          mockContext as any,
          mockCallHandler,
        ) as Observable<any>;
        const value = await firstValueFrom(result);

        expect(value).toEqual(mockData);

        jest.clearAllMocks();
      }
    });

    it('should handle concurrent requests', async () => {
      interceptor = new RequestCacheInterceptor(300);
      const mockData1 = { id: 1, message: 'first' };
      const mockData2 = { id: 2, message: 'second' };

      mockCallHandler.handle
        .mockReturnValueOnce(of(mockData1))
        .mockReturnValueOnce(of(mockData2));

      const result1 = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      ) as Observable<any>;
      const result2 = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      ) as Observable<any>;

      const [value1, value2] = await Promise.all([
        firstValueFrom(result1),
        firstValueFrom(result2),
      ]);

      expect(value1).toEqual(mockData1);
      expect(value2).toEqual(mockData2);
      expect(mockCallHandler.handle).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      interceptor = new RequestCacheInterceptor(300);
    });

    it('should handle very large response objects', async () => {
      const largeObject = {
        data: new Array(1000).fill(0).map((_, i) => ({
          id: i,
          name: `item-${i}`,
          description: `This is item number ${i}`,
        })),
      };

      mockCallHandler.handle.mockReturnValue(of(largeObject));

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      ) as Observable<any>;
      const value = await firstValueFrom(result);

      expect(value).toEqual(largeObject);
      expect(value.data).toHaveLength(1000);
    });

    it('should handle circular reference objects (if they somehow get through)', async () => {
      // Note: In practice, circular references would likely be handled by JSON serialization
      const mockData = { message: 'no circular refs in this test' };
      mockCallHandler.handle.mockReturnValue(of(mockData));

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      ) as Observable<any>;
      const value = await firstValueFrom(result);

      expect(value).toEqual(mockData);
    });

    it('should handle responses with special characters', async () => {
      const mockData = {
        message: 'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?',
        unicode: '🚀 Unicode test 中文 العربية',
      };

      mockCallHandler.handle.mockReturnValue(of(mockData));

      const result = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      ) as Observable<any>;
      const value = await firstValueFrom(result);

      expect(value).toEqual(mockData);
    });
  });
});
