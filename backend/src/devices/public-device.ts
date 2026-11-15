import type { RegisteredDevice } from '../workspaces/registered-device.entity';
const fields = [
  'id',
  'installationId',
  'workspaceId',
  'registeredById',
  'name',
  'platform',
  'operatingSystemVersion',
  'capabilities',
  'lastSeenAt',
  'createdAt',
  'updatedAt',
  'state',
  'generation',
  'monitoringEnabled',
  'consentScopes',
  'enrolledAt',
  'revokedAt',
  'removedAt',
  'lastSyncedAt',
  'applicationVersion',
  'deviceModel',
  'batteryOptimizationStatus',
  'permissionStatus',
  'monitoringHealth',
  'capabilityReport',
] as const;
export function publicDevice(device: RegisteredDevice) {
  return Object.fromEntries(
    fields.map((field) => [field, device[field] ?? null]),
  );
}
