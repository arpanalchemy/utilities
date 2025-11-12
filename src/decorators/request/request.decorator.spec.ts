import {
  Config,
  ConfigData,
  SubscriptionData,
  TerminalUserID,
  UserDataIfExists,
} from './request.decorator';
import * as httpMock from 'node-mocks-http';
import { ctx, getParamDecoratorFactory } from '../__mocks__/decorators.stub';
describe('Test Cases for Request Decorator', () => {
  let res;
  let factory,
    publicDataFactory,
    configDataFactory,
    configFactory,
    subscriptionFactory;
  beforeEach(() => {
    res = httpMock.createResponse();
    factory = getParamDecoratorFactory(TerminalUserID);
    publicDataFactory = getParamDecoratorFactory(UserDataIfExists);
    configDataFactory = getParamDecoratorFactory(ConfigData);
    configFactory = getParamDecoratorFactory(Config);
    subscriptionFactory = getParamDecoratorFactory(SubscriptionData);
  });

  it('UserData Must return a User Data', () => {
    const req = httpMock.createRequest({
      userData: true,
    });
    expect(factory(null, ctx(req, res))).toBe(true);
  });

  it('UserData Must return a value of key foo', () => {
    const req = httpMock.createRequest({
      userData: {
        foo: true,
      },
    });
    expect(factory('foo', ctx(req, res))).toBe(true);
  });

  it('UserData Must return undefined for a value of key foo', () => {
    const req = httpMock.createRequest({
      userData: {
        bar: true,
      },
    });
    expect(factory('foo', ctx(req, res))).toBe(undefined);
  });

  it('UserData Must throw an error if userData doesnot exists', () => {
    const req = httpMock.createRequest({});
    expect(() => factory('foo', ctx(req, res))).toThrow(
      'No TerminalData found for this Controller',
    );
  });

  it('UserDataIfExists Must return a User Data', () => {
    const req = httpMock.createRequest({
      userData: true,
    });
    expect(publicDataFactory(null, ctx(req, res))).toBe(true);
  });

  it('UserDataIfExists Must return a value of key foo', () => {
    const req = httpMock.createRequest({
      userData: {
        foo: true,
      },
    });
    expect(publicDataFactory('foo', ctx(req, res))).toBe(true);
  });

  it('UserDataIfExists Must return null for a value of key foo', () => {
    const req = httpMock.createRequest({
      userData: {
        bar: true,
      },
    });
    expect(publicDataFactory('foo', ctx(req, res))).toBe(undefined);
  });

  it('UserDataIfExists should return null if user data not exists', () => {
    const req = httpMock.createRequest({});
    expect(publicDataFactory('foo', ctx(req, res))).toBe(null);
  });

  it('ConfigData Must return undefined for a value of key foo', () => {
    const req = httpMock.createRequest({
      configData: {
        bar: true,
      },
    });
    expect(configDataFactory('foo', ctx(req, res))).toBe(undefined);
  });

  it('ConfigData Must return true for a value of key foo', () => {
    const req = httpMock.createRequest({
      configData: {
        foo: true,
      },
    });
    expect(configDataFactory('foo', ctx(req, res))).toBe(true);
  });

  it('ConfigData Must return a Config Data', () => {
    const req = httpMock.createRequest({
      configData: true,
    });
    expect(configDataFactory(null, ctx(req, res))).toBe(true);
  });

  it('ConfigData Must throw an error if configData doesnot exists', () => {
    const req = httpMock.createRequest({});
    expect(() => configDataFactory('foo', ctx(req, res))).toThrow(
      'No ConfigData found for this Controller',
    );
  });

  it('Config Must return undefined for a value of key foo', () => {
    const req = httpMock.createRequest({
      configData: {
        configJson: {
          bar: true,
        },
      },
    });
    expect(configFactory('foo', ctx(req, res))).toBe(undefined);
  });

  it('Config Must return a Config Data', () => {
    const req = httpMock.createRequest({
      configData: {
        configJson: true,
      },
    });
    expect(configFactory(null, ctx(req, res))).toBe(true);
  });

  it('Config Must throw an error if config doesnot exists', () => {
    let req = httpMock.createRequest({
      configData: {},
    });
    expect(() => configFactory(null, ctx(req, res))).toThrow(
      'No Config Json found for this Controller',
    );
    req = httpMock.createRequest({});
    expect(() => configFactory(null, ctx(req, res))).toThrow(
      'No Config Json found for this Controller',
    );
  });

  it('Config Must return true for a value of key foo', () => {
    const req = httpMock.createRequest({
      configData: {
        configJson: {
          foo: true,
        },
      },
    });
    expect(configFactory('foo', ctx(req, res))).toBe(true);
  });

  it('Subscription Must return undefined for a value of key foo', () => {
    const req = httpMock.createRequest({
      subscriptionData: {
        bar: true,
      },
    });
    expect(subscriptionFactory('foo', ctx(req, res))).toBe(undefined);
  });

  it('Subscription Must return a Config Data', () => {
    const req = httpMock.createRequest({
      subscriptionData: true,
    });
    expect(subscriptionFactory(null, ctx(req, res))).toBe(true);
  });

  it('Subscription Must throw an error if config doesnot exists', () => {
    const req = httpMock.createRequest({});
    expect(() => subscriptionFactory(null, ctx(req, res))).toThrow(
      'No SubscriptionData found for this Controller',
    );
  });

  it('Subscription Must return true for a value of key foo', () => {
    const req = httpMock.createRequest({
      subscriptionData: {
        foo: true,
      },
    });
    expect(subscriptionFactory('foo', ctx(req, res))).toBe(true);
  });
});
