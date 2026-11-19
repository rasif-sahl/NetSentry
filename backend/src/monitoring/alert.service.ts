import { User, AccountStatus } from '../users/user.entity';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { workspacePolicy } from '../workspaces/workspace-policy';
import {
  WorkspacePermission,
  roleAllows,
} from '../workspaces/workspace-access.service';
import { Workspace } from '../workspaces/workspace.entity';
import { RegisteredDevice } from '../workspaces/registered-device.entity';
import {
  AlertOccurrence,
  AlertRule,
  NotificationDelivery,
  NotificationPreference,
} from './alert.entities';
import { AlertRuleDto, NotificationPreferenceDto } from './dto/alert.dto';
import { DailyUsage, MonitoringRun, UsageNetwork } from './entities';
import { decimal, micro } from './values';
import { defaultAdapters, type NotificationAdapter } from './delivery';

export async function ruleAccess(manager: EntityManager, rule: AlertRule) {
  const { member, workspace } = await workspacePolicy(
    manager,
    rule.userId,
    rule.workspaceId,
    WorkspacePermission.READ,
  );
  const devices = await manager.findBy(RegisteredDevice, {
    workspaceId: rule.workspaceId,
    ...(rule.deviceId ? { id: rule.deviceId } : {}),
  });
  const shared =
    !rule.deviceId ||
    Boolean(rule.networkId) ||
    devices.some((d) => d.registeredById !== rule.userId);
  if (shared && workspace.type === 'BUSINESS')
    throw new ForbiddenException(
      'Use consent-scoped Business reports and network alerts; personal usage rules require an explicitly owned device.',
    );
  if (shared && workspace.type === 'FAMILY' && member.role === 'GUARDIAN')
    throw new ForbiddenException(
      'Use explicitly scoped family observations for child alerts.',
    );
  if (
    shared &&
    (!roleAllows(member.role, WorkspacePermission.HANDLE_ALERTS) ||
      !roleAllows(member.role, WorkspacePermission.READ_REPORTS))
  )
    throw new ForbiddenException('Shared alert scope is not permitted.');
  if (rule.deviceId && !devices.length)
    throw new ForbiddenException('Device is unavailable.');
  if (rule.networkId) {
    if (
      !(await manager.existsBy(UsageNetwork, {
        id: rule.networkId,
        workspaceId: rule.workspaceId,
      }))
    )
      throw new ForbiddenException('Network is unavailable.');
  }
  if (devices.length > 20)
    throw new BadRequestException('Narrow this rule to a device.');
  return { devices, workspace };
}
export async function quietUntil(
  manager: EntityManager,
  rule: AlertRule,
  now: Date,
): Promise<Date | null> {
  const quiet = rule.config.quietHours;
  if (!quiet) return null;
  const [result] = await manager.query(
    `WITH local AS (SELECT $1::timestamptz AT TIME ZONE $4 AS t), state AS (SELECT t,CASE WHEN $2::time<$3::time THEN t::time >= $2::time AND t::time < $3::time ELSE t::time >= $2::time OR t::time < $3::time END AS quiet FROM local) SELECT CASE WHEN quiet THEN ((t::date+CASE WHEN $2::time>$3::time AND t::time >= $2::time THEN 1 ELSE 0 END)+$3::time) AT TIME ZONE $4 ELSE NULL END AS until FROM state`,
    [now, quiet.start, quiet.end, quiet.timezone],
  );
  return result.until ? new Date(result.until) : null;
}
@Injectable()
export class AlertService {
  constructor(private readonly source: DataSource) {}
  private async rulesContext(
    manager: EntityManager,
    userId: string,
    workspaceId: string,
  ) {
    return workspacePolicy(
      manager,
      userId,
      workspaceId,
      WorkspacePermission.READ,
    );
  }
  save(
    userId: string,
    workspaceId: string,
    input: AlertRuleDto,
    ruleId?: string,
  ) {
    return this.source.transaction(async (manager) => {
      await this.rulesContext(manager, userId, workspaceId);
      const rule = ruleId
        ? await manager.findOneBy(AlertRule, {
            id: ruleId,
            userId,
            workspaceId,
          })
        : manager.create(AlertRule, {
            workspaceId,
            userId,
            windowKey: '',
            active: false,
            cycle: 0,
          });
      if (!rule) throw new ForbiddenException('Rule is unavailable.');
      if (!ruleId && (await manager.countBy(AlertRule, { workspaceId })) >= 100)
        throw new BadRequestException(
          'This workspace has reached its rule limit.',
        );
      if (
        input.kind === 'threshold' &&
        (!input.metric ||
          (input.metric === 'application_foreground_seconds') !==
            Boolean(input.applicationId))
      )
        throw new BadRequestException(
          'Choose a metric and its application scope.',
        );
      if (
        input.kind !== 'threshold' &&
        (!input.deviceId ||
          input.networkId ||
          input.metric ||
          input.applicationId ||
          input.quality)
      )
        throw new BadRequestException('Health rules require a single device.');
      if (input.quietHours?.start === input.quietHours?.end && input.quietHours)
        throw new BadRequestException(
          'Quiet hours must have different start and end times.',
        );
      if (
        ['device_offline', 'not_reporting'].includes(input.kind) &&
        (input.threshold < 60 || input.threshold > 604800)
      )
        throw new BadRequestException(
          'Offline threshold must be 60 to 604800 seconds.',
        );
      const { deviceId, networkId, ...config } = input;
      rule.deviceId = deviceId ?? null;
      rule.networkId = networkId ?? null;
      rule.config = config;
      await ruleAccess(manager, rule);
      // Edits cancel old payloads; re-evaluate against the new definition.
      if (ruleId) await manager.delete(AlertOccurrence, { ruleId });
      rule.active = false;
      rule.windowKey = '';
      return manager.save(rule);
    });
  }
  listRules(userId: string, workspaceId: string) {
    return this.source.transaction(async (manager) => {
      await this.rulesContext(manager, userId, workspaceId);
      const rules = await manager.findBy(AlertRule, { userId, workspaceId });
      const permitted: AlertRule[] = [];
      for (const rule of rules) {
        try {
          await ruleAccess(manager, rule);
          permitted.push(rule);
        } catch (error) {
          if (!(error instanceof ForbiddenException)) throw error;
        }
      }
      return permitted;
    });
  }
  remove(userId: string, workspaceId: string, id: string) {
    return this.source.transaction(async (manager) => {
      await this.rulesContext(manager, userId, workspaceId);
      await manager.delete(AlertRule, { id, userId, workspaceId });
      return { deleted: true };
    });
  }
  preferences(userId: string, input?: NotificationPreferenceDto) {
    return this.source.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId, status: AccountStatus.ACTIVE },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new ForbiddenException('Account is unavailable.');
      const existing =
        (await manager.findOneBy(NotificationPreference, { userId })) ??
        manager.create(NotificationPreference, { userId });
      if (input) {
        existing.inApp = input.inApp;
        existing.push = input.push;
        if (typeof input.email === 'boolean') existing.email = input.email;
        await manager.save(existing);
      }
      return {
        userId: existing.userId,
        inApp: existing.inApp,
        push: existing.push,
        email: existing.email,
        emailDeliveryAvailable: false,
      };
    });
  }
  list(userId: string, workspaceId: string, notifications = false) {
    return this.source.transaction(async (manager) => {
      await this.rulesContext(manager, userId, workspaceId);
      const rules = await manager.findBy(AlertRule, { userId, workspaceId });
      const allowed: string[] = [];
      for (const rule of rules) {
        try {
          await ruleAccess(manager, rule);
          allowed.push(rule.id);
        } catch (error) {
          if (!(error instanceof ForbiddenException)) throw error;
        }
      }
      if (!allowed.length) return [];
      const alerts = await manager.find(AlertOccurrence, {
        where: { ruleId: In(allowed) },
        order: { createdAt: 'DESC' },
        take: 100,
      });
      const rows = [];
      for (const alert of alerts) {
        const deliveries = await manager.findBy(NotificationDelivery, {
          alertId: alert.id,
        });
        if (
          !notifications ||
          deliveries.some(
            (d) => d.channel === 'in_app' && d.status === 'delivered',
          )
        )
          rows.push(Object.assign({}, alert, { deliveries }));
      }
      return rows;
    });
  }
  acknowledge(userId: string, workspaceId: string, id: string) {
    return this.source.transaction(async (manager) => {
      await this.rulesContext(manager, userId, workspaceId);
      const alert = await manager.findOneBy(AlertOccurrence, { id });
      const rule = alert
        ? await manager.findOneBy(AlertRule, {
            id: alert.ruleId,
            userId,
            workspaceId,
          })
        : null;
      if (!alert || !rule)
        throw new ForbiddenException('Alert is unavailable.');
      await ruleAccess(manager, rule);
      alert.acknowledgedAt ??= new Date();
      return manager.save(alert);
    });
  }
  diagnostics(userId: string, workspaceId: string) {
    return this.source.transaction(async (manager) => {
      await workspacePolicy(
        manager,
        userId,
        workspaceId,
        WorkspacePermission.READ_AUDIT,
      );
      const runs = await manager.find(MonitoringRun, {
        where: { workspaceId },
        order: { createdAt: 'DESC' },
        take: 100,
      });
      const deliveries = await manager.query(
        'SELECT d.status,count(*)::int AS count FROM notification_deliveries d JOIN alerts a ON a.id=d."alertId" JOIN alert_rules r ON r.id=a."ruleId" WHERE r."workspaceId"=$1 GROUP BY d.status',
        [workspaceId],
      );
      return {
        runs,
        deliveries,
        pushProviders: { android: 'unconfigured', ios: 'unconfigured' },
      };
    });
  }
}
export async function evaluateWorkspace(
  source: DataSource,
  workspaceId: string,
  now = new Date(),
) {
  return source.transaction(async (manager) => {
    // Serialize evaluation with ingestion, scope changes and delivery.
    await manager.findOneOrFail(Workspace, {
      where: { id: workspaceId },
      lock: { mode: 'pessimistic_write' },
    });
    const rules = await manager.find(AlertRule, {
      where: { workspaceId },
      order: { id: 'ASC' },
      take: 100,
    });
    let created = 0;
    for (const rule of rules) {
      let context: Awaited<ReturnType<typeof ruleAccess>>;
      try {
        context = await ruleAccess(manager, rule);
      } catch (error) {
        if (error instanceof ForbiddenException) {
          await manager.delete(AlertRule, rule.id);
          continue;
        }
        throw error;
      }
      const config = rule.config;
      if (!config.enabled) continue;
      let active = false,
        value: string | null = null,
        windowKey = 'health',
        contributors: string[] = [];
      const devices = context.devices.filter((d) => d.state === 'ACTIVE');
      if (config.kind === 'threshold') {
        const [window] = await manager.query(
          `SELECT date_trunc($1,$2::timestamptz AT TIME ZONE $3)::date::text AS start, ((date_trunc($1,$2::timestamptz AT TIME ZONE $3)+('1 '||$1)::interval)::date)::text AS finish`,
          [config.period, now, context.workspace.timezone],
        );
        windowKey = window.start;
        const rows = devices.length
          ? await manager
              .getRepository(DailyUsage)
              .createQueryBuilder('u')
              .where(
                'u.workspaceId=:wid AND u.deviceId IN (:...ids) AND u.metric=:metric AND u.applicationId=:app AND u.quality=:quality AND u."localDate" >= :start AND u."localDate" < :finish',
                {
                  wid: workspaceId,
                  ids: devices.map((d) => d.id),
                  metric: config.metric,
                  quality: config.quality ?? 'measured',
                  app: config.applicationId ?? '',
                  start: window.start,
                  finish: window.finish,
                },
              )
              .andWhere(rule.networkId ? 'u.networkId=:nid' : 'TRUE', {
                nid: rule.networkId,
              })
              .getMany()
          : [];
        if (rows.length) {
          const total = rows.reduce((a, r) => a + micro(r.value), 0n);
          value = decimal(total);
          active = total >= micro(config.threshold.toFixed(6));
          contributors = [...new Set(rows.map((r) => r.deviceId))];
        }
      } else if (devices.length) {
        const device = devices[0];
        contributors = [device.id];
        if (config.kind === 'permission_revoked')
          active = ['denied', 'revoked'].includes(device.permissionStatus);
        else if (config.kind === 'not_reporting') {
          const [latest]: { report: Date | null; consent: Date | null }[] =
            await manager.query(
              `SELECT (SELECT max("receivedAt") FROM measurement_batches WHERE "deviceId"=$1) AS report,(SELECT max("createdAt") FROM device_events WHERE "deviceId"=$1 AND generation=$2 AND kind='consent_granted') AS consent`,
              [device.id, device.generation],
            );
          const baseline = Math.max(
            (latest.report ?? device.enrolledAt ?? device.createdAt).getTime(),
            (latest.consent ?? device.enrolledAt ?? device.createdAt).getTime(),
          );
          const seconds = Math.max(0, (now.getTime() - baseline) / 1000);
          active = device.monitoringEnabled && seconds >= config.threshold;
          value = seconds.toFixed(6);
        } else {
          const seconds = Math.max(
            0,
            (now.getTime() -
              (
                device.lastSeenAt ??
                device.enrolledAt ??
                device.createdAt
              ).getTime()) /
              1000,
          );
          active = seconds >= config.threshold;
          value = seconds.toFixed(6);
        }
      }
      if (rule.windowKey !== windowKey || !active) {
        await manager
          .createQueryBuilder()
          .update(AlertOccurrence)
          .set({ resolvedAt: now })
          .where('"ruleId"=:id AND "resolvedAt" IS NULL', { id: rule.id })
          .execute();
        rule.active = false;
      }
      if (active && !rule.active) {
        rule.cycle++;
        const alert = await manager.save(
          manager.create(AlertOccurrence, {
            ruleId: rule.id,
            cycle: rule.cycle,
            sourceDeviceIds: contributors,
            snapshot: {
              kind: config.kind,
              severity: config.severity,
              value,
              windowKey,
              ...(config.kind === 'threshold'
                ? { quality: config.quality ?? 'measured' }
                : {}),
            },
            acknowledgedAt: null,
            resolvedAt: null,
          }),
        );
        for (const channel of config.channels)
          await manager.save(
            manager.create(NotificationDelivery, {
              alertId: alert.id,
              channel,
              status: 'pending',
              attempts: 0,
              dueAt: (await quietUntil(manager, rule, now)) ?? now,
              attemptHistory: [],
            }),
          );
        created++;
      }
      rule.active = active;
      rule.windowKey = windowKey;
      await manager.save(rule);
    }
    // Workspace may have no rules. Do not create diagnostics against a deleted workspace.
    if (rules.length)
      await manager.save(
        manager.create(MonitoringRun, {
          workspaceId,
          deviceId: null,
          kind: 'alert_evaluation',
          status: 'succeeded',
          errorCode: null,
        }),
      );
    return created;
  });
}
export async function deliverWorkspace(
  source: DataSource,
  workspaceId: string,
  now = new Date(),
  adapters: NotificationAdapter[] = defaultAdapters,
) {
  return source.transaction(async (manager) => {
    await manager.findOneOrFail(Workspace, {
      where: { id: workspaceId },
      lock: { mode: 'pessimistic_write' },
    });
    const candidates = await manager.query(
      `SELECT d.id FROM notification_deliveries d JOIN alerts a ON a.id=d."alertId" JOIN alert_rules r ON r.id=a."ruleId" WHERE r."workspaceId"=$1 AND d.status IN ('pending','retry') AND d."dueAt"<=$2 ORDER BY d."dueAt",d.id LIMIT 100`,
      [workspaceId, now],
    );
    let processed = 0;
    for (const candidate of candidates) {
      const original = await manager.findOneBy(NotificationDelivery, {
        id: candidate.id,
      });
      if (!original) continue;
      const alert = await manager.findOneBy(AlertOccurrence, {
        id: original.alertId,
      });
      const rule = alert
        ? await manager.findOneBy(AlertRule, { id: alert.ruleId })
        : null;
      if (!rule || !alert) continue;
      try {
        await ruleAccess(manager, rule);
      } catch (error) {
        if (error instanceof ForbiddenException) {
          await manager.delete(AlertRule, rule.id);
          continue;
        }
        throw error;
      }
      const delivery = await manager.findOne(NotificationDelivery, {
        where: { id: original.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !delivery ||
        !['pending', 'retry'].includes(delivery.status) ||
        delivery.dueAt > now
      )
        continue;
      if (!rule.config.enabled || alert.resolvedAt) {
        delivery.status = 'cancelled';
        await manager.save(delivery);
        continue;
      }
      const preferences =
        (await manager.findOneBy(NotificationPreference, {
          userId: rule.userId,
        })) ?? manager.create(NotificationPreference, { userId: rule.userId });
      if (
        delivery.channel === 'in_app'
          ? !preferences.inApp
          : delivery.channel === 'email'
            ? !preferences.email
            : !preferences.push
      ) {
        delivery.status = 'suppressed';
        await manager.save(delivery);
        continue;
      }
      const until = await quietUntil(manager, rule, now);
      if (until && until > now) {
        delivery.dueAt = until;
        await manager.save(delivery);
        continue;
      }
      const adapter = adapters.find((a) => a.channel === delivery.channel);
      let result: Awaited<ReturnType<NotificationAdapter['deliver']>>;
      try {
        result = adapter
          ? await adapter.deliver({
              idempotencyKey: delivery.id,
              alertId: alert.id,
              userId: rule.userId,
            })
          : { status: 'unavailable', code: 'ADAPTER_UNCONFIGURED' };
      } catch {
        result = { status: 'retry', code: 'ADAPTER_TRANSIENT_FAILURE' };
      }
      // Provider errors must be server-owned codes, never arbitrary exception text.
      const code =
        result.code && /^[A-Z_]{1,80}$/.test(result.code)
          ? result.code
          : result.code
            ? 'ADAPTER_FAILURE'
            : null;
      delivery.attempts++;
      delivery.status =
        result.status === 'retry' && delivery.attempts >= 5
          ? 'failed'
          : result.status;
      delivery.attemptHistory.push({
        at: now.toISOString(),
        outcome: delivery.status,
        code,
      });
      if (delivery.status === 'retry')
        delivery.dueAt = new Date(
          now.getTime() +
            Math.min(3600000, 60000 * 2 ** (delivery.attempts - 1)),
        );
      await manager.save(delivery);
      processed++;
      await manager.save(
        manager.create(MonitoringRun, {
          workspaceId,
          deviceId: rule.deviceId,
          kind: 'delivery',
          status: delivery.status,
          errorCode: code,
        }),
      );
    }
    return processed;
  });
}
