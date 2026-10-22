import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(reason: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status =
      reason instanceof HttpException
        ? reason.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload =
      reason instanceof HttpException ? reason.getResponse() : null;
    const validationMessages =
      typeof payload === 'object' && payload !== null
        ? (payload as { message?: unknown }).message
        : undefined;
    const message =
      typeof payload === 'string'
        ? payload
        : Array.isArray(validationMessages)
          ? 'The request contains invalid values.'
          : typeof validationMessages === 'string'
            ? validationMessages
            : status === 500
              ? 'An unexpected error occurred.'
              : 'The request could not be completed.';

    response.status(status).json({
      statusCode: status,
      message,
      details: Array.isArray(validationMessages)
        ? validationMessages
        : undefined,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
