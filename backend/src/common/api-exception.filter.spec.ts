import {
  BadRequestException,
  InternalServerErrorException,
  type ArgumentsHost,
} from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter';

function invoke(error: unknown) {
  const response = {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({
        path: '/api/v1/example',
        url: '/api/v1/example?token=secret',
        requestId: 'test-request-id',
      }),
    }),
  } as unknown as ArgumentsHost;
  new ApiExceptionFilter().catch(error, host);
  return response.json.mock.calls[0][0] as Record<string, unknown>;
}

describe('API errors', () => {
  it('hides internal errors and query strings', () => {
    const body = invoke(
      new InternalServerErrorException('database-password=private'),
    );
    expect(body).toMatchObject({
      statusCode: 500,
      code: 'internal_error',
      message: 'An unexpected error occurred.',
      path: '/api/v1/example',
      requestId: 'test-request-id',
    });
    expect(JSON.stringify(body)).not.toMatch(/private|token=secret/);
  });
  it('preserves useful validation messages', () => {
    expect(
      invoke(new BadRequestException(['email must be an email'])),
    ).toMatchObject({
      code: 'validation_failed',
      details: ['email must be an email'],
    });
  });
});
