import { HttpException, Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

export function HandleError(error?: {
  status?: number;
  message?: string;
  supress?: boolean;
}) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (e) {
        const logger = LoggerInstance.getInstance().get();
        logger.error(e);
        if (error?.supress) return;
        if (error?.message)
          throw new HttpException(error?.message, error?.status || 500);
        if (e.isAxiosError) {
          throw new HttpException(
            e.response?.data?.message || e.response?.data,
            e.response?.status,
          );
        } else {
          throw e;
        }
      }
    };
  };
}

export class LoggerInstance {
  private logger: Logger;
  private static instance: LoggerInstance;
  static getInstance(): LoggerInstance {
    if (!this.instance) {
      this.instance = new LoggerInstance();
    }
    return this.instance;
  }

  get(): Logger {
    return this.logger;
  }

  set(logger: Logger): void {
    this.logger = logger;
  }
}

@Injectable()
export class ClassLogger {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private logger: Logger,
  ) {
    LoggerInstance.getInstance().set(this.logger);
  }
}
