import { Agent, AgentEvent } from '../agents/agent.entities';
import { publicAgent } from '../agents/agent.service';
import { NotificationPreference } from '../monitoring/alert.entities';
import { eraseMonitoring } from '../monitoring/privacy';
import { Measurement, DailyUsage, CollectionGap } from '../monitoring/entities';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, EntityManager, In, Not } from 'typeorm';
import { User, AccountStatus } from '../users/user.entity';
import { PasswordHasher } from '../auth/password-hasher';
import { AuthService } from '../auth/auth.service';
import { Session } from '../auth/session.entity';
import { Workspace } from '../workspaces/workspace.entity';
import { Membership } from '../workspaces/membership.entity';
import { RegisteredDevice } from '../workspaces/registered-device.entity';
import { DeviceEvent } from '../devices/device-event.entity';
import { publicDevice } from '../devices/public-device';
import { PrivacyEvent } from './privacy-event.entity';

@Injectable()
export class PrivacyService {
  constructor(
    private readonly source: DataSource,
    private readonly passwords: PasswordHasher,
    private readonly auth: AuthService,
  ) {}

  private async authenticate(
    manager: EntityManager,
    userId: string,
    password: string,
  ) {
    const user = await manager
      .getRepository(User)
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id=:id AND user.status=:status', {
        id: userId,
        status: AccountStatus.ACTIVE,
      })
      .setLock('pessimistic_write')
      .getOne();
    if (!user || !(await this.passwords.verify(password, user.passwordHash)))
      throw new UnauthorizedException(
        'Confirm your current password to continue.',
      );
    return user;
  }

  async export(userId: string, password: string) {
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      const user = await this.authenticate(manager, userId, password);
      await manager.save(
        manager.create(PrivacyEvent, { userId, kind: 'export_created' }),
      );
      const devices = await manager.findBy(RegisteredDevice, {
        registeredById: userId,
      });
      const history = devices.length
        ? await manager.find(DeviceEvent, {
            where: { deviceId: In(devices.map((device) => device.id)) },
            order: { createdAt: 'ASC' },
          })
        : [];
      const sessions = await manager.find(Session, {
        where: { userId },
        select: {
          id: true,
          userAgent: true,
          ipAddress: true,
          expiresAt: true,
          revokedAt: true,
          createdAt: true,
          lastUsedAt: true,
        },
      });
      const memberships = (await manager.findBy(Membership, { userId })).map(
        (member) => ({ workspaceId: member.workspaceId, role: member.role }),
      );
      const agents = await manager.findBy(Agent, { userId });
      const agentEvents = agents.length
        ? await manager.findBy(AgentEvent, {
            agentId: In(agents.map((agent) => agent.id)),
          })
        : [];
      return {
        agents: agents.map(publicAgent),
        agentEvents,
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        user: this.auth.safeUser(user),
        memberships,
        devices: devices.map(publicDevice),
        notificationPreferences:
          (await manager.findOneBy(NotificationPreference, { userId })) ??
          manager.create(NotificationPreference, { userId }),
        monitoring: {
          measurements: devices.length
            ? await manager.findBy(Measurement, {
                deviceId: In(devices.map((d) => d.id)),
              })
            : [],
          dailyUsage: devices.length
            ? await manager.findBy(DailyUsage, {
                deviceId: In(devices.map((d) => d.id)),
              })
            : [],
          declaredGaps: devices.length
            ? (
                await manager.findBy(CollectionGap, {
                  deviceId: In(devices.map((d) => d.id)),
                })
              ).map(({ payloadHash: _payloadHash, ...gap }) => gap)
            : [],
        },
        deviceHistory: history.map((event) => ({
          id: event.id,
          deviceId: event.deviceId,
          kind: event.kind,
          generation: event.generation,
          details: event.details,
          createdAt: event.createdAt,
          actorUserId: event.actorUserId === userId ? userId : null,
        })),
        sessions,
        privacyHistory: await manager.find(PrivacyEvent, {
          where: { userId },
          order: { createdAt: 'ASC' },
        }),
      };
    });
  }

  history(userId: string) {
    return this.source
      .getRepository(PrivacyEvent)
      .find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  private async referencedWorkspaces(manager: EntityManager, userId: string) {
    const owned = await manager.findBy(Workspace, { ownerId: userId });
    const memberships = await manager.findBy(Membership, { userId });
    const devices = await manager.findBy(RegisteredDevice, {
      registeredById: userId,
    });
    const agents = await manager.findBy(Agent, { userId });
    return [
      ...new Set([
        ...agents.map((agent) => agent.workspaceId),
        ...owned.map((workspace) => workspace.id),
        ...memberships.map((member) => member.workspaceId),
        ...devices.map((device) => device.workspaceId),
      ]),
    ].sort();
  }

  async deleteAccount(userId: string, password: string) {
    // Follow workspace -> account -> child-row ordering used by lifecycle actions.
    const references = await this.referencedWorkspaces(
      this.source.manager,
      userId,
    );
    await this.source.transaction(async (manager) => {
      for (const id of references)
        await manager.findOne(Workspace, {
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
      await this.authenticate(manager, userId, password);
      if (
        (await this.referencedWorkspaces(manager, userId)).some(
          (id) => !references.includes(id),
        )
      )
        throw new ConflictException(
          'Workspace membership changed. Retry account deletion.',
        );
      const owned = await manager.findBy(Workspace, { ownerId: userId });
      for (const workspace of owned) {
        if (
          (await manager.existsBy(Membership, {
            workspaceId: workspace.id,
            userId: Not(userId),
          })) ||
          (await manager.existsBy(Agent, {
            workspaceId: workspace.id,
            userId: Not(userId),
          })) ||
          (await manager.existsBy(RegisteredDevice, {
            workspaceId: workspace.id,
            registeredById: Not(userId),
          }))
        )
          throw new ConflictException(
            'Transfer ownership of shared workspaces containing other people before deleting your account.',
          );
      }
      const subjects = await manager.findBy(RegisteredDevice, {
        registeredById: userId,
      });
      for (const device of subjects) await eraseMonitoring(manager, device.id);
      for (const workspace of owned)
        await manager.delete(Workspace, workspace.id);
      // FKs remove sessions, actions, outbox, enrolments, owned devices/history and
      // privacy records. Other people's device events retain only a null actor ID.
      await manager.delete(User, userId);
    });
    return { deleted: true };
  }
}
