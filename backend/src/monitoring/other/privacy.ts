import {
  ApplicationCatalog,
  ApplicationWindow,
  ApplicationDay,
} from '../entity/application.entities';
import { AlertOccurrence, AlertRule } from '../entity/alert.entities';
import { EntityManager } from 'typeorm';
import {
  CollectionGap,
  DailyUsage,
  DeviceUsageNetwork,
  Measurement,
  MeasurementReceipt,
  MonitoringRun,
  SyncBatch,
} from '../entity/entities';
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
    ApplicationCatalog,
    ApplicationWindow,
    ApplicationDay,
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
