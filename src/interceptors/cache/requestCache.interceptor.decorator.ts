import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { RequestCacheInterceptor } from './requestCache.interceptor';

export function UseCached(timeToLive: number) {
  return applyDecorators(
    UseInterceptors(new RequestCacheInterceptor(timeToLive)),
  );
}
