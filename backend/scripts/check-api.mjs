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
  API_RATE_LIMIT: '1000',
  ACCOUNT_MAIL_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  DATABASE_URL: url,
  DATABASE_SSL: process.env.TEST_DATABASE_SSL ?? 'false',
  DB_SYNCHRONIZE: 'false',
  API_PREFIX: 'api',
  CORS_ORIGINS: 'http://localhost:3001',
  JWT_ACCESS_TOKEN_SECRET: 'isolated-api-test-access-secret-not-for-production',
  JWT_REFRESH_TOKEN_SECRET:
    'isolated-api-test-refresh-secret-not-for-production',
});
const { deliverOne } = require('../dist/mail/delivery.js');
const { decryptMail } = require('../dist/mail/mail-crypto.js');
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
    assert.equal(response.headers.get('cache-control'), 'no-store');
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
  async function mailToken(email, purpose) {
    const [row] = await source.query(
      'SELECT m.id, m."encryptedPayload" FROM mail_outbox m JOIN users u ON u.id=m."userId" WHERE u.email=$1 ORDER BY m."createdAt" DESC',
      [email],
    );
    assert.ok(row, 'Expected encrypted fixture mail');
    const payload = decryptMail(
      row.encryptedPayload,
      process.env.ACCOUNT_MAIL_ENCRYPTION_KEY,
      row.id,
    );
    assert.equal(payload.purpose, purpose);
    return payload.token;
  }
  async function verify(email) {
    const token = await mailToken(email, 'verify_email');
    await request('POST', '/auth/verification/confirm', 201, null, { token });
    await request('POST', '/auth/verification/confirm', 400, 'ApiError', {
      token,
    });
  }
  await request('GET', '/health', 200, 'Health');
  const alice = await request('POST', '/auth/register', 201, 'AuthSession', {
    email: 'alice@example.invalid',
    displayName: 'Alice fixture',
    password: 'fixture-password-1234',
  });
  await verify('alice@example.invalid');
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
    403,
    'ApiError',
    device,
    alice.accessToken,
  );
  const enrolment = await request(
    'POST',
    '/devices/enrolments',
    201,
    null,
    {
      workspaceId: workspace.id,
      installationId: device.installationId,
      platform: 'ANDROID',
    },
    alice.accessToken,
  );
  const enrolledDevice = await request(
    'POST',
    '/devices/enrol',
    201,
    null,
    {
      token: enrolment.token,
      name: device.name,
      disclosureVersion: 'device-enrolment-v1',
      accepted: true,
    },
    alice.accessToken,
  );
  await request(
    'POST',
    '/devices/enrol',
    400,
    'ApiError',
    {
      token: enrolment.token,
      name: device.name,
      disclosureVersion: 'device-enrolment-v1',
      accepted: true,
    },
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
  const family = await request(
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
  await verify('bob@example.invalid');
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
    '/devices/enrolments',
    409,
    'ApiError',
    {
      installationId: device.installationId,
      platform: 'ANDROID',
      workspaceId: bobWorkspace.id,
    },
    bob.accessToken,
  );
  await source.query(
    'INSERT INTO memberships ("workspaceId", "userId", role) VALUES ($1, $2, $3)',
    [workspace.id, bob.user.id, 'VIEWER'],
  );
  await request(
    'GET',
    `/workspaces/${workspace.id}/devices`,
    200,
    'RegisteredDevice[]',
    null,
    bob.accessToken,
  );
  await request(
    'POST',
    '/workspaces/devices',
    403,
    'ApiError',
    { ...device, installationId: 'viewer-cannot-register' },
    bob.accessToken,
  );
  await source.query(
    'DELETE FROM memberships WHERE "workspaceId"=$1 AND "userId"=$2',
    [workspace.id, bob.user.id],
  );
  await request(
    'GET',
    `/workspaces/${workspace.id}/devices`,
    403,
    'ApiError',
    null,
    bob.accessToken,
  );
  await request(
    'POST',
    `/workspaces/${workspace.id}/invitations`,
    403,
    'ApiError',
    { email: 'bob@example.invalid', role: 'VIEWER' },
    alice.accessToken,
  );
  const invite = await request(
    'POST',
    `/workspaces/${family.id}/invitations`,
    201,
    null,
    { email: 'bob@example.invalid', role: 'VIEWER' },
    alice.accessToken,
  );
  await request(
    'POST',
    '/workspaces/invitations/accept',
    400,
    'ApiError',
    { token: invite.token },
    alice.accessToken,
  );
  await request(
    'POST',
    '/workspaces/invitations/accept',
    201,
    null,
    { token: invite.token },
    bob.accessToken,
  );
  await request(
    'POST',
    '/workspaces/invitations/accept',
    400,
    'ApiError',
    { token: invite.token },
    bob.accessToken,
  );
  await request(
    'GET',
    `/workspaces/${family.id}/members`,
    200,
    'WorkspaceMember[]',
    null,
    bob.accessToken,
  );
  await request(
    'POST',
    `/workspaces/${family.id}/select`,
    201,
    'Workspace',
    null,
    bob.accessToken,
  );
  const viewerPermissions = await request(
    'GET',
    `/workspaces/${family.id}/permissions`,
    200,
    'WorkspacePermissions',
    null,
    bob.accessToken,
  );
  assert.ok(!viewerPermissions.permissions.includes('services:control'));
  await request(
    'POST',
    `/workspaces/${family.id}/invitations`,
    403,
    'ApiError',
    { email: 'carol@example.invalid', role: 'ADMIN' },
    bob.accessToken,
  );
  await request(
    'PATCH',
    `/workspaces/${family.id}/members/${bob.user.id}`,
    403,
    'ApiError',
    { role: 'ADMIN' },
    bob.accessToken,
  );
  await request(
    'PATCH',
    `/workspaces/${family.id}/members/${bob.user.id}`,
    200,
    null,
    { role: 'ADMIN' },
    alice.accessToken,
  );
  await request(
    'POST',
    `/workspaces/${family.id}/invitations`,
    403,
    'ApiError',
    { email: 'carol@example.invalid', role: 'ADMIN' },
    bob.accessToken,
  );
  await request(
    'POST',
    `/workspaces/${family.id}/owner`,
    403,
    'ApiError',
    { userId: alice.user.id },
    bob.accessToken,
  );
  await request(
    'DELETE',
    `/workspaces/${family.id}/members/${alice.user.id}`,
    409,
    'ApiError',
    null,
    alice.accessToken,
  );
  await request(
    'DELETE',
    `/workspaces/${family.id}/members/${bob.user.id}`,
    200,
    null,
    null,
    bob.accessToken,
  );
  const afterLeave = await request(
    'GET',
    '/auth/me',
    200,
    'User',
    null,
    bob.accessToken,
  );
  assert.ok(!afterLeave.preferences.activeWorkspaceId);
  await request(
    'GET',
    `/workspaces/${family.id}/members`,
    403,
    'ApiError',
    null,
    bob.accessToken,
  );
  const expiredInvite = await request(
    'POST',
    `/workspaces/${family.id}/invitations`,
    201,
    null,
    { email: 'bob@example.invalid', role: 'MEMBER' },
    alice.accessToken,
  );
  await source.query(
    'UPDATE workspace_invitations SET "expiresAt"=now()-interval \'1 minute\' WHERE id=$1',
    [expiredInvite.invitation.id],
  );
  await request(
    'POST',
    '/workspaces/invitations/accept',
    400,
    'ApiError',
    { token: expiredInvite.token },
    bob.accessToken,
  );
  const revokedInvite = await request(
    'POST',
    `/workspaces/${family.id}/invitations`,
    201,
    null,
    { email: 'bob@example.invalid', role: 'MEMBER' },
    alice.accessToken,
  );
  await request(
    'DELETE',
    `/workspaces/${family.id}/invitations/${revokedInvite.invitation.id}`,
    200,
    null,
    null,
    alice.accessToken,
  );
  await request(
    'POST',
    '/workspaces/invitations/accept',
    400,
    'ApiError',
    { token: revokedInvite.token },
    bob.accessToken,
  );
  const memberInvite = await request(
    'POST',
    `/workspaces/${family.id}/invitations`,
    201,
    null,
    { email: 'bob@example.invalid', role: 'MEMBER' },
    alice.accessToken,
  );
  await request(
    'POST',
    '/workspaces/invitations/accept',
    201,
    null,
    { token: memberInvite.token },
    bob.accessToken,
  );
  const staleRejoin = await request(
    'POST',
    `/workspaces/${family.id}/invitations`,
    201,
    null,
    { email: 'bob@example.invalid', role: 'ADMIN' },
    alice.accessToken,
  );
  await request(
    'DELETE',
    `/workspaces/${family.id}/members/${bob.user.id}`,
    200,
    null,
    null,
    alice.accessToken,
  );
  await request(
    'POST',
    '/workspaces/invitations/accept',
    400,
    'ApiError',
    { token: staleRejoin.token },
    bob.accessToken,
  );
  const freshRejoin = await request(
    'POST',
    `/workspaces/${family.id}/invitations`,
    201,
    null,
    { email: 'bob@example.invalid', role: 'MEMBER' },
    alice.accessToken,
  );
  await request(
    'POST',
    '/workspaces/invitations/accept',
    201,
    null,
    { token: freshRejoin.token },
    bob.accessToken,
  );
  await request(
    'POST',
    `/workspaces/${family.id}/owner`,
    201,
    null,
    { userId: bob.user.id },
    alice.accessToken,
  );
  await request(
    'DELETE',
    `/workspaces/${family.id}/members/${alice.user.id}`,
    200,
    null,
    null,
    bob.accessToken,
  );
  await request(
    'GET',
    `/workspaces/${family.id}/members`,
    403,
    'ApiError',
    null,
    alice.accessToken,
  );
  const { checkDevices } = await import('./device-checks.mjs');
  await checkDevices({
    request,
    source,
    alice,
    bob,
    workspace,
    family,
    enrolledDevice,
  });
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
  const beforeReset = await request('POST', '/auth/login', 201, 'AuthSession', {
    email: 'alice@example.invalid',
    password: 'fixture-password-1234',
  });
  const unknownRecovery = await request(
    'POST',
    '/auth/password/forgot',
    201,
    null,
    { email: 'unknown@example.invalid' },
  );
  const knownRecovery = await request(
    'POST',
    '/auth/password/forgot',
    201,
    null,
    { email: 'alice@example.invalid' },
  );
  assert.deepEqual(
    knownRecovery,
    unknownRecovery,
    'Recovery responses cannot identify registered addresses.',
  );
  const reset = await mailToken('alice@example.invalid', 'reset_password');
  await request('POST', '/auth/verification/confirm', 400, 'ApiError', {
    token: reset,
  });
  await request('POST', '/auth/password/reset', 201, null, {
    token: reset,
    password: 'replacement-password-5678',
  });
  await request('POST', '/auth/password/reset', 400, 'ApiError', {
    token: reset,
    password: 'replacement-password-5678',
  });
  await request('POST', '/auth/login', 401, 'ApiError', {
    email: 'alice@example.invalid',
    password: 'fixture-password-1234',
  });
  await request(
    'GET',
    '/auth/me',
    401,
    'ApiError',
    null,
    beforeReset.accessToken,
  );
  let recovered = await request('POST', '/auth/login', 201, 'AuthSession', {
    email: 'alice@example.invalid',
    password: 'replacement-password-5678',
  });
  await request(
    'PATCH',
    '/auth/me',
    200,
    'User',
    { displayName: 'Updated fixture' },
    recovered.accessToken,
  );
  const preference = await request(
    'PATCH',
    '/auth/preferences',
    200,
    'User',
    { theme: 'DARK', notifications: { push: false } },
    recovered.accessToken,
  );
  assert.equal(preference.preferences.notifications.push, false);
  await request(
    'PATCH',
    '/auth/preferences',
    400,
    'ApiError',
    { activeWorkspaceId: workspace.id },
    recovered.accessToken,
  );
  await request(
    'PATCH',
    '/auth/preferences',
    400,
    'ApiError',
    { notifications: [] },
    recovered.accessToken,
  );
  const otherLogin = await request('POST', '/auth/login', 201, 'AuthSession', {
    email: 'alice@example.invalid',
    password: 'replacement-password-5678',
  });
  await request(
    'DELETE',
    '/auth/sessions',
    200,
    null,
    null,
    recovered.accessToken,
  );
  await request(
    'GET',
    '/auth/me',
    401,
    'ApiError',
    null,
    otherLogin.accessToken,
  );
  await request('GET', '/auth/me', 200, 'User', null, recovered.accessToken);
  const currentSessions = await request(
    'GET',
    '/auth/sessions',
    200,
    'Session[]',
    null,
    recovered.accessToken,
  );
  const currentSession = currentSessions.find(
    (session) => session.revokedAt === null,
  );
  await source.query('UPDATE sessions SET "lastUsedAt"=$1 WHERE id=$2', [
    new Date(0),
    currentSession.id,
  ]);
  await request('GET', '/auth/me', 200, 'User', null, recovered.accessToken);
  const [activity] = await source.query(
    'SELECT "lastUsedAt" FROM sessions WHERE id=$1',
    [currentSession.id],
  );
  assert.ok(new Date(activity.lastUsedAt).getTime() > Date.now() - 60000);
  const refreshRace = await Promise.all(
    [0, 1].map(() =>
      fetch(`${base}/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: recovered.refreshToken }),
      }),
    ),
  );
  assert.deepEqual(
    refreshRace.map((response) => response.status).sort(),
    [201, 401],
  );
  const refreshWinner = refreshRace.find((response) => response.status === 201);
  recovered = await refreshWinner.json();
  validateApiPayload('AuthSession', recovered);
  await request('POST', '/auth/password/forgot', 201, null, {
    email: 'alice@example.invalid',
  });
  const expired = await mailToken('alice@example.invalid', 'reset_password');
  await source.query(
    "UPDATE account_actions SET \"expiresAt\"=now()-interval '1 minute' WHERE purpose='reset_password'",
  );
  await request('POST', '/auth/password/reset', 400, 'ApiError', {
    token: expired,
    password: 'replacement-password-9999',
  });
  await request('POST', '/auth/password/forgot', 201, null, {
    email: 'alice@example.invalid',
  });
  const concurrentToken = await mailToken(
    'alice@example.invalid',
    'reset_password',
  );
  const delivered = [];
  for (let i = 0; i < 20; i++) {
    const result = await deliverOne(
      source,
      process.env.ACCOUNT_MAIL_ENCRYPTION_KEY,
      'https://app.example.invalid',
      async (mail) => {
        delivered.push(mail);
      },
    );
    if (result === 'sent' || result === 'empty') break;
  }
  assert.equal(
    delivered.length,
    1,
    'Mock delivery receives only the current valid message.',
  );
  assert.ok(delivered[0].text.includes('#token='));
  const concurrentResults = await Promise.all(
    [0, 1].map(() =>
      fetch(`${base}/auth/password/reset`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          token: concurrentToken,
          password: 'final-fixture-password-7890',
        }),
      }),
    ),
  );
  assert.deepEqual(
    concurrentResults.map((response) => response.status).sort(),
    [201, 400],
    'Reset must have only one winner.',
  );
  await request(
    'GET',
    '/auth/me',
    401,
    'ApiError',
    null,
    recovered.accessToken,
  );
  recovered = await request('POST', '/auth/login', 201, 'AuthSession', {
    email: 'alice@example.invalid',
    password: 'final-fixture-password-7890',
  });
  await source.query("UPDATE users SET status='SUSPENDED' WHERE id=$1", [
    bob.user.id,
  ]);
  await request('GET', '/auth/me', 401, 'ApiError', null, bob.accessToken);
  await request('POST', '/auth/refresh', 401, 'ApiError', {
    refreshToken: bob.refreshToken,
  });
  const { checkMonitoring } = await import('./monitoring-checks.mjs');
  await checkMonitoring({ request, source, alice: recovered, bob, workspace });
  const { checkEstimatedAlerts } = await import('./estimated-alert-checks.mjs');
  await checkEstimatedAlerts({ request, source, alice: recovered, workspace });
  const { checkAgents } = await import('./agent-checks.mjs');
  await checkAgents({ request, source, alice: recovered, bob, workspace });
  const { checkRemoteCommands } = await import('./remote-command-checks.mjs');
  await checkRemoteCommands({
    request,
    source,
    alice: recovered,
    bob,
    workspace,
  });
  const { checkRemoteAgentProcess } =
    await import('./remote-agent-process-checks.mjs');
  await checkRemoteAgentProcess({
    request,
    source,
    alice: recovered,
    workspace,
    apiURL: base,
  });
  const { checkAgentProcess } = await import('./agent-process-checks.mjs');
  await checkAgentProcess({
    request,
    source,
    alice: recovered,
    workspace,
    apiURL: base,
  });
  const { checkPrivacy } = await import('./privacy-checks.mjs');
  await checkPrivacy({ request, source, alice: recovered, bob, workspace });
  console.log(
    'Passed live API/schema checks, validation errors, request correlation, workspace isolation, device ownership and session revocation.',
  );
} finally {
  if (app) await app.close();
  if (source.isInitialized) {
    try {
      if (ownsSchema)
        while (
          Number(
            (
              await source.query(
                'SELECT count(*) AS count FROM netsentry_migrations',
              )
            )[0].count,
          )
        )
          await source.undoLastMigration();
    } finally {
      await source.destroy();
    }
  }
}
