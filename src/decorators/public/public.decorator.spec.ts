import { Public, PublicOrJWT } from './public.decorator';
jest.mock('@nestjs/common', () => {
  return { SetMetadata: () => true };
});
describe('Test case for Public Key', () => {
  it('Should return true for NoSubscription Key', () => {
    expect(Public()).toBe(true);
  });
});

describe('Test case for PublicOrJWT Key', () => {
  it('Should return true for NoSubscription Key', () => {
    expect(PublicOrJWT()).toBe(true);
  });
});
