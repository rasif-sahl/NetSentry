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
