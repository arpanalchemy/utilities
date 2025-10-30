import { InternalServerErrorException } from '@nestjs/common';
import { Request } from 'express';
import { v4 } from 'uuid';
import { Logger } from 'winston';

export class RequestLoggerHelper {
  private readonly apiId = v4();
  private readonly errMsg =
    'Unhandled Exception occurred in system. Use this ID for debugging : ';

  constructor(private readonly logger: Logger) {}

  private getAdditionalLogObject() {
    return {
      entity: {
        name: process.env.SERVICE_NAME,
      },
    };
  }

  // Custom stringify function to handle circular references
  private safeStringifyCircular(obj: any): string {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      return value;
    });
  }

  private getRequestLog(req) {
    const { ip, originalUrl, method, body, query, params } = req;
    return {
      timestamp: new Date(),
      APIUUID: this.apiId,
      ip: ip,
      method: method,
      message: this.safeStringifyCircular({
        url: originalUrl,
        query,
        body,
        params,
      }),
      ...this.getAdditionalLogObject(),
    };
  }

  logRequest(request: Request): void {
    this.logger.info(this.safeStringifyCircular(this.getRequestLog(request)));
  }

  private getResponseLog(data) {
    const end = +new Date();
    return {
      endTime: new Date(end),
      APIUUID: this.apiId,
      message: this.safeStringifyCircular({
        response: data,
      }),
      ...this.getAdditionalLogObject(),
    };
  }
  //Any is used as the same data is returned after logging
  logResponse(data: any): any {
    this.logger.info(this.safeStringifyCircular(this.getResponseLog(data)));
    return data;
  }

  private getErrorObject(err) {
    const end = +new Date();
    return {
      endTime: new Date(end),
      APIUUID: this.apiId,
      message: this.safeStringifyCircular({
        errorType: err.name,
        error: this.safeStringify(err.message),
        stackTrace: `${err.stack}`,
      }),
      ...this.getAdditionalLogObject(),
    };
  }

  logError(err: Error): void {
    this.logger.error(this.safeStringifyCircular(this.getErrorObject(err)));
    throw this.handleErr(err);
  }

  private handleErr(err: Error): Error {
    if (err.name && err.name.includes('Exception')) return err;
    return new InternalServerErrorException(this.errMsg + this.apiId);
  }

  private safeStringify(object: any): string | null | undefined {
    return object && typeof object === 'object'
      ? this.safeStringifyCircular(object)
      : object;
  }
}
