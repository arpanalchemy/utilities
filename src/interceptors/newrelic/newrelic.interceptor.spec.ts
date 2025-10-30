// newrelic.interceptor.spec.ts

import { NewrelicInterceptor } from './newrelic.interceptor';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';

jest.mock('newrelic', () => ({
  startWebTransaction: jest.fn((name, handler) => handler()),
  getTransaction: jest.fn(() => ({ end: jest.fn() })),
  getTraceMetadata: jest.fn(),
}));

const newrelic = require('newrelic');

describe('NewrelicInterceptor', () => {
  let interceptor: NewrelicInterceptor;
  let context: ExecutionContext;
  let callHandler: CallHandler;

  beforeEach(() => {
    interceptor = new NewrelicInterceptor();
    context = {
      getHandler: jest.fn(() => ({ name: 'testHandler' })),
    } as unknown as ExecutionContext;
    callHandler = {
      handle: jest.fn(() => of('test response')),
    };
  });

  it('should call newrelic methods and end transaction', (done) => {
    const transaction = { end: jest.fn() };
    newrelic.getTransaction.mockReturnValue(transaction);

    interceptor.intercept(context, callHandler).subscribe((response) => {
      expect(newrelic.startWebTransaction).toHaveBeenCalledWith(
        'testHandler',
        expect.any(Function),
      );
      expect(newrelic.getTransaction).toHaveBeenCalled();
      expect(newrelic.getTraceMetadata).toHaveBeenCalled();
      expect(transaction.end).toHaveBeenCalled();
      expect(response).toBe('test response');
      done();
    });
  });
});
