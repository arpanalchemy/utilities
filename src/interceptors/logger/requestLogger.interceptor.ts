import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Observable, tap } from 'rxjs';
import { Logger } from 'winston';
import { RequestLoggerHelper } from './helpers/requestLogger.helper';

@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}
  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    const helper = new RequestLoggerHelper(this.logger);
    helper.logRequest(request);
    return next.handle().pipe(
      tap({
        next: (data) => helper.logResponse(data),
        error: (err) => helper.logError(err),
      }),
    );
  }
}
