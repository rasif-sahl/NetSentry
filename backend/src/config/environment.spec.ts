import {
  validateEnvironment,
  validateDatabaseEnvironment,
} from './environment';
import { databaseOptions } from '../database/options';

const input = {
  ACCOUNT_MAIL_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  DATABASE_URL: 'postgresql://test:password@localhost/netsentry_test',
  JWT_ACCESS_TOKEN_SECRET: 'access-secret-for-isolated-unit-tests-only',
  JWT_REFRESH_TOKEN_SECRET: 'refresh-secret-for-isolated-unit-tests-only',
};

describe('environment configuration', () => {
  it('defaults to explicit migrations and verified TLS when enabled', () => {
    expect(validateEnvironment(input).DB_SYNCHRONIZE).toBe(false);
    const options = databaseOptions({ ...input, DATABASE_SSL: 'true' });
    expect(options.ssl).toEqual({ rejectUnauthorized: true });
    expect(options.migrationsRun).toBe(false);
  });

  it.each([
    { PORT: '0' },
    { PORT: 'NaN' },
    { PORT: '1.5' },
    { JWT_REFRESH_TOKEN_TTL_DAYS: '-1' },
    { JWT_ACCESS_TOKEN_TTL: 'forever' },
    { CORS_ORIGINS: '*' },
    { CORS_ORIGINS: 'http://localhost:3001/path' },
    { DATABASE_URL: 'sqlite://localhost/test' },
    { DATABASE_URL: 'postgres://localhost/test?sslmode=disable' },
    { DATABASE_SSL: 'perhaps' },
    { NODE_ENV: 'staging' },
    { API_PREFIX: '/api/v1' },
    { JWT_REFRESH_TOKEN_SECRET: input.JWT_ACCESS_TOKEN_SECRET },
  ])(
    'rejects invalid configuration without exposing credentials: %j',
    (invalid) => {
      expect(() => validateEnvironment({ ...input, ...invalid })).toThrow();
    },
  );

  it('rejects unsafe production settings', () => {
    expect(() =>
      validateEnvironment({ ...input, NODE_ENV: 'production' }),
    ).toThrow('DATABASE_SSL');
    expect(() =>
      validateDatabaseEnvironment({
        ...input,
        NODE_ENV: 'test',
        DB_SYNCHRONIZE: 'true',
      }),
    ).toThrow('DB_SYNCHRONIZE');
    expect(() =>
      validateEnvironment({
        ...input,
        NODE_ENV: 'production',
        DATABASE_SSL: 'true',
      }),
    ).toThrow('CORS_ORIGINS');
    expect(() =>
      validateEnvironment({
        ...input,
        NODE_ENV: 'production',
        DATABASE_SSL: 'true',
        CORS_ORIGINS: 'https://netsentry.example',
      }),
    ).not.toThrow();
  });
});
