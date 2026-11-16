import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource, EntityManager, In, Between } from 'typeorm';
import { workspacePolicy } from '../workspaces/workspace-policy';
import {
  WorkspacePermission,
  roleAllows,
} from '../workspaces/workspace-access.service';
import { RegisteredDevice } from '../workspaces/registered-device.entity';
import { WorkspaceRole } from '../workspaces/membership.entity';
import {
  CollectionGap,
  DailyUsage,
  DeviceUsageNetwork,
  MonitoringRun,
  RetentionPolicy,
  UsageNetwork,
} from './entities';
import { UsageQuery, RetentionDto } from './report.dto';
import { decimal, micro } from './values';

export function csvCell(value: string | number | boolean | null | undefined) {
  const text = String(value ?? '');
  return (
    '"' +
    (/^[=+\-@\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""') +
    '"'
  );
}
export async function reportDevices(
  manager: EntityManager,
  userId: string,
  workspaceId: string,
  deviceId?: string,
  exporting = false,
) {
  const { workspace, member } = await workspacePolicy(
    manager,
    userId,
    workspaceId,
    WorkspacePermission.READ,
  );
  const all =
    workspace.type !== "BUSINESS" &&
    roleAllows(member.role, WorkspacePermission.READ_REPORTS) &&
    !(workspace.type === 'FAMILY' && member.role === 'GUARDIAN');
  const devices = await manager.findBy(RegisteredDevice, {
    workspaceId,
    ...(all ? {} : { registeredById: userId }),
    ...(deviceId ? { id: deviceId } : {}),
  });
  if (deviceId && !devices.length)
    throw new ForbiddenException('Device is outside your report scope.');
  if (
    exporting &&
    devices.some((d) => d.registeredById !== userId) &&
    !roleAllows(member.role, WorkspacePermission.EXPORT_REPORTS)
  )
    throw new ForbiddenException('Shared report export is not permitted.');
  if (devices.length > 20)
    throw new BadRequestException('Narrow this report to a device.');
  return { workspace, devices, member };
}
@Injectable()
export class ReportService {
  constructor(private readonly source: DataSource) {}
  report(
    userId: string,
    workspaceId: string,
    input: UsageQuery,
    exporting = false,
  ) {
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      const { workspace, devices } = await reportDevices(
        manager,
        userId,
        workspaceId,
        input.deviceId,
        exporting,
      );
      const first = Date.parse(input.from + 'T00:00:00Z'),
        last = Date.parse(input.to + 'T00:00:00Z');
      if (
        !Number.isFinite(first) ||
        !Number.isFinite(last) ||
        new Date(first).toISOString().slice(0, 10) !== input.from ||
        new Date(last).toISOString().slice(0, 10) !== input.to ||
        last <= first ||
        last - first > 366 * 86400000
      )
        throw new BadRequestException(
          'Choose valid local dates spanning at most 366 days, with to exclusive.',
        );
      if (
        (input.metric === 'application_foreground_seconds') !==
        Boolean(input.applicationId)
      )
        throw new BadRequestException(
          'This metric requires an application identifier.',
        );
      if (
        input.networkId &&
        !(await manager.existsBy(UsageNetwork, {
          id: input.networkId,
          workspaceId,
        }))
      )
        throw new ForbiddenException('Network is outside this workspace.');
      const previous = new Date(first - (last - first))
        .toISOString()
        .slice(0, 10);
      const rows = devices.length
        ? await manager.find(DailyUsage, {
            where: {
              workspaceId,
              localDate: Between(previous, input.to),
              deviceId: In(devices.map((d) => d.id)),
              metric: input.metric,
              applicationId: input.applicationId ?? '',
              ...(input.networkId ? { networkId: input.networkId } : {}),
            },
            order: { localDate: 'ASC' },
            take: 10001,
          })
        : [];
      if (rows.length > 10000)
        throw new BadRequestException(
          'Report history is too large; narrow the scope.',
        );
      const days = await manager.query(
        `SELECT d::date::text AS date,date_trunc($4,d)::date::text AS bucket,(EXTRACT(EPOCH FROM (((d+interval '1 day') AT TIME ZONE $3)-(d AT TIME ZONE $3)))*1000)::float8 AS duration FROM generate_series($1::date::timestamp,($2::date-1)::timestamp,interval '1 day') d`,
        [input.from, input.to, workspace.timezone, input.period ?? 'day'],
      );
      const buckets = new Map<
        string,
        {
          periodStart: string;
          measured: string | null;
          estimated: string | null;
          measuredCoverageMs: number;
          expectedMs: number;
          missingMs: number;
          prorated: boolean;
        }
      >();
      for (const day of days) {
        let bucket = buckets.get(day.bucket);
        if (!bucket) {
          bucket = {
            periodStart: day.bucket,
            measured: null,
            estimated: null,
            measuredCoverageMs: 0,
            expectedMs: 0,
            missingMs: 0,
            prorated: false,
          };
          buckets.set(day.bucket, bucket);
        }
        bucket.expectedMs += day.duration * devices.length;
        for (const row of rows.filter((r) => r.localDate === day.date)) {
          const quality = row.quality as 'measured' | 'estimated';
          bucket[quality] = decimal(
            micro(bucket[quality] ?? '0') + micro(row.value),
          );
          if (quality === 'measured')
            bucket.measuredCoverageMs += Number(row.coverageMs);
          bucket.prorated ||= row.proratedEvents > 0;
        }
      }
      for (const bucket of buckets.values())
        bucket.missingMs = Math.max(
          0,
          bucket.expectedMs - bucket.measuredCoverageMs,
        );
      const selected = rows.filter(
        (r) => r.localDate >= input.from && r.localDate < input.to,
      );
      if (selected.length > 2000)
        throw new BadRequestException(
          'Narrow this report before returning source detail.',
        );
      const sum = (items: DailyUsage[], quality: string) =>
        items.some((r) => r.quality === quality)
          ? decimal(
              items
                .filter((r) => r.quality === quality)
                .reduce((a, r) => a + micro(r.value), 0n),
            )
          : null;
      const current = sum(selected, 'measured'),
        prior = sum(
          rows.filter(
            (r) => r.localDate >= previous && r.localDate < input.from,
          ),
          'measured',
        );
      const gaps = devices.length
        ? await manager
            .getRepository(CollectionGap)
            .createQueryBuilder('g')
            .where(
              'g.workspaceId=:workspaceId AND g.deviceId IN (:...ids) AND g.metric=:metric AND g.applicationId=:app AND g."intervalStart" < (:to::date AT TIME ZONE :tz) AND g."intervalEnd" > (:from::date AT TIME ZONE :tz)',
              {
                workspaceId,
                ids: devices.map((d) => d.id),
                metric: input.metric,
                app: input.applicationId ?? '',
                to: input.to,
                from: input.from,
                tz: workspace.timezone,
              },
            )
            .andWhere(input.networkId ? 'g.networkId=:networkId' : 'TRUE', {
              networkId: input.networkId,
            })
            .take(2001)
            .getMany()
        : [];
      if (gaps.length > 2000)
        throw new BadRequestException('Narrow the gap history.');
      const report = {
        timezone: workspace.timezone,
        from: input.from,
        to: input.to,
        period: input.period ?? 'day',
        metric: input.metric,
        deviceIds: devices.map((d) => d.id),
        buckets: [...buckets.values()],
        comparison: {
          from: previous,
          to: input.from,
          measured: prior,
          currentMeasured: current,
          percentChange:
            current !== null && prior !== null && micro(prior) !== 0n
              ? Number(
                  ((micro(current) - micro(prior)) * 10000n) / micro(prior),
                ) / 100
              : null,
        },
        sources: selected.map((r) => ({
          deviceId: r.deviceId,
          networkId: r.networkId,
          localDate: r.localDate,
          kind: r.sourceKind,
          collectorVersion: r.collectorVersion,
          quality: r.quality,
          value: r.value,
          coverageMs: r.coverageMs,
          prorated: r.proratedEvents > 0,
        })),
        declaredGaps: gaps.map((g) => ({
          deviceId: g.deviceId,
          reason: g.reason,
          intervalStart: g.intervalStart,
          intervalEnd: g.intervalEnd,
        })),
        qualityNote:
          'Device-reported observations. Declared gaps are historical; later uploads may fill them. Split intervals use proportional allocation. Missing time uses the selected devices’ full report windows; network labels do not prove continuous network presence.',
      };
      if (!exporting) return report;
      const header = [
        'periodStart',
        'measured',
        'estimated',
        'measuredCoverageMs',
        'expectedMs',
        'missingMs',
        'prorated',
      ];
      await manager.save(
        manager.create(MonitoringRun, {
          workspaceId,
          deviceId: input.deviceId ?? null,
          kind: 'export',
          status: 'succeeded',
          errorCode: null,
        }),
      );
      return {
        fileName: 'netsentry-usage.csv',
        contentType: 'text/csv',
        content: [
          header.map(csvCell).join(','),
          ...report.buckets.map((b) =>
            header.map((k) => csvCell(b[k as keyof typeof b])).join(','),
          ),
        ].join('\r\n'),
      };
    });
  }
  retention(userId: string, workspaceId: string, input?: RetentionDto) {
    return this.source.transaction(async (manager) => {
      const { member } = await workspacePolicy(
        manager,
        userId,
        workspaceId,
        WorkspacePermission.READ_AUDIT,
      );
      if (input && member.role !== WorkspaceRole.OWNER)
        throw new ForbiddenException('Only the owner can change retention.');
      if (input && input.aggregateDays < input.rawDays)
        throw new BadRequestException(
          'Aggregate retention must cover raw retention.',
        );
      const current =
        (await manager.findOneBy(RetentionPolicy, { workspaceId })) ??
        manager.create(RetentionPolicy, { workspaceId });
      if (input)
        await manager.save(
          manager.create(MonitoringRun, {
            workspaceId,
            deviceId: null,
            kind: 'retention_policy_changed',
            status: 'succeeded',
            errorCode: null,
          }),
        );
      return input
        ? manager.save(
            Object.assign(current, input, { effectiveAt: new Date() }),
          )
        : current;
    });
  }
  networks(userId: string, workspaceId: string, name?: string) {
    return this.source.transaction(async (manager) => {
      await workspacePolicy(
        manager,
        userId,
        workspaceId,
        name
          ? WorkspacePermission.MANAGE_NETWORKS
          : WorkspacePermission.READ_NETWORKS,
      );
      if (
        name &&
        (await manager.existsBy(UsageNetwork, {
          workspaceId,
          name: name.trim(),
        }))
      )
        throw new ConflictException('This network label already exists.');
      if (name && (await manager.countBy(UsageNetwork, { workspaceId })) >= 200)
        throw new BadRequestException(
          'This workspace has reached its network label limit.',
        );
      if (name)
        return manager.save(
          manager.create(UsageNetwork, {
            workspaceId,
            name: name.trim(),
            createdById: userId,
          }),
        );
      return manager.findBy(UsageNetwork, { workspaceId });
    });
  }
  assign(
    userId: string,
    workspaceId: string,
    deviceId: string,
    networkId: string,
  ) {
    return this.source.transaction(async (manager) => {
      await workspacePolicy(
        manager,
        userId,
        workspaceId,
        WorkspacePermission.REGISTER_DEVICE,
      );
      const device = await manager.findOne(RegisteredDevice, {
        where: { id: deviceId, workspaceId, registeredById: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !device ||
        !(await manager.existsBy(UsageNetwork, { id: networkId, workspaceId }))
      )
        throw new ForbiddenException(
          'Device or network is outside your scope.',
        );
      device.generation++;
      device.monitoringEnabled = false;
      device.consentScopes = [];
      await manager.save(device);
      await manager.upsert(DeviceUsageNetwork, { deviceId, networkId }, [
        'deviceId',
      ]);
      return {
        assigned: true,
        generation: device.generation,
        requiresConsent: true,
      };
    });
  }
}
