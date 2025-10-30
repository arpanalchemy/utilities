import newrelic from 'newrelic';

export function CacheTrack(cacheKey: string) {
  return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Execute the original method and get the return value
      const result = await originalMethod.apply(this, args);

      // Determine if it's a cache hit or miss based on the return value
      const isCacheHit = result !== undefined && result !== null;

      // Send cache hit/miss status to New Relic
      newrelic.addCustomAttribute(`cache_${cacheKey}`, isCacheHit ? 'true' : 'false');

      return result;
    };

    return descriptor;
  };
}
