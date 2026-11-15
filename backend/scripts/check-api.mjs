import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  validateApiPayload,
  validateApiResponse,
} from '../../contracts/scripts/validation.mjs';
const require = createRequire(import.meta.url);
require('reflect-metadata');
process.env.TZ = 'UTC';
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test'))
  throw new Error(
    'Set TEST_DATABASE_URL to a dedicated empty database ending in _test.',
  );
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: url,
  DATABASE_SSL: process.env.TEST_DATABASE_SSL ?? 'false',
  DB_SYNCHRONIZE: 'false',
  API_PREFIX: 'api',
  CORS_ORIGINS: 'http://localhost:3001',
  JWT_ACCESS_TOKEN_SECRET: 'isolated-api-test-access-secret-not-for-production',
  JWT_REFRESH_TOKEN_SECRET:
    'isolated-api-test-refresh-secret-not-for-production',
});
const { DataSource } = require('typeorm');
const { databaseOptions } = require('../dist/database/options.js');
const { NestFactory } = require('@nestjs/core');
const { ConfigService } = require('@nestjs/config');
const { configureHttp } = require('../dist/common/configure-http.js');
const source = new DataSource(databaseOptions(process.env));
let app;
let ownsSchema = false;
try {
  await source.initialize();
  const tables = await source.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name <> 'netsentry_migrations'",
  );
  assert.equal(tables.length, 0, 'Refusing a nonempty application schema.');
  const [history] = await source.query(
    "SELECT to_regclass('public.netsentry_migrations') AS history",
  );
  if (history.history)
    assert.equal(
      Number(
        (
          await source.query(
            'SELECT count(*) AS count FROM netsentry_migrations',
          )
        )[0].count,
      ),
      0,
    );
  await source.runMigrations();
  ownsSchema = true;
  const { AppModule } = require('../dist/app.module.js');
  app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  configureHttp(app, app.get(ConfigService));
  await app.listen(0, '127.0.0.1');
  const base = `${await app.getUrl()}/api/v1`;
  async function request(method, path, status, schema, body, token) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'untrusted-caller-id',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal(
      response.status,
      status,
      `${method} ${path} returned an unexpected status`,
    );
    const payload = await response.json();
    if (path !== '/missing') validateApiResponse(method, path, status, payload);
    assert.match(response.headers.get('x-request-id'), /^[0-9a-f-]{36}$/);
    if (schema === 'ApiError') {
      validateApiPayload(schema, payload);
      assert.equal(payload.requestId, response.headers.get('x-request-id'));
      assert.ok(!payload.path.includes('?'));
    } else if (schema?.endsWith('[]')) {
      assert.ok(Array.isArray(payload));
      for (const item of payload) validateApiPayload(schema.slice(0, -2), item);
    } else if (schema) validateApiPayload(schema, payload);
    return payload;
  }
  await request('GET', '/health', 200, 'Health');
  const alice = await request('POST', '/auth/register', 201, 'AuthSession', {
    email: 'alice@example.invalid',
    displayName: 'Alice fixture',
    password: 'fixture-password-1234',
  });
  await request('GET', '/auth/me', 200, 'User', null, alice.accessToken);
  const [workspace] = await request(
    'GET',
    '/workspaces',
    200,
    'Workspace[]',
    null,
    alice.accessToken,
  );
  const device = {
    workspaceId: workspace.id,
    installationId: 'phase1-fixture-installation',
    name: 'Fixture phone',
    platform: 'ANDROID',
    capabilities: { usage: false },
  };
  await request(
    'POST',
    '/workspaces/devices',
    201,
    'RegisteredDevice',
    device,
    alice.accessToken,
  );
  await request(
    'GET',
    `/workspaces/${workspace.id}/devices`,
    200,
    'RegisteredDevice[]',
    null,
    alice.accessToken,
  );
  await request(
    'POST',
    '/workspaces',
    201,
    'Workspace',
    { name: 'Family fixture', type: 'FAMILY', timezone: 'UTC' },
    alice.accessToken,
  );
  await request(
    'POST',
    '/workspaces',
    403,
    'ApiError',
    { name: 'Duplicate personal', type: 'PERSONAL' },
    alice.accessToken,
  );
  await request(
    'GET',
    '/workspaces/not-a-uuid/devices',
    400,
    'ApiError',
    null,
    alice.accessToken,
  );
  await request(
    'POST',
    '/workspaces/devices',
    400,
    'ApiError',
    { ...device, capabilities: { usage: { unsupported: true } } },
    alice.accessToken,
  );
  const bob = await request('POST', '/auth/register', 201, 'AuthSession', {
    email: 'bob@example.invalid',
    displayName: 'Bob fixture',
    password: 'fixture-password-1234',
  });
  await request(
    'GET',
    `/workspaces/${workspace.id}/devices`,
    403,
    'ApiError',
    null,
    bob.accessToken,
  );
  const [bobWorkspace] = await request(
    'GET',
    '/workspaces',
    200,
    'Workspace[]',
    null,
    bob.accessToken,
  );
  await request(
    'POST',
    '/workspaces/devices',
    409,
    'ApiError',
    { ...device, workspaceId: bobWorkspace.id },
    bob.accessToken,
  );
  const renewed = await request('POST', '/auth/refresh', 201, 'AuthSession', {
    refreshToken: alice.refreshToken,
  });
  await request(
    'GET',
    '/auth/me?token=must-not-be-echoed',
    401,
    'ApiError',
    null,
    alice.accessToken,
  );
  const sessions = await request(
    'GET',
    '/auth/sessions',
    200,
    'Session[]',
    null,
    renewed.accessToken,
  );
  const active = sessions.find((session) => session.revokedAt === null);
  assert.ok(active);
  await request(
    'DELETE',
    `/auth/sessions/${active.id}`,
    200,
    null,
    null,
    renewed.accessToken,
  );
  await request('GET', '/auth/me', 401, 'ApiError', null, renewed.accessToken);
  const login = await request('POST', '/auth/login', 201, 'AuthSession', {
    email: 'alice@example.invalid',
    password: 'fixture-password-1234',
  });
  await request('POST', '/auth/logout', 201, null, null, login.accessToken);
  await request('GET', '/auth/me', 401, 'ApiError', null, login.accessToken);
  await request('GET', '/missing', 404, 'ApiError');
  console.log(
    'Passed live API/schema checks, validation errors, request correlation, workspace isolation, device ownership and session revocation.',
  );
} finally {
  if (app) await app.close();
  if (source.isInitialized) {
    try {
      if (ownsSchema) await source.undoLastMigration();
    } finally {
      await source.destroy();
    }
  }
}
