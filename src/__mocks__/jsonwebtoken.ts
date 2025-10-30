export const verify = (err = null) => {
  if (err === 'true') return null;
  return { foo: 'bar' };
};
export const sign = () => 'test';
