import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

export async function checkDevices({
  request,
  source,
  alice,
  bob,
  workspace,
  family,
  enrolledDevice,
}) {
  let pairing = enrolledDevice;
  const id = pairing.device.id;
  const auth = alice.accessToken;
  await request('GET', '/privacy/disclosures', 200, 'Disclosures');
  await request('GET', `/devices/${id}`, 200, 'RegisteredDevice', null, auth);
  await request(
    'GET',
    `/devices/${id}`,
    403,
    'ApiError',
    null,
    bob.accessToken,
  );
  await request(
    'GET',
    `/devices/${id}/configuration`,
    401,
    'ApiError',
    null,
    auth,
  );
  await request(
    'GET',
    `/devices/${id}`,
    401,
    'ApiError',
    null,
    pairing.deviceToken,
  );
  await request(
    'PATCH',
    `/devices/${id}`,
    200,
    'RegisteredDevice',
    { name: 'Renamed fixture' },
    auth,
  );
  const capabilityReport = JSON.parse(
    readFileSync(
      new URL(
        '../../contracts/fixtures/device-capabilities.v1.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  capabilityReport.deviceId = id;
  capabilityReport.workspaceId = workspace.id;
  await request(
    'POST',
    `/devices/${id}/heartbeat`,
    201,
    'DeviceConfiguration',
    {
      generation: pairing.device.generation,
      applicationVersion: 'fixture-1',
      deviceModel: 'Fixture phone',
      operatingSystemVersion: 'Fixture OS',
      permissionStatus: 'granted',
      batteryOptimizationStatus: 'unrestricted',
      capabilityReport,
    },
    pairing.deviceToken,
  );
  const invalidReport = structuredClone(capabilityReport);
  invalidReport.capabilities[0].availableActions = ['measure'];
  await request(
    'POST',
    `/devices/${id}/heartbeat`,
    400,
    'ApiError',
    { generation: pairing.device.generation, capabilityReport: invalidReport },
    pairing.deviceToken,
  );
  const foreignReport = { ...capabilityReport, workspaceId: family.id };
  await request(
    'POST',
    `/devices/${id}/heartbeat`,
    400,
    'ApiError',
    { generation: pairing.device.generation, capabilityReport: foreignReport },
    pairing.deviceToken,
  );
  const enabled = await request(
    'POST',
    `/devices/${id}/consent`,
    201,
    'RegisteredDevice',
    {
      disclosureVersion: 'monitoring-v1',
      accepted: true,
      scopes: ['network_usage'],
    },
    auth,
  );
  assert.equal(enabled.monitoringEnabled, true);
  await request(
    'POST',
    `/devices/${id}/heartbeat`,
    409,
    'ApiError',
    { generation: pairing.device.generation },
    pairing.deviceToken,
  );
  let configuration = await request(
    'GET',
    `/devices/${id}/configuration`,
    200,
    'DeviceConfiguration',
    null,
    pairing.deviceToken,
  );
  const denied = await request(
    'POST',
    `/devices/${id}/heartbeat`,
    201,
    'DeviceConfiguration',
    { generation: configuration.generation, permissionStatus: 'revoked' },
    pairing.deviceToken,
  );
  assert.equal(denied.monitoringEnabled, false);
  const history = await request(
    'GET',
    `/devices/${id}/history`,
    200,
    'DeviceEvent[]',
    null,
    auth,
  );
  assert.ok(
    history.some(
      (event) =>
        event.kind === 'consent_granted' && event.details.disclosureHash,
    ),
  );
  assert.ok(history.some((event) => event.kind === 'permission_reported'));
  await request(
    'POST',
    `/devices/${id}/pause`,
    201,
    'RegisteredDevice',
    null,
    auth,
  );
  await request(
    'DELETE',
    `/devices/${id}/consent`,
    200,
    'RegisteredDevice',
    null,
    auth,
  );
  await request('DELETE', `/devices/${id}/data`, 200, null, null, auth);
  await request(
    'GET',
    `/devices/${id}/configuration`,
    401,
    'ApiError',
    null,
    pairing.deviceToken,
  );
  const erased = await request(
    'GET',
    `/devices/${id}`,
    200,
    'RegisteredDevice',
    null,
    auth,
  );
  assert.equal(erased.capabilityReport, null);
  assert.equal(erased.applicationVersion, null);
  const erasedHistory = await request(
    'GET',
    `/devices/${id}/history`,
    200,
    'DeviceEvent[]',
    null,
    auth,
  );
  assert.deepEqual(
    erasedHistory.map((event) => event.kind),
    ['data_deleted'],
  );
  await request(
    'POST',
    `/devices/${id}/unenrol`,
    201,
    'RegisteredDevice',
    null,
    auth,
  );
  await request(
    'GET',
    `/devices/${id}/configuration`,
    401,
    'ApiError',
    null,
    pairing.deviceToken,
  );
  const renewedCode = await request(
    'POST',
    '/devices/enrolments',
    201,
    null,
    {
      workspaceId: workspace.id,
      installationId: pairing.device.installationId,
      platform: 'ANDROID',
    },
    auth,
  );
  const oldToken = pairing.deviceToken;
  pairing = await request(
    'POST',
    '/devices/enrol',
    201,
    null,
    {
      token: renewedCode.token,
      name: 'Re-enrolled fixture',
      disclosureVersion: 'device-enrolment-v1',
      accepted: true,
    },
    auth,
  );
  assert.equal(pairing.device.monitoringEnabled, false);
  await request(
    'GET',
    `/devices/${id}/configuration`,
    401,
    'ApiError',
    null,
    oldToken,
  );
  await request(
    'GET',
    `/devices/${id}/configuration`,
    200,
    'DeviceConfiguration',
    null,
    pairing.deviceToken,
  );
  const staleCode = await request(
    'POST',
    '/devices/enrolments',
    201,
    null,
    {
      workspaceId: workspace.id,
      installationId: pairing.device.installationId,
      platform: 'ANDROID',
    },
    auth,
  );
  await request('DELETE', `/devices/${id}`, 200, null, null, auth);
  await request(
    'GET',
    `/devices/${id}/configuration`,
    401,
    'ApiError',
    null,
    pairing.deviceToken,
  );
  await request(
    'POST',
    '/devices/enrol',
    400,
    'ApiError',
    {
      token: staleCode.token,
      name: 'Cannot resurrect',
      disclosureVersion: 'device-enrolment-v1',
      accepted: true,
    },
    auth,
  );
  assert.ok(
    !(
      await request(
        'GET',
        `/workspaces/${workspace.id}/devices`,
        200,
        'RegisteredDevice[]',
        null,
        auth,
      )
    ).some((device) => device.id === id),
  );
  const expiredCode = await request(
    'POST',
    '/devices/enrolments',
    201,
    null,
    {
      workspaceId: workspace.id,
      installationId: 'expired-fixture-installation',
      platform: 'ANDROID',
    },
    auth,
  );
  await source.query(
    'UPDATE device_enrolments SET "expiresAt"=now()-interval \'1 minute\' WHERE "installationId"=\'expired-fixture-installation\'',
  );
  await request(
    'POST',
    '/devices/enrol',
    400,
    'ApiError',
    {
      token: expiredCode.token,
      name: 'Expired fixture',
      disclosureVersion: 'device-enrolment-v1',
      accepted: true,
    },
    auth,
  );

  // Shared-workspace administrators may pause/unenrol, but only the installation
  // owner can grant monitoring consent. Membership loss invalidates credentials.
  const invitation = await request(
    'POST',
    `/workspaces/${family.id}/invitations`,
    201,
    null,
    { email: 'alice@example.invalid', role: 'MEMBER' },
    bob.accessToken,
  );
  await request(
    'POST',
    '/workspaces/invitations/accept',
    201,
    null,
    { token: invitation.token },
    auth,
  );
  const sharedCode = await request(
    'POST',
    '/devices/enrolments',
    201,
    null,
    {
      workspaceId: family.id,
      installationId: 'shared-fixture-installation',
      platform: 'ANDROID',
    },
    auth,
  );
  await request(
    'POST',
    '/devices/enrol',
    400,
    'ApiError',
    {
      token: sharedCode.token,
      name: 'Wrong user',
      disclosureVersion: 'device-enrolment-v1',
      accepted: true,
    },
    bob.accessToken,
  );
  const shared = await request(
    'POST',
    '/devices/enrol',
    201,
    null,
    {
      token: sharedCode.token,
      name: 'Shared fixture',
      disclosureVersion: 'device-enrolment-v1',
      accepted: true,
    },
    auth,
  );
  await request(
    'POST',
    `/devices/${shared.device.id}/consent`,
    403,
    'ApiError',
    {
      disclosureVersion: 'monitoring-v1',
      accepted: true,
      scopes: ['app_usage'],
    },
    bob.accessToken,
  );
  await request(
    'POST',
    `/devices/${shared.device.id}/pause`,
    201,
    'RegisteredDevice',
    null,
    bob.accessToken,
  );
  await request(
    'PATCH',
    `/workspaces/${family.id}/members/${alice.user.id}`,
    200,
    null,
    { role: 'VIEWER' },
    bob.accessToken,
  );
  await request(
    'GET',
    `/devices/${shared.device.id}/configuration`,
    401,
    'ApiError',
    null,
    shared.deviceToken,
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
    'DELETE',
    `/devices/${shared.device.id}/data`,
    200,
    null,
    null,
    auth,
  );
  console.log(
    'Passed device enrolment/replay/expiry, credential boundaries, consent/history, stale generations, revocation, data deletion and membership removal.',
  );
}
