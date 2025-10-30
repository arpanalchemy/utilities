import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { RequestLoggerInterceptor } from './requestLogger.interceptor';
import { of, throwError } from 'rxjs';

describe('Request Logger Interseptor', () => {
  let module: RequestLoggerInterceptor;
  const context = {
    switchToHttp: () => {
      return {
        getRequest: () => {
          return {
            ip: '',
            originalUrl: '',
            method: '',
            body: '',
            query: '',
            params: '',
          };
        },
      };
    },
  } as unknown as ExecutionContext;

  const loggerMock = {
    info: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    const test = await Test.createTestingModule({
      providers: [
        RequestLoggerInterceptor,
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: loggerMock,
        },
      ],
    }).compile();
    module = test.get<RequestLoggerInterceptor>(RequestLoggerInterceptor);
    jest.clearAllMocks();
  });

  it('intercept should be defined', () => {
    expect(module.intercept).toBeDefined();
  });

  it('RequestLoggerInterceptor intercept to return', () =>
    expect(
      module.intercept(context, {
        handle: () => {
          return {
            pipe: () => null,
          };
        },
      } as unknown as CallHandler<any>),
    ).toBe(null));

  it('RequestLoggerInterceptor intercept to throw', () =>
    expect(() =>
      module.intercept(context, {
        handle: () => {
          return {
            pipe: () => {
              throw new Error('');
            },
          };
        },
      } as unknown as CallHandler<any>),
    ).toThrowError());

  it('should log response using tap next', async () => {
    const next = {
      handle: () => of({ message: 'success' }),
    } as CallHandler<any>;

    const result$ = module.intercept(context, next);

    const observable$ = result$ instanceof Promise ? await result$ : result$;

    return observable$.toPromise().then(() => {
      expect(loggerMock.info).toHaveBeenCalled();
    });
  });

  it('should log error using tap error', async () => {
    const next = {
      handle: () => throwError(() => new Error('fail')),
    } as CallHandler<any>;

    const result$ = module.intercept(context, next);

    const observable$ = result$ instanceof Promise ? await result$ : result$;

    return observable$.toPromise().catch(() => {
      expect(loggerMock.error).toHaveBeenCalled();
    });
  });
});
