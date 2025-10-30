export const GetParameterCommand = jest.fn();

export const SSM = jest.fn();

export const SSMClient = jest.fn(() => ({
  send: jest.fn(),
}));
