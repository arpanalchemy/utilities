import { Test } from '@nestjs/testing';
import { CommonUtil } from './common.util.service';

describe('test suite for common utils', () => {
  let module;
  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [CommonUtil],
    }).compile();

    module = moduleRef.get<CommonUtil>(CommonUtil);
  });

  it('should convert array to string', () => {
    expect(module.arrToNumString([1, 2])).toBe('1,2');
  });

  it('should  convert number to string if input is number', () => {
    expect(module.arrToNumString(1)).toBe('1');
  });
});
