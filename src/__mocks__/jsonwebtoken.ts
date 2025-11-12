export const verify = (err = null) => {
  if (err === 'true') return null;
  return { foo: 'bar' };
};
export const sign = () => 'test';
export const decode = (token: string) => {
  if (!token) return null;
  return { sub: 'test-user', exp: Math.floor(Date.now() / 1000) + 3600 };
};
