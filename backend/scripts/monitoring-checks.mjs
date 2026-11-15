import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
const execute = promisify(execFile);
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import { randomUUID } from 'node:crypto';
export async function checkMonitoring({
  request,
  source,
  alice,
  bob,
  workspace,
}) {
  const auth = alice.accessToken;
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
  const pair = await request(
    'POST',
    '/devices/enrol',
    201,
    null,
    {
      token: code.token,
      name: 'Synthetic measurement phone',
      disclosureVersion: 'device-enrolment-v1',
      accepted: true,
    },
    auth,
  );
  const id = pair.device.id,
    path = `/devices/${id}/measurements`;
  const consent = await request(
    'POST',
    `/devices/${id}/consent`,
    201,
    'RegisteredDevice',
    {
      disclosureVersion: 'monitoring-v3',
      accepted: true,
      scopes: ['network_usage'],
    },
    auth,
  );
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
        workspaceId: workspace.id,
        deviceId: id,
        reportedAt: now,
        capabilities: [
          {
            id: 'network.mobile_data',
            status: 'supported',
            reason: 'Synthetic test capability',
            source: 'os',
            checkedAt: now,
            requiredSetup: [],
            availableActions: ['measure'],
          },
        ],
      },
    },
    pair.deviceToken,
  );
  // Fixture clock: move the consent epoch back so intervals can cross UTC midnight.
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end.getTime() - 3600000);
  const finish = new Date(end.getTime() + 3600000);
  await source.query(
    'UPDATE registered_devices SET "enrolledAt"=$2 WHERE id=$1',
    [id, new Date(start.getTime() - 1000)],
  );
  await source.query(
    'UPDATE device_events SET "createdAt"=$2 WHERE "deviceId"=$1 AND kind=\'consent_granted\'',
    [id, new Date(start.getTime() - 1000)],
  );
  // At the first UTC hour use yesterday's boundary to keep the full fixture in the past.
  if (finish > new Date()) {
    start.setUTCDate(start.getUTCDate() - 1);
    finish.setUTCDate(finish.getUTCDate() - 1);
    await source.query(
      'UPDATE registered_devices SET "enrolledAt"=$2 WHERE id=$1',
      [id, new Date(start.getTime() - 1000)],
    );
    await source.query(
      'UPDATE device_events SET "createdAt"=$2 WHERE "deviceId"=$1 AND kind=\'consent_granted\'',
      [id, new Date(start.getTime() - 1000)],
    );
  }
  const event = {
    schemaVersion: 1,
    eventId: randomUUID(),
    workspaceId: workspace.id,
    deviceId: id,
    metric: 'mobile_data_bytes',
    value: 101,
    unit: 'bytes',
    source: { kind: 'android', collectorVersion: 'synthetic-1' },
    intervalStart: start.toISOString(),
    intervalEnd: finish.toISOString(),
    collectedAt: now,
    quality: 'measured',
  };
  const batch = {
    schemaVersion: 1,
    batchId: randomUUID(),
    generation: consent.generation,
    events: [event],
    gaps: [],
  };
  const accepted = await request(
    'POST',
    path,
    201,
    'MeasurementReceipt',
    batch,
    pair.deviceToken,
  );
  assert.equal(accepted.accepted, 1);
  const simultaneous = await Promise.all([
    request('POST', path, 201, 'MeasurementReceipt', batch, pair.deviceToken),
    request('POST', path, 201, 'MeasurementReceipt', batch, pair.deviceToken),
  ]);
  assert.ok(simultaneous.every((result) => result.replayed));
  const replay = await request(
    'POST',
    path,
    201,
    'MeasurementReceipt',
    batch,
    pair.deviceToken,
  );
  assert.equal(replay.replayed, true);
  await request(
    'POST',
    path,
    409,
    'ApiError',
    { ...batch, events: [{ ...event, value: 102 }] },
    pair.deviceToken,
  );
  const duplicate = await request(
    'POST',
    path,
    201,
    'MeasurementReceipt',
    { ...batch, batchId: randomUUID() },
    pair.deviceToken,
  );
  assert.equal(duplicate.duplicates, 1);
  await request(
    'POST',
    path,
    409,
    'ApiError',
    {
      ...batch,
      batchId: randomUUID(),
      events: [{ ...event, eventId: randomUUID() }],
    },
    pair.deviceToken,
  );
  await request(
    'POST',
    path,
    403,
    'ApiError',
    {
      ...batch,
      batchId: randomUUID(),
      events: [
        {
          ...event,
          eventId: randomUUID(),
          source: { kind: 'router', collectorVersion: 'synthetic-1' },
        },
      ],
    },
    pair.deviceToken,
  );
  const totals = await source.query(
    'SELECT value,"coverageMs" FROM daily_usage WHERE "deviceId"=$1 ORDER BY "localDate"',
    [id],
  );
  assert.equal(totals.length, 2);
  assert.deepEqual(
    totals.map((x) => x.value),
    ['50.500000', '50.500000'],
  );
  const gap = {
    gapId: randomUUID(),
    metric: event.metric,
    intervalStart: start.toISOString(),
    intervalEnd: finish.toISOString(),
    reason: 'offline',
  };
  await request(
    'POST',
    path,
    201,
    'MeasurementReceipt',
    { ...batch, batchId: randomUUID(), events: [], gaps: [gap] },
    pair.deviceToken,
  );
  // A storage failure must roll back raw data, dedup receipts and aggregates together.
  await source.query(
    `CREATE FUNCTION fixture_reject_aggregate() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic storage failure'; END $$`,
  );
  await source.query(
    'CREATE TRIGGER fixture_reject_aggregate BEFORE INSERT ON daily_usage FOR EACH ROW EXECUTE FUNCTION fixture_reject_aggregate()',
  );
  const next = {
    ...event,
    eventId: randomUUID(),
    intervalStart: finish.toISOString(),
    intervalEnd: new Date(finish.getTime() + 1000).toISOString(),
    value: 2,
  };
  const failing = { ...batch, batchId: randomUUID(), events: [next] };
  await request('POST', path, 500, 'ApiError', failing, pair.deviceToken);
  assert.equal(
    (
      await source.query(
        'SELECT count(*)::int AS n FROM measurement_receipts WHERE "eventId"=$1',
        [next.eventId],
      )
    )[0].n,
    0,
  );
  await source.query('DROP TRIGGER fixture_reject_aggregate ON daily_usage');
  await source.query('DROP FUNCTION fixture_reject_aggregate()');
  await request(
    'POST',
    path,
    201,
    'MeasurementReceipt',
    failing,
    pair.deviceToken,
  );
  const prefix = `/workspaces/${workspace.id}/monitoring`;
  const from = start.toISOString().slice(0, 10),
    to = new Date(finish.getTime() + 86400000).toISOString().slice(0, 10);
  const query = `from=${from}&to=${to}&metric=mobile_data_bytes&deviceId=${id}`;
  for (const period of ['day', 'week', 'month']) {
    const report = await request(
      'GET',
      `${prefix}/usage?${query}&period=${period}`,
      200,
      'UsageReport',
      null,
      auth,
    );
    assert.equal(report.comparison.currentMeasured, '103.000000');
    assert.ok(report.buckets.some((b) => b.missingMs > 0));
    assert.equal(report.declaredGaps.length, 1);
    assert.ok(report.sources.every((row) => row.kind === 'android'));
  }
  const csv = await request(
    'GET',
    `${prefix}/export?${query}`,
    200,
    'UsageExport',
    null,
    auth,
  );
  assert.match(csv.content, /measured/);
  await request(
    'GET',
    `${prefix}/usage?from=2026-02-30&to=2026-03-02&metric=mobile_data_bytes`,
    400,
    'ApiError',
    null,
    auth,
  );
  const empty = await request(
    'GET',
    `${prefix}/usage?from=2025-01-01&to=2025-01-02&metric=mobile_data_bytes&deviceId=${id}`,
    200,
    'UsageReport',
    null,
    auth,
  );
  assert.equal(empty.buckets[0].measured, null);
  const { dailyParts } = require('../dist/monitoring/aggregate.js');
  for (const [first, last, hours] of [
    ['2026-03-08T05:00:00.000Z', '2026-03-09T04:00:00.000Z', 23],
    ['2026-11-01T04:00:00.000Z', '2026-11-02T05:00:00.000Z', 25],
  ]) {
    const parts = await dailyParts(
      source.manager,
      new Date(first),
      new Date(last),
      'America/New_York',
    );
    assert.equal(parts.length, 1);
    assert.equal(parts[0].milliseconds, hours * 3600000);
  }
  const policy = await request(
    'GET',
    `${prefix}/retention`,
    200,
    'RetentionPolicy',
    null,
    auth,
  );
  assert.equal(policy.rawDays, 30);
  await request(
    'PATCH',
    `${prefix}/retention`,
    200,
    'RetentionPolicy',
    { rawDays: 1, aggregateDays: 365, alertDays: 90, diagnosticDays: 7 },
    auth,
  );
  // Retention failure rolls back every deletion, and a later pass can recover.
  await source.query(
    `CREATE FUNCTION fixture_reject_retention() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic retention failure'; END $$`,
  );
  await source.query(
    'CREATE TRIGGER fixture_reject_retention BEFORE DELETE ON measurements FOR EACH ROW EXECUTE FUNCTION fixture_reject_retention()',
  );
  // Backdate one raw row only. Aggregate history must survive independent raw expiry.
  await source.query(
    'UPDATE measurements SET "intervalEnd"=$2 WHERE "eventId"=$1',
    [next.eventId, new Date(Date.now() - 2 * 86400000)],
  );
  const { retainWorkspace } = require('../dist/monitoring/retention.js');
  await assert.rejects(retainWorkspace(source, workspace.id));
  const worker = fileURLToPath(
    new URL('../dist/monitoring/work-cli.js', import.meta.url),
  );
  await assert.rejects(
    execute(process.execPath, [worker, workspace.id], { env: process.env }),
    (error) => error.code === 1 && error.stderr.includes('retention: failed'),
  );
  assert.ok(
    (
      await source.query(
        "SELECT id FROM monitoring_runs WHERE \"workspaceId\"=$1 AND kind='retention' AND status='failed'",
        [workspace.id],
      )
    ).length > 0,
  );
  assert.equal(
    (
      await source.query(
        'SELECT count(*)::int AS n FROM measurements WHERE "eventId"=$1',
        [next.eventId],
      )
    )[0].n,
    1,
  );
  await source.query('DROP TRIGGER fixture_reject_retention ON measurements');
  await source.query('DROP FUNCTION fixture_reject_retention()');
  const worked = await execute(process.execPath, [worker, workspace.id], {
    env: process.env,
  });
  assert.match(worked.stdout, /retention: completed/);
  assert.equal(
    (
      await source.query(
        'SELECT count(*)::int AS n FROM measurements WHERE "eventId"=$1',
        [next.eventId],
      )
    )[0].n,
    0,
  );
  // Increasing raw retention must not permit a new ID to recount an expired raw interval.
  await request(
    'PATCH',
    `${prefix}/retention`,
    200,
    'RetentionPolicy',
    { rawDays: 30, aggregateDays: 365, alertDays: 90, diagnosticDays: 7 },
    auth,
  );
  await request(
    'POST',
    path,
    409,
    'ApiError',
    {
      ...batch,
      batchId: randomUUID(),
      events: [{ ...next, eventId: randomUUID() }],
    },
    pair.deviceToken,
  );
  const retained = await request(
    'GET',
    `${prefix}/usage?${query}`,
    200,
    'UsageReport',
    null,
    auth,
  );
  assert.equal(retained.comparison.currentMeasured, '103.000000');
  const { checkAlerts } = await import('./alert-checks.mjs');
  await checkAlerts({
    request,
    source,
    auth,
    workspace,
    id,
    clock: new Date(finish.getTime() + 1000),
  });
  // Fixture membership verifies own-only reports and immediate queue revocation on role loss.
  await source.query("UPDATE users SET status='ACTIVE' WHERE id=$1", [
    bob.user.id,
  ]);
  await request(
    'GET',
    `${prefix}/usage?${query}`,
    403,
    'ApiError',
    null,
    bob.accessToken,
  );
  await source.query(
    `INSERT INTO memberships ("workspaceId","userId",role) VALUES ($1,$2,'VIEWER')`,
    [workspace.id, bob.user.id],
  );
  await request(
    'GET',
    `${prefix}/usage?${query}`,
    403,
    'ApiError',
    null,
    bob.accessToken,
  );
  await request(
    'POST',
    `${prefix}/rules`,
    403,
    'ApiError',
    {
      kind: 'threshold',
      metric: 'mobile_data_bytes',
      period: 'day',
      threshold: 1,
      severity: 'warning',
      channels: ['in_app'],
      enabled: true,
    },
    bob.accessToken,
  );
  await request(
    'GET',
    `${prefix}/diagnostics`,
    403,
    'ApiError',
    null,
    bob.accessToken,
  );
  await request(
    'PATCH',
    `/workspaces/${workspace.id}/members/${bob.user.id}`,
    200,
    null,
    { role: 'ADMIN' },
    auth,
  );
  const sharedRule = await request(
    'POST',
    `${prefix}/rules`,
    201,
    'AlertRule',
    {
      kind: 'threshold',
      metric: 'mobile_data_bytes',
      period: 'month',
      threshold: 1,
      severity: 'warning',
      channels: ['in_app'],
      enabled: true,
    },
    bob.accessToken,
  );
  const { evaluateWorkspace } = require('../dist/monitoring/alert.service.js');
  await evaluateWorkspace(
    source,
    workspace.id,
    new Date(finish.getTime() + 1000),
  );
  await request(
    'PATCH',
    `/workspaces/${workspace.id}/members/${bob.user.id}`,
    200,
    null,
    { role: 'MEMBER' },
    auth,
  );
  assert.equal(
    (
      await source.query(
        'SELECT count(*)::int AS n FROM alert_rules WHERE id=$1',
        [sharedRule.id],
      )
    )[0].n,
    0,
  );
  await request(
    'DELETE',
    `/workspaces/${workspace.id}/members/${bob.user.id}`,
    200,
    null,
    null,
    auth,
  );
  const personal = await request(
    'POST',
    '/privacy/export',
    201,
    'PrivacyExport',
    { password: 'final-fixture-password-7890' },
    auth,
  );
  assert.ok(personal.monitoring.dailyUsage.some((row) => row.deviceId === id));
  assert.ok(
    personal.monitoring.measurements.every((row) => row.deviceId === id),
  );
  assert.ok(!JSON.stringify(personal).includes('payloadHash'));
  const label = await request(
    'POST',
    `${prefix}/networks`,
    201,
    'UsageNetwork',
    { name: 'Synthetic home label' },
    auth,
  );
  const assigned = await request(
    'POST',
    `${prefix}/network-assignment`,
    201,
    null,
    { deviceId: id, networkId: label.id },
    auth,
  );
  assert.equal(assigned.requiresConsent, true);
  await request('POST', path, 409, 'ApiError', batch, pair.deviceToken);
  const networkRule = await request(
    'POST',
    `${prefix}/rules`,
    201,
    'AlertRule',
    {
      kind: 'threshold',
      networkId: label.id,
      metric: 'mobile_data_bytes',
      period: 'month',
      threshold: 1,
      severity: 'warning',
      channels: ['in_app'],
      enabled: true,
    },
    auth,
  );
  await evaluateWorkspace(
    source,
    workspace.id,
    new Date(finish.getTime() + 1000),
  );
  assert.equal(
    (
      await source.query(
        'SELECT count(*)::int AS n FROM alerts WHERE "ruleId"=$1',
        [networkRule.id],
      )
    )[0].n,
    0,
  );
  await source.query(
    'UPDATE daily_usage SET "networkId"=$2 WHERE "deviceId"=$1',
    [id, label.id],
  );
  await evaluateWorkspace(
    source,
    workspace.id,
    new Date(finish.getTime() + 1000),
  );
  assert.equal(
    (
      await source.query(
        'SELECT count(*)::int AS n FROM alerts WHERE "ruleId"=$1',
        [networkRule.id],
      )
    )[0].n,
    1,
  );
  await request(
    'POST',
    `/devices/${id}/pause`,
    201,
    'RegisteredDevice',
    {},
    auth,
  );
  await request('POST', path, 409, 'ApiError', batch, pair.deviceToken);
  await request('DELETE', `/devices/${id}/data`, 200, null, null, auth);
  for (const table of [
    'measurements',
    'measurement_receipts',
    'measurement_batches',
    'collection_gaps',
    'daily_usage',
    'monitoring_runs',
    'alert_rules',
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
  assert.equal(
    (
      await source.query(
        'SELECT count(*)::int AS n FROM alerts WHERE \"sourceDeviceIds\" @> $1::jsonb',
        [JSON.stringify([id])],
      )
    )[0].n,
    0,
  );
  await request('POST', path, 401, 'ApiError', batch, pair.deviceToken);
  console.log(
    'Passed synthetic measurement replay, conflict, midnight split, gap, rollback/recovery and deletion checks.',
  );
}
