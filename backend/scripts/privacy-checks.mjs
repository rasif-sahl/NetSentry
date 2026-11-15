import assert from 'node:assert/strict';
export async function checkPrivacy({ request, source, alice, bob, workspace }) {
  const auth = alice.accessToken;
  const password = 'final-fixture-password-7890';
  await source.query("UPDATE users SET status='ACTIVE' WHERE id=$1", [
    bob.user.id,
  ]);
  const code = await request(
    'POST',
    '/devices/enrolments',
    201,
    null,
    {
      workspaceId: workspace.id,
      installationId: 'privacy-fixture-installation',
      platform: 'ANDROID',
    },
    auth,
  );
  const activeDevice = await request(
    'POST',
    '/devices/enrol',
    201,
    null,
    {
      token: code.token,
      name: 'Privacy fixture',
      disclosureVersion: 'device-enrolment-v1',
      accepted: true,
    },
    auth,
  );
  await request(
    'GET',
    `/devices/${activeDevice.device.id}/configuration`,
    200,
    'DeviceConfiguration',
    null,
    activeDevice.deviceToken,
  );
  await request(
    'POST',
    '/privacy/export',
    401,
    'ApiError',
    { password: 'incorrect-password' },
    auth,
  );
  const exported = await request(
    'POST',
    '/privacy/export',
    201,
    'PrivacyExport',
    { password },
    auth,
  );
  assert.equal(exported.user.id, alice.user.id);
  assert.ok(
    exported.devices.every((device) => device.registeredById === alice.user.id),
  );
  assert.ok(exported.sessions.length > 0);
  const serialized = JSON.stringify(exported);
  for (const forbidden of [
    'passwordHash',
    'refreshTokenHash',
    'tokenHash',
    'encryptedPayload',
    'credentialHash',
    'bob@example.invalid',
  ])
    assert.ok(
      !serialized.includes(forbidden),
      `Export must exclude ${forbidden}`,
    );
  const history = await request(
    'GET',
    '/privacy/history',
    200,
    'PrivacyEvent[]',
    null,
    auth,
  );
  assert.ok(history.some((event) => event.kind === 'export_created'));
  const foreignHistory = await request(
    'GET',
    '/privacy/history',
    200,
    'PrivacyEvent[]',
    null,
    bob.accessToken,
  );
  assert.equal(foreignHistory.length, 0);
  await request(
    'DELETE',
    '/privacy/account',
    400,
    'ApiError',
    { password, confirmation: 'wrong' },
    auth,
  );
  await request(
    'DELETE',
    '/privacy/account',
    401,
    'ApiError',
    { password: 'incorrect-password', confirmation: 'DELETE' },
    auth,
  );
  const shared = await request(
    'POST',
    '/workspaces',
    201,
    'Workspace',
    { name: 'Privacy ownership fixture', type: 'FAMILY' },
    auth,
  );
  const invitation = await request(
    'POST',
    `/workspaces/${shared.id}/invitations`,
    201,
    null,
    { email: 'bob@example.invalid', role: 'MEMBER' },
    auth,
  );
  await request(
    'POST',
    '/workspaces/invitations/accept',
    201,
    null,
    { token: invitation.token },
    bob.accessToken,
  );
  await request(
    'DELETE',
    '/privacy/account',
    409,
    'ApiError',
    { password, confirmation: 'DELETE' },
    auth,
  );
  await request(
    'POST',
    `/workspaces/${shared.id}/owner`,
    201,
    null,
    { userId: bob.user.id },
    auth,
  );
  await request(
    'DELETE',
    `/workspaces/${shared.id}/members/${alice.user.id}`,
    200,
    null,
    null,
    auth,
  );
  await request(
    'DELETE',
    '/privacy/account',
    200,
    null,
    { password, confirmation: 'DELETE' },
    auth,
  );
  await request('GET', '/auth/me', 401, 'ApiError', null, auth);
  await request('POST', '/auth/refresh', 401, 'ApiError', {
    refreshToken: alice.refreshToken,
  });
  await request('POST', '/auth/login', 401, 'ApiError', {
    email: 'alice@example.invalid',
    password,
  });
  await request(
    'GET',
    `/devices/${activeDevice.device.id}/configuration`,
    401,
    'ApiError',
    null,
    activeDevice.deviceToken,
  );
  for (const [table, column] of [
    ['users', 'id'],
    ['sessions', 'userId'],
    ['account_actions', 'userId'],
    ['mail_outbox', 'userId'],
    ['device_enrolments', 'userId'],
    ['registered_devices', 'registeredById'],
    ['privacy_events', 'userId'],
  ]) {
    const [row] = await source.query(
      `SELECT count(*) AS count FROM "${table}" WHERE "${column}"=$1`,
      [alice.user.id],
    );
    assert.equal(
      Number(row.count),
      0,
      `Deletion must remove account-owned rows from ${table}`,
    );
  }
  await request('GET', '/auth/me', 200, 'User', null, bob.accessToken);
  await request(
    'GET',
    `/workspaces/${shared.id}/members`,
    200,
    'WorkspaceMember[]',
    null,
    bob.accessToken,
  );
  console.log(
    'Passed fresh-password export, secret/tenant isolation, ownership safeguards, atomic account deletion and credential invalidation.',
  );
}
