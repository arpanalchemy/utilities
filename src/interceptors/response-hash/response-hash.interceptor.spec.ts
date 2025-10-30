import { Test, TestingModule } from '@nestjs/testing';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { of, throwError, Observable, firstValueFrom } from 'rxjs';
import { ResponseHashInterceptor } from './response-hash.interceptor';
import { CryptoService } from '../../utils/crypto/crypto.service';
import { SecretsService } from '../../utils/secretsService/secrets.service';

describe('ResponseHashInterceptor', () => {
  let interceptor: ResponseHashInterceptor;
  let mockCryptoService: jest.Mocked<CryptoService>;
  let mockSecretsService: jest.Mocked<SecretsService>;
  let mockLogger: any;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockCallHandler: jest.Mocked<CallHandler>;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(async () => {
    // Mock logger
    mockLogger = {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    // Mock CryptoService
    mockCryptoService = {
      generateHashWithSalt: jest.fn(),
      encrypt: jest.fn(),
      decrypt: jest.fn(),
      initialize: jest.fn(),
    } as any;

    // Mock SecretsService
    mockSecretsService = {
      getSecret: jest.fn(),
    } as any;

    // Mock Request
    mockRequest = {
      method: 'POST',
      url: '/api/test',
      body: { param: 'value' },
      headers: { 'content-type': 'application/json' },
    };

    // Mock Response
    mockResponse = {
      setHeader: jest.fn(),
      getHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Mock ExecutionContext
    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
      getClass: jest.fn(),
      getHandler: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as any;

    // Mock CallHandler
    mockCallHandler = {
      handle: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResponseHashInterceptor,
        {
          provide: CryptoService,
          useValue: mockCryptoService,
        },
        {
          provide: SecretsService,
          useValue: mockSecretsService,
        },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: mockLogger,
        },
      ],
    }).compile();

    interceptor = module.get<ResponseHashInterceptor>(ResponseHashInterceptor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('intercept method', () => {
    it('should be defined', () => {
      expect(interceptor.intercept).toBeDefined();
      expect(typeof interceptor.intercept).toBe('function');
    });

    it('should skip processing for GET requests', async () => {
      mockRequest.method = 'GET';
      const mockData = { message: 'success' };
      mockCallHandler.handle.mockReturnValue(of(mockData));

      const result = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );
      const value = await firstValueFrom(result as Observable<any>);

      expect(value).toEqual(mockData);
      expect(mockSecretsService.getSecret).not.toHaveBeenCalled();
      expect(mockCryptoService.generateHashWithSalt).not.toHaveBeenCalled();
      expect(mockResponse.setHeader).not.toHaveBeenCalled();
    });

    it('should process POST requests and generate hash', async () => {
      const mockData = { id: 1, message: 'success' };
      const mockSalt = 'test-salt-key';
      const mockHash = 'generated-hash-value';

      mockSecretsService.getSecret.mockResolvedValue(mockSalt);
      mockCryptoService.generateHashWithSalt.mockReturnValue(mockHash);
      mockCallHandler.handle.mockReturnValue(of(mockData));

      const result = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );
      const value = await firstValueFrom(result as Observable<any>);

      expect(value).toEqual(mockData);
      expect(mockSecretsService.getSecret).toHaveBeenCalledWith(
        'auth',
        'encryption_key',
      );
      expect(mockCryptoService.generateHashWithSalt).toHaveBeenCalledWith(
        mockData,
        mockSalt,
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'x-response-token',
        mockHash,
      );
    });

    it('should process PUT requests and generate hash', async () => {
      mockRequest.method = 'PUT';
      const mockData = { id: 1, updated: true };
      const mockSalt = 'test-salt-key';
      const mockHash = 'generated-hash-value';

      mockSecretsService.getSecret.mockResolvedValue(mockSalt);
      mockCryptoService.generateHashWithSalt.mockReturnValue(mockHash);
      mockCallHandler.handle.mockReturnValue(of(mockData));

      const result = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );
      const value = await firstValueFrom(result as Observable<any>);

      expect(value).toEqual(mockData);
      expect(mockSecretsService.getSecret).toHaveBeenCalledWith(
        'auth',
        'encryption_key',
      );
      expect(mockCryptoService.generateHashWithSalt).toHaveBeenCalledWith(
        mockData,
        mockSalt,
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'x-response-token',
        mockHash,
      );
    });

    it('should process DELETE requests and generate hash', async () => {
      mockRequest.method = 'DELETE';
      const mockData = { deleted: true, id: 1 };
      const mockSalt = 'test-salt-key';
      const mockHash = 'generated-hash-value';

      mockSecretsService.getSecret.mockResolvedValue(mockSalt);
      mockCryptoService.generateHashWithSalt.mockReturnValue(mockHash);
      mockCallHandler.handle.mockReturnValue(of(mockData));

      const result = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );
      const value = await firstValueFrom(result as Observable<any>);

      expect(value).toEqual(mockData);
      expect(mockSecretsService.getSecret).toHaveBeenCalledWith(
        'auth',
        'encryption_key',
      );
      expect(mockCryptoService.generateHashWithSalt).toHaveBeenCalledWith(
        mockData,
        mockSalt,
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'x-response-token',
        mockHash,
      );
    });

    it('should process PATCH requests and generate hash', async () => {
      mockRequest.method = 'PATCH';
      const mockData = { id: 1, patched: true };
      const mockSalt = 'test-salt-key';
      const mockHash = 'generated-hash-value';

      mockSecretsService.getSecret.mockResolvedValue(mockSalt);
      mockCryptoService.generateHashWithSalt.mockReturnValue(mockHash);
      mockCallHandler.handle.mockReturnValue(of(mockData));

      const result = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );
      const value = await firstValueFrom(result as Observable<any>);

      expect(value).toEqual(mockData);
      expect(mockSecretsService.getSecret).toHaveBeenCalledWith(
        'auth',
        'encryption_key',
      );
      expect(mockCryptoService.generateHashWithSalt).toHaveBeenCalledWith(
        mockData,
        mockSalt,
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'x-response-token',
        mockHash,
      );
    });

    it('should handle null response data', async () => {
      const mockData = null;
      const mockSalt = 'test-salt-key';
      const mockHash = 'generated-hash-value';

      mockSecretsService.getSecret.mockResolvedValue(mockSalt);
      mockCryptoService.generateHashWithSalt.mockReturnValue(mockHash);
      mockCallHandler.handle.mockReturnValue(of(mockData));

      const result = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );
      const value = await firstValueFrom(result as Observable<any>);

      expect(value).toBeNull();
      expect(mockSecretsService.getSecret).toHaveBeenCalledWith(
        'auth',
        'encryption_key',
      );
      expect(mockCryptoService.generateHashWithSalt).toHaveBeenCalledWith(
        mockData,
        mockSalt,
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'x-response-token',
        mockHash,
      );
    });

    it('should handle empty object response data', async () => {
      const mockData = {};
      const mockSalt = 'test-salt-key';
      const mockHash = 'generated-hash-value';

      mockSecretsService.getSecret.mockResolvedValue(mockSalt);
      mockCryptoService.generateHashWithSalt.mockReturnValue(mockHash);
      mockCallHandler.handle.mockReturnValue(of(mockData));

      const result = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );
      const value = await firstValueFrom(result as Observable<any>);

      expect(value).toEqual({});
      expect(mockSecretsService.getSecret).toHaveBeenCalledWith(
        'auth',
        'encryption_key',
      );
      expect(mockCryptoService.generateHashWithSalt).toHaveBeenCalledWith(
        mockData,
        mockSalt,
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'x-response-token',
        mockHash,
      );
    });

    it('should handle array response data', async () => {
      const mockData = [{ id: 1 }, { id: 2 }];
      const mockSalt = 'test-salt-key';
      const mockHash = 'generated-hash-value';

      mockSecretsService.getSecret.mockResolvedValue(mockSalt);
      mockCryptoService.generateHashWithSalt.mockReturnValue(mockHash);
      mockCallHandler.handle.mockReturnValue(of(mockData));

      const result = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );
      const value = await firstValueFrom(result as Observable<any>);

      expect(value).toEqual(mockData);
      expect(mockSecretsService.getSecret).toHaveBeenCalledWith(
        'auth',
        'encryption_key',
      );
      expect(mockCryptoService.generateHashWithSalt).toHaveBeenCalledWith(
        mockData,
        mockSalt,
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'x-response-token',
        mockHash,
      );
    });

    it('should handle complex nested response data', async () => {
      const mockData = {
        user: {
          id: 1,
          profile: {
            name: 'John Doe',
            preferences: {
              theme: 'dark',
              notifications: true,
            },
          },
        },
        metadata: {
          timestamp: '2023-01-01T00:00:00Z',
          version: '1.0.0',
        },
      };
      const mockSalt = 'test-salt-key';
      const mockHash = 'generated-hash-value';

      mockSecretsService.getSecret.mockResolvedValue(mockSalt);
      mockCryptoService.generateHashWithSalt.mockReturnValue(mockHash);
      mockCallHandler.handle.mockReturnValue(of(mockData));

      const result = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );
      const value = await firstValueFrom(result as Observable<any>);

      expect(value).toEqual(mockData);
      expect(mockSecretsService.getSecret).toHaveBeenCalledWith(
        'auth',
        'encryption_key',
      );
      expect(mockCryptoService.generateHashWithSalt).toHaveBeenCalledWith(
        mockData,
        mockSalt,
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'x-response-token',
        mockHash,
      );
    });
  });

  describe('error handling', () => {
    it('should handle SecretsService errors by throwing them', async () => {
      const mockData = { message: 'success' };
      const error = new Error('Failed to get secret');

      mockSecretsService.getSecret.mockRejectedValue(error);
      mockCallHandler.handle.mockReturnValue(of(mockData));

      // The interceptor should throw the error since getSecret is not in try-catch
      await expect(
        interceptor.intercept(mockExecutionContext, mockCallHandler),
      ).rejects.toThrow('Failed to get secret');

      expect(mockSecretsService.getSecret).toHaveBeenCalledWith(
        'auth',
        'encryption_key',
      );
      expect(mockCryptoService.generateHashWithSalt).not.toHaveBeenCalled();
      expect(mockResponse.setHeader).not.toHaveBeenCalled();
      // Logger should not be called since error is thrown before try-catch
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle CryptoService errors and log them', async () => {
      const mockData = { message: 'success' };
      const mockSalt = 'test-salt-key';
      const error = new Error('Hash generation failed');

      mockSecretsService.getSecret.mockResolvedValue(mockSalt);
      mockCryptoService.generateHashWithSalt.mockImplementation(() => {
        throw error;
      });
      mockCallHandler.handle.mockReturnValue(of(mockData));

      const result = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );
      const value = await firstValueFrom(result as Observable<any>);

      expect(value).toEqual(mockData);
      expect(mockSecretsService.getSecret).toHaveBeenCalledWith(
        'auth',
        'encryption_key',
      );
      expect(mockCryptoService.generateHashWithSalt).toHaveBeenCalledWith(
        mockData,
        mockSalt,
      );
      expect(mockResponse.setHeader).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error generating hash for response:' + error.message,
      );
    });

    it('should handle response.setHeader errors and log them', async () => {
      const mockData = { message: 'success' };
      const mockSalt = 'test-salt-key';
      const mockHash = 'generated-hash-value';
      const error = new Error('Failed to set header');

      mockSecretsService.getSecret.mockResolvedValue(mockSalt);
      mockCryptoService.generateHashWithSalt.mockReturnValue(mockHash);
      mockResponse.setHeader.mockImplementation(() => {
        throw error;
      });
      mockCallHandler.handle.mockReturnValue(of(mockData));

      const result = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );
      const value = await firstValueFrom(result as Observable<any>);

      expect(value).toEqual(mockData);
      expect(mockSecretsService.getSecret).toHaveBeenCalledWith(
        'auth',
        'encryption_key',
      );
      expect(mockCryptoService.generateHashWithSalt).toHaveBeenCalledWith(
        mockData,
        mockSalt,
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'x-response-token',
        mockHash,
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error generating hash for response:' + error.message,
      );
    });

    it('should propagate original request errors', async () => {
      const error = new Error('Request processing failed');
      mockCallHandler.handle.mockReturnValue(throwError(() => error));

      const result = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      await expect(firstValueFrom(result as Observable<any>)).rejects.toThrow(
        'Request processing failed',
      );
      expect(mockSecretsService.getSecret).toHaveBeenCalledWith(
        'auth',
        'encryption_key',
      );
      expect(mockCryptoService.generateHashWithSalt).not.toHaveBeenCalled();
      expect(mockResponse.setHeader).not.toHaveBeenCalled();
    });

    it('should handle HTTP errors from the original request', async () => {
      const httpError = {
        status: 404,
        message: 'Not Found',
        error: 'Resource not found',
      };
      mockCallHandler.handle.mockReturnValue(throwError(() => httpError));

      const result = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      await expect(firstValueFrom(result as Observable<any>)).rejects.toEqual(
        httpError,
      );
      expect(mockSecretsService.getSecret).toHaveBeenCalledWith(
        'auth',
        'encryption_key',
      );
      expect(mockCryptoService.generateHashWithSalt).not.toHaveBeenCalled();
      expect(mockResponse.setHeader).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle undefined response data', async () => {
      const mockData = undefined;
      const mockSalt = 'test-salt-key';
      const mockHash = 'generated-hash-value';

      mockSecretsService.getSecret.mockResolvedValue(mockSalt);
      mockCryptoService.generateHashWithSalt.mockReturnValue(mockHash);
      mockCallHandler.handle.mockReturnValue(of(mockData));

      const result = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );
      const value = await firstValueFrom(result as Observable<any>);

      expect(value).toBeUndefined();
      expect(mockSecretsService.getSecret).toHaveBeenCalledWith(
        'auth',
        'encryption_key',
      );
      expect(mockCryptoService.generateHashWithSalt).toHaveBeenCalledWith(
        mockData,
        mockSalt,
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'x-response-token',
        mockHash,
      );
    });

    it('should handle string response data', async () => {
      const mockData = 'simple string response';
      const mockSalt = 'test-salt-key';
      const mockHash = 'generated-hash-value';

      mockSecretsService.getSecret.mockResolvedValue(mockSalt);
      mockCryptoService.generateHashWithSalt.mockReturnValue(mockHash);
      mockCallHandler.handle.mockReturnValue(of(mockData));

      const result = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );
      const value = await firstValueFrom(result as Observable<any>);

      expect(value).toBe(mockData);
      expect(mockSecretsService.getSecret).toHaveBeenCalledWith(
        'auth',
        'encryption_key',
      );
      expect(mockCryptoService.generateHashWithSalt).toHaveBeenCalledWith(
        mockData,
        mockSalt,
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'x-response-token',
        mockHash,
      );
    });

    it('should handle number response data', async () => {
      const mockData = 12345;
      const mockSalt = 'test-salt-key';
      const mockHash = 'generated-hash-value';

      mockSecretsService.getSecret.mockResolvedValue(mockSalt);
      mockCryptoService.generateHashWithSalt.mockReturnValue(mockHash);
      mockCallHandler.handle.mockReturnValue(of(mockData));

      const result = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );
      const value = await firstValueFrom(result as Observable<any>);

      expect(value).toBe(mockData);
      expect(mockSecretsService.getSecret).toHaveBeenCalledWith(
        'auth',
        'encryption_key',
      );
      expect(mockCryptoService.generateHashWithSalt).toHaveBeenCalledWith(
        mockData,
        mockSalt,
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'x-response-token',
        mockHash,
      );
    });

    it('should handle boolean response data', async () => {
      const mockData = true;
      const mockSalt = 'test-salt-key';
      const mockHash = 'generated-hash-value';

      mockSecretsService.getSecret.mockResolvedValue(mockSalt);
      mockCryptoService.generateHashWithSalt.mockReturnValue(mockHash);
      mockCallHandler.handle.mockReturnValue(of(mockData));

      const result = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );
      const value = await firstValueFrom(result as Observable<any>);

      expect(value).toBe(mockData);
      expect(mockSecretsService.getSecret).toHaveBeenCalledWith(
        'auth',
        'encryption_key',
      );
      expect(mockCryptoService.generateHashWithSalt).toHaveBeenCalledWith(
        mockData,
        mockSalt,
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'x-response-token',
        mockHash,
      );
    });

    it('should handle very large response objects', async () => {
      const largeObject = {
        data: new Array(1000).fill(0).map((_, i) => ({
          id: i,
          name: `item-${i}`,
          description: `This is item number ${i}`,
        })),
      };
      const mockSalt = 'test-salt-key';
      const mockHash = 'generated-hash-value';

      mockSecretsService.getSecret.mockResolvedValue(mockSalt);
      mockCryptoService.generateHashWithSalt.mockReturnValue(mockHash);
      mockCallHandler.handle.mockReturnValue(of(largeObject));

      const result = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );
      const value = await firstValueFrom(result as Observable<any>);

      expect(value).toEqual(largeObject);
      expect(value.data).toHaveLength(1000);
      expect(mockSecretsService.getSecret).toHaveBeenCalledWith(
        'auth',
        'encryption_key',
      );
      expect(mockCryptoService.generateHashWithSalt).toHaveBeenCalledWith(
        largeObject,
        mockSalt,
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'x-response-token',
        mockHash,
      );
    });

    it('should handle responses with special characters', async () => {
      const mockData = {
        message: 'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?',
        unicode: '🚀 Unicode test 中文 العربية',
      };
      const mockSalt = 'test-salt-key';
      const mockHash = 'generated-hash-value';

      mockSecretsService.getSecret.mockResolvedValue(mockSalt);
      mockCryptoService.generateHashWithSalt.mockReturnValue(mockHash);
      mockCallHandler.handle.mockReturnValue(of(mockData));

      const result = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );
      const value = await firstValueFrom(result as Observable<any>);

      expect(value).toEqual(mockData);
      expect(mockSecretsService.getSecret).toHaveBeenCalledWith(
        'auth',
        'encryption_key',
      );
      expect(mockCryptoService.generateHashWithSalt).toHaveBeenCalledWith(
        mockData,
        mockSalt,
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'x-response-token',
        mockHash,
      );
    });
  });

  describe('different HTTP methods', () => {
    const testMethods = ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

    testMethods.forEach((method) => {
      it(`should process ${method} requests`, async () => {
        mockRequest.method = method;
        const mockData = { method, processed: true };
        const mockSalt = 'test-salt-key';
        const mockHash = 'generated-hash-value';

        mockSecretsService.getSecret.mockResolvedValue(mockSalt);
        mockCryptoService.generateHashWithSalt.mockReturnValue(mockHash);
        mockCallHandler.handle.mockReturnValue(of(mockData));

        const result = await interceptor.intercept(
          mockExecutionContext,
          mockCallHandler,
        );
        const value = await firstValueFrom(result as Observable<any>);

        expect(value).toEqual(mockData);
        expect(mockSecretsService.getSecret).toHaveBeenCalledWith(
          'auth',
          'encryption_key',
        );
        expect(mockCryptoService.generateHashWithSalt).toHaveBeenCalledWith(
          mockData,
          mockSalt,
        );
        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          'x-response-token',
          mockHash,
        );
      });
    });
  });

  describe('integration scenarios', () => {
    it('should work with different execution contexts', async () => {
      const contexts = [
        { method: 'POST', url: '/api/users', body: { name: 'John' } },
        { method: 'PUT', url: '/api/posts/1', body: { title: 'Updated' } },
        { method: 'DELETE', url: '/api/comments/123', body: {} },
      ];

      for (const contextData of contexts) {
        const mockContext = {
          ...mockExecutionContext,
          switchToHttp: jest.fn().mockReturnValue({
            getRequest: jest.fn().mockReturnValue(contextData),
            getResponse: jest.fn().mockReturnValue(mockResponse),
          }),
        };

        const mockData = { method: contextData.method, url: contextData.url };
        const mockSalt = 'test-salt-key';
        const mockHash = 'generated-hash-value';

        mockSecretsService.getSecret.mockResolvedValue(mockSalt);
        mockCryptoService.generateHashWithSalt.mockReturnValue(mockHash);
        mockCallHandler.handle.mockReturnValue(of(mockData));

        const result = await interceptor.intercept(
          mockContext as any,
          mockCallHandler,
        );
        const value = await firstValueFrom(result as Observable<any>);

        expect(value).toEqual(mockData);
        expect(mockSecretsService.getSecret).toHaveBeenCalledWith(
          'auth',
          'encryption_key',
        );
        expect(mockCryptoService.generateHashWithSalt).toHaveBeenCalledWith(
          mockData,
          mockSalt,
        );
        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          'x-response-token',
          mockHash,
        );

        jest.clearAllMocks();
      }
    });

    it('should handle concurrent requests', async () => {
      const mockData1 = { id: 1, message: 'first' };
      const mockData2 = { id: 2, message: 'second' };
      const mockSalt = 'test-salt-key';
      const mockHash1 = 'generated-hash-1';
      const mockHash2 = 'generated-hash-2';

      mockSecretsService.getSecret.mockResolvedValue(mockSalt);
      mockCryptoService.generateHashWithSalt
        .mockReturnValueOnce(mockHash1)
        .mockReturnValueOnce(mockHash2);
      mockCallHandler.handle
        .mockReturnValueOnce(of(mockData1))
        .mockReturnValueOnce(of(mockData2));

      const result1 = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );
      const result2 = await interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      const [value1, value2] = await Promise.all([
        firstValueFrom(result1 as Observable<any>),
        firstValueFrom(result2 as Observable<any>),
      ]);

      expect(value1).toEqual(mockData1);
      expect(value2).toEqual(mockData2);
      expect(mockSecretsService.getSecret).toHaveBeenCalledTimes(2);
      expect(mockCryptoService.generateHashWithSalt).toHaveBeenCalledTimes(2);
      expect(mockResponse.setHeader).toHaveBeenCalledTimes(2);
    });
  });
});
