import { Test } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { URLService } from '../urlService/url.service';
import { AxiosHelper } from './axios.helper';

jest.mock('axios', () => async () => {
  return {
    data: null,
    status: 200,
  };
});

describe('Get AxiosHelper  Test Cases', () => {
  let module: AxiosHelper;

  beforeEach(async () => {
    const test = await Test.createTestingModule({
      providers: [
        AxiosHelper,
        {
          provide: URLService,
          useValue: {
            generateURL: () => null,
            createQueryFilter: () => null,
            createQuery: () => null,
            get: 'get',
            post: 'post',
            head: 'head',
            apiTimeout: () => 0,
            errorInResponse: () => null,
          },
        },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: {
            debug: () => null,
            error: () => null,
          },
        },
      ],
    }).compile();
    module = test.get<AxiosHelper>(AxiosHelper);
  });

  it('createHeadPayload Should give JSON response', () => {
    expect(
      (module as any).createHeadPayload(
        'https://alchemytech.ca/blog/earn-50K-per-month',
      ),
    ).toStrictEqual({
      method: 'head',
      url: 'https://alchemytech.ca/blog/earn-50K-per-month',
      timeout: 0,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });

  it('createGetPayload Should give JSON response', () => {
    expect((module as any).createGetPayload('')).toStrictEqual({
      method: 'get',
      url: '',
      timeout: 0,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });

  it('createPostPayload Should give JSON response', () => {
    expect((module as any).createPostPayload('')).toStrictEqual({
      url: '',
      timeout: 0,
      data: undefined,
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });

  it('headData Should return 200 status', async () => {
    expect(
      await module.headData('https://alchemytech.ca/blog/earn-50K-per-month'),
    ).toBe(200);
  });

  it('getData Should return null', async () => {
    expect(await module.getData('')).toBe(null);
  });

  it('getData should throw an error and should be handled', async () => {
    jest.spyOn(module as any, 'createGetPayload').mockImplementationOnce(() => {
      ('');
    });
    expect(await module.getData('')).toBe(null);
  });

  it('postData Should return null', async () => {
    expect(await module.postData('1', 1)).toBe(null);
  });

  it('postData should throw an error and should be handled', async () => {
    jest
      .spyOn(module as any, 'createPostPayload')
      .mockImplementationOnce(() => {
        ('');
      });
    expect(await module.postData('')).toBe(null);
  });

  it('putData Should return null', async () => {
    expect(await module.putData('1', 1)).toBe(null);
  });

  it('putData should throw an error and should be handled', async () => {
    jest
      .spyOn(module as any, 'createPostPayload')
      .mockImplementationOnce(() => {
        ('');
      });
    expect(await module.putData('')).toBe(null);
  });

  it('putData should throw an error', async () => {
    jest.spyOn(module as any, 'createPutPayload').mockImplementationOnce(() => {
      throw new Error('test error');
    });
    try {
      const res = await module.putData('');
    } catch (err) {
      expect(err).toEqual(new Error('test error'));
    }
  });

  it('putData should throw an error', async () => {
    jest
      .spyOn(module as any, 'createPostPayload')
      .mockImplementationOnce(() => {
        throw new Error('test error');
      });
    try {
      const res = await module.postData('');
    } catch (err) {
      expect(err).toEqual(new Error('test error'));
    }
  });

  it('should truncate large request body in logging', () => {
    const mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
    };
    (module as any).logger = mockLogger;

    // Create a large body that exceeds 50KB
    const largeBody = 'x'.repeat(60000);

    // Test logPostLogin method
    (module as any).logPostLogin('test-url', largeBody);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Attempting POST Request'),
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('... (truncated)'),
    );
  });

  it('should truncate large error response in handleError', () => {
    const mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
    };
    (module as any).logger = mockLogger;

    // Create a large error response that exceeds 50KB
    const largeErrorData = 'x'.repeat(60000);
    const mockError = {
      response: {
        status: 500,
        statusText: 'Internal Server Error',
        data: largeErrorData,
      },
    };

    // Test handleError method
    expect(() => {
      (module as any).handleError(mockError);
    }).toThrow();

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error in axios service'),
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('... (truncated)'),
    );
  });
});
