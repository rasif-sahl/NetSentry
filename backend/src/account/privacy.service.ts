import { eraseBusinessUser } from '../business/other/business.lifecycle';
import {
  eraseFamilyUser,
  exportFamilyUser,
} from '../family/other/family.lifecycle';
import { eraseNetworkAgent } from '../networks/other/network-lifecycle';
import {
  NetworkCollector,
  NetworkEndpoint,
  NetworkRouter,
} from '../networks/entity/network.entities';
import {
  ApplicationCatalog,
  ApplicationWindow,
  ApplicationDay,
} from '../monitoring/entity/application.entities';
import {
  AgentDeveloper,
  DeveloperCommand,
} from '../agents/entity/developer.entities';
import { Agent, AgentEvent } from '../agents/entity/agent.entities';
import { publicAgent } from '../agents/agent.service';
import { NotificationPreference } from '../monitoring/entity/alert.entities';
import { eraseMonitoring } from '../monitoring/other/privacy';
import {
  Measurement,
  DailyUsage,
  CollectionGap,
} from '../monitoring/entity/entities';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, EntityManager, In, Not } from 'typeorm';
import { User, AccountStatus } from '../users/entity/user.entity';
import { PasswordHasher } from '../auth/other/password-hasher';
import { AuthService } from '../auth/auth.service';
import { Session } from '../auth/entity/session.entity';
import { Workspace } from '../workspaces/entity/workspace.entity';
import { Membership } from '../workspaces/entity/membership.entity';
import { RegisteredDevice } from '../workspaces/entity/registered-device.entity';
import { DeviceEvent } from '../devices/entity/device-event.entity';
import { publicDevice } from '../devices/other/public-device';
import { PrivacyEvent } from './entity/privacy-event.entity';

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
        billing: {
          requests: await manager.query(
            'SELECT "workspaceId","requestId",plan,interval,status,"createdAt" FROM billing_requests WHERE "requesterId"=$1 ORDER BY "createdAt" DESC LIMIT 1000',
            [userId],
          ),
          operatorActions: await manager.query(
            'SELECT action,"workspaceId","occurredAt" FROM operator_audit WHERE "actorId"=$1 ORDER BY "occurredAt" DESC LIMIT 1000',
            [userId],
          ),
        },
        business: {
          employees: await manager.query(
            'SELECT id,"workspaceId","departmentId",revision,"offboardedAt" FROM business_employees WHERE "userId"=$1',
            [userId],
          ),
          sharing: await manager.query(
            'SELECT a."deviceId",a."workspaceId",a.generation,a.revision,a."consentedAt",a."reportFrom" FROM business_assignments a JOIN business_employees e ON e.id=a."employeeId" WHERE e."userId"=$1',
            [userId],
          ),
          events: await manager.query(
            'SELECT id,"workspaceId",action,"occurredAt" FROM business_audit WHERE "actorId"=$1 ORDER BY "occurredAt" DESC LIMIT 1000',
            [userId],
          ),
        },
        family: await exportFamilyUser(
          manager,
          userId,
          devices.map((d) => d.id),
        ),
        networkCollectors: agents.length
          ? await manager.findBy(NetworkCollector, {
              agentId: In(agents.map((a) => a.id)),
            })
          : [],
        networkAssignments: await manager.find(NetworkEndpoint, {
          where: { assignedUserId: userId },
          select: {
            id: true,
            networkId: true,
            name: true,
            category: true,
            trust: true,
            assignedUserId: true,
          },
        }),
        networkRouters: agents.length
          ? await manager.find(NetworkRouter, {
              where: { agentId: In(agents.map((a) => a.id)) },
              select: {
                id: true,
                networkId: true,
                agentId: true,
                adapter: true,
                url: true,
                revision: true,
              },
            })
          : [],
        developerCommands: await manager.findBy(DeveloperCommand, {
          requesterId: userId,
        }),
        developerPolicies: agents.length
          ? await manager.findBy(AgentDeveloper, {
              agentId: In(agents.map((a) => a.id)),
            })
          : [],
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
          applicationCatalogs: devices.length
            ? await manager.findBy(ApplicationCatalog, {
                deviceId: In(devices.map((d) => d.id)),
              })
            : [],
          applicationWindows: devices.length
            ? await manager.findBy(ApplicationWindow, {
                deviceId: In(devices.map((d) => d.id)),
              })
            : [],
          applicationDays: devices.length
            ? await manager.findBy(ApplicationDay, {
                deviceId: In(devices.map((d) => d.id)),
              })
            : [],
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
    const familyRefs: { workspaceId: string }[] = await manager.query(
      'SELECT DISTINCT p."workspaceId" FROM family_profiles p LEFT JOIN family_policies pol ON pol."profileId"=p.id LEFT JOIN family_requests r ON r."profileId"=p.id WHERE p."userId"=$1 OR p.guardians ? $2 OR pol."authorId"=$1 OR r."requesterId"=$1 OR r."decidedBy"=$1',
      [userId, userId],
    );
    const businessRefs: { workspaceId: string }[] = await manager.query(
      'SELECT "workspaceId" FROM business_employees WHERE "userId"=$1 UNION SELECT "workspaceId" FROM business_audit WHERE "actorId"=$1',
      [userId],
    );
    const networkRefs: { workspaceId: string }[] = await manager.query(
      'SELECT DISTINCT n."workspaceId" FROM network_endpoints e JOIN usage_networks n ON n.id=e."networkId" WHERE e."assignedUserId"=$1',
      [userId],
    );
    const developerRefs: { workspaceId: string }[] = await manager.query(
      'SELECT DISTINCT a."workspaceId" FROM agents a LEFT JOIN agent_developer d ON d."agentId"=a.id LEFT JOIN developer_commands c ON c."agentId"=a.id WHERE d.controllers ? $1 OR c."requesterId"=$1::uuid',
      [userId],
    );
    return [
      ...new Set([
        ...businessRefs.map((row) => row.workspaceId),
        ...familyRefs.map((row) => row.workspaceId),
        ...networkRefs.map((row) => row.workspaceId),
        ...developerRefs.map((row: { workspaceId: string }) => row.workspaceId),
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
      await manager.query(
        'UPDATE agent_developer SET controllers=controllers-$1, revision=revision+1 WHERE controllers ? $1',
        [userId],
      );
      for (const agent of await manager.findBy(Agent, { userId }))
        await eraseNetworkAgent(manager, agent.id);
      await eraseBusinessUser(manager, userId);
      await eraseFamilyUser(manager, userId);
      await manager.delete(User, userId);
    });
    return { deleted: true };
  }
}
