import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import type { ContextRequest } from './configure-http';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(reason: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<ContextRequest>();
    const status =
      reason instanceof HttpException
        ? reason.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload =
      reason instanceof HttpException ? reason.getResponse() : null;
    const messages =
      typeof payload === 'object' && payload !== null
        ? (payload as { message?: unknown }).message
        : undefined;
    const serverError = status >= 500;
    const validation = status === 400 && Array.isArray(messages);
    const codes: Record<number, string> = {
      401: 'unauthenticated',
      403: 'forbidden',
      404: 'not_found',
      409: 'conflict',
      429: 'rate_limited',
    };
    const requestId = request.requestId ?? randomUUID();
    response.setHeader('x-request-id', requestId);
    response.status(status).json({
      statusCode: status,
      code: serverError
        ? 'internal_error'
        : validation
          ? 'validation_failed'
          : (codes[status] ?? 'request_failed'),
      message: serverError
        ? 'An unexpected error occurred.'
        : validation
          ? 'The request contains invalid values.'
          : typeof payload === 'string'
            ? payload
            : typeof messages === 'string'
              ? messages
              : 'The request could not be completed.',
      details:
        !serverError && Array.isArray(messages)
          ? messages.filter(
              (value): value is string => typeof value === 'string',
            )
          : undefined,
      path: request.path,
      timestamp: new Date().toISOString(),
      requestId,
    });
  }
}
