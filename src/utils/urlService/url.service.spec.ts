import { Test } from '@nestjs/testing';
import { URLService } from './url.service';

describe('Test Cases for URLService', () => {
  let module: URLService;
  const originalEnv = process.env;

  afterAll(() => {
    process.env = originalEnv;
  });
  beforeEach(async () => {
    const test = await Test.createTestingModule({
      providers: [URLService],
    }).compile();
    module = test.get<URLService>(URLService);
  });
  it('generateURL Should Generate a url', () => {
    process.env.BASE_URL = 'baseUrl/api';
    expect(module.generateURL('test')).toBe('baseUrl/api/test');
  });

  it('apiTimeout Should Generate a timeout', () => {
    expect(module.apiTimeout()).toBe(1000 * 2000);
  });

  it('createQueryFilter Should return a filter query', () => {
    expect(
      module.createQueryFilter({
        test1: 'testing',
        test2: 'testing',
      }),
    ).toBe('?filter[test1]=testing&filter[test2]=testing');
  });

  it('createQuery Should return a  query', () => {
    expect(
      module.createQuery({
        test1: 'testing',
        test2: 'testing',
      }),
    ).toBe('?test1=testing&test2=testing');
  });

  it('stringify Should return a  query', () => {
    expect(
      module.stringify({
        test1: 'testing',
        test2: 'testing',
      }),
    ).toBe('test1=testing&test2=testing');
  });

  it('errorInResponse Should throw an Error', () => {
    expect(() => module.errorInResponse()).toThrow(
      'Error in Internal Communication',
    );
  });

  it('createOrderByFilter testcases should return empty string if undefined or length less than 0', async () => {
    const param = undefined;
    expect(module.createOrderByFilter([])).toEqual('');
    expect(module.createOrderByFilter(param)).toEqual('');
  });

  it('createOrderByFilter testcases should return orderBy filter with param key and order', async () => {
    expect(module.createOrderByFilter(['endDate', 'desc'])).toEqual(
      '&orderBy[endDate]=desc',
    );
    expect(module.createOrderByFilter(['assetID', 'asc'])).toEqual(
      '&orderBy[assetID]=asc',
    );
  });

  it('should convert array [1, 2, 3] to string "1,2,3"', () => {
    const numArr = [1, 2, 3];
    const result = module.arrToNumString(numArr);
    expect(result).toBe('1,2,3');
  });

  it('should convert array [10, 20, 30, 40] to string "10,20,30,40"', () => {
    const numArr = [10, 20, 30, 40];
    const result = module.arrToNumString(numArr);
    expect(result).toBe('10,20,30,40');
  });

  it('should convert array [100] to string "100"', () => {
    const numArr = [100];
    const result = module.arrToNumString(numArr);
    expect(result).toBe('100');
  });

  it('should return an empty string for an empty array', () => {
    const numArr: number[] = [];
    const result = module.arrToNumString(numArr);
    expect(result).toBe('');
  });

  it('should create complete query string correctly', () => {
    const obj = {
      filter: { key1: 'value1', key2: 'value2' },
      key3: 'value3',
      key4: '123',
      key5: ['value4', 'value5'],
      key6: 'true',
      key7: { nestedKey: 'nestedValue' },
    };

    const expectedQueryString =
      '?filter[key1]=value1&filter[key2]=value2&key3=value3&key4=123&key5=value4%2Cvalue5&key6=true&key7=%5Bobject%20Object%5D';

    const result = module.createCompleteQuery(obj);
    expect(result).toBe(expectedQueryString);
  });
});
