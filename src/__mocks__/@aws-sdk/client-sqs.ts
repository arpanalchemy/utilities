export const SQSClient = jest.fn(() => ({
    send: jest.fn(),
}));

export const SendMessageCommand = jest.fn();
export const ReceiveMessageCommand = jest.fn();
export const DeleteMessageCommand = jest.fn();
