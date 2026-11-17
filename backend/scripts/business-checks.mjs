// Explicitly synthetic actors and daily aggregates. No employee/device OS data.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  CollaborationService,
} = require('../dist/workspaces/collaboration.service.js');
const { NetworkEndpoint } = require('../dist/networks/network.entities.js');
const { Agent } = require('../dist/agents/agent.entities.js');
const {
  AgentDeveloper,
  DeveloperCommand,
} = require('../dist/agents/developer.entities.js');
const {
  maintainBusiness,
} = require('../dist/business/business-maintenance.js');
const { PrivacyService } = require('../dist/account/privacy.service.js');
export async function checkBusiness({ request, source, alice, app }) {
  const token = alice.accessToken,
    password = 'synthetic-business-password-123';
  const organization = await request(
    'POST',
    '/workspaces',
    201,
    null,
    { name: 'Synthetic organization', type: 'BUSINESS', timezone: 'UTC' },
    token,
  );
  const other = await request(
    'POST',
    '/workspaces',
    201,
    null,
    {
      name: 'Separate synthetic organization',
      type: 'BUSINESS',
      timezone: 'UTC',
    },
    token,
  );
  const base = `/workspaces/${organization.id}/business`,
    otherBase = `/workspaces/${other.id}/business`;
  const accounts = {};
  for (const role of [
    'ADMIN',
    'NETWORK_ADMIN',
    'ANALYST',
    'VIEWER',
    'EMPLOYEE',
  ]) {
    const account = await request('POST', '/auth/register', 201, null, {
      email: `business-${role.toLowerCase()}@example.invalid`,
      displayName: `Synthetic ${role}`,
      password,
    });
    await source.query('UPDATE users SET "emailVerifiedAt"=now() WHERE id=$1', [
      account.user.id,
    ]);
    const invitation = await request(
      'POST',
      `/workspaces/${organization.id}/invitations`,
      201,
      null,
      { email: account.user.email, role },
      token,
    );
    await app
      .get(CollaborationService)
      .accept(account.user.id, invitation.token);
    accounts[role] = account;
  }
  const employee = accounts.EMPLOYEE,
    analyst = accounts.ANALYST,
    network = accounts.NETWORK_ADMIN,
    viewer = accounts.VIEWER,
    admin = accounts.ADMIN;
  const location = await request(
    'POST',
    `${base}/locations`,
    201,
    null,
    { name: 'Synthetic Colombo', expectedRevision: 0 },
    network.accessToken,
  );
  const second = await request(
    'POST',
    `${base}/locations`,
    201,
    null,
    { name: 'Synthetic Kandy', expectedRevision: 0 },
    token,
  );
  const remote = await request(
    'POST',
    `${otherBase}/locations`,
    201,
    null,
    { name: 'Other organization', expectedRevision: 0 },
    token,
  );
  const department = await request(
    'POST',
    `${base}/departments`,
    201,
    null,
    { name: 'Engineering', locationId: location.id, expectedRevision: 0 },
    token,
  );
  await request(
    'POST',
    `${base}/departments`,
    403,
    'ApiError',
    { name: 'Cross-org forgery', locationId: remote.id, expectedRevision: 0 },
    token,
  );
  await request(
    'POST',
    `${base}/departments`,
    403,
    'ApiError',
    { name: 'Forbidden', locationId: location.id, expectedRevision: 0 },
    network.accessToken,
  );
  const outsideFamily = await request(
    'POST',
    '/workspaces',
    201,
    null,
    { name: 'Role boundary family', type: 'FAMILY', timezone: 'UTC' },
    token,
  );
  await request(
    'POST',
    `/workspaces/${outsideFamily.id}/invitations`,
    403,
    'ApiError',
    { email: employee.user.email, role: 'NETWORK_ADMIN' },
    token,
  );
  const profile = await request(
    'POST',
    `${base}/employees`,
    201,
    null,
    { userId: employee.user.id, departmentId: department.id },
    token,
  );
  await request(
    'POST',
    `${base}/employees`,
    409,
    'ApiError',
    { userId: employee.user.id },
    token,
  );
  async function pair(account, workspaceId, name) {
    const code = await request(
      'POST',
      '/devices/enrolments',
      201,
      null,
      { workspaceId, installationId: randomUUID(), platform: 'ANDROID' },
      account.accessToken,
    );
    return request(
      'POST',
      '/devices/enrol',
      201,
      null,
      {
        token: code.token,
        name,
        accepted: true,
        disclosureVersion: 'device-enrolment-v1',
      },
      account.accessToken,
    );
  }
  const personal = await pair(
    employee,
    organization.id,
    'Synthetic employee phone',
  );
  let device = await request(
    'POST',
    `/devices/${personal.device.id}/consent`,
    201,
    null,
    {
      accepted: true,
      disclosureVersion: 'monitoring-v3',
      scopes: ['network_usage'],
    },
    employee.accessToken,
  );
  const assignment = await request(
    'POST',
    `${base}/devices/${device.id}/assignment`,
    201,
    null,
    { employeeId: profile.id, expectedRevision: 0 },
    token,
  );
  await request(
    'POST',
    `${base}/devices/${device.id}/sharing`,
    403,
    'ApiError',
    {
      accepted: true,
      disclosureVersion: 'business-sharing-v1',
      expectedRevision: assignment.revision,
      generation: device.generation,
    },
    token,
  );
  const accepted = await request(
    'POST',
    `${base}/devices/${device.id}/sharing`,
    201,
    null,
    {
      accepted: true,
      disclosureVersion: 'business-sharing-v1',
      expectedRevision: assignment.revision,
      generation: device.generation,
    },
    employee.accessToken,
  );
  assert.ok(accepted.reportFrom);
  const today = new Date().toISOString().slice(0, 10),
    tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const range = `from=${yesterday}&to=${tomorrow}`;
  for (const date of [yesterday, today])
    await source.query(
      `INSERT INTO daily_usage ("workspaceId","deviceId","seriesKey","localDate",timezone,metric,"applicationId",quality,"sourceKind","collectorVersion",value,"coverageMs","proratedEvents") VALUES ($1,$2,$3,$4,'UTC','mobile_data_bytes','','estimated','android','synthetic-business-v1',25,1000,0)`,
      [organization.id, device.id, randomUUID(), date],
    );
  assert.equal(
    (
      await request(
        'GET',
        `${base}/reports?${range}`,
        200,
        'BusinessReport',
        null,
        analyst.accessToken,
      )
    ).rows.length,
    0,
    'No partial-day or pre-sharing history',
  );
  // Fixture only: move the consent boundary to today to test exact filtering.
  await source.query(
    'UPDATE business_assignments SET "reportFrom"=$1 WHERE "deviceId"=$2',
    [today, device.id],
  );
  let report = await request(
    'GET',
    `${base}/reports?${range}`,
    200,
    'BusinessReport',
    null,
    analyst.accessToken,
  );
  assert.equal(report.rows.length, 1);
  assert.equal(Number(report.rows[0].value), 25);
  assert.equal(report.rows[0].quality, 'estimated');
  assert.equal(report.rows[0].localDate, today);
  assert.ok(!JSON.stringify(report).includes(employee.user.id));
  assert.ok(!JSON.stringify(report).includes('applicationId'));
  await request(
    'GET',
    `${base}/reports/export?${range}`,
    200,
    'BusinessReport',
    null,
    analyst.accessToken,
  );
  await request(
    'GET',
    `${base}/reports?${range}`,
    403,
    'ApiError',
    null,
    viewer.accessToken,
  );
  await request(
    'GET',
    `${base}/reports?${range}`,
    403,
    'ApiError',
    null,
    network.accessToken,
  );
  await request(
    'GET',
    `${otherBase}/reports?${range}`,
    403,
    'ApiError',
    null,
    analyst.accessToken,
  );
  await request(
    'GET',
    `${base}/reports?${range}&locationId=${remote.id}`,
    403,
    'ApiError',
    null,
    token,
  );
  await request(
    'GET',
    `/workspaces/${organization.id}/monitoring/usage?${range}&period=day&metric=mobile_data_bytes&deviceId=${device.id}`,
    403,
    'ApiError',
    null,
    token,
  );
  await request(
    'GET',
    `/workspaces/${organization.id}/monitoring/export?${range}&period=day&metric=mobile_data_bytes&deviceId=${device.id}`,
    403,
    'ApiError',
    null,
    token,
  );
  await request(
    'POST',
    `/workspaces/${organization.id}/monitoring/rules`,
    403,
    'ApiError',
    {
      kind: 'threshold',
      deviceId: device.id,
      metric: 'mobile_data_bytes',
      period: 'day',
      threshold: 10,
      severity: 'warning',
      channels: ['in_app'],
      enabled: true,
    },
    token,
  );
  await request(
    'POST',
    `${otherBase}/devices/${device.id}/assignment`,
    403,
    'ApiError',
    { employeeId: profile.id, expectedRevision: accepted.revision },
    token,
  );
  const net = await request(
    'POST',
    `/workspaces/${organization.id}/monitoring/networks`,
    201,
    null,
    { name: 'Synthetic office LAN' },
    network.accessToken,
  );
  await request(
    'PATCH',
    `${base}/networks/${net.id}/location`,
    200,
    null,
    { locationId: location.id },
    network.accessToken,
  );
  await request(
    'PATCH',
    `${base}/networks/${net.id}/location`,
    403,
    'ApiError',
    { locationId: remote.id },
    network.accessToken,
  );
  await request(
    'POST',
    `${base}/compliance-policy`,
    201,
    null,
    {
      expectedRevision: 0,
      staleMinutes: 30,
      requireMonitoring: true,
      requirePermission: true,
    },
    token,
  );
  await request(
    'POST',
    `${base}/compliance-policy`,
    409,
    'ApiError',
    {
      expectedRevision: 0,
      staleMinutes: 30,
      requireMonitoring: false,
      requirePermission: false,
    },
    token,
  );
  await source.query(
    'UPDATE registered_devices SET "lastSeenAt"=NULL WHERE id=$1',
    [device.id],
  );
  const alertSite = await request(
    'POST',
    `/workspaces/${organization.id}/networks`,
    201,
    null,
    { name: 'Synthetic assigned-event LAN', cidrs: ['192.168.90.0/24'] },
    network.accessToken,
  );
  const endpoint = await source.getRepository(NetworkEndpoint).save({
    networkId: alertSite.networkId,
    identity: randomUUID(),
    name: 'Synthetic department printer',
    firstSeenAt: new Date(),
    lastSeenAt: new Date(),
  });
  const endpointLink = await request(
    'PATCH',
    `${base}/endpoints/${endpoint.id}/department`,
    200,
    null,
    { expectedRevision: 0, departmentId: department.id },
    network.accessToken,
  );
  assert.equal(endpointLink.departmentId, department.id);
  await request(
    'PATCH',
    `${otherBase}/endpoints/${endpoint.id}/department`,
    403,
    'ApiError',
    { expectedRevision: 0, departmentId: department.id },
    token,
  );
  await request(
    'PATCH',
    `${base}/endpoints/${endpoint.id}/department`,
    403,
    'ApiError',
    { expectedRevision: 1, departmentId: department.id },
    employee.accessToken,
  );
  await request(
    'PATCH',
    `${base}/endpoints/${endpoint.id}/department`,
    200,
    null,
    { expectedRevision: 1 },
    network.accessToken,
  );
  await request(
    'PATCH',
    `${base}/endpoints/${endpoint.id}/department`,
    409,
    'ApiError',
    { expectedRevision: 1, departmentId: department.id },
    network.accessToken,
  );
  const events = await request(
    'GET',
    `${base}/alerts`,
    200,
    null,
    null,
    network.accessToken,
  );
  assert.ok(events.length > 0);
  const assignedAlert = await request(
    'PATCH',
    `${base}/alerts/${events[0].id}`,
    200,
    null,
    { expectedRevision: 0, assigneeId: network.user.id, resolved: false },
    token,
  );
  await request(
    'PATCH',
    `${base}/alerts/${events[0].id}`,
    403,
    'ApiError',
    {
      expectedRevision: assignedAlert.revision,
      assigneeId: employee.user.id,
      resolved: false,
    },
    token,
  );
  await request(
    'PATCH',
    `${otherBase}/alerts/${events[0].id}`,
    403,
    'ApiError',
    { expectedRevision: 0, resolved: true },
    token,
  );
  await request(
    'GET',
    `${base}/alerts`,
    403,
    'ApiError',
    null,
    employee.accessToken,
  );
  const ownView = await request(
    'GET',
    base,
    200,
    'BusinessOverview',
    null,
    employee.accessToken,
  );
  assert.equal(ownView.employees.length, 1);
  assert.equal(ownView.devices.length, 1);
  assert.ok(
    ownView.devices[0].compliance.checks.includes('metadata_stale_or_missing'),
  );
  const members = await request(
    'GET',
    `/workspaces/${organization.id}/members`,
    200,
    null,
    null,
    employee.accessToken,
  );
  assert.equal(members.length, 1);
  assert.equal(members[0].userId, employee.user.id);
  await request(
    'DELETE',
    `/devices/${device.id}/data`,
    403,
    'ApiError',
    null,
    admin.accessToken,
  );
  await request(
    'POST',
    `${base}/devices/${device.id}/custody`,
    403,
    'ApiError',
    { accepted: true, disclosureVersion: 'business-custody-v1' },
    token,
  );
  const corporate = await pair(
    alice,
    organization.id,
    'Synthetic company tablet',
  );
  await request(
    'POST',
    `${base}/devices/${corporate.device.id}/custody`,
    201,
    null,
    { accepted: true, disclosureVersion: 'business-custody-v1' },
    token,
  );
  const corporateAssignment = await request(
    'POST',
    `${base}/devices/${corporate.device.id}/assignment`,
    201,
    null,
    { employeeId: profile.id, expectedRevision: 0 },
    admin.accessToken,
  );
  await request(
    'POST',
    `${base}/devices/${corporate.device.id}/sharing`,
    201,
    null,
    {
      accepted: true,
      disclosureVersion: 'business-sharing-v1',
      expectedRevision: corporateAssignment.revision,
      generation: corporate.device.generation,
    },
    employee.accessToken,
  );
  await request(
    'DELETE',
    `/devices/${corporate.device.id}/data`,
    403,
    'ApiError',
    null,
    employee.accessToken,
  );
  await request(
    'PATCH',
    `${base}/employees/${profile.id}`,
    200,
    null,
    { expectedRevision: profile.revision, departmentId: department.id },
    token,
  );
  report = await request(
    'GET',
    `${base}/reports?${range}`,
    200,
    'BusinessReport',
    null,
    analyst.accessToken,
  );
  assert.equal(
    report.rows.length,
    0,
    'Department/grant revisions invalidate sharing',
  );
  await request(
    'GET',
    `${base}/audit/export?${range}`,
    200,
    'BusinessAuditExport',
    null,
    analyst.accessToken,
  );
  await request(
    'GET',
    `${base}/audit?${range}`,
    403,
    'ApiError',
    null,
    viewer.accessToken,
  );
  await request(
    'GET',
    `${base}/audit/export?${range}`,
    403,
    'ApiError',
    null,
    network.accessToken,
  );
  const outsideWorkspace = (
    await request('GET', '/workspaces', 200, null, null, employee.accessToken)
  ).find((w) => w.type === 'PERSONAL');
  const unrelated = await pair(
    employee,
    outsideWorkspace.id,
    'Synthetic independent phone',
  );
  const commandAgent = await source.getRepository(Agent).save({
    installationId: randomUUID(),
    workspaceId: organization.id,
    userId: employee.user.id,
    disclosureHash: 'f'.repeat(64),
    consentedAt: new Date(),
    name: 'Synthetic offboarding agent',
    platform: 'darwin',
    modules: { network: false, developer: true },
  });
  await source.getRepository(AgentDeveloper).save({
    agentId: commandAgent.id,
    generation: 1,
    consentedAt: new Date(),
    controllers: [employee.user.id],
  });
  const queued = await source.getRepository(DeveloperCommand).save({
    agentId: commandAgent.id,
    requesterId: employee.user.id,
    requestId: randomUUID(),
    generation: 1,
    revision: 1,
    target: {},
    mode: 'graceful',
    fingerprint: 'a'.repeat(64),
    state: 'accepted',
    expiresAt: new Date(Date.now() + 10000),
  });
  await request(
    'POST',
    `${base}/employees/${profile.id}/offboard`,
    403,
    'ApiError',
    { confirmation: 'OFFBOARD' },
    viewer.accessToken,
  );
  await request(
    'POST',
    `${base}/employees/${profile.id}/offboard`,
    201,
    null,
    { confirmation: 'OFFBOARD' },
    token,
  );
  await request('GET', base, 403, 'ApiError', null, employee.accessToken);
  await request(
    'GET',
    `/devices/${personal.device.id}/configuration`,
    401,
    'ApiError',
    null,
    personal.deviceToken,
  );
  await request(
    'GET',
    `/devices/${corporate.device.id}/configuration`,
    401,
    'ApiError',
    null,
    corporate.deviceToken,
  );
  await request(
    'GET',
    `/devices/${unrelated.device.id}/configuration`,
    200,
    null,
    null,
    unrelated.deviceToken,
  );
  assert.equal(
    (
      await source.query('SELECT state FROM developer_commands WHERE id=$1', [
        queued.id,
      ])
    )[0].state,
    'cancelled',
  );
  assert.equal(
    Number(
      (
        await source.query(
          'SELECT count(*) AS n FROM developer_audit WHERE "commandId"=$1 AND event=\'cancelled\'',
          [queued.id],
        )
      )[0].n,
    ),
    1,
  );
  assert.equal(
    (
      await source.query('SELECT state FROM agents WHERE id=$1', [
        commandAgent.id,
      ])
    )[0].state,
    'REVOKED',
  );
  assert.deepEqual(
    (
      await source.query(
        'SELECT controllers FROM agent_developer WHERE "agentId"=$1',
        [commandAgent.id],
      )
    )[0].controllers,
    [],
  );
  assert.equal(
    Number(
      (
        await source.query(
          'SELECT count(*) AS n FROM daily_usage WHERE "deviceId"=$1',
          [device.id],
        )
      )[0].n,
    ),
    2,
    'Offboarding does not erase personal observations',
  );
  await request(
    'POST',
    `/workspaces/${organization.id}/owner`,
    201,
    null,
    { userId: admin.user.id },
    token,
  );
  const custody = (
    await source.query('SELECT * FROM registered_devices WHERE id=$1', [
      corporate.device.id,
    ])
  )[0];
  assert.equal(custody.registeredById, admin.user.id);
  assert.equal(custody.state, 'REVOKED');
  assert.equal(
    (
      await source.query(
        'SELECT "registeredById" FROM registered_devices WHERE id=$1',
        [device.id],
      )
    )[0].registeredById,
    employee.user.id,
    'Personal custody never transfers',
  );
  await source.query(
    'INSERT INTO business_audit ("workspaceId",action,"occurredAt") VALUES ($1,\'synthetic_expired\',now()-interval \'91 days\')',
    [organization.id],
  );
  const maintenance = await maintainBusiness(source, organization.id);
  assert.equal(maintenance.auditRemoved, 1);
  await source.query('DELETE FROM workspaces WHERE id=$1', [outsideFamily.id]);
  await source.query('DELETE FROM workspaces WHERE id=$1', [other.id]);
  await app.get(PrivacyService).deleteAccount(employee.user.id, password);
  assert.equal(
    Number(
      (
        await source.query(
          'SELECT count(*) AS n FROM registered_devices WHERE id=$1',
          [corporate.device.id],
        )
      )[0].n,
    ),
    1,
    'Company asset survives employee erasure',
  );
  assert.equal(
    Number(
      (
        await source.query(
          'SELECT count(*) AS n FROM registered_devices WHERE id=$1',
          [personal.device.id],
        )
      )[0].n,
    ),
    0,
    'Employee-owned data is erased with employee account',
  );
  console.log(
    'Business API checks passed: role separation, two organizations/locations, departments, employee consent and full-day reports, legacy-route privacy, assignments/custody, compliance, exports, offboarding credentials, independent devices and account-erasure ownership. All readings are synthetic.',
  );
}
