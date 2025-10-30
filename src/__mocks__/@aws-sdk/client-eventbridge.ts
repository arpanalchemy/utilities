export const EventBridge = jest.fn(() => ({
    deleteRule: jest.fn(),
    putRule: jest.fn(),
    putTargets: jest.fn(),
    removeTargets: jest.fn(),
}));
