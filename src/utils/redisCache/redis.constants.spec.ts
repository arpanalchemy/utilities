import { LOCAL_CONN_STRING } from './redis.constants';
describe('Check Connection Strings', () => {
  it('should be defined', () => {
    expect(LOCAL_CONN_STRING).toBe('redis://localhost:6379');
  });
});
