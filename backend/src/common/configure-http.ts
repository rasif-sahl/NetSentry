import {
  ValidationPipe,
  VersioningType,
  type INestApplication,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { ApiExceptionFilter } from './api-exception.filter';

export type ContextRequest = Request & { requestId?: string };

export function configureHttp(
  app: INestApplication,
  config: ConfigService,
): void {
  app.use((request: ContextRequest, response: Response, next: NextFunction) => {
    // Generate server-owned correlation IDs; never trust arbitrary caller IDs.
    request.requestId = randomUUID();
    response.setHeader('x-request-id', request.requestId);
    next();
  });
  app.setGlobalPrefix(config.get<string>('API_PREFIX', 'api'));
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableCors({
    origin: config.getOrThrow<string[]>('CORS_ORIGINS'),
    credentials: true,
    exposedHeaders: ['x-request-id'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
}
