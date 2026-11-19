import {
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import {
  OperatorGrant,
  OperatorAudit,
  CompatibilityRecord,
} from './entity/operations.entities';
import {
  FeatureSetting,
  Subscription,
} from '../billing/entity/billing.entities';
import { User, AccountStatus } from '../users/entity/user.entity';
import { Session } from '../auth/entity/session.entity';
import { Workspace } from '../workspaces/entity/workspace.entity';
import { PasswordHasher } from '../auth/other/password-hasher';
import { CompatibilityDto, FlagDto } from './dto/operations.dto';
@Injectable()
export class OperationsService {
  constructor(
    private readonly source: DataSource,
    private readonly passwords: PasswordHasher,
  ) {}
  private async grant(m: EntityManager, uid: string, role?: string) {
    const g = await m.findOneBy(OperatorGrant, { userId: uid }),
      u = await m.findOneBy(User, { id: uid, status: AccountStatus.ACTIVE });
    if (
      !g ||
      !u?.emailVerifiedAt ||
      g.expiresAt <= new Date() ||
      !['SUPPORT', 'BILLING', 'ADMIN'].includes(g.role) ||
      (role && g.role !== role)
    )
      throw new ForbiddenException(
        'Current operator authorization is required.',
      );
    return g;
  }
  private async password(m: EntityManager, uid: string, password: string) {
    const user = await m
      .getRepository(User)
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.id=:id', { id: uid })
      .getOne();
    if (!user || !(await this.passwords.verify(password, user.passwordHash)))
      throw new UnauthorizedException('Confirm your current password.');
  }
  private async log(
    m: EntityManager,
    actorId: string,
    action: string,
    workspaceId: string | null = null,
    targetId: string | null = null,
  ) {
    await m.save(
      m.create(OperatorAudit, { actorId, action, workspaceId, targetId }),
    );
  }
  access(uid: string) {
    return this.source.transaction(async (m) => {
      const g = await this.grant(m, uid);
      return {
        role: g.role,
        workspaceIds: g.workspaceIds,
        globalAccounts: g.globalAccounts,
        globalCatalog: g.globalCatalog,
        expiresAt: g.expiresAt,
      };
    });
  }
  overview(uid: string) {
    return this.source.transaction(async (m) => {
      const g = await this.grant(m, uid);
      const workspaces = g.workspaceIds.length
        ? await m.find(Workspace, {
            where: { id: In(g.workspaceIds) },
            select: { id: true, name: true, type: true, timezone: true },
          })
        : [];
      const ids = workspaces.map((w) => w.id);
      const health = await m.query(
        `SELECT w.id AS "workspaceId",(SELECT count(*)::int FROM agents a WHERE a."workspaceId"=w.id AND a.state='ACTIVE') AS agents,(SELECT count(*)::int FROM agents a WHERE a."workspaceId"=w.id AND a.state='ACTIVE' AND (a."lastSeenAt" IS NULL OR a."lastSeenAt"<now()-interval '90 seconds')) AS "staleAgents",(SELECT count(*)::int FROM monitoring_runs r WHERE r."workspaceId"=w.id AND r.status='failed' AND r."createdAt">now()-interval '7 days') AS "failedJobs",(SELECT count(*)::int FROM notification_deliveries d JOIN alerts al ON al.id=d."alertId" JOIN alert_rules r ON r.id=al."ruleId" WHERE r."workspaceId"=w.id AND d.status='failed') AS "failedDeliveries" FROM workspaces w WHERE w.id=ANY($1::uuid[])`,
        [ids],
      );
      const versions = await m.query(
        `SELECT "workspaceId",platform,CASE WHEN version ~ '^[0-9]+[.][0-9]+[.][0-9]+[-A-Za-z0-9._+]{0,30}$' THEN version ELSE 'unrecognized' END AS version,state,count(*)::int AS count FROM agents WHERE "workspaceId"=ANY($1::uuid[]) GROUP BY "workspaceId",platform,version,state ORDER BY "workspaceId",platform LIMIT 200`,
        [ids],
      );
      return {
        workspaces,
        health,
        versions,
        subscriptions:
          g.role === 'SUPPORT'
            ? []
            : await m.find(Subscription, { where: { workspaceId: In(ids) } }),
        compatibility: await m.find(CompatibilityRecord, { take: 200 }),
        flags: await m.find(FeatureSetting, {
          where: [{ scope: 'global' }, ...ids.map((scope) => ({ scope }))],
        }),
        audit: await m.find(OperatorAudit, {
          where: [{ workspaceId: In(ids) }, { actorId: uid }],
          order: { occurredAt: 'DESC' },
          take: 100,
        }),
        notice:
          'Scoped operational metadata only. No passwords, tokens, router credentials, process paths/arguments, application history or notification contents are returned. Compatibility records do not authorize an adapter or change its built-in verified-support gates.',
      };
    });
  }
  diagnostics(uid: string, wid: string) {
    return this.source.transaction(async (m) => {
      const g = await this.grant(m, uid);
      if (
        !g.workspaceIds.includes(wid) ||
        !(await m.existsBy(Workspace, { id: wid }))
      )
        throw new ForbiddenException(
          'Workspace is outside the operator grant.',
        );
      const [counts] = await m.query(
        `SELECT (SELECT count(*)::int FROM registered_devices WHERE "workspaceId"=$1) AS devices,(SELECT count(*)::int FROM memberships WHERE "workspaceId"=$1) AS members,(SELECT count(*)::int FROM agents WHERE "workspaceId"=$1) AS agents`,
        [wid],
      );
      await this.log(m, uid, 'diagnostics_exported', wid);
      return {
        schemaVersion: 1,
        workspaceId: wid,
        generatedAt: new Date().toISOString(),
        counts,
        redacted: true,
      };
    });
  }
  users(uid: string) {
    return this.source.transaction(async (m) => {
      const g = await this.grant(m, uid, 'ADMIN');
      if (!g.globalAccounts)
        throw new ForbiddenException(
          'Global account administration was not granted.',
        );
      return m.find(User, {
        select: {
          id: true,
          displayName: true,
          status: true,
          emailVerifiedAt: true,
          createdAt: true,
        },
        take: 100,
        order: { createdAt: 'DESC' },
      });
    });
  }
  status(uid: string, id: string, status: string, password: string) {
    return this.source.transaction(async (m) => {
      const g = await this.grant(m, uid, 'ADMIN');
      if (!g.globalAccounts || id === uid)
        throw new ForbiddenException(
          'Global account authority is required; self-suspension is disabled.',
        );
      await this.password(m, uid, password);
      const target = await m.findOne(User, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!target) throw new ForbiddenException('Account unavailable.');
      if (!['ACTIVE', 'SUSPENDED'].includes(target.status))
        throw new ForbiddenException(
          'Deletion-state accounts cannot be reactivated through operator suspension controls.',
        );
      target.status = status as AccountStatus;
      await m.save(target);
      if (status === 'SUSPENDED')
        await m.update(Session, { userId: id }, { revokedAt: new Date() });
      await this.log(m, uid, 'account_' + status.toLowerCase(), null, id);
      return { updated: true };
    });
  }
  flag(uid: string, i: FlagDto) {
    return this.source.transaction(async (m) => {
      const g = await this.grant(m, uid, 'ADMIN');
      await this.password(m, uid, i.password);
      if (
        (i.scope === 'global' && !g.globalCatalog) ||
        (i.scope === 'workspace' && !g.workspaceIds.includes(i.workspaceId))
      )
        throw new ForbiddenException('Feature-setting scope was not granted.');
      const scope = i.scope === 'global' ? 'global' : i.workspaceId;
      await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'feature:' + scope + ':' + i.key,
      ]);
      const old = await m.findOneBy(FeatureSetting, { scope, key: i.key });
      if ((old?.revision ?? 0) !== i.expectedRevision)
        throw new ConflictException('Refresh feature settings.');
      const row = await m.save(
        m.create(FeatureSetting, {
          scope,
          key: i.key,
          enabled: i.enabled,
          revision: (old?.revision ?? 0) + 1,
        }),
      );
      await this.log(
        m,
        uid,
        'feature_setting_changed',
        i.scope === 'workspace' ? i.workspaceId : null,
      );
      return row;
    });
  }
  compatibility(uid: string, i: CompatibilityDto) {
    return this.source.transaction(async (m) => {
      const g = await this.grant(m, uid, 'ADMIN');
      if (!g.globalCatalog)
        throw new ForbiddenException('Catalog administration was not granted.');
      await this.password(m, uid, i.password);
      await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        'compatibility:' + i.key,
      ]);
      const old = await m.findOneBy(CompatibilityRecord, { key: i.key });
      if ((old?.revision ?? 0) !== i.expectedRevision)
        throw new ConflictException('Refresh the compatibility record.');
      const row = await m.save(
        m.create(CompatibilityRecord, {
          key: i.key,
          kind: i.kind,
          label: i.label,
          status: i.status,
          evidence: i.evidence,
          checkedAt: new Date(),
          revision: (old?.revision ?? 0) + 1,
        }),
      );
      await this.log(m, uid, 'compatibility_record_changed');
      return row;
    });
  }
}
