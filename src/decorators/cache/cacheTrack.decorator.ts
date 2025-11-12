export function CacheTrack(cacheKey: string) {
  return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Execute the original method and get the return value
      const result = await originalMethod.apply(this, args);

      return result;
    };

    return descriptor;
  };
}
