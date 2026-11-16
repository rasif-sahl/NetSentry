import { Workspace } from '../workspaces/workspace.entity';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { workspacePolicy } from '../workspaces/workspace-policy';
import {
  WorkspacePermission,
  roleAllows,
} from '../workspaces/workspace-access.service';
import { hashToken } from '../auth/account-actions.service';
import { fingerprint } from '../monitoring/values';
import {
  Agent,
  AgentEnrolment,
  AgentEvent,
  type Modules,
} from './agent.entities';
import {
  AgentEnrolmentDto,
  AgentHeartbeatDto,
  AgentRedeemDto,
  AgentSettingsDto,
  AgentSyncDto,
} from './agent.dto';
export const agentDisclosure =
  'Pair this software installation with your workspace. The core reports connection times, software version, architecture, module settings and bounded diagnostic codes. Network Monitoring and Developer Tools are independently authorized. Pairing enables no discovery, traffic collection or service-stop action in this phase. Background operation requires a separate local choice. Diagnostic events expire after seven days; old enrolment codes expire after ten minutes. Revoke or erase the agent to invalidate offline data.';
export function publicAgent(agent: Agent) {
  const {
    credentialHash: _secret,
    workspace: _workspace,
    user: _user,
    ...safe
  } = agent;
  return safe;
}
export async function modulePolicy(
  manager: EntityManager,
  userId: string,
  workspaceId: string,
  modules: Modules,
) {
  const context = await workspacePolicy(
    manager,
    userId,
    workspaceId,
    WorkspacePermission.REGISTER_DEVICE,
  );
  if (
    modules.network &&
    !roleAllows(context.member.role, WorkspacePermission.MANAGE_NETWORKS)
  )
    throw new ForbiddenException(
      'Network module authorization is not permitted.',
    );
  if (
    modules.developer &&
    !roleAllows(context.member.role, WorkspacePermission.VIEW_SERVICES)
  )
    throw new ForbiddenException(
      'Developer module authorization is not permitted.',
    );
  return context;
}
@Injectable()
export class AgentService {
  constructor(private readonly source: DataSource) {}
  issue(userId: string, workspaceId: string, input: AgentEnrolmentDto) {
    return this.source.transaction(async (manager) => {
      await modulePolicy(manager, userId, workspaceId, input.modules);
      const existing = await manager.findOneBy(Agent, {
        installationId: input.installationId,
      });
      if (
        existing &&
        (existing.userId !== userId || existing.workspaceId !== workspaceId)
      )
        throw new ConflictException(
          'This installation belongs to another registration.',
        );
      if (!existing && (await manager.countBy(Agent, { workspaceId })) >= 100)
        throw new BadRequestException('Workspace agent limit reached.');
      await manager.update(
        AgentEnrolment,
        { installationId: input.installationId, userId, consumedAt: IsNull() },
        { consumedAt: new Date() },
      );
      const token = randomBytes(32).toString('base64url');
      const code = await manager.save(
        manager.create(AgentEnrolment, {
          installationId: input.installationId,
          platform: input.platform,
          name: input.name,
          modules: input.modules,
          backgroundAllowed: input.backgroundAllowed,
          disclosureVersion: input.disclosureVersion,
          userId,
          workspaceId,
          disclosureHash: hashToken(agentDisclosure),
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 600000),
        }),
      );
      return { token, expiresAt: code.expiresAt };
    });
  }
  async redeem(input: AgentRedeemDto) {
    const candidate = await this.source.manager.findOneBy(AgentEnrolment, {
      tokenHash: hashToken(input.token),
    });
    if (!candidate)
      throw new BadRequestException(
        'Agent enrolment code is invalid or expired.',
      );
    return this.source
      .transaction(async (manager) => {
        await modulePolicy(
          manager,
          candidate.userId,
          candidate.workspaceId,
          candidate.modules,
        );
        const code = await manager.findOne(AgentEnrolment, {
          where: { id: candidate.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (
          !code ||
          code.consumedAt ||
          code.expiresAt <= new Date() ||
          code.installationId !== input.installationId ||
          code.platform !== input.platform
        )
          throw new BadRequestException(
            'Agent enrolment code is invalid or expired.',
          );
        let agent = await manager.findOne(Agent, {
          where: { installationId: code.installationId },
          lock: { mode: 'pessimistic_write' },
        });
        if (
          agent &&
          (agent.userId !== code.userId ||
            agent.workspaceId !== code.workspaceId)
        )
          throw new ConflictException(
            'This installation belongs to another registration.',
          );
        if (
          !agent &&
          (await manager.countBy(Agent, { workspaceId: code.workspaceId })) >=
            100
        )
          throw new BadRequestException('Workspace agent limit reached.');
        const token = randomBytes(32).toString('base64url');
        if (agent) await manager.delete(AgentEvent, { agentId: agent.id });
        agent = await manager.save(
          manager.merge(Agent, agent ?? manager.create(Agent), {
            installationId: code.installationId,
            userId: code.userId,
            workspaceId: code.workspaceId,
            name: code.name,
            platform: code.platform,
            disclosureVersion: code.disclosureVersion,
            disclosureHash: code.disclosureHash,
            consentedAt: code.issuedAt,
            state: 'ACTIVE',
            credentialHash: hashToken(token),
            generation: (agent?.generation ?? 0) + 1,
            modules: code.modules,
            backgroundAllowed: code.backgroundAllowed,
            lastSeenAt: null,
            lastSyncedAt: null,
            version: null,
            architecture: null,
            capabilities: {},
            enrolledAt: new Date(),
          }),
        );
        code.consumedAt = new Date();
        await manager.save(code);
        return {
          agent: publicAgent(agent),
          agentToken: token,
          configuration: this.configuration(agent),
        };
      })
      .catch((error: unknown) => {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === '23505'
        )
          throw new ConflictException(
            'This installation was registered concurrently. Request a new enrolment code.',
          );
        throw error;
      });
  }
  configuration(agent: Agent) {
    return {
      schemaVersion: 1,
      agentId: agent.id,
      workspaceId: agent.workspaceId,
      generation: agent.generation,
      modules: agent.modules,
      backgroundAllowed: agent.backgroundAllowed,
      remoteControlAllowed: false,
      heartbeatSeconds: 30,
      maxBufferedEvents: 1000,
      maxBufferBytes: 1048576,
      maxEventAgeSeconds: 86400,
      maxBatchEvents: 50,
      maxAttempts: 8,
      maxBackoffSeconds: 300,
    };
  }
  list(userId: string, workspaceId: string) {
    return this.source.transaction(async (manager) => {
      await workspacePolicy(
        manager,
        userId,
        workspaceId,
        WorkspacePermission.READ_DEVICES,
        false,
      );
      return (await manager.findBy(Agent, { workspaceId })).map((agent) => ({
        ...publicAgent(agent),
        connection:
          agent.state === 'REVOKED'
            ? 'revoked'
            : agent.lastSeenAt &&
                Date.now() - agent.lastSeenAt.getTime() < 90000
              ? 'recently_seen'
              : 'unavailable',
      }));
    });
  }
  manage(
    userId: string,
    workspaceId: string,
    id: string,
    input?: AgentSettingsDto,
    erase = false,
  ) {
    return this.source.transaction(async (manager) => {
      const subject = await manager.findOneBy(Agent, {
        id,
        workspaceId,
        userId,
      });
      const context =
        erase && subject
          ? (await manager.findOneOrFail(Workspace, {
              where: { id: workspaceId },
              lock: { mode: 'pessimistic_write' },
            }),
            null)
          : await workspacePolicy(
              manager,
              userId,
              workspaceId,
              WorkspacePermission.READ_DEVICES,
            );
      const agent = await manager.findOne(Agent, {
        where: { id, workspaceId },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !agent ||
        (agent.userId !== userId &&
          (!context ||
            !roleAllows(
              context.member.role,
              WorkspacePermission.MANAGE_DEVICES,
            ) ||
            input ||
            erase))
      )
        throw new ForbiddenException('Agent is outside your management scope.');
      if (input) {
        if (agent.state !== 'ACTIVE')
          throw new ConflictException(
            'Re-enrol before changing agent authorization.',
          );
        await modulePolicy(manager, userId, workspaceId, input.modules);
        agent.modules = input.modules;
        agent.backgroundAllowed = input.backgroundAllowed;
        agent.consentedAt = new Date();
        agent.disclosureVersion = input.disclosureVersion;
        agent.disclosureHash = hashToken(agentDisclosure);
      } else {
        agent.state = 'REVOKED';
        agent.credentialHash = null;
        agent.modules = { network: false, developer: false };
        agent.backgroundAllowed = false;
      }
      agent.generation++;
      await manager.update(
        AgentEnrolment,
        { installationId: agent.installationId, consumedAt: IsNull() },
        { consumedAt: new Date() },
      );
      if (erase) {
        await manager.delete(AgentEnrolment, {
          installationId: agent.installationId,
          userId: agent.userId,
        });
        await manager.delete(AgentEvent, { agentId: id });
        agent.name = 'Erased agent';
        agent.capabilities = {};
        agent.version = null;
        agent.architecture = null;
        agent.lastSeenAt = null;
        agent.lastSyncedAt = null;
      }
      await manager.save(agent);
      return publicAgent(agent);
    });
  }
  async authenticate(
    id: string,
    token: string,
    manager = this.source.manager,
    lock = false,
  ) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new UnauthorizedException('Agent credentials required.');
    const candidate = await manager.findOneBy(Agent, { id });
    if (!candidate)
      throw new UnauthorizedException('Agent credentials revoked.');
    await workspacePolicy(
      manager,
      candidate.userId,
      candidate.workspaceId,
      WorkspacePermission.REGISTER_DEVICE,
    );
    const query = manager
      .getRepository(Agent)
      .createQueryBuilder('agent')
      .addSelect('agent.credentialHash')
      .where('agent.id=:id', { id });
    if (lock) query.setLock('pessimistic_write');
    const agent = await query.getOne();
    if (
      !agent ||
      agent.state !== 'ACTIVE' ||
      !agent.credentialHash ||
      !/^[a-f0-9]{64}$/.test(agent.credentialHash) ||
      !timingSafeEqual(
        Buffer.from(agent.credentialHash),
        Buffer.from(hashToken(token)),
      )
    )
      throw new UnauthorizedException('Agent credentials revoked.');
    await modulePolicy(manager, agent.userId, agent.workspaceId, agent.modules);
    return agent;
  }
  device<T>(
    id: string,
    token: string,
    work: (manager: EntityManager, agent: Agent) => Promise<T>,
  ) {
    return this.source.transaction(async (manager) =>
      work(manager, await this.authenticate(id, token, manager, true)),
    );
  }
  heartbeat(id: string, token: string, input: AgentHeartbeatDto) {
    return this.device(id, token, async (manager, agent) => {
      if (agent.generation !== input.generation)
        throw new ConflictException('Read current agent configuration.');
      if (Math.abs(Date.now() - Date.parse(input.reportedAt)) > 300000)
        throw new BadRequestException(
          'Heartbeat clock is outside the permitted window.',
        );
      agent.lastSeenAt = new Date();
      agent.version = input.version;
      agent.architecture = input.architecture;
      agent.capabilities = {
        network: {
          enabled: input.requested.network && agent.modules.network,
          status: 'temporarily_unavailable',
          reason: 'Network discovery and collection are not implemented.',
        },
        developer: {
          enabled: input.requested.developer && agent.modules.developer,
          status: 'temporarily_unavailable',
          reason:
            'Remote service inventory and commands are unavailable. Local tools depend on agent platform support and explicit local permission.',
        },
        backgroundAllowed: input.backgroundAllowed && agent.backgroundAllowed,
        droppedEvents: input.droppedEvents,
      };
      await manager.save(agent);
      return this.configuration(agent);
    });
  }
  sync(id: string, token: string, input: AgentSyncDto) {
    return this.device(id, token, async (manager, agent) => {
      if (agent.generation !== input.generation)
        throw new ConflictException('Read current agent configuration.');
      if (
        new Set(input.events.map((e) => e.eventId)).size !== input.events.length
      )
        throw new BadRequestException('Duplicate event IDs within a batch.');
      let accepted = 0,
        duplicates = 0;
      for (const event of input.events) {
        const occurredAt = new Date(event.occurredAt);
        if (
          occurredAt.getTime() <
            Math.max(agent.enrolledAt.getTime(), Date.now() - 86400000) ||
          occurredAt.getTime() > Date.now() + 300000
        )
          throw new BadRequestException(
            'Diagnostic event is outside the allowed interval.',
          );
        const hash = fingerprint(event),
          existing = await manager
            .getRepository(AgentEvent)
            .createQueryBuilder('event')
            .addSelect('event.payloadHash')
            .where('event.agentId=:id AND event.eventId=:eventId', {
              id,
              eventId: event.eventId,
            })
            .getOne();
        if (existing) {
          if (existing.payloadHash !== hash)
            throw new ConflictException('Diagnostic identifier was reused.');
          duplicates++;
          continue;
        }
        await manager.save(
          manager.create(AgentEvent, {
            eventId: event.eventId,
            kind: event.kind,
            code: event.code,
            agentId: id,
            generation: agent.generation,
            occurredAt,
            payloadHash: hash,
          }),
        );
        accepted++;
      }
      // Historical diagnostics never mark a disconnected installation online.
      agent.lastSyncedAt = new Date();
      await manager.save(agent);
      return { accepted, duplicates };
    });
  }
}
