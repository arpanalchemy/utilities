import { CryptoService } from '../../utils/crypto/crypto.service';
import { SecretsService } from '../../utils/secretsService/secrets.service';
import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Response as ExpressResponse } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class ResponseHashInterceptor implements NestInterceptor {
  @Inject()
  private readonly secretService: SecretsService;

  @Inject()
  private readonly cryptoService: CryptoService;

  @Inject(WINSTON_MODULE_PROVIDER)
  private readonly logger: Logger;

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<ExpressResponse>();
    // Skip processing for GET requests
    if (request.method === 'GET') {
      return next.handle();
    }
    const salt = await this.secretService.getSecret('auth', 'encryption_key');
    return next.handle().pipe(
      tap(async (data) => {
        try {
          // Generate hash for the response data
          const hash = await this.cryptoService.generateHashWithSalt(
            data,
            salt,
          );
          // Set the hash as a response header
          response.setHeader('x-response-token', hash);
        } catch (error) {
          this.logger.error(
            'Error generating hash for response:' + error.message,
          );
        }
      }),
    );
  }
}
