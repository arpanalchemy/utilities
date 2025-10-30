import { RedisInstance } from '../../../utils/redisCache/redis.instance';
import { Logger } from 'winston';

export class RequestCacheHelper {
  private readonly urlPrefix = 'url_';
  private url: string;
  private readonly subscriptionKey = 'x-api-key';
  constructor(
    private readonly instance: RedisInstance,
    private readonly httpContext: Request,
  ) {
    this.getRequestKey();
  }

  private getRequestKey() {
    const url = this.httpContext.url;
    const method = this.httpContext.method;
    const body =
      typeof this.httpContext.body === 'object'
        ? JSON.stringify(this.httpContext.body)
        : this.httpContext.body;
    const subscription =
      this.httpContext.headers[this.subscriptionKey] ?? 'NoSub';
    this.url = `${this.urlPrefix}_${method}_${subscription}_${url}_${body}`;
  }

  async getData() {
    return (await this.instance.getClient()).get(this.url);
  }
}
