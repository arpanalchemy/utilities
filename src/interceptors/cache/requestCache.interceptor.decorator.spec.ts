import { UseCached } from './requestCache.interceptor.decorator';
import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { RequestCacheInterceptor } from './requestCache.interceptor';

// Mock the NestJS decorators
jest.mock('@nestjs/common', () => ({
  applyDecorators: jest.fn(),
  UseInterceptors: jest.fn(),
}));

// Mock the RequestCacheInterceptor
jest.mock('./requestCache.interceptor', () => ({
  RequestCacheInterceptor: jest.fn(),
}));

describe('UseCached Decorator', () => {
  let mockApplyDecorators: jest.MockedFunction<typeof applyDecorators>;
  let mockUseInterceptors: jest.MockedFunction<typeof UseInterceptors>;
  let mockRequestCacheInterceptor: jest.MockedClass<
    typeof RequestCacheInterceptor
  >;

  beforeEach(() => {
    mockApplyDecorators = applyDecorators as jest.MockedFunction<
      typeof applyDecorators
    >;
    mockUseInterceptors = UseInterceptors as jest.MockedFunction<
      typeof UseInterceptors
    >;
    mockRequestCacheInterceptor = RequestCacheInterceptor as jest.MockedClass<
      typeof RequestCacheInterceptor
    >;

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock implementations
    mockApplyDecorators.mockReturnValue(jest.fn());
    mockUseInterceptors.mockReturnValue(jest.fn());
    mockRequestCacheInterceptor.mockImplementation(
      (ttl: number) =>
        ({
          ttl,
          intercept: jest.fn(),
        } as any),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('UseCached function', () => {
    it('should be defined', () => {
      expect(UseCached).toBeDefined();
      expect(typeof UseCached).toBe('function');
    });

    it('should create RequestCacheInterceptor with correct TTL', () => {
      const ttl = 300; // 5 minutes

      UseCached(ttl);

      expect(mockRequestCacheInterceptor).toHaveBeenCalledTimes(1);
      expect(mockRequestCacheInterceptor).toHaveBeenCalledWith(ttl);
    });

    it('should call UseInterceptors with RequestCacheInterceptor instance', () => {
      const ttl = 600; // 10 minutes
      const mockInterceptorInstance = { ttl, intercept: jest.fn() };
      mockRequestCacheInterceptor.mockReturnValue(
        mockInterceptorInstance as any,
      );

      UseCached(ttl);

      expect(mockUseInterceptors).toHaveBeenCalledTimes(1);
      expect(mockUseInterceptors).toHaveBeenCalledWith(mockInterceptorInstance);
    });

    it('should call applyDecorators with UseInterceptors result', () => {
      const ttl = 900; // 15 minutes
      const mockUseInterceptorsResult = jest.fn();
      mockUseInterceptors.mockReturnValue(mockUseInterceptorsResult);

      UseCached(ttl);

      expect(mockApplyDecorators).toHaveBeenCalledTimes(1);
      expect(mockApplyDecorators).toHaveBeenCalledWith(
        mockUseInterceptorsResult,
      );
    });

    it('should return the result of applyDecorators', () => {
      const ttl = 1200; // 20 minutes
      const mockDecoratorResult = jest.fn();
      mockApplyDecorators.mockReturnValue(mockDecoratorResult);

      const result = UseCached(ttl);

      expect(result).toBe(mockDecoratorResult);
    });

    it('should handle zero TTL', () => {
      const ttl = 0;

      UseCached(ttl);

      expect(mockRequestCacheInterceptor).toHaveBeenCalledWith(0);
    });

    it('should handle negative TTL', () => {
      const ttl = -100;

      UseCached(ttl);

      expect(mockRequestCacheInterceptor).toHaveBeenCalledWith(-100);
    });

    it('should handle very large TTL', () => {
      const ttl = Number.MAX_SAFE_INTEGER;

      UseCached(ttl);

      expect(mockRequestCacheInterceptor).toHaveBeenCalledWith(ttl);
    });

    it('should handle decimal TTL', () => {
      const ttl = 123.456;

      UseCached(ttl);

      expect(mockRequestCacheInterceptor).toHaveBeenCalledWith(ttl);
    });
  });

  describe('Integration with NestJS decorators', () => {
    it('should create a proper decorator chain', () => {
      const ttl = 300;

      // Reset mocks to use real implementations for this test
      jest.resetAllMocks();

      // Mock the actual decorator behavior
      const mockInterceptorDecorator = jest.fn();
      const mockFinalDecorator = jest.fn();

      mockUseInterceptors.mockReturnValue(mockInterceptorDecorator);
      mockApplyDecorators.mockReturnValue(mockFinalDecorator);

      const result = UseCached(ttl);

      // Verify the chain of calls
      expect(mockRequestCacheInterceptor).toHaveBeenCalledWith(ttl);
      expect(mockUseInterceptors).toHaveBeenCalledTimes(1);
      expect(mockApplyDecorators).toHaveBeenCalledWith(
        mockInterceptorDecorator,
      );
      expect(result).toBe(mockFinalDecorator);
    });
  });

  describe('Usage scenarios', () => {
    it('should work with typical cache durations', () => {
      const commonTtlValues = [
        60, // 1 minute
        300, // 5 minutes
        900, // 15 minutes
        1800, // 30 minutes
        3600, // 1 hour
        86400, // 1 day
      ];

      commonTtlValues.forEach((ttl) => {
        jest.clearAllMocks();

        UseCached(ttl);

        expect(mockRequestCacheInterceptor).toHaveBeenCalledWith(ttl);
        expect(mockUseInterceptors).toHaveBeenCalledTimes(1);
        expect(mockApplyDecorators).toHaveBeenCalledTimes(1);
      });
    });

    it('should be usable as a method decorator', () => {
      const ttl = 300;
      const mockDecoratorFunction = jest.fn();
      mockApplyDecorators.mockReturnValue(mockDecoratorFunction);

      class TestController {
        @UseCached(ttl)
        testMethod() {
          return 'test';
        }
      }

      // The decorator should have been applied
      expect(mockRequestCacheInterceptor).toHaveBeenCalledWith(ttl);
      expect(mockApplyDecorators).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error handling', () => {
    it('should handle RequestCacheInterceptor constructor errors', () => {
      const ttl = 300;
      const error = new Error('Interceptor creation failed');
      mockRequestCacheInterceptor.mockImplementation(() => {
        throw error;
      });

      expect(() => UseCached(ttl)).toThrow('Interceptor creation failed');
    });

    it('should handle UseInterceptors errors', () => {
      const ttl = 300;
      const error = new Error('UseInterceptors failed');
      mockUseInterceptors.mockImplementation(() => {
        throw error;
      });

      expect(() => UseCached(ttl)).toThrow('UseInterceptors failed');
    });

    it('should handle applyDecorators errors', () => {
      const ttl = 300;
      const error = new Error('applyDecorators failed');
      mockApplyDecorators.mockImplementation(() => {
        throw error;
      });

      expect(() => UseCached(ttl)).toThrow('applyDecorators failed');
    });
  });
});
