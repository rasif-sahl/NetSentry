import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export async function checkApplications({
  request,
  source,
  app: nest,
  alice,
  bob,
  workspace,
}) {
  const auth = alice.accessToken,
    prefix = `/workspaces/${workspace.id}/monitoring`;
  const code = await request(
    'POST',
    '/devices/enrolments',
    201,
    null,
    {
      workspaceId: workspace.id,
      installationId: randomUUID(),
      platform: 'ANDROID',
    },
    auth,
  );
  const paired = await request(
    'POST',
    '/devices/enrol',
    201,
    null,
    {
      token: code.token,
      name: 'Synthetic event-history phone',
      accepted: true,
      disclosureVersion: 'device-enrolment-v1',
    },
    auth,
  );
  const id = paired.device.id;
  let consent = await request(
    'POST',
    `/devices/${id}/consent`,
    201,
    'RegisteredDevice',
    {
      accepted: true,
      disclosureVersion: 'monitoring-v3',
      scopes: ['app_usage'],
    },
    auth,
  );
  const midnight = new Date();
  midnight.setUTCHours(0, 0, 0, 0);
  if (midnight.getTime() + 1800000 >= Date.now() - 2000)
    midnight.setUTCDate(midnight.getUTCDate() - 1);
  const end = new Date(midnight.getTime() + 1800000),
    start = new Date(midnight.getTime() - 1800000);
  async function setEpoch() {
    await source.query(
      'UPDATE registered_devices SET "enrolledAt"=$2 WHERE id=$1',
      [id, new Date(start.getTime() - 1000)],
    );
    await source.query(
      'UPDATE device_events SET "createdAt"=$2 WHERE "deviceId"=$1 AND kind=\'consent_granted\'',
      [id, new Date(start.getTime() - 1000)],
    );
  }
  await setEpoch();
  async function heartbeat() {
    const now = new Date().toISOString();
    await request(
      'POST',
      `/devices/${id}/heartbeat`,
      201,
      'DeviceConfiguration',
      {
        generation: consent.generation,
        permissionStatus: 'granted',
        capabilityReport: {
          schemaVersion: 1,
          deviceId: id,
          workspaceId: workspace.id,
          reportedAt: now,
          capabilities: [
            'usage.screen_time',
            'usage.application_foreground',
          ].map((capability) => ({
            id: capability,
            status: 'supported',
            reason: 'Synthetic OS adapter',
            source: 'os',
            checkedAt: now,
            requiredSetup: [],
            availableActions: ['measure'],
          })),
        },
      },
      paired.deviceToken,
    );
  }
  await heartbeat();
  const app = 'com.example.reader',
    second = 'com.example.notes';
  const batch = {
    schemaVersion: 1,
    batchId: randomUUID(),
    generation: consent.generation,
    workspaceId: workspace.id,
    deviceId: id,
    intervalStart: start.toISOString(),
    intervalEnd: end.toISOString(),
    collectedAt: new Date().toISOString(),
    screenKnown: true,
    appKnown: true,
    issues: [],
    sessions: [
      {
        applicationId: app,
        start: start.toISOString(),
        end: midnight.toISOString(),
      },
      {
        applicationId: second,
        start: start.toISOString(),
        end: end.toISOString(),
      },
    ],
    screen: [{ start: start.toISOString(), end: end.toISOString() }],
    launches: [
      { applicationId: app, at: start.toISOString() },
      { applicationId: second, at: start.toISOString() },
    ],
    applications: [
      {
        applicationId: app,
        label: '=Synthetic Reader',
        platformCategory: 'unknown',
      },
      { applicationId: second, label: null, platformCategory: 'productivity' },
    ],
  };
  const route = `/devices/${id}/application-usage`;
  // Duration-only app consent cannot authorize detailed timelines or metadata.
  await request('POST', route, 403, 'ApiError', batch, paired.deviceToken);
  assert.equal(
    (
      await source.query(
        'SELECT count(*)::int AS n FROM measurements WHERE "deviceId"=$1',
        [id],
      )
    )[0].n,
    0,
    'Denied detailed consent must roll back generic measurements too.',
  );
  consent = await request(
    'POST',
    `/devices/${id}/consent`,
    201,
    'RegisteredDevice',
    {
      accepted: true,
      disclosureVersion: 'monitoring-v3',
      appUsageDisclosureVersion: 'app-usage-v1',
      scopes: ['app_usage'],
    },
    auth,
  );
  batch.generation = consent.generation;
  await setEpoch();
  await heartbeat();
  const replies = await Promise.all([
    request(
      'POST',
      route,
      201,
      'MeasurementReceipt',
      batch,
      paired.deviceToken,
    ),
    request(
      'POST',
      route,
      201,
      'MeasurementReceipt',
      batch,
      paired.deviceToken,
    ),
  ]);
  assert.equal(replies.filter((r) => r.replayed).length, 1);
  await request(
    'POST',
    route,
    409,
    'ApiError',
    {
      ...batch,
      applications: [
        { ...batch.applications[0], label: 'Changed' },
        batch.applications[1],
      ],
    },
    paired.deviceToken,
  );
  await request(
    'POST',
    route,
    400,
    'ApiError',
    {
      ...batch,
      batchId: randomUUID(),
      sessions: [...batch.sessions, batch.sessions[0]],
    },
    paired.deviceToken,
  );
  await request(
    'POST',
    route,
    400,
    'ApiError',
    {
      ...batch,
      batchId: randomUUID(),
      launches: [batch.launches[0], batch.launches[0]],
    },
    paired.deviceToken,
  );
  await request(
    'POST',
    route,
    403,
    'ApiError',
    { ...batch, deviceId: randomUUID() },
    paired.deviceToken,
  );
  // Whole-window overlap is denied even when application partitions differ.
  await request(
    'POST',
    route,
    409,
    'ApiError',
    {
      ...batch,
      batchId: randomUUID(),
      sessions: [],
      screen: [],
      screenKnown: false,
      launches: [],
      applications: [],
    },
    paired.deviceToken,
  );
  const from = new Date(start.getTime() - 86400000).toISOString().slice(0, 10),
    to = new Date(end.getTime() + 86400000).toISOString().slice(0, 10);
  const query = `deviceId=${id}&from=${from}&to=${to}&period=day`;
  let report = await request(
    'GET',
    `${prefix}/application-usage?${query}`,
    200,
    'ApplicationReport',
    null,
    auth,
  );
  assert.equal(
    report.applications.reduce((sum, a) => sum + a.seconds, 0),
    5400,
  );
  assert.equal(
    report.trends.reduce((sum, b) => sum + (b.screenSeconds ?? 0), 0),
    3600,
    'Screen union must not double-count concurrent app foreground.',
  );
  assert.equal(
    report.applications.find((a) => a.applicationId === app).source,
    'unknown',
  );
  assert.equal(
    report.applications.find((a) => a.applicationId === app).launchCount,
    1,
  );
  assert.equal(
    report.applications.find((a) => a.applicationId === app).firstUse,
    start.toISOString(),
  );
  assert.equal(
    report.applications.find((a) => a.applicationId === app).lastUse,
    midnight.toISOString(),
  );
  assert.equal(
    report.applications.find((a) => a.applicationId === second).confidence,
    0.6,
  );
  const aligned = await source.query(
    `SELECT a."durationMs"::float8/1000 AS seconds,COALESCE(d.value,0)::float8 AS value FROM application_days a LEFT JOIN daily_usage d ON d."deviceId"=a."deviceId" AND d."applicationId"=a."applicationId" AND d."localDate"=a."localDate" AND d.metric='application_foreground_seconds' AND d.quality='estimated' WHERE a."deviceId"=$1 AND a."applicationId"<>''`,
    [id],
  );
  assert.ok(
    aligned.every((row) => row.seconds === row.value),
    'Usage limits and detailed reports must agree at calendar boundaries.',
  );
  assert.ok(report.insights[0].evidence.includes('estimated'));
  assert.equal(report.comparison.percentChange, null);
  const catalog = await request(
    'POST',
    `${prefix}/application-categories`,
    201,
    'ApplicationCatalog',
    { deviceId: id, name: 'Reading' },
    auth,
  );
  const category = catalog.categories[0];
  await request(
    'PATCH',
    `${prefix}/application-classification`,
    200,
    'ApplicationCatalog',
    { deviceId: id, applicationId: app, categoryId: category.id },
    auth,
  );
  report = await request(
    'GET',
    `${prefix}/application-usage?${query}&categoryId=${category.id}`,
    200,
    'ApplicationReport',
    null,
    auth,
  );
  assert.equal(report.applications.length, 1);
  assert.equal(report.applications[0].source, 'manual');
  assert.equal(report.applications[0].confidence, 1);
  const exported = await request(
    'GET',
    `${prefix}/application-export?${query}`,
    200,
    null,
    null,
    auth,
  );
  assert.ok(
    exported.content.includes("'=Synthetic Reader"),
    'CSV labels must guard formula prefixes.',
  );
  await source.query(
    'INSERT INTO memberships ("workspaceId","userId",role) VALUES ($1,$2,\'VIEWER\') ON CONFLICT ("workspaceId","userId") DO UPDATE SET role=\'VIEWER\'',
    [workspace.id, bob.user.id],
  );
  await request(
    'GET',
    `${prefix}/application-usage?${query}`,
    403,
    'ApiError',
    null,
    bob.accessToken,
  );
  await request(
    'PATCH',
    `${prefix}/application-classification`,
    403,
    'ApiError',
    { deviceId: id, applicationId: app, categoryId: 'game' },
    bob.accessToken,
  );
  await request(
    'GET',
    `/workspaces/${randomUUID()}/monitoring/application-usage?${query}`,
    403,
    'ApiError',
    null,
    auth,
  );
  await source.query(
    'DELETE FROM memberships WHERE "workspaceId"=$1 AND "userId"=$2',
    [workspace.id, bob.user.id],
  );
  await request(
    'DELETE',
    `${prefix}/application-categories/${category.id}?deviceId=${id}`,
    200,
    'ApplicationCatalog',
    null,
    auth,
  );
  report = await request(
    'GET',
    `${prefix}/application-usage?${query}&applicationId=${app}`,
    200,
    'ApplicationReport',
    null,
    auth,
  );
  assert.equal(report.applications[0].categoryId, 'unknown');
  // A separately bounded source window with unknown context keeps entry count null.
  const more = {
    ...batch,
    batchId: randomUUID(),
    intervalStart: end.toISOString(),
    intervalEnd: new Date(end.getTime() + 500).toISOString(),
    appKnown: false,
    screenKnown: false,
    issues: ['initial_state_unknown'],
    sessions: [
      {
        applicationId: app,
        start: end.toISOString(),
        end: new Date(end.getTime() + 500).toISOString(),
      },
    ],
    screen: [],
    launches: [{ applicationId: app, at: end.toISOString() }],
    applications: [batch.applications[0]],
  };
  await request(
    'POST',
    route,
    201,
    'MeasurementReceipt',
    more,
    paired.deviceToken,
  );
  const unknown = await request(
    'GET',
    `${prefix}/application-usage?${query}&applicationId=${app}`,
    200,
    'ApplicationReport',
    null,
    auth,
  );
  assert.equal(unknown.applications[0].launchCount, null);
  const { dailyParts } = require('../dist/monitoring/other/aggregate.js');
  const parts = await dailyParts(
    source.manager,
    new Date('2026-11-01T04:00:00.000Z'),
    new Date('2026-11-02T05:00:00.000Z'),
    'America/New_York',
  );
  assert.equal(parts[0].milliseconds, 25 * 3600000);
  // Retention uses a simulated maintenance date; the actual API clock/consent checks stay unchanged.
  const { retainWorkspace } = require('../dist/monitoring/other/retention.js');
  await retainWorkspace(
    source,
    workspace.id,
    new Date(Date.now() + 31 * 86400000),
  );
  const afterRetention = await request(
    'GET',
    `${prefix}/application-usage?${query}`,
    200,
    'ApplicationReport',
    null,
    auth,
  );
  assert.equal(afterRetention.timeline.length, 0);
  assert.ok(afterRetention.applications.length > 0);
  const oldReplay = await request(
    'POST',
    route,
    201,
    'MeasurementReceipt',
    batch,
    paired.deviceToken,
  );
  assert.ok(oldReplay.replayed);
  assert.equal(
    (
      await source.query(
        'SELECT count(*)::int AS n FROM application_windows WHERE "deviceId"=$1 AND "batchId"=$2',
        [id, batch.batchId],
      )
    )[0].n,
    0,
  );
  // Direct persistence fixture isolates calendar/DST arithmetic without bypassing production ingestion checks.
  const dstStart = '2026-11-01T02:30:00.000Z',
    dstEnd = '2026-11-01T08:30:00.000Z';
  const dst = {
    ...batch,
    batchId: randomUUID(),
    intervalStart: dstStart,
    intervalEnd: dstEnd,
    sessions: [{ applicationId: app, start: dstStart, end: dstEnd }],
    screen: [{ start: dstStart, end: dstEnd }],
    launches: [{ applicationId: app, at: dstStart }],
    applications: [batch.applications[0]],
  };
  const [originalTimezone] = await source.query(
    'SELECT timezone FROM workspaces WHERE id=$1',
    [workspace.id],
  );
  await source.query('UPDATE workspaces SET timezone=$2 WHERE id=$1', [
    workspace.id,
    'America/New_York',
  ]);
  const {
    ApplicationService,
  } = require('../dist/monitoring/application.service.js');
  await source.transaction((manager) =>
    nest.get(ApplicationService).persist(manager, id, 'America/New_York', dst),
  );
  const overnight = await request(
    'GET',
    `${prefix}/application-usage?deviceId=${id}&from=2026-11-01&to=2026-11-02&period=day`,
    200,
    'ApplicationReport',
    null,
    auth,
  );
  assert.equal(overnight.applications[0].lateNightSeconds, 16200);
  assert.equal(overnight.trends[0].expectedMs, 25 * 3600000);
  assert.equal(
    overnight.timeline[0].sessions[0].start,
    '2026-11-01T04:00:00.000Z',
  );
  assert.equal(overnight.applications[0].firstUse, '2026-11-01T04:00:00.000Z');
  assert.equal(overnight.trends[0].coverageMs, 16200000);
  await source.query('UPDATE workspaces SET timezone=$2 WHERE id=$1', [
    workspace.id,
    originalTimezone.timezone,
  ]);
  const missingRule = await request(
    'POST',
    `${prefix}/rules`,
    201,
    'AlertRule',
    {
      kind: 'not_reporting',
      deviceId: id,
      period: 'day',
      threshold: 60,
      severity: 'warning',
      channels: ['in_app'],
      enabled: true,
    },
    auth,
  );
  await source.query(
    'UPDATE measurement_batches SET "receivedAt"=$2 WHERE "deviceId"=$1',
    [id, new Date(Date.now() - 7200000)],
  );
  const { evaluateWorkspace } = require('../dist/monitoring/alert.service.js');
  await evaluateWorkspace(source, workspace.id, new Date(Date.now() + 61000));
  const missing = await request(
    'GET',
    `${prefix}/alerts`,
    200,
    'AlertWithDelivery[]',
    null,
    auth,
  );
  assert.ok(
    missing.some((a) => a.ruleId === missingRule.id && a.resolvedAt === null),
    'Fresh heartbeats must not mask missing usage uploads.',
  );
  await request(
    'POST',
    `/devices/${id}/pause`,
    201,
    'RegisteredDevice',
    null,
    auth,
  );
  await evaluateWorkspace(source, workspace.id, new Date(Date.now() + 7200000));
  const paused = await request(
    'GET',
    `${prefix}/alerts`,
    200,
    'AlertWithDelivery[]',
    null,
    auth,
  );
  assert.ok(
    paused.some((a) => a.ruleId === missingRule.id && a.resolvedAt !== null),
    'An intentionally paused collector must not remain a missing-report condition.',
  );
  const { PrivacyService } = require('../dist/account/privacy.service.js');
  const privacy = await nest
    .get(PrivacyService)
    .export(alice.user.id, 'final-fixture-password-7890');
  assert.ok(
    privacy.monitoring.applicationCatalogs.some((c) => c.deviceId === id),
  );
  assert.ok(
    privacy.monitoring.applicationWindows.every((w) =>
      privacy.devices.some((d) => d.id === w.deviceId),
    ),
  );
  await request('DELETE', `/devices/${id}/data`, 200, null, null, auth);
  for (const table of [
    'application_catalogs',
    'application_days',
    'application_windows',
  ])
    assert.equal(
      (
        await source.query(
          `SELECT count(*)::int AS n FROM ${table} WHERE "deviceId"=$1`,
          [id],
        )
      )[0].n,
      0,
    );
  console.log(
    'Detailed Android consent, atomic replay/overlap, concurrent foreground/screen union, classification, categories, report/export isolation, privacy and erasure passed.',
  );
}
