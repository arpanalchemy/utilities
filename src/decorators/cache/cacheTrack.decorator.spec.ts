import newrelic from 'newrelic';
import { CacheTrack } from './cacheTrack.decorator';

// Mock New Relic
jest.mock('newrelic', () => ({
  addCustomAttribute: jest.fn(),
}));

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

    it('should send cache hit status to New Relic when result is not null or undefined', async () => {
        const cacheKey = 'testKey';
        mockMethod.mockResolvedValue('someValue');
        const decoratedMethod = CacheTrack(cacheKey)(null, '', descriptor).value;

        await decoratedMethod();

        expect(newrelic.addCustomAttribute).toHaveBeenCalledWith(`cache_${cacheKey}`, 'true');
    });

    it('should send cache miss status to New Relic when result is null', async () => {
        const cacheKey = 'testKey';
        mockMethod.mockResolvedValue(null);
        const decoratedMethod = CacheTrack(cacheKey)(null, '', descriptor).value;

        await decoratedMethod();

        expect(newrelic.addCustomAttribute).toHaveBeenCalledWith(`cache_${cacheKey}`, 'false');
    });

    it('should send cache miss status to New Relic when result is undefined', async () => {
        const cacheKey = 'testKey';
        mockMethod.mockResolvedValue(undefined);
        const decoratedMethod = CacheTrack(cacheKey)(null, '', descriptor).value;

        await decoratedMethod();

        expect(newrelic.addCustomAttribute).toHaveBeenCalledWith(`cache_${cacheKey}`, 'false');
    });
});