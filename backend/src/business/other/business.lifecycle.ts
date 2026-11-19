import { EntityManager, IsNull } from 'typeorm';
import {
  BusinessAssignment,
  BusinessAsset,
  BusinessAudit,
  BusinessEmployee,
  BusinessAlertAssignment,
} from '../entity/business.entities';
import { RegisteredDevice } from '../../workspaces/entity/registered-device.entity';
import { DeviceEnrolment } from '../../devices/entity/enrolment.entity';
import { DeviceEvent } from '../../devices/entity/device-event.entity';
export async function businessAudit(
  m: EntityManager,
  workspaceId: string,
  actorId: string | null,
  action: string,
  targetId: string | null = null,
) {
  await m.save(
    m.create(BusinessAudit, { workspaceId, actorId, action, targetId }),
  );
}
export async function revokeBusinessDevice(
  m: EntityManager,
  device: RegisteredDevice,
  actorId: string | null,
) {
  device.generation++;
  device.credentialHash = null;
  device.monitoringEnabled = false;
  device.consentScopes = [];
  device.state = 'REVOKED';
  device.revokedAt = new Date();
  await m.save(device);
  await m.update(
    DeviceEnrolment,
    {
      workspaceId: device.workspaceId,
      installationId: device.installationId,
      consumedAt: IsNull(),
    },
    { consumedAt: new Date() },
  );
  await m.delete(BusinessAssignment, { deviceId: device.id });
  await m.save(
    m.create(DeviceEvent, {
      deviceId: device.id,
      actorUserId: actorId,
      kind: 'business_unenrolled',
      generation: device.generation,
      details: {},
    }),
  );
  await businessAudit(
    m,
    device.workspaceId,
    actorId,
    'device_unenrolled',
    device.id,
  );
}
/** Runs under the same workspace lock as membership changes. Never erases raw
 * personal measurements. Company assets survive employee account deletion. */
export async function offboardBusinessMember(
  m: EntityManager,
  workspaceId: string,
  userId: string,
  actorId: string | null,
) {
  const employee = await m.findOneBy(BusinessEmployee, { workspaceId, userId });
  if (employee) {
    const assignments = await m.findBy(BusinessAssignment, {
      workspaceId,
      employeeId: employee.id,
    });
    for (const assignment of assignments) {
      const device = await m.findOneBy(RegisteredDevice, {
        id: assignment.deviceId,
        workspaceId,
      });
      if (device) await revokeBusinessDevice(m, device, actorId);
    }
    employee.offboardedAt = new Date();
    employee.departmentId = null;
    employee.revision++;
    await m.save(employee);
    await businessAudit(
      m,
      workspaceId,
      actorId,
      'employee_offboarded',
      employee.id,
    );
  }
  await m.update(
    BusinessAlertAssignment,
    { workspaceId, assigneeId: userId },
    { assigneeId: null, resolvedAt: null },
  );
  await m.query(
    `UPDATE agent_developer SET controllers=controllers-$1, revision=revision+1 WHERE controllers ? $1 AND "agentId" IN (SELECT id FROM agents WHERE "workspaceId"=$2)`,
    [userId, workspaceId],
  );
  await m.query(
    `WITH cancelled AS (UPDATE developer_commands SET state='cancelled', outcome='membership_changed', "completedAt"=now() WHERE "agentId" IN (SELECT id FROM agents WHERE "workspaceId"=$1) AND "requesterId"=$2 AND state IN ('pending','accepted') RETURNING id) INSERT INTO developer_audit ("commandId",event,outcome) SELECT id,'cancelled','membership_changed' FROM cancelled`,
    [workspaceId, userId],
  );
}
export async function transferBusinessAssets(
  m: EntityManager,
  workspaceId: string,
  previousOwner: string,
  ownerId: string,
) {
  const assets = await m.findBy(BusinessAsset, { workspaceId });
  for (const asset of assets) {
    const device = await m.findOneBy(RegisteredDevice, {
      id: asset.deviceId,
      workspaceId,
      registeredById: previousOwner,
    });
    if (device) {
      await revokeBusinessDevice(m, device, previousOwner);
      device.registeredById = ownerId;
      await m.save(device);
    }
  }
}
export async function eraseBusinessUser(m: EntityManager, userId: string) {
  for (const employee of await m.findBy(BusinessEmployee, { userId }))
    await offboardBusinessMember(m, employee.workspaceId, userId, userId);
  await m.delete(BusinessAudit, { actorId: userId });
}
