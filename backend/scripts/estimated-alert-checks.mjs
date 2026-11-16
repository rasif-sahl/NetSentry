// Actual API/PostgreSQL checks using synthetic Android-shaped OS readings, not real phone telemetry.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export async function checkEstimatedAlerts({ request, source, alice, workspace }) {
  const auth = alice.accessToken;
  const code = await request('POST', '/devices/enrolments', 201, null,
    { workspaceId: workspace.id, installationId: randomUUID(), platform: 'ANDROID' }, auth);
  const paired = await request('POST', '/devices/enrol', 201, null,
    { token: code.token, name: 'Synthetic Android allowance phone', accepted: true, disclosureVersion: 'device-enrolment-v1' }, auth);
  const id = paired.device.id;
  const consent = await request('POST', `/devices/${id}/consent`, 201, 'RegisteredDevice',
    { accepted: true, disclosureVersion: 'monitoring-v3', scopes: ['network_usage'] }, auth);
  const now = new Date(), start = new Date(now.getTime() - 60_000), end = new Date(now.getTime() - 1000);
  await source.query('UPDATE registered_devices SET "enrolledAt"=$2 WHERE id=$1', [id, new Date(start.getTime() - 1000)]);
  await source.query('UPDATE device_events SET "createdAt"=$2 WHERE "deviceId"=$1 AND kind=\'consent_granted\'', [id, new Date(start.getTime() - 1000)]);
  await request('POST', `/devices/${id}/heartbeat`, 201, 'DeviceConfiguration', {
    generation: consent.generation, permissionStatus: 'granted', capabilityReport: {
      schemaVersion: 1, workspaceId: workspace.id, deviceId: id, reportedAt: now.toISOString(), capabilities: [{
        id: 'network.mobile_data', status: 'supported', reason: 'Synthetic OS adapter for contract verification', source: 'os', checkedAt: now.toISOString(), requiredSetup: [], availableActions: ['measure'],
      }],
    },
  }, paired.deviceToken);
  const event = { schemaVersion: 1, workspaceId: workspace.id, deviceId: id, metric: 'mobile_data_bytes', unit: 'bytes', source: { kind: 'android', collectorVersion: '0.8.0-synthetic' }, intervalStart: start.toISOString(), intervalEnd: end.toISOString(), collectedAt: now.toISOString() };
  await request('POST', `/devices/${id}/measurements`, 201, 'MeasurementReceipt', {
    schemaVersion: 1, batchId: randomUUID(), generation: consent.generation, gaps: [], events: [
      { ...event, eventId: randomUUID(), quality: 'estimated', value: 123 },
      { ...event, eventId: randomUUID(), quality: 'measured', value: 90 },
    ],
  }, paired.deviceToken);
  await request('PATCH', '/notifications/preferences', 200, 'NotificationPreference', { inApp: true, push: false }, auth);
  const base = `/workspaces/${workspace.id}/monitoring`;
  const definition = { kind: 'threshold', metric: 'mobile_data_bytes', period: 'month', deviceId: id, threshold: 100, severity: 'warning', channels: ['in_app'], enabled: true };
  const measured = await request('POST', `${base}/rules`, 201, 'AlertRule', definition, auth);
  const estimated = await request('POST', `${base}/rules`, 201, 'AlertRule', { ...definition, quality: 'estimated' }, auth);
  const separate = await request('POST', `${base}/rules`, 201, 'AlertRule', { ...definition, threshold: 200, quality: 'estimated' }, auth);
  await request('POST', `${base}/rules`, 400, 'ApiError', { ...definition, quality: 'combined' }, auth);
  const { evaluateWorkspace } = require('../dist/monitoring/alert.service.js');
  await evaluateWorkspace(source, workspace.id, now);
  await evaluateWorkspace(source, workspace.id, now);
  const list = await request('GET', `${base}/alerts`, 200, 'AlertWithDelivery[]', null, auth);
  assert.equal(list.filter((row) => row.ruleId === measured.id).length, 0, 'Default measured threshold must ignore estimates.');
  assert.equal(list.filter((row) => row.ruleId === separate.id).length, 0, 'Measured and estimated readings must never be summed.');
  const matches = list.filter((row) => row.ruleId === estimated.id);
  assert.equal(matches.length, 1, 'Repeated evaluation must not duplicate an estimated occurrence.');
  assert.equal(matches[0].snapshot.quality, 'estimated');
  assert.equal(matches[0].snapshot.value, '123.000000');
  const { deliverWorkspace } = require('../dist/monitoring/alert.service.js');
  await deliverWorkspace(source, workspace.id, now);
  const notifications = await request('GET', `${base}/notifications`, 200, 'AlertWithDelivery[]', null, auth);
  assert.ok(notifications.some((row) => row.ruleId === estimated.id && row.snapshot.quality === 'estimated'));
  await request('DELETE', `/devices/${id}/data`, 200, null, null, auth);
  assert.equal((await source.query('SELECT count(*)::int AS n FROM alerts WHERE "ruleId"=$1', [estimated.id]))[0].n, 0);
  console.log('Estimated allowance opt-in/default isolation, exact quality, deduplication, in-app delivery and erasure passed.');
}
