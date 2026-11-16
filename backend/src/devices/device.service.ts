import {assertCapacity} from '../billing/policy';
import { BusinessAssignment } from '../business/business.entities';
import { businessAudit } from '../business/business.lifecycle';
import { FamilyAssignment } from '../family/family.entities';
import { eraseMonitoring } from '../monitoring/privacy';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { RegisteredDevice } from '../workspaces/registered-device.entity';
import { Workspace } from '../workspaces/workspace.entity';
import {
  WorkspacePermission,
  roleAllows,
} from '../workspaces/workspace-access.service';
import { workspacePolicy } from '../workspaces/workspace-policy';
import { hashToken } from '../auth/account-actions.service';
import { DeviceEnrolment } from './enrolment.entity';
import { DeviceEvent } from './device-event.entity';
import {
  ConsentDto,
  DeviceHealthDto,
  EnrolmentRequestDto,
  RedeemEnrolmentDto,
} from './device.dto';
import { disclosureHash, disclosures } from './disclosures';
import { publicDevice } from './public-device';
import { validateCapabilityReport } from './capability-validation';

@Injectable()
export class DeviceService {
  constructor(private readonly source: DataSource) {}

  async issue(userId: string, input: EnrolmentRequestDto) {
    return this.source.transaction(async (manager) => {
      await workspacePolicy(
        manager,
        userId,
        input.workspaceId,
        WorkspacePermission.REGISTER_DEVICE,
      );
      const existing = await manager.findOneBy(RegisteredDevice, {
        installationId: input.installationId,
      });
      if (
        existing &&
        (existing.registeredById !== userId ||
          existing.workspaceId !== input.workspaceId)
      )
        throw new ConflictException(
          'This installation is already registered elsewhere.',
        );
      await manager.update(
        DeviceEnrolment,
        {
          userId,
          workspaceId: input.workspaceId,
          installationId: input.installationId,
          consumedAt: IsNull(),
        },
        { consumedAt: new Date() },
      );
      const token = randomBytes(32).toString('base64url');
      const enrolment = await manager.save(
        manager.create(DeviceEnrolment, {
          userId,
          workspaceId: input.workspaceId,
          installationId: input.installationId,
          platform: input.platform,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 600000),
        }),
      );
      return { token, expiresAt: enrolment.expiresAt };
    });
  }

  async enrol(userId: string, input: RedeemEnrolmentDto) {
    try {
      return await this.source.transaction(async (manager) => {
        const candidate = await manager.findOneBy(DeviceEnrolment, {
          tokenHash: hashToken(input.token),
        });
        if (!candidate || candidate.userId !== userId)
          throw new BadRequestException(
            'Enrolment code is invalid or has expired.',
          );
        await workspacePolicy(
          manager,
          userId,
          candidate.workspaceId,
          WorkspacePermission.REGISTER_DEVICE,
        );
        const code = await manager.findOne(DeviceEnrolment, {
          where: { id: candidate.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!code || code.consumedAt || code.expiresAt <= new Date())
          throw new BadRequestException(
            'Enrolment code is invalid or has expired.',
          );
        let device = await manager.findOne(RegisteredDevice, {
          where: { installationId: code.installationId },
          lock: { mode: 'pessimistic_write' },
        });
        if (
          device &&
          (device.registeredById !== userId ||
            device.workspaceId !== code.workspaceId)
        )
          throw new ConflictException(
            'This installation is already registered elsewhere.',
          );
        if(!device||device.state!=='ACTIVE') await assertCapacity(manager,code.workspaceId,'devices');
        const token = randomBytes(32).toString('base64url');
        device = manager.merge(
          RegisteredDevice,
          device ?? manager.create(RegisteredDevice),
          {
            workspaceId: code.workspaceId,
            registeredById: userId,
            installationId: code.installationId,
            platform: code.platform,
            name: input.name.trim(),
            state: 'ACTIVE',
            credentialHash: hashToken(token),
            generation: (device?.generation ?? 0) + 1,
            monitoringEnabled: false,
            consentScopes: [],
            enrolledAt: new Date(),
            revokedAt: null,
            removedAt: null,
            lastSeenAt: new Date(),
            lastSyncedAt: null,
            applicationVersion: null,
            deviceModel: null,
            operatingSystemVersion: null,
            batteryOptimizationStatus: 'unknown',
            permissionStatus: 'unknown',
            monitoringHealth: 'unknown',
            capabilityReport: null,
            capabilities: {},
          },
        );
        device = await manager.save(device);
        code.consumedAt = new Date();
        await manager.save(code);
        await this.event(manager, device, userId, 'enrolled', {
          disclosureVersion: disclosures.enrolment.version,
          disclosureHash: disclosureHash('enrolment'),
        });
        return { device: publicDevice(device), deviceToken: token };
      });
    } catch (error) {
      if (
        (error as { driverError?: { code?: string } }).driverError?.code ===
        '23505'
      )
        throw new ConflictException(
          'This installation was enrolled concurrently.',
        );
      throw error;
    }
  }

  async read(userId: string, deviceId: string) {
    return this.withDevice(userId, deviceId, 'read', async (_manager, device) =>
      publicDevice(device),
    );
  }
  async rename(userId: string, deviceId: string, name: string) {
    return this.withDevice(
      userId,
      deviceId,
      'manage',
      async (manager, device) => {
        device.name = name.trim();
        return publicDevice(await manager.save(device));
      },
    );
  }
  async history(userId: string, deviceId: string) {
    return this.withDevice(
      userId,
      deviceId,
      'manage',
      async (manager, device) =>
        manager.find(DeviceEvent, {
          where: { deviceId: device.id },
          order: { createdAt: 'ASC' },
        }),
    );
  }

  async consent(userId: string, deviceId: string, input: ConsentDto) {
    return this.withDevice(
      userId,
      deviceId,
      'owner',
      async (manager, device) => {
        if (device.state !== 'ACTIVE')
          throw new ConflictException(
            'Re-enrol this device before enabling monitoring.',
          );
        device.monitoringEnabled = true;
        device.consentScopes = input.scopes;
        device.generation++;
        await manager.save(device);
        await this.event(manager, device, userId, 'consent_granted', {
          disclosureVersion: disclosures.monitoring.version,
          disclosureHash: disclosureHash('monitoring'),
          scopes: input.scopes,
          ...(input.scopes.includes('app_usage') &&
          input.appUsageDisclosureVersion
            ? { appUsageDisclosureVersion: input.appUsageDisclosureVersion }
            : {}),
        });
        return publicDevice(device);
      },
    );
  }

  async change(
    userId: string,
    deviceId: string,
    action: 'pause' | 'revoke_consent' | 'unenrol' | 'remove' | 'delete_data',
  ) {
    return this.withDevice(
      userId,
      deviceId,
      action === 'delete_data'
        ? 'erase'
        : action === 'revoke_consent'
          ? 'owner'
          : 'manage',
      async (manager, device) => {
        device.monitoringEnabled = false;
        device.generation++;
        if (action !== 'pause') device.consentScopes = [];
        if (
          action === 'unenrol' ||
          action === 'remove' ||
          action === 'delete_data'
        ) {
          device.credentialHash = null;
          device.revokedAt = new Date();
          device.state =
            action === 'remove' || device.state === 'REMOVED'
              ? 'REMOVED'
              : 'REVOKED';
        }
        if (action === 'remove') {
          device.removedAt = new Date();
          device.name = 'Removed device';
        }
        if (['delete_data', 'remove'].includes(action)) {
          await manager.delete(FamilyAssignment, { deviceId: device.id });
          await manager.delete(BusinessAssignment, { deviceId: device.id });
          device.capabilityReport = null;
          device.capabilities = {};
          device.applicationVersion = null;
          device.deviceModel = null;
          device.operatingSystemVersion = null;
          device.lastSeenAt = null;
          device.lastSyncedAt = null;
          device.permissionStatus = 'unknown';
          device.monitoringHealth = 'unknown';
          device.batteryOptimizationStatus = 'unknown';
          await eraseMonitoring(manager, device.id);
          await manager.delete(DeviceEvent, { deviceId: device.id });
        }
        if (action !== 'pause')
          await manager.update(
            DeviceEnrolment,
            {
              userId: device.registeredById,
              workspaceId: device.workspaceId,
              installationId: device.installationId,
              consumedAt: IsNull(),
            },
            { consumedAt: new Date() },
          );
        await manager.save(device);
        const kinds = {
          pause: 'monitoring_paused',
          revoke_consent: 'consent_revoked',
          unenrol: 'unenrolled',
          remove: 'removed',
          delete_data: 'data_deleted',
        };
        await this.event(manager, device, userId, kinds[action], {});
        return action === 'remove'
          ? { removed: true }
          : action === 'delete_data'
            ? { deleted: true, generation: device.generation }
            : publicDevice(device);
      },
    );
  }

  configuration(device: RegisteredDevice) {
    return {
      deviceId: device.id,
      workspaceId: device.workspaceId,
      generation: device.generation,
      monitoringEnabled: device.monitoringEnabled,
      consentScopes: device.consentScopes,
      syncPolicy: {
        maxEvents: 100,
        maxGaps: 100,
        maxAttempts: 8,
        initialBackoffMs: 1000,
        maxBackoffMs: 300000,
      },
    };
  }

  async heartbeat(authenticated: RegisteredDevice, input: DeviceHealthDto) {
    return this.source.transaction(async (manager) => {
      // Recheck credentials/state after taking the same workspace/device locks as revocation.
      await workspacePolicy(
        manager,
        authenticated.registeredById,
        authenticated.workspaceId,
        WorkspacePermission.REGISTER_DEVICE,
      );
      const device = await manager.findOneOrFail(RegisteredDevice, {
        where: { id: authenticated.id },
        lock: { mode: 'pessimistic_write' },
        select: {
          id: true,
          credentialHash: true,
          state: true,
          generation: true,
        },
      });
      if (
        device.state !== 'ACTIVE' ||
        device.credentialHash !== authenticated.credentialHash
      )
        throw new ForbiddenException('Device credentials were revoked.');
      if (input.generation !== device.generation)
        throw new ConflictException(
          'Device configuration changed. Read configuration before retrying.',
        );
      const current = await manager.findOneByOrFail(RegisteredDevice, {
        id: device.id,
      });
      if (input.capabilityReport) {
        validateCapabilityReport(
          input.capabilityReport,
          current.workspaceId,
          current.id,
        );
        if (
          current.capabilityReport &&
          Date.parse(String(current.capabilityReport.reportedAt)) >
            Date.parse(String(input.capabilityReport.reportedAt))
        )
          throw new ConflictException(
            'Capability report is older than the stored report.',
          );
        current.capabilityReport = input.capabilityReport;
      }
      for (const key of [
        'applicationVersion',
        'deviceModel',
        'operatingSystemVersion',
        'batteryOptimizationStatus',
        'permissionStatus',
        'monitoringHealth',
      ] as const)
        if (input[key] !== undefined) current[key] = input[key]!;
      if (
        ['denied', 'revoked'].includes(current.permissionStatus) &&
        current.monitoringEnabled
      ) {
        current.monitoringEnabled = false;
        current.generation++;
      }
      current.lastSeenAt = new Date();
      current.lastSyncedAt = new Date();
      await manager.save(current);
      if (
        input.permissionStatus !== undefined ||
        input.batteryOptimizationStatus !== undefined
      )
        await this.event(manager, current, null, 'permission_reported', {
          permissionStatus: current.permissionStatus,
          batteryOptimizationStatus: current.batteryOptimizationStatus,
        });
      return this.configuration(current);
    });
  }

  private async withDevice<T>(
    userId: string,
    deviceId: string,
    mode: 'read' | 'manage' | 'owner' | 'erase',
    work: (manager: EntityManager, device: RegisteredDevice) => Promise<T>,
  ): Promise<T> {
    return this.source.transaction(async (manager) => {
      const candidate = await manager.findOneBy(RegisteredDevice, {
        id: deviceId,
      });
      if (!candidate) throw new ForbiddenException('Device is not available.');
      if (mode === 'erase' && candidate.registeredById === userId) {
        await manager.findOneOrFail(Workspace, {
          where: { id: candidate.workspaceId },
          lock: { mode: 'pessimistic_write' },
        });
      } else {
        const { member, workspace } = await workspacePolicy(
          manager,
          userId,
          candidate.workspaceId,
          WorkspacePermission.READ_DEVICES,
          mode !== 'read',
        );
        if (
          workspace.type === 'BUSINESS' &&
          ['EMPLOYEE', 'MEMBER'].includes(member.role) &&
          candidate.registeredById !== userId
        )
          throw new ForbiddenException('This device is outside your scope.');
        if (
          (mode === 'owner' || mode === 'erase') &&
          candidate.registeredById !== userId
        )
          throw new ForbiddenException(
            'Only the device owner can change consent or erase personal data.',
          );
        if (
          mode === 'manage' &&
          candidate.registeredById !== userId &&
          !roleAllows(member.role, WorkspacePermission.MANAGE_DEVICES)
        )
          throw new ForbiddenException('Device management is not permitted.');
      }
      const device = await manager.findOneOrFail(RegisteredDevice, {
        where: { id: deviceId },
        lock: { mode: 'pessimistic_write' },
      });
      if (device.removedAt && mode !== 'erase')
        throw new ForbiddenException('Device was removed.');
      return work(manager, device);
    });
  }

  private async event(
    manager: EntityManager,
    device: RegisteredDevice,
    actorUserId: string | null,
    kind: string,
    details: Record<string, unknown>,
  ) {
    const workspace = await manager.findOneBy(Workspace, {
      id: device.workspaceId,
    });
    if (workspace?.type === 'BUSINESS')
      await businessAudit(
        manager,
        device.workspaceId,
        actorUserId,
        kind,
        device.id,
      );
    await manager.save(
      manager.create(DeviceEvent, {
        deviceId: device.id,
        actorUserId,
        kind,
        generation: device.generation,
        details,
      }),
    );
  }
}
