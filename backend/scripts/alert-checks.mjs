import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export async function checkAlerts({
  request,
  source,
  auth,
  workspace,
  id,
  clock,
}) {
  const {
    evaluateWorkspace,
    deliverWorkspace,
    quietUntil,
  } = require('../dist/monitoring/alert.service.js');
  const prefix = `/workspaces/${workspace.id}/monitoring`;
  const definition = {
    kind: 'threshold',
    deviceId: id,
    metric: 'mobile_data_bytes',
    period: 'month',
    threshold: 1,
    severity: 'warning',
    channels: ['in_app', 'android_push', 'ios_push'],
    enabled: true,
  };
  const rule = await request(
    'POST',
    `${prefix}/rules`,
    201,
    'AlertRule',
    definition,
    auth,
  );
  await request(
    'PATCH',
    '/notifications/preferences',
    200,
    'NotificationPreference',
    { inApp: true, push: true },
    auth,
  );
  assert.equal(await evaluateWorkspace(source, workspace.id, clock), 1);
  assert.equal(await evaluateWorkspace(source, workspace.id, clock), 0);
  await Promise.all([
    evaluateWorkspace(source, workspace.id, clock),
    evaluateWorkspace(source, workspace.id, clock),
  ]);
  assert.equal(await deliverWorkspace(source, workspace.id, clock), 3);
  const notifications = await request(
    'GET',
    `${prefix}/notifications`,
    200,
    null,
    null,
    auth,
  );
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].snapshot.value, '103.000000');
  assert.deepEqual(notifications[0].deliveries.map((d) => d.status).sort(), [
    'delivered',
    'unavailable',
    'unavailable',
  ]);
  await request(
    'POST',
    `${prefix}/alerts/${notifications[0].id}/acknowledge`,
    201,
    'AlertOccurrence',
    {},
    auth,
  );
  assert.equal(
    await evaluateWorkspace(source, workspace.id, clock),
    0,
    'Acknowledgement does not rearm an active condition.',
  );
  const hhmm = (d) => d.toISOString().slice(11, 16);
  const quietHours = {
    start: hhmm(new Date(clock.getTime() - 300000)),
    end: hhmm(new Date(clock.getTime() + 300000)),
    timezone: 'UTC',
  };
  const quietRule = await request(
    'PATCH',
    `${prefix}/rules/${rule.id}`,
    200,
    'AlertRule',
    { ...definition, quietHours },
    auth,
  );
  const until = await quietUntil(source.manager, quietRule, clock);
  assert.ok(until > clock);
  await evaluateWorkspace(source, workspace.id, clock);
  assert.equal(await deliverWorkspace(source, workspace.id, clock), 0);
  assert.equal(
    (await request('GET', `${prefix}/notifications`, 200, null, null, auth))
      .length,
    0,
  );
  const quietAlert = (
    await request('GET', `${prefix}/alerts`, 200, null, null, auth)
  )[0];
  assert.ok(quietAlert.deliveries.every((d) => d.attempts === 0));
  // A transient adapter failure persists a retry and recovers with the same idempotency key.
  const keys = [];
  const flaky = {
    channel: 'in_app',
    deliver: async (input) => {
      keys.push(input.idempotencyKey);
      return {
        status: keys.length === 1 ? 'retry' : 'delivered',
        code: keys.length === 1 ? 'SYNTHETIC_FAILURE' : null,
      };
    },
  };
  await deliverWorkspace(source, workspace.id, until, [flaky]);
  let retry = (
    await source.query(
      'SELECT * FROM notification_deliveries WHERE "alertId"=$1 AND channel=\'in_app\'',
      [quietAlert.id],
    )
  )[0];
  assert.equal(retry.status, 'retry');
  assert.equal(retry.attempts, 1);
  await deliverWorkspace(
    source,
    workspace.id,
    new Date(until.getTime() + 61000),
    [flaky],
  );
  retry = (
    await source.query('SELECT * FROM notification_deliveries WHERE id=$1', [
      retry.id,
    ])
  )[0];
  assert.equal(retry.status, 'delivered');
  assert.equal(retry.attemptHistory.length, 2);
  assert.equal(keys[0], keys[1]);
  // Preference changes are applied at delivery time.
  await request(
    'PATCH',
    `${prefix}/rules/${rule.id}`,
    200,
    'AlertRule',
    definition,
    auth,
  );
  await evaluateWorkspace(source, workspace.id, clock);
  await request(
    'PATCH',
    '/notifications/preferences',
    200,
    'NotificationPreference',
    { inApp: false, push: false },
    auth,
  );
  await deliverWorkspace(source, workspace.id, clock);
  const suppressed = (
    await request('GET', `${prefix}/alerts`, 200, null, null, auth)
  )[0];
  assert.ok(suppressed.deliveries.every((d) => d.status === 'suppressed'));
  await request(
    'PATCH',
    '/notifications/preferences',
    200,
    'NotificationPreference',
    { inApp: true, push: false },
    auth,
  );
  await request('DELETE', `${prefix}/rules/${rule.id}`, 200, null, null, auth);
  // Estimated data cannot activate a measured threshold.
  const estimateRule = await request(
    'POST',
    `${prefix}/rules`,
    201,
    'AlertRule',
    { ...definition, threshold: 104 },
    auth,
  );
  await source.query(
    'UPDATE daily_usage SET quality=\'estimated\' WHERE "deviceId"=$1',
    [id],
  );
  assert.equal(await evaluateWorkspace(source, workspace.id, clock), 0);
  await source.query(
    'UPDATE daily_usage SET quality=\'measured\' WHERE "deviceId"=$1',
    [id],
  );
  await request(
    'DELETE',
    `${prefix}/rules/${estimateRule.id}`,
    200,
    null,
    null,
    auth,
  );
  // Offline and permission rules use reported device health rather than invented router data.
  await source.query(
    'UPDATE registered_devices SET "lastSeenAt"=$2,"permissionStatus"=\'revoked\' WHERE id=$1',
    [id, new Date(clock.getTime() - 120000)],
  );
  for (const kind of ['device_offline', 'permission_revoked']) {
    const health = await request(
      'POST',
      `${prefix}/rules`,
      201,
      'AlertRule',
      {
        kind,
        deviceId: id,
        period: 'day',
        threshold: 60,
        severity: 'critical',
        channels: ['in_app'],
        enabled: true,
      },
      auth,
    );
    await evaluateWorkspace(source, workspace.id, clock);
    await deliverWorkspace(source, workspace.id, clock);
    assert.equal(
      (await request('GET', `${prefix}/notifications`, 200, null, null, auth))
        .length,
      1,
    );
    await request(
      'DELETE',
      `${prefix}/rules/${health.id}`,
      200,
      null,
      null,
      auth,
    );
  }
  await source.query(
    'UPDATE registered_devices SET "permissionStatus"=\'granted\' WHERE id=$1',
    [id],
  );
  // Leave one contributing alert for the device erasure test to remove.
  await request('POST', `${prefix}/rules`, 201, 'AlertRule', definition, auth);
  await evaluateWorkspace(source, workspace.id, clock);
  const diagnostics = await request(
    'GET',
    `${prefix}/diagnostics`,
    200,
    null,
    null,
    auth,
  );
  assert.ok(diagnostics.runs.some((r) => r.kind === 'delivery'));
  assert.equal(diagnostics.pushProviders.android, 'unconfigured');
  // New York overnight quiet hours cross the autumn DST change.
  const dstRule = {
    ...quietRule,
    config: {
      ...quietRule.config,
      quietHours: {
        start: '22:00',
        end: '08:00',
        timezone: 'America/New_York',
      },
    },
  };
  assert.equal(
    (
      await quietUntil(
        source.manager,
        dstRule,
        new Date('2026-11-01T04:30:00.000Z'),
      )
    ).toISOString(),
    '2026-11-01T13:00:00.000Z',
  );
  console.log(
    'Passed synthetic thresholds, concurrent evaluation, acknowledgement, quiet hours/DST, delivery retries, preferences, provider availability and health alerts.',
  );
}
