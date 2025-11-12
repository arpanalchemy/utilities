import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import {
  ClassLogger,
  HandleError,
  LoggerInstance,
} from './handleError.decorator';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

const mockLogger = () =>
  jest
    .spyOn(LoggerInstance, 'getInstance' as any)
    .mockImplementationOnce(() => {
      return {
        get() {
          return {
            error: () => null,
          };
        },
        set() {},
      };
    });

describe('HandleError Decorator', () => {
  class TestService {
    @HandleError()
    async testMethod() {
      throw new Error('This is a test error');
    }

    @HandleError({ status: 400, message: 'custom error message' })
    async testErrorMethod() {
      throw new Error('This is a test error');
    }

    @HandleError({ supress: true })
    async testSupressMethod() {
      throw new Error('This is a test error');
    }
  }
  let testService: TestService;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [TestService],
    }).compile();
    testService = module.get<TestService>(TestService);
  });

  it('should catch errors and throw default error', async () => {
    mockLogger();
    await expect(testService.testMethod()).rejects.toThrow(Error);
  });

  it('should catch errors and throw custom error', async () => {
    mockLogger();
    await expect(testService.testErrorMethod()).rejects.toThrow(HttpException);
  });

  it('should catch errors and supress it', async () => {
    mockLogger();
    await testService.testSupressMethod();
  });

  // Replace 'your-code' with the actual file path

  describe('ClassLogger', () => {
    let loggerMock: any;
    let classLogger: ClassLogger;
    beforeEach(async () => {
      loggerMock = {
        // Create a mock implementation of the Logger class methods used in your code
        // For example:
        info: jest.fn(),
        error: jest.fn(),
        // Add other methods used in your Logger class
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ClassLogger,
          { provide: WINSTON_MODULE_PROVIDER, useValue: loggerMock },
        ],
      }).compile();
      classLogger = module.get<ClassLogger>(ClassLogger);
    });

    it('should be defined', () => {
      expect(classLogger).toBeDefined();
    });

    it('should set the logger instance in LoggerInstance when constructed', () => {
      const loggerInstance = LoggerInstance.getInstance();

      expect(loggerInstance.get()).toBe(loggerMock);
    });

    it('should log information using the logger', () => {
      const loggerInstance = LoggerInstance.getInstance().get();

      loggerInstance.error('test');

      expect(loggerMock.error).toHaveBeenCalledWith('test');
    });

    it('should log errors using the logger', () => {
      const loggerInstance = LoggerInstance.getInstance().get();

      loggerInstance.error('test');

      expect(loggerMock.error).toHaveBeenCalledWith('test');
    });
  });
});
