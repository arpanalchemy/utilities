import { CacheTrack } from './cacheTrack.decorator';

describe('CacheTrack Decorator', () => {
    let mockMethod: jest.Mock;
    let descriptor: PropertyDescriptor;

    beforeEach(() => {
        mockMethod = jest.fn();
        descriptor = {
            value: mockMethod,
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should call the original method', async () => {
        const cacheKey = 'testKey';
        const decoratedMethod = CacheTrack(cacheKey)(null, '', descriptor).value;

        await decoratedMethod();

        expect(mockMethod).toHaveBeenCalled();
    });

    it('should return the result from the original method', async () => {
        const cacheKey = 'testKey';
        const expectedResult = 'someValue';
        mockMethod.mockResolvedValue(expectedResult);
        const decoratedMethod = CacheTrack(cacheKey)(null, '', descriptor).value;

        const result = await decoratedMethod();

        expect(result).toBe(expectedResult);
    });

    it('should return null when the original method returns null', async () => {
        const cacheKey = 'testKey';
        mockMethod.mockResolvedValue(null);
        const decoratedMethod = CacheTrack(cacheKey)(null, '', descriptor).value;

        const result = await decoratedMethod();

        expect(result).toBeNull();
    });

    it('should return undefined when the original method returns undefined', async () => {
        const cacheKey = 'testKey';
        mockMethod.mockResolvedValue(undefined);
        const decoratedMethod = CacheTrack(cacheKey)(null, '', descriptor).value;

        const result = await decoratedMethod();

        expect(result).toBeUndefined();
    });
});