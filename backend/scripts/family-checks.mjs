// Explicit synthetic family accounts and aggregates. No device restrictions are executed.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  maintainFamily,
} = require('../dist/family/other/family-maintenance.js');
const { DeviceService } = require('../dist/devices/device.service.js');
const { AuthService } = require('../dist/auth/auth.service.js');
const {
  CollaborationService,
} = require('../dist/workspaces/collaboration.service.js');
const { PrivacyService } = require('../dist/account/privacy.service.js');
export async function checkFamily({ request, source, alice, app }) {
  const owner = alice.accessToken,
    consent = { accepted: true, disclosureVersion: 'family-sharing-v1' };
  const w = await request(
      'POST',
      '/workspaces',
      201,
      null,
      { name: 'Synthetic family scope', type: 'FAMILY', timezone: 'UTC' },
      owner,
    ),
    base = `/workspaces/${w.id}/family`;
  const actors = {};
  for (const [name, role] of [
    ['guardian', 'GUARDIAN'],
    ['child', 'MEMBER'],
    ['observer', 'VIEWER'],
  ]) {
    // Real services prepare fixture actors without consuming shared HTTP auth quotas.
    const session = await app.get(AuthService).register(
      {
        email: `family-${name}@example.invalid`,
        displayName: `Synthetic ${name}`,
        password: 'synthetic-family-password-1234',
      },
      {},
    );
    await source.query('UPDATE users SET "emailVerifiedAt"=now() WHERE id=$1', [
      session.user.id,
    ]);
    const invite = await request(
      'POST',
      `/workspaces/${w.id}/invitations`,
      201,
      null,
      { email: session.user.email, role },
      owner,
    );
    await app.get(CollaborationService).accept(session.user.id, invite.token);
    actors[name] = session;
  }
  const g = actors.guardian,
    c = actors.child,
    v = actors.observer;
  const definition = {
    expectedRevision: 0,
    name: 'Synthetic child',
    avatar: 'owl',
    ageBand: 'teen',
    userId: c.user.id,
    guardians: [g.user.id],
    networks: [],
    archived: false,
    ...consent,
  };
  await request(
    'POST',
    `${base}/profiles`,
    403,
    'ApiError',
    definition,
    g.accessToken,
  );
  const p = await request(
      'POST',
      `${base}/profiles`,
      201,
      'FamilyProfile',
      definition,
      owner,
    ),
    path = `${base}/profiles/${p.id}`;
  let overview = await request(
    'GET',
    base,
    200,
    'FamilyOverview',
    null,
    c.accessToken,
  );
  assert.equal(overview.profiles.length, 1);
  assert.equal(overview.profiles[0].canManage, false);
  await request('GET', path, 403, 'ApiError', null, v.accessToken);
  await request(
    'GET',
    `/workspaces/${randomUUID()}/family/profiles/${p.id}`,
    403,
    'ApiError',
    null,
    g.accessToken,
  );
  const other = await request(
    'POST',
    `${base}/profiles`,
    201,
    'FamilyProfile',
    { ...definition, userId: null, guardians: [], name: 'Other child' },
    owner,
  );
  await request(
    'GET',
    `${base}/profiles/${other.id}`,
    403,
    'ApiError',
    null,
    g.accessToken,
  );
  const code = await request(
    'POST',
    '/devices/enrolments',
    201,
    null,
    { workspaceId: w.id, installationId: randomUUID(), platform: 'ANDROID' },
    owner,
  );
  const pair = await request(
    'POST',
    '/devices/enrol',
    201,
    null,
    {
      token: code.token,
      name: 'Synthetic family phone',
      accepted: true,
      disclosureVersion: 'device-enrolment-v1',
    },
    owner,
  );
  const device = await request(
    'POST',
    `/devices/${pair.device.id}/consent`,
    201,
    null,
    {
      accepted: true,
      disclosureVersion: 'monitoring-v3',
      scopes: ['app_usage'],
      appUsageDisclosureVersion: 'app-usage-v1',
    },
    owner,
  );
  await request(
    'POST',
    `${path}/devices`,
    403,
    'ApiError',
    { deviceId: device.id, ...consent },
    g.accessToken,
  );
  await request(
    'POST',
    `${path}/devices`,
    201,
    'FamilyAssignment',
    { deviceId: device.id, ...consent },
    owner,
  );
  // A provider must retain withdrawal rights after losing a profile grant.
  const gCode = await app.get(DeviceService).issue(g.user.id, {
    workspaceId: w.id,
    installationId: randomUUID(),
    platform: 'ANDROID',
  });
  const gPair = await app.get(DeviceService).enrol(g.user.id, {
    token: gCode.token,
    name: 'Synthetic guardian phone',
    accepted: true,
    disclosureVersion: 'device-enrolment-v1',
  });
  const otherDefinition = {
    ...definition,
    userId: null,
    name: 'Other child',
    guardians: [g.user.id],
  };
  await request(
    'PATCH',
    `${base}/profiles/${other.id}`,
    200,
    'FamilyProfile',
    { ...otherDefinition, expectedRevision: other.revision },
    owner,
  );
  await request(
    'POST',
    `${base}/profiles/${other.id}/devices`,
    201,
    'FamilyAssignment',
    { deviceId: gPair.device.id, ...consent },
    g.accessToken,
  );
  await request(
    'PATCH',
    `${base}/profiles/${other.id}`,
    200,
    'FamilyProfile',
    { ...otherDefinition, guardians: [], expectedRevision: other.revision + 1 },
    owner,
  );
  await request(
    'GET',
    `${base}/profiles/${other.id}`,
    403,
    'ApiError',
    null,
    g.accessToken,
  );
  await request(
    'DELETE',
    `/devices/${device.id}/family-assignment`,
    403,
    'ApiError',
    null,
    g.accessToken,
  );
  await request(
    'DELETE',
    `/devices/${gPair.device.id}/family-assignment`,
    200,
    'NetworkRemoved',
    null,
    g.accessToken,
  );
  await request(
    'DELETE',
    `/devices/${gPair.device.id}/family-assignment`,
    200,
    'NetworkRemoved',
    null,
    g.accessToken,
  );
  const rules = {
    enabled: true,
    dailyMinutes: 60,
    appLimits: [{ id: 'com.example.game', minutes: 20 }],
    categoryLimits: [
      { id: 'game', minutes: 30 },
      {
        id: '11111111-1111-4111-8111-111111111111',
        minutes: 120,
        purpose: 'education',
      },
    ],
    allowedApps: [],
    restrictedApps: [],
    schedules: [
      { kind: 'bedtime', days: [1, 2, 3, 4, 5], start: '21:00', end: '07:00' },
    ],
    pauseUntil: null,
    networkPause: true,
    domains: ['example.invalid'],
    domainCategories: [],
  };
  await request(
    'POST',
    `${path}/policy`,
    403,
    'ApiError',
    { expectedRevision: 0, rules, ...consent },
    c.accessToken,
  );
  await request(
    'POST',
    `${path}/policy`,
    400,
    'ApiError',
    { expectedRevision: 0, rules: { ...rules, execute: 'shell' }, ...consent },
    g.accessToken,
  );
  const policy = await request(
    'POST',
    `${path}/policy`,
    201,
    'FamilyPolicy',
    { expectedRevision: 0, rules, ...consent },
    g.accessToken,
  );
  await request(
    'POST',
    `${path}/policy`,
    409,
    'ApiError',
    { expectedRevision: 0, rules, ...consent },
    g.accessToken,
  );
  await request(
    'POST',
    `/devices/${device.id}/family/configuration`,
    401,
    'ApiError',
    { generation: device.generation },
    owner,
  );
  const config = await request(
    'POST',
    `/devices/${device.id}/family/configuration`,
    201,
    'FamilyDeviceConfiguration',
    { generation: device.generation },
    pair.deviceToken,
  );
  assert.equal(config.assignment.enforcement, 'unsupported');
  const receipt = {
    generation: device.generation,
    profileRevision: p.revision,
    policyRevision: policy.revision,
    status: 'unsupported',
  };
  await request(
    'POST',
    `/devices/${device.id}/family/receipt`,
    400,
    'ApiError',
    { ...receipt, status: 'applied' },
    pair.deviceToken,
  );
  await request(
    'POST',
    `/devices/${device.id}/family/receipt`,
    201,
    'FamilyAccepted',
    receipt,
    pair.deviceToken,
  );
  let view = await request('GET', path, 200, 'FamilyView', null, g.accessToken);
  assert.equal(view.devices[0].enforcement, 'unsupported');
  assert.equal(view.report.confidence, 'insufficient_data');
  assert.equal(view.desired.state, 'restriction_requested');
  const requestBody = {
    id: randomUUID(),
    minutes: 15,
    reason: 'Synthetic homework exception',
    policyRevision: policy.revision,
  };
  const pending = await request(
    'POST',
    `${path}/requests`,
    201,
    'FamilyRequest',
    requestBody,
    c.accessToken,
  );
  assert.equal(
    (
      await request(
        'POST',
        `${path}/requests`,
        201,
        'FamilyRequest',
        requestBody,
        c.accessToken,
      )
    ).id,
    pending.id,
  );
  await request(
    'POST',
    `${path}/requests`,
    409,
    'ApiError',
    { ...requestBody, minutes: 16 },
    c.accessToken,
  );
  await request(
    'PATCH',
    `${path}/requests/${pending.id}`,
    403,
    'ApiError',
    { decision: 'approved' },
    c.accessToken,
  );
  const approval = await request(
    'PATCH',
    `${path}/requests/${pending.id}`,
    200,
    'FamilyRequest',
    { decision: 'approved' },
    g.accessToken,
  );
  assert.ok(Date.parse(approval.overrideUntil) > Date.now());
  await request(
    'PATCH',
    `${path}/requests/${pending.id}`,
    409,
    'ApiError',
    { decision: 'rejected' },
    g.accessToken,
  );
  view = await request('GET', path, 200, 'FamilyView', null, c.accessToken);
  assert.equal(view.desired.state, 'overridden');
  // Exercise data evidence after a synthetic old consent timestamp, without enabling a collector.
  await source.query(
    'UPDATE family_assignments SET "consentedAt"=$1 WHERE "deviceId"=$2',
    [new Date(Date.now() - 20 * 86400000), device.id],
  );
  const today = new Date().toISOString().slice(0, 10);
  await source.query(
    `INSERT INTO application_days ("deviceId","applicationId","localDate",timezone,"durationMs","lateNightMs","coverageMs","observedLaunches","launchesComplete") VALUES ($1,'',$2,'UTC',3600000,0,7200000,0,false)`,
    [device.id, today],
  );
  await source.query(
    'INSERT INTO application_catalogs ("deviceId",applications,categories,overrides) VALUES ($1,$2::jsonb,$3::jsonb,$4::jsonb)',
    [
      device.id,
      JSON.stringify([
        {
          applicationId: 'com.example.game',
          label: 'Synthetic game',
          platformCategory: 'game',
        },
        {
          applicationId: 'com.example.book',
          label: 'Synthetic book',
          platformCategory: 'unknown',
        },
      ]),
      JSON.stringify([
        { id: '11111111-1111-4111-8111-111111111111', name: 'Education' },
      ]),
      JSON.stringify({
        'com.example.book': '11111111-1111-4111-8111-111111111111',
      }),
    ],
  );
  for (const [id, duration, night] of [
    ['com.example.game', 3600000, 2400000],
    ['com.example.book', 900000, 0],
  ])
    await source.query(
      `INSERT INTO application_days ("deviceId","applicationId","localDate",timezone,"durationMs","lateNightMs","coverageMs","observedLaunches","launchesComplete") VALUES ($1,$2,$3,'UTC',$4,$5,7200000,1,false)`,
      [device.id, id, today, duration, night],
    );
  view = await request('GET', path, 200, 'FamilyView', null, g.accessToken);
  assert.equal(view.report.currentWeekMinutes, 60);
  assert.equal(view.report.educationMinutes, 15);
  assert.equal(view.report.entertainmentMinutes, 60);
  assert.equal(view.report.applicationTrends.length, 2);
  assert.ok(view.report.suggestions.some((s) => s.includes('bedtime')));
  assert.equal(view.report.comparisonPercent, null);
  assert.equal(view.report.confidence, 'partial_observations');
  // Generic shared report routes cannot bypass explicit child scoping or consent dates.
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await request(
    'GET',
    `/workspaces/${w.id}/monitoring/usage?metric=screen_time_seconds&from=${today}&to=${tomorrow}&deviceId=${device.id}`,
    403,
    'ApiError',
    null,
    g.accessToken,
  );
  await request(
    'POST',
    `${path}/feedback`,
    201,
    'FamilySaved',
    { rating: 'not_enough_data', note: 'Synthetic feedback' },
    c.accessToken,
  );
  await request(
    'PATCH',
    path,
    200,
    'FamilyProfile',
    { ...definition, name: 'Updated child', expectedRevision: p.revision },
    owner,
  );
  await request(
    'PATCH',
    path,
    409,
    'ApiError',
    {
      ...definition,
      expectedRevision: p.revision,
      name: 'Stale profile overwrite',
    },
    owner,
  );
  let unavailable = await request(
    'POST',
    `/devices/${device.id}/family/configuration`,
    201,
    'FamilyDeviceConfiguration',
    { generation: device.generation },
    pair.deviceToken,
  );
  assert.equal(
    unavailable.assignment,
    null,
    'Profile revisions require renewed sharing consent',
  );
  view = await request('GET', path, 200, 'FamilyView', null, g.accessToken);
  assert.equal(view.devices.length, 0);
  await request(
    'POST',
    `${path}/devices`,
    201,
    'FamilyAssignment',
    { deviceId: device.id, ...consent },
    owner,
  );
  view = await request('GET', path, 200, 'FamilyView', null, g.accessToken);
  assert.equal(
    view.report.currentWeekMinutes,
    0,
    'Pre-renewal day aggregates are excluded',
  );
  await source.query(
    'UPDATE memberships SET role=\'MEMBER\' WHERE "workspaceId"=$1 AND "userId"=$2',
    [w.id, g.user.id],
  );
  await request('GET', path, 403, 'ApiError', null, g.accessToken);
  unavailable = await request(
    'POST',
    `/devices/${device.id}/family/configuration`,
    201,
    'FamilyDeviceConfiguration',
    { generation: device.generation },
    pair.deviceToken,
  );
  assert.equal(
    unavailable.assignment.rules,
    null,
    'Policy author revocation stops policy synchronization',
  );
  await source.query(
    'UPDATE memberships SET role=\'GUARDIAN\' WHERE "workspaceId"=$1 AND "userId"=$2',
    [w.id, g.user.id],
  );
  const next = await request(
    'POST',
    `${path}/policy`,
    201,
    'FamilyPolicy',
    {
      expectedRevision: 1,
      rules: { ...rules, networkPause: false },
      ...consent,
    },
    owner,
  );
  view = await request('GET', path, 200, 'FamilyView', null, g.accessToken);
  assert.equal(
    view.overrideUntil,
    null,
    'Policy revisions invalidate exceptions',
  );
  await request(
    'POST',
    `/devices/${device.id}/family/receipt`,
    409,
    'ApiError',
    receipt,
    pair.deviceToken,
  );
  const expired = await request(
    'POST',
    `${path}/requests`,
    201,
    'FamilyRequest',
    { ...requestBody, id: randomUUID(), policyRevision: next.revision },
    c.accessToken,
  );
  await source.query('UPDATE family_requests SET "expiresAt"=$1 WHERE id=$2', [
    new Date(0),
    expired.id,
  ]);
  await request(
    'PATCH',
    `${path}/requests/${expired.id}`,
    409,
    'ApiError',
    { decision: 'approved' },
    owner,
  );
  const exported = await app
    .get(PrivacyService)
    .export(alice.user.id, 'final-fixture-password-7890');
  assert.ok(exported.family.assignments.some((a) => a.deviceId === device.id));
  await source.query(
    'UPDATE family_requests SET "requestedAt"=$1 WHERE "profileId"=$2',
    [new Date(0), p.id],
  );
  await maintainFamily(source, w.id);
  assert.equal(
    Number(
      (
        await source.query(
          'SELECT count(*) FROM family_requests WHERE "profileId"=$1',
          [p.id],
        )
      )[0].count,
    ),
    0,
  );
  await request(
    'DELETE',
    `${path}/devices/${device.id}`,
    200,
    'NetworkRemoved',
    null,
    c.accessToken,
  );
  await request('DELETE', path, 200, 'NetworkRemoved', null, owner);
  assert.equal(
    Number(
      (
        await source.query(
          'SELECT count(*) FROM family_policies WHERE "profileId"=$1',
          [p.id],
        )
      )[0].count,
    ),
    0,
  );
  const personalProfile = await request(
    'POST',
    `${base}/profiles`,
    201,
    'FamilyProfile',
    { ...definition, name: 'Synthetic erasure subject' },
    owner,
  );
  await request(
    'POST',
    `${base}/profiles/${personalProfile.id}/devices`,
    201,
    'FamilyAssignment',
    { deviceId: device.id, ...consent },
    owner,
  );
  await app
    .get(PrivacyService)
    .deleteAccount(c.user.id, 'synthetic-family-password-1234');
  assert.equal(
    Number(
      (
        await source.query('SELECT count(*) FROM family_profiles WHERE id=$1', [
          personalProfile.id,
        ])
      )[0].count,
    ),
    0,
  );
  assert.equal(
    Number(
      (
        await source.query(
          'SELECT count(*) FROM family_assignments WHERE "deviceId"=$1',
          [device.id],
        )
      )[0].count,
    ),
    0,
  );
  assert.equal(
    Number(
      (
        await source.query(
          'SELECT count(*) FROM registered_devices WHERE id=$1',
          [device.id],
        )
      )[0].count,
    ),
    1,
    'Child erasure must preserve the consenting guardian-owned device',
  );
  await source.query('DELETE FROM workspaces WHERE id=$1', [w.id]);
  console.log(
    'Passed synthetic family invitations, explicit guardian/child scope, device-owner consent, schedules/overrides, immutable requests, unsupported receipts, current role/revision withdrawal, scoped evidence, privacy projection and retention. No restrictions were executed.',
  );
}
