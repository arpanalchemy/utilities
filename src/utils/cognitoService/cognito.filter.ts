import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global exception filter for Cognito service
 * 
 * Features:
 * - Structured error logging
 * - Production-safe error responses (no stack traces)
 * - Security headers
 * - Request context tracking
 * - Sanitized error messages
 * 
 * @example
 * ```typescript
 * // In your main.ts or module
 * app.useGlobalFilters(new CognitoExceptionFilter());
 * ```
 */
@Catch()
export class CognitoExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(CognitoExceptionFilter.name);

  /**
   * Catch and format exceptions
   * @param exception - The caught exception
   * @param host - Execution context
   */
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Extract error information
    const error = exception as Error & {
      getStatus?: () => number;
      getResponse?: () => any;
      status?: number;
      code?: string;
    };

    const status =
      typeof error.getStatus === 'function'
        ? error.getStatus()
        : error.status || HttpStatus.INTERNAL_SERVER_ERROR;

    const timestamp = new Date().toISOString();
    const path = request.url;
    const method = request.method;

    // Log the error with full context
    this.logError(error, status, request);

    // Build error response
    let errorResponse: any;

    if (typeof error.getResponse === 'function') {
      // HttpException with custom response
      const exceptionResponse = error.getResponse();
      errorResponse =
        typeof exceptionResponse === 'object'
          ? { ...exceptionResponse, timestamp, path, method }
          : { statusCode: status, message: exceptionResponse, timestamp, path, method };
    } else {
      // Generic error
      errorResponse = {
        statusCode: status,
        message: this.getSafeErrorMessage(error, status),
        error: this.getErrorName(status),
        timestamp,
        path,
        method,
      };
    }

    // Sanitize error response in production
    if (process.env.NODE_ENV === 'production') {
      errorResponse = this.sanitizeErrorResponse(errorResponse, status);
    }

    // Add security headers
    this.addSecurityHeaders(response);

    // Send response
    response.status(status).json(errorResponse);
  }

  /**
   * Log error with context
   * @param error - Error object
   * @param status - HTTP status code
   * @param request - Express request object
   */
  private logError(error: any, status: number, request: Request): void {
    const errorContext = {
      timestamp: new Date().toISOString(),
      method: request.method,
      path: request.url,
      statusCode: status,
      errorName: error.name || 'UnknownError',
      message: error.message,
      ip: request.ip,
      userAgent: request.get('user-agent'),
    };

    // Include stack trace only in development
    if (process.env.NODE_ENV !== 'production' && error.stack) {
      this.logger.error(
        `Exception caught: ${error.message}`,
        error.stack,
        JSON.stringify(errorContext, null, 2),
      );
    } else {
      this.logger.error(
        `Exception caught: ${error.message}`,
        JSON.stringify(errorContext, null, 2),
      );
    }
  }

  /**
   * Get safe error message for response
   * @param error - Error object
   * @param status - HTTP status code
   * @returns Safe error message
   */
  private getSafeErrorMessage(error: any, status: number): string {
    // In production, return generic messages for 5xx errors
    if (process.env.NODE_ENV === 'production' && status >= 500) {
      return 'An unexpected error occurred. Please try again later.';
    }

    // Return actual message for 4xx errors or development
    if (error.message) {
      return this.sanitizeMessage(error.message);
    }

    // Fallback messages
    const fallbackMessages: Record<number, string> = {
      400: 'Bad request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not found',
      409: 'Conflict',
      429: 'Too many requests',
      500: 'Internal server error',
      502: 'Bad gateway',
      503: 'Service unavailable',
    };

    return fallbackMessages[status] || 'An error occurred';
  }

  /**
   * Sanitize error message to prevent information leakage
   * @param message - Original message
   * @returns Sanitized message
   */
  private sanitizeMessage(message: string): string {
    // Remove potential sensitive information patterns
    return message
      .replace(/password[=:]\s*\S+/gi, 'password=***')
      .replace(/token[=:]\s*\S+/gi, 'token=***')
      .replace(/key[=:]\s*\S+/gi, 'key=***')
      .replace(/secret[=:]\s*\S+/gi, 'secret=***')
      .replace(/bearer\s+\S+/gi, 'bearer ***')
      .slice(0, 500); // Limit message length
  }

  /**
   * Get error name from status code
   * @param status - HTTP status code
   * @returns Error name
   */
  private getErrorName(status: number): string {
    const errorNames: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
    };

    return errorNames[status] || HttpStatus[status] || 'Error';
  }

  /**
   * Sanitize error response for production
   * @param errorResponse - Original error response
   * @param status - HTTP status code
   * @returns Sanitized error response
   */
  private sanitizeErrorResponse(errorResponse: any, status: number): any {
    // For 5xx errors in production, strip all details except basic info
    if (status >= 500) {
      return {
        statusCode: status,
        message: 'An unexpected error occurred. Please try again later.',
        error: this.getErrorName(status),
        timestamp: errorResponse.timestamp,
        path: errorResponse.path,
        method: errorResponse.method,
      };
    }

    // For 4xx errors, keep the message but remove sensitive fields
    const sanitized = { ...errorResponse };
    
    // Remove potentially sensitive fields
    delete sanitized.stack;
    delete sanitized.trace;
    delete sanitized.details;
    
    return sanitized;
  }

  /**
   * Add security headers to response
   * @param response - Express response object
   */
  private addSecurityHeaders(response: Response): void {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('X-XSS-Protection', '1; mode=block');
    response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    response.setHeader('Content-Security-Policy', "default-src 'self'");
    response.setHeader('X-Powered-By', ''); // Remove this header
  }
}