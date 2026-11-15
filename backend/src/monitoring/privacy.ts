import { AlertOccurrence, AlertRule } from './alert.entities';
import { EntityManager } from 'typeorm';
import {
  CollectionGap,
  DailyUsage,
  DeviceUsageNetwork,
  Measurement,
  MeasurementReceipt,
  MonitoringRun,
  SyncBatch,
} from './entities';
export async function eraseMonitoring(
  manager: EntityManager,
  deviceId: string,
) {
  const alerts = await manager
    .getRepository(AlertOccurrence)
    .createQueryBuilder('a')
    .where('a."sourceDeviceIds" @> :ids::jsonb', {
      ids: JSON.stringify([deviceId]),
    })
    .getMany();
  for (const alert of alerts) {
    await manager.update(AlertRule, { id: alert.ruleId }, { active: false });
    await manager.delete(AlertOccurrence, alert.id);
  }
  await manager.delete(AlertRule, { deviceId });
  for (const entity of [
    CollectionGap,
    DailyUsage,
    Measurement,
    MeasurementReceipt,
    MonitoringRun,
    SyncBatch,
    DeviceUsageNetwork,
  ])
    await manager.delete(entity, { deviceId });
}
