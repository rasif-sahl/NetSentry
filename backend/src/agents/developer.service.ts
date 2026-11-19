import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { AgentService } from './agent.service';
import { Agent } from './agent.entities';
import {
  AgentDeveloper,
  DeveloperCommand,
  DeveloperAudit,
} from './developer.entities';
import {
  DeveloperPolicyDto,
  DeveloperSnapshotDto,
  RemoteCommandDto,
  CommandResultDto,
} from './dto/developer.dto';
import { workspacePolicy } from '../workspaces/workspace-policy';
import {
  WorkspacePermission,
  roleAllows,
} from '../workspaces/workspace-access.service';
import { hashToken } from '../auth/account-actions.service';
import { fingerprint } from '../monitoring/values';
export const developerDisclosure =
  'Share up to 32 owned TCP service summaries (project labels, runtime, PID/start time and ports) with workspace viewers. Explicit named controllers must also hold the workspace service-control role. The computer separately opts into sharing and remote shutdown. No paths, command arguments, shell commands or traffic are uploaded. Commands expire quickly and cancellation is available only before execution starts. Audit/command records expire after seven days. Capability reports never grant control.';
function publicCommand(command: DeveloperCommand) {
  const {
    leaseHash: _lease,
    fingerprint: _hash,
    agent: _agent,
    requester: _user,
    ...safe
  } = command;
  return safe;
}
@Injectable()
export class DeveloperService {
  constructor(
    private source: DataSource,
    private agents: AgentService,
  ) {}
  private async audit(
    m: EntityManager,
    c: DeveloperCommand,
    event: string,
    outcome = '',
  ) {
    await m.save(m.create(DeveloperAudit, { commandId: c.id, event, outcome }));
  }
  private async computer(m: EntityManager, id: string, wid: string) {
    const a = await m.findOneBy(Agent, { id, workspaceId: wid });
    if (!a) throw new ForbiddenException('Computer is outside this workspace.');
    return a;
  }
  private validAgent(a: Agent, p: AgentDeveloper | null) {
    return Boolean(
      p &&
      a.state === 'ACTIVE' &&
      a.modules.developer &&
      p.generation === a.generation &&
      p.sharingAllowed,
    );
  }
  private async controller(
    m: EntityManager,
    a: Agent,
    p: AgentDeveloper | null,
    userId: string,
  ) {
    const ctx = await workspacePolicy(
      m,
      userId,
      a.workspaceId,
      WorkspacePermission.CONTROL_SERVICES,
    );
    if (
      !this.validAgent(a, p) ||
      !p!.controllers.includes(userId) ||
      !roleAllows(ctx.member.role, WorkspacePermission.CONTROL_SERVICES)
    )
      throw new ForbiddenException(
        'This computer has not granted you remote control.',
      );
  }
  private async settle(m: EntityManager, a: Agent, p: AgentDeveloper | null) {
    const commands = await m.findBy(DeveloperCommand, {
      agentId: a.id,
      state: In(['pending', 'accepted']),
    });
    for (const c of commands) {
      let reason = '';
      if (c.expiresAt <= new Date()) reason = 'expired';
      else if (
        !this.validAgent(a, p) ||
        !p?.localControlReady ||
        !p.platformSupported ||
        c.generation !== a.generation ||
        c.revision !== p?.revision
      )
        reason = 'authorization_revoked';
      else {
        try {
          await this.controller(m, a, p, c.requesterId);
        } catch {
          reason = 'authorization_revoked';
        }
      }
      if (reason) {
        c.state = c.startedAt
          ? 'failed'
          : reason === 'expired'
            ? 'expired'
            : 'cancelled';
        c.outcome = c.startedAt ? 'unknown' : reason;
        c.completedAt = new Date();
        await m.save(c);
        await this.audit(m, c, c.state, c.outcome);
      }
    }
  }
  async policy(
    userId: string,
    wid: string,
    id: string,
    input: DeveloperPolicyDto,
  ) {
    return this.source.transaction(async (m) => {
      await workspacePolicy(
        m,
        userId,
        wid,
        WorkspacePermission.CONTROL_SERVICES,
      );
      const a = await this.computer(m, id, wid);
      if (a.userId !== userId || a.state !== 'ACTIVE' || !a.modules.developer)
        throw new ForbiddenException(
          'Only the paired computer owner can grant access.',
        );
      if (!input.sharingAllowed && input.controllers.length)
        throw new BadRequestException(
          'Enable sharing before granting controllers.',
        );
      for (const uid of input.controllers) {
        await workspacePolicy(
          m,
          uid,
          wid,
          WorkspacePermission.CONTROL_SERVICES,
        );
      }
      let p = await m.findOneBy(AgentDeveloper, { agentId: id });
      p = m.merge(AgentDeveloper, p ?? m.create(AgentDeveloper), {
        agentId: id,
        generation: a.generation,
        revision: (p?.revision ?? 0) + 1,
        sharingAllowed: input.sharingAllowed,
        controllers: input.controllers,
        services: [],
        observations: [],
        localControlReady: false,
        platformSupported: false,
        total: 0,
        reportedAt: null,
        disclosureVersion: input.disclosureVersion,
        consentedAt: new Date(),
      });
      await m.save(p);
      await this.settle(m, a, p);
      return {
        agentId: id,
        revision: p.revision,
        sharingAllowed: p.sharingAllowed,
        controllers: p.controllers,
        disclosureVersion: p.disclosureVersion,
        consentedAt: p.consentedAt,
      };
    });
  }
  async list(userId: string, wid: string) {
    return this.source.transaction(async (m) => {
      await workspacePolicy(
        m,
        userId,
        wid,
        WorkspacePermission.VIEW_SERVICES,
        false,
      );
      const agents = await m.findBy(Agent, { workspaceId: wid });
      const out = [];
      for (const a of agents) {
        const p = await m.findOneBy(AgentDeveloper, { agentId: a.id });
        await this.settle(m, a, p);
        const valid = this.validAgent(a, p);
        const fresh = Boolean(
          valid &&
          p?.reportedAt &&
          Date.now() - p.reportedAt.getTime() < 15000 &&
          a.lastSeenAt &&
          Date.now() - a.lastSeenAt.getTime() < 90000,
        );
        let canControl = false;
        try {
          await this.controller(m, a, p, userId);
          canControl = Boolean(
            fresh && p?.localControlReady && p.platformSupported,
          );
        } catch {}
        out.push({
          id: a.id,
          name: a.name,
          platform: a.platform,
          state: a.state,
          ownerId: a.userId,
          connection:
            a.state === 'REVOKED'
              ? 'revoked'
              : fresh
                ? 'online'
                : 'unavailable',
          sharingAllowed: Boolean(valid),
          controllers: a.userId === userId ? (p?.controllers ?? []) : [],
          canManage: a.userId === userId,
          canControl,
          localControlReady: Boolean(p?.localControlReady),
          platformSupported: Boolean(p?.platformSupported),
          reportedAt: p?.reportedAt ?? null,
          total: fresh ? p!.total : 0,
          services: fresh ? p!.services : [],
        });
      }
      return out;
    });
  }
  async create(
    userId: string,
    wid: string,
    id: string,
    input: RemoteCommandDto,
  ) {
    return this.source.transaction(async (m) => {
      await workspacePolicy(
        m,
        userId,
        wid,
        WorkspacePermission.CONTROL_SERVICES,
      );
      const a = await this.computer(m, id, wid);
      const p = await m.findOneBy(AgentDeveloper, { agentId: id });
      await this.settle(m, a, p);
      await this.controller(m, a, p, userId);
      const hash = fingerprint(input);
      const old = await m.findOne(DeveloperCommand, {
        where: { agentId: id, requesterId: userId, requestId: input.requestId },
        select: { id: true, fingerprint: true },
      });
      if (old) {
        if (old.fingerprint !== hash)
          throw new ConflictException(
            'This request ID has a different target.',
          );
        return publicCommand(
          await m.findOneByOrFail(DeveloperCommand, { id: old.id }),
        );
      }
      if (
        !p?.reportedAt ||
        Date.now() - p.reportedAt.getTime() > 10000 ||
        !a.lastSeenAt ||
        Date.now() - a.lastSeenAt.getTime() > 90000 ||
        !p.platformSupported ||
        !p.localControlReady
      )
        throw new ConflictException(
          'Computer unavailable or remote shutdown disabled. Refresh inventory.',
        );
      const target = p.observations.find(
        (s) =>
          s.serviceId === input.serviceId &&
          s.observationId === input.observationId,
      );
      if (
        !target ||
        !target.canStop ||
        Date.now() - Date.parse(target.observedAt) > 10000 ||
        (input.includeChildren && target.childCount > 16)
      )
        throw new ConflictException('Service observation changed or expired.');
      if (
        (await m.countBy(DeveloperCommand, {
          agentId: id,
          state: In(['pending', 'accepted']),
        })) >= 10 ||
        (await m.countBy(DeveloperCommand, { agentId: id })) >= 1000
      )
        throw new ConflictException('Command queue/history limit reached.');
      const c = await m.save(
        m.create(DeveloperCommand, {
          agentId: id,
          requesterId: userId,
          requestId: input.requestId,
          fingerprint: hash,
          generation: a.generation,
          revision: p.revision,
          target,
          mode: input.mode,
          includeChildren: input.includeChildren,
          state: 'pending',
          expiresAt: new Date(
            Math.min(Date.now() + 10000, Date.parse(target.observedAt) + 15000),
          ),
        }),
      );
      await this.audit(m, c, 'requested');
      return publicCommand(c);
    });
  }
  async commands(userId: string, wid: string, id: string) {
    return this.source.transaction(async (m) => {
      await workspacePolicy(
        m,
        userId,
        wid,
        WorkspacePermission.VIEW_SERVICES,
        false,
      );
      const a = await this.computer(m, id, wid);
      await this.settle(
        m,
        a,
        await m.findOneBy(AgentDeveloper, { agentId: id }),
      );
      const commands = await m.find(DeveloperCommand, {
        where: { agentId: id },
        order: { requestedAt: 'DESC' },
        take: 25,
      });
      if (!commands.length) return [];
      const audits: DeveloperAudit[] = await m.query(
        `SELECT audit.*
         FROM unnest($1::uuid[]) AS command(id)
         CROSS JOIN LATERAL (
           SELECT id, "commandId", event, outcome, "occurredAt"
           FROM developer_audit
           WHERE "commandId" = command.id
           ORDER BY "occurredAt", id
           LIMIT 20
         ) AS audit
         ORDER BY audit."occurredAt", audit.id`,
        [commands.map((command) => command.id)],
      );
      const auditsByCommand = new Map<string, DeveloperAudit[]>();
      for (const audit of audits) {
        const history = auditsByCommand.get(audit.commandId);
        if (history) history.push(audit);
        else auditsByCommand.set(audit.commandId, [audit]);
      }
      return commands.map((command) => ({
        ...publicCommand(command),
        audit: auditsByCommand.get(command.id) ?? [],
      }));
    });
  }
  async cancel(userId: string, wid: string, id: string, commandId: string) {
    return this.source.transaction(async (m) => {
      await workspacePolicy(
        m,
        userId,
        wid,
        WorkspacePermission.CONTROL_SERVICES,
      );
      const a = await this.computer(m, id, wid);
      const p = await m.findOneBy(AgentDeveloper, { agentId: id });
      await this.settle(m, a, p);
      await this.controller(m, a, p, userId);
      const c = await m.findOneByOrFail(DeveloperCommand, {
        id: commandId,
        agentId: id,
      });
      if (c.requesterId !== userId && a.userId !== userId)
        throw new ForbiddenException();
      if (c.startedAt)
        throw new ConflictException(
          'Execution has started; cancellation cannot undo it.',
        );
      if (!['pending', 'accepted'].includes(c.state)) return publicCommand(c);
      c.state = 'cancelled';
      c.outcome = 'cancelled';
      c.completedAt = new Date();
      await m.save(c);
      await this.audit(m, c, 'cancelled');
      return publicCommand(c);
    });
  }
  configuration(id: string, token: string) {
    return this.agents.device(id, token, async (m, a) => {
      const p = await m.findOneBy(AgentDeveloper, { agentId: id });
      await this.settle(m, a, p);
      return {
        schemaVersion: 1,
        generation: a.generation,
        revision: p?.revision ?? 0,
        sharingAllowed: this.validAgent(a, p),
        serverTime: new Date().toISOString(),
      };
    });
  }
  snapshot(id: string, token: string, input: DeveloperSnapshotDto) {
    return this.agents.device(id, token, async (m, a) => {
      const p = await m.findOneBy(AgentDeveloper, { agentId: id });
      if (
        !this.validAgent(a, p) ||
        !p ||
        input.generation !== a.generation ||
        input.revision !== p.revision
      )
        throw new ConflictException('Developer configuration changed.');
      if (
        new Set(input.services.map((s) => s.serviceId)).size !==
          input.services.length ||
        new Set(input.services.map((s) => s.observationId)).size !==
          input.services.length
      )
        throw new BadRequestException('Duplicate service identities.');
      for (const s of input.services) {
        if (
          Date.parse(s.startedAt) > Date.parse(s.observedAt) ||
          Math.abs(Date.now() - Date.parse(s.observedAt)) > 5000
        )
          throw new BadRequestException('Stale or invalid service time.');
      }
      const ids = new Set(input.services.map((s) => s.observationId));
      p.observations = [
        ...p.observations.filter(
          (s) =>
            Date.now() - Date.parse(s.observedAt) < 15000 &&
            !ids.has(s.observationId),
        ),
        ...input.services,
      ].slice(-256);
      p.services = input.services;
      p.localControlReady = input.localControlReady;
      p.platformSupported = input.platformSupported;
      p.total = input.total;
      p.reportedAt = new Date();
      await m.save(p);
      return { accepted: input.services.length };
    });
  }
  poll(id: string, token: string) {
    return this.agents.device(id, token, async (m, a) => {
      const p = await m.findOneBy(AgentDeveloper, { agentId: id });
      await this.settle(m, a, p);
      if (!this.validAgent(a, p)) return { command: null };
      const c = await m.findOne(DeveloperCommand, {
        where: { agentId: id, state: 'pending' },
        order: { requestedAt: 'ASC' },
      });
      if (!c) return { command: null };
      const leaseToken = randomBytes(32).toString('base64url');
      c.leaseHash = hashToken(leaseToken);
      c.state = 'accepted';
      c.acceptedAt = new Date();
      await m.save(c);
      await this.audit(m, c, 'accepted');
      return { command: { ...publicCommand(c), leaseToken } };
    });
  }
  pause(id: string, token: string) {
    return this.agents.device(id, token, async (m, a) => {
      const p = await m.findOneBy(AgentDeveloper, { agentId: id });
      if (p) {
        p.localControlReady = false;
        p.services = [];
        p.observations = [];
        p.reportedAt = null;
        await m.save(p);
      }
      await this.settle(m, a, p);
      return { cleared: true };
    });
  }
  private async lease(
    m: EntityManager,
    id: string,
    commandId: string,
    leaseToken: string,
  ) {
    const c = await m
      .getRepository(DeveloperCommand)
      .createQueryBuilder('c')
      .addSelect('c.leaseHash')
      .where('c.id=:commandId AND c.agentId=:id', { commandId, id })
      .getOne();
    if (
      !c?.leaseHash ||
      !timingSafeEqual(
        Buffer.from(hashToken(leaseToken)),
        Buffer.from(c.leaseHash),
      )
    )
      throw new UnauthorizedException('Invalid command lease.');
    return c;
  }
  start(id: string, token: string, commandId: string, leaseToken: string) {
    return this.agents.device(id, token, async (m, a) => {
      const p = await m.findOneBy(AgentDeveloper, { agentId: id });
      await this.settle(m, a, p);
      const c = await this.lease(m, id, commandId, leaseToken);
      await this.controller(m, a, p, c.requesterId);
      if (
        c.state !== 'accepted' ||
        c.startedAt ||
        c.expiresAt <= new Date() ||
        c.generation !== a.generation ||
        c.revision !== p?.revision
      )
        throw new ConflictException(
          'Command is expired, cancelled, started or revoked.',
        );
      c.startedAt = new Date();
      await m.save(c);
      await this.audit(m, c, 'execution_started');
      return {
        allowed: true,
        remainingMs: Math.max(0, c.expiresAt.getTime() - Date.now()),
      };
    });
  }
  result(
    id: string,
    token: string,
    commandId: string,
    input: CommandResultDto,
  ) {
    return this.agents.device(id, token, async (m, a) => {
      const c = await this.lease(m, id, commandId, input.leaseToken);
      if (c.generation !== a.generation)
        throw new ConflictException('Old generation receipt.');
      if (!c.startedAt) {
        if (c.state === 'accepted') {
          c.state = 'failed';
          c.outcome = 'unknown';
          c.completedAt = new Date();
          await m.save(c);
          await this.audit(m, c, 'not_executed', 'unknown');
        }
        return { recorded: true };
      }
      if (
        ['succeeded', 'failed'].includes(c.state) &&
        c.outcome !== 'unknown'
      ) {
        if (c.outcome !== input.outcome)
          throw new ConflictException('Conflicting outcome.');
        return { recorded: true };
      }
      c.outcome = input.outcome;
      c.state = ['stopped', 'already_stopped'].includes(input.outcome)
        ? 'succeeded'
        : 'failed';
      c.completedAt = new Date();
      await m.save(c);
      await this.audit(m, c, c.state, input.outcome);
      return { recorded: true };
    });
  }
}
