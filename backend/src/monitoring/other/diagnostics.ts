import { DataSource } from 'typeorm';
import { Workspace } from '../../workspaces/entity/workspace.entity';
import { RegisteredDevice } from '../../workspaces/entity/registered-device.entity';
import { MonitoringRun } from '../entity/entities';
export async function recordFailure(
  source: DataSource,
  workspaceId: string,
  kind: string,
  device?: RegisteredDevice,
) {
  try {
    await source.transaction(async (manager) => {
      const workspace = await manager.findOne(Workspace, {
        where: { id: workspaceId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!workspace) return;
      if (device) {
        const current = await manager
          .getRepository(RegisteredDevice)
          .createQueryBuilder('d')
          .addSelect('d.credentialHash')
          .where('d.id=:id', { id: device.id })
          .setLock('pessimistic_write')
          .getOne();
        if (
          !current ||
          current.state !== 'ACTIVE' ||
          current.generation !== device.generation ||
          current.credentialHash !== device.credentialHash
        )
          return;
      }
      await manager.save(
        manager.create(MonitoringRun, {
          workspaceId,
          deviceId: device?.id ?? null,
          kind,
          status: 'failed',
          errorCode: 'OPERATION_FAILED',
        }),
      );
    });
  } catch {
    /* A diagnostic storage failure must not replace the original operation error. */
  }
}
