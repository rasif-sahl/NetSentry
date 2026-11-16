import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  AlertOccurrence,
  NotificationDelivery,
} = require('../dist/monitoring/alert.entities.js');
const { deliverWorkspace } = require('../dist/monitoring/alert.service.js');
export async function checkEmailAlerts({ request, source, alice }) {
  const token = alice.accessToken;
  let prefs = await request(
    'GET',
    '/notifications/preferences',
    200,
    'NotificationPreference',
    null,
    token,
  );
  assert.equal(prefs.email, false);
  assert.equal(prefs.emailDeliveryAvailable, false);
  prefs = await request(
    'PATCH',
    '/notifications/preferences',
    200,
    'NotificationPreference',
    { inApp: true, push: false, email: true },
    token,
  );
  assert.equal(prefs.email, true);
  assert.equal(prefs.emailDeliveryAvailable, false);
  prefs = await request(
    'PATCH',
    '/notifications/preferences',
    200,
    'NotificationPreference',
    { inApp: true, push: false },
    token,
  );
  assert.equal(
    prefs.email,
    true,
    'Older clients must preserve the opt-in when omitting email',
  );
  await request(
    'PATCH',
    '/notifications/preferences',
    400,
    'ApiError',
    { inApp: true, push: false, email: 'true' },
    token,
  );
  const workspace = await request(
    'POST',
    '/workspaces',
    201,
    null,
    {
      name: 'Synthetic email alert workspace',
      type: 'FAMILY',
      timezone: 'UTC',
    },
    token,
  );
  const base = `/workspaces/${workspace.id}/monitoring`;
  const rule = await request(
    'POST',
    base + '/rules',
    201,
    null,
    {
      kind: 'threshold',
      metric: 'mobile_data_bytes',
      quality: 'measured',
      period: 'day',
      threshold: 1,
      severity: 'warning',
      channels: ['in_app', 'android_push', 'ios_push', 'email'],
      enabled: true,
    },
    token,
  );
  async function pending(cycle) {
    const occurrence = await source.getRepository(AlertOccurrence).save({
      ruleId: rule.id,
      cycle,
      sourceDeviceIds: [],
      snapshot: {
        kind: 'threshold',
        severity: 'warning',
        value: '1',
        windowKey: 'synthetic-email-test',
      },
    });
    return source.getRepository(NotificationDelivery).save({
      alertId: occurrence.id,
      channel: 'email',
      status: 'pending',
      dueAt: new Date(),
      attempts: 0,
      attemptHistory: [],
    });
  }
  const first = await pending(1);
  await deliverWorkspace(source, workspace.id);
  const disabled = await source
    .getRepository(NotificationDelivery)
    .findOneByOrFail({ id: first.id });
  assert.equal(disabled.status, 'unavailable');
  assert.equal(disabled.attemptHistory[0].code, 'EMAIL_DELIVERY_DISABLED');
  assert.equal(disabled.attempts, 1);
  await deliverWorkspace(source, workspace.id);
  assert.equal(
    (
      await source
        .getRepository(NotificationDelivery)
        .findOneByOrFail({ id: first.id })
    ).attempts,
    1,
    'Disabled deliveries must not replay later',
  );
  await request(
    'PATCH',
    '/notifications/preferences',
    200,
    'NotificationPreference',
    { inApp: true, push: false, email: false },
    token,
  );
  const second = await pending(2);
  await deliverWorkspace(source, workspace.id);
  assert.equal(
    (
      await source
        .getRepository(NotificationDelivery)
        .findOneByOrFail({ id: second.id })
    ).status,
    'suppressed',
  );
  await request('DELETE', base + `/rules/${rule.id}`, 200, null, null, token);
  assert.equal(
    await source.getRepository(NotificationDelivery).countBy({ id: first.id }),
    0,
  );
  console.log(
    'Email alert opt-in/default/legacy-client preservation, strict validation, rule channel, disabled delivery, no replay, opt-out suppression and cascade cleanup passed. No email transport or message was used.',
  );
}
