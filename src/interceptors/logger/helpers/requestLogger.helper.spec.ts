import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { RequestLoggerHelper } from './requestLogger.helper';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from 'winston';
import { Request } from 'express';
describe('RequestLoggerHelper', () => {
  let helper: RequestLoggerHelper;
  let logger: jest.Mocked<Logger>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();
    logger = module.get(WINSTON_MODULE_PROVIDER);
  });

  it('should log request', () => {
    helper = new RequestLoggerHelper(logger);
    const request = {
      ip: '',
      originalUrl: '',
      method: '',
      body: '',
      query: '',
      params: '',
    } as any;
    helper.logRequest(request);
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('should log response', () => {
    helper = new RequestLoggerHelper(logger);
    helper.logResponse('test');
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('should log error', () => {
    helper = new RequestLoggerHelper(logger);
    try {
      helper.logError(new Error('test'));
    } catch (e) {
      expect(logger.error).toHaveBeenCalledTimes(1);
    }
  });
});
