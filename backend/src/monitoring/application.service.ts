import { applicationInsights } from './application-insights';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource, EntityManager, Between } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { IngestionService } from './ingestion.service';
import {
  validateApplicationBatch,
  type AppBatch,
  type Segment,
} from './application-validation';
import {
  ApplicationCatalog,
  ApplicationDay,
  ApplicationWindow,
  type AppMetadata,
} from './application.entities';
import { RegisteredDevice } from '../workspaces/registered-device.entity';
import { DeviceEvent } from '../devices/device-event.entity';
import { Workspace } from '../workspaces/workspace.entity';
import { reportDevices, csvCell } from './report.service';
import { workspacePolicy } from '../workspaces/workspace-policy';
import { WorkspacePermission } from '../workspaces/workspace-access.service';
import { fingerprint } from './values';
import { dailyParts } from './aggregate';
import { AlertRule } from './alert.entities';
import type { ApplicationQuery } from './application.dto';
import type { EventInput } from './validation';

export const builtinCategories = [
  'game',
  'audio',
  'video',
  'image',
  'social',
  'news',
  'maps',
  'productivity',
  'accessibility',
  'unknown',
];
export function classification(app: AppMetadata, catalog: ApplicationCatalog) {
  const override = catalog.overrides[app.applicationId];
  const custom = catalog.categories.find((c) => c.id === override);
  const categoryId =
    override && (builtinCategories.includes(override) || custom)
      ? override
      : app.platformCategory;
  return {
    categoryId,
    category: custom?.name ?? categoryId,
    source: override
      ? 'manual'
      : categoryId === 'unknown'
        ? 'unknown'
        : 'os_category',
    confidence: override ? 1 : categoryId === 'unknown' ? 0 : 0.6,
  };
}
@Injectable()
export class ApplicationService {
  constructor(
    private readonly source: DataSource,
    private readonly ingestion: IngestionService,
  ) {}
  async ingest(device: RegisteredDevice, value: unknown) {
    validateApplicationBatch(value);
    const batch = value;
    if (
      device.platform !== 'ANDROID' ||
      device.id !== batch.deviceId ||
      device.workspaceId !== batch.workspaceId
    )
      throw new ForbiddenException(
        'Application usage is outside this Android identity.',
      );
    const prepared = await this.source
      .getRepository(Workspace)
      .findOneByOrFail({ id: device.workspaceId });
    const parts = await dailyParts(
      this.source.manager,
      new Date(batch.intervalStart),
      new Date(batch.intervalEnd),
      prepared.timezone,
    );
    const events: EventInput[] = [];
    for (const part of parts) {
      const [bounds]: { first: Date; last: Date }[] = await this.source.query(
        'SELECT ($1::date::timestamp AT TIME ZONE $2) AS first,(($1::date+1)::timestamp AT TIME ZONE $2) AS last',
        [part.localDate, prepared.timezone],
      );
      const first = Math.max(
          bounds.first.getTime(),
          Date.parse(batch.intervalStart),
        ),
        last = Math.min(bounds.last.getTime(), Date.parse(batch.intervalEnd));
      const duration = (segments: Segment[]) =>
        segments.reduce(
          (sum, segment) =>
            sum +
            Math.max(
              0,
              Math.min(last, Date.parse(segment.end)) -
                Math.max(first, Date.parse(segment.start)),
            ),
          0,
        ) / 1000;
      const add = (metric: string, seconds: number, applicationId?: string) => {
        const hash = fingerprint([
          batch.batchId,
          metric,
          applicationId ?? '',
          first,
          last,
        ]);
        events.push({
          schemaVersion: 1,
          eventId: `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`,
          workspaceId: device.workspaceId,
          deviceId: device.id,
          metric,
          value: seconds,
          unit: 'seconds',
          source: { kind: 'android', collectorVersion: '0.9.0' },
          intervalStart: new Date(first).toISOString(),
          intervalEnd: new Date(last).toISOString(),
          collectedAt: batch.collectedAt,
          quality: 'estimated',
          ...(applicationId ? { applicationId } : {}),
        });
      };
      for (const app of batch.applications) {
        const seconds = duration(
          batch.sessions.filter(
            (segment) => segment.applicationId === app.applicationId,
          ),
        );
        if (seconds > 0)
          add('application_foreground_seconds', seconds, app.applicationId);
      }
      if (batch.screenKnown) add('screen_time_seconds', duration(batch.screen));
    }
    const gaps = batch.screenKnown
      ? []
      : [
          {
            gapId: batch.batchId,
            metric: 'screen_time_seconds',
            intervalStart: batch.intervalStart,
            intervalEnd: batch.intervalEnd,
            reason: 'collection_failed',
          },
        ];
    return this.ingestion.ingest(
      device,
      {
        schemaVersion: 1,
        batchId: batch.batchId,
        generation: batch.generation,
        events,
        gaps,
      },
      {
        payloadHash: fingerprint(batch),
        commit: async (manager, current) => {
          const consent = await manager.findOneBy(DeviceEvent, {
            deviceId: current.id,
            generation: current.generation,
            kind: 'consent_granted',
          });
          if (consent?.details.appUsageDisclosureVersion !== 'app-usage-v1')
            throw new ForbiddenException(
              'Accept the application-usage disclosure before sharing detailed history.',
            );
          if (
            (await manager.countBy(ApplicationWindow, {
              deviceId: device.id,
            })) >= 5000
          )
            throw new BadRequestException(
              'Application history capacity reached; run retention or erase old data.',
            );
          const overlap = await manager
            .getRepository(ApplicationWindow)
            .createQueryBuilder('w')
            .where(
              'w."deviceId"=:id AND w."intervalStart"<:last AND w."intervalEnd">:first',
              {
                id: current.id,
                first: batch.intervalStart,
                last: batch.intervalEnd,
              },
            )
            .getExists();
          if (overlap)
            throw new ConflictException(
              'Detailed application window overlaps accepted history.',
            );
          const workspace = await manager.findOneByOrFail(Workspace, {
            id: current.workspaceId,
          });
          if (workspace.timezone !== prepared.timezone)
            throw new ConflictException(
              'Workspace timezone changed; refresh configuration before collecting again.',
            );
          await this.persist(manager, current.id, workspace.timezone, batch);
        },
      },
    );
  }
  private async persist(
    manager: EntityManager,
    deviceId: string,
    timezone: string,
    batch: AppBatch,
  ) {
    const catalog =
      (await manager.findOneBy(ApplicationCatalog, { deviceId })) ??
      manager.create(ApplicationCatalog, {
        deviceId,
        applications: [],
        categories: [],
        overrides: {},
      });
    for (const app of batch.applications) {
      const old = catalog.applications.findIndex(
        (a) => a.applicationId === app.applicationId,
      );
      if (old >= 0) catalog.applications[old] = app;
      else if (catalog.applications.length < 256)
        catalog.applications.push(app);
    }
    await manager.save(catalog);
    await manager.save(
      manager.create(ApplicationWindow, {
        deviceId,
        batchId: batch.batchId,
        intervalStart: new Date(batch.intervalStart),
        intervalEnd: new Date(batch.intervalEnd),
        payload: batch,
      }),
    );
    const parts = await dailyParts(
      manager,
      new Date(batch.intervalStart),
      new Date(batch.intervalEnd),
      timezone,
    );
    for (const id of ['', ...batch.applications.map((a) => a.applicationId)]) {
      const segments = id
        ? batch.sessions.filter((s) => s.applicationId === id)
        : batch.screen;
      if (
        id &&
        !segments.length &&
        !batch.launches.some((l) => l.applicationId === id)
      )
        continue;
      for (const part of parts) {
        const [bounds]: {
          first: Date;
          last: Date;
          nightEnd: Date;
          nightStart: Date;
        }[] = await manager.query(
          `SELECT ($1::date::timestamp AT TIME ZONE $2) AS first,(($1::date+1)::timestamp AT TIME ZONE $2) AS last,(($1::date+time '06:00') AT TIME ZONE $2) AS "nightEnd",(($1::date+time '22:00') AT TIME ZONE $2) AS "nightStart"`,
          [part.localDate, timezone],
        );
        const first = bounds.first.getTime(),
          last = bounds.last.getTime();
        let milliseconds = 0,
          night = 0,
          firstUse: number | null = null,
          lastUse: number | null = null;
        for (const segment of segments) {
          const a = Math.max(first, Date.parse(segment.start)),
            b = Math.min(last, Date.parse(segment.end));
          if (b <= a) continue;
          milliseconds += b - a;
          night +=
            Math.max(0, Math.min(b, bounds.nightEnd.getTime()) - a) +
            Math.max(0, b - Math.max(a, bounds.nightStart.getTime()));
          firstUse = Math.min(firstUse ?? a, a);
          lastUse = Math.max(lastUse ?? b, b);
        }
        const launches = id
          ? batch.launches.filter(
              (l) =>
                l.applicationId === id &&
                Date.parse(l.at) >= first &&
                Date.parse(l.at) < last,
            ).length
          : 0;
        const complete =
          batch.appKnown &&
          !batch.issues.some((i) =>
            [
              'event_limit',
              'device_restart',
              'stream_unavailable',
              'activity_identity_unavailable',
              'window_limit',
            ].includes(i),
          );
        const coverage = (id ? complete : batch.screenKnown)
          ? part.milliseconds
          : 0;
        await manager.query(
          `INSERT INTO application_days ("deviceId","applicationId","localDate",timezone,"durationMs","lateNightMs","coverageMs","observedLaunches","launchesComplete","firstUse","lastUse") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT ("deviceId","applicationId","localDate",timezone) DO UPDATE SET "durationMs"=application_days."durationMs"+EXCLUDED."durationMs","lateNightMs"=application_days."lateNightMs"+EXCLUDED."lateNightMs","coverageMs"=application_days."coverageMs"+EXCLUDED."coverageMs","observedLaunches"=application_days."observedLaunches"+EXCLUDED."observedLaunches","launchesComplete"=application_days."launchesComplete" AND EXCLUDED."launchesComplete","firstUse"=LEAST(application_days."firstUse",EXCLUDED."firstUse"),"lastUse"=GREATEST(application_days."lastUse",EXCLUDED."lastUse")`,
          [
            deviceId,
            id,
            part.localDate,
            timezone,
            milliseconds,
            night,
            coverage,
            launches,
            complete,
            firstUse === null ? null : new Date(firstUse),
            lastUse === null ? null : new Date(lastUse),
          ],
        );
      }
    }
  }
  private async owner(
    manager: EntityManager,
    userId: string,
    workspaceId: string,
    deviceId: string,
  ) {
    await workspacePolicy(
      manager,
      userId,
      workspaceId,
      WorkspacePermission.READ,
    );
    const device = await manager.findOneBy(RegisteredDevice, {
      id: deviceId,
      workspaceId,
      registeredById: userId,
    });
    if (!device)
      throw new ForbiddenException(
        'Only the installation owner can correct application classifications.',
      );
    return (
      (await manager.findOneBy(ApplicationCatalog, { deviceId })) ??
      manager.create(ApplicationCatalog, {
        deviceId,
        applications: [],
        categories: [],
        overrides: {},
      })
    );
  }
  category(
    userId: string,
    workspaceId: string,
    deviceId: string,
    name: string,
    remove?: string,
  ) {
    return this.source.transaction(async (manager) => {
      const catalog = await this.owner(manager, userId, workspaceId, deviceId);
      if (remove) {
        catalog.categories = catalog.categories.filter((c) => c.id !== remove);
        catalog.overrides = Object.fromEntries(
          Object.entries(catalog.overrides).filter(([, id]) => id !== remove),
        );
      } else {
        if (
          catalog.categories.length >= 20 ||
          catalog.categories.some(
            (c) => c.name.toLowerCase() === name.trim().toLowerCase(),
          )
        )
          throw new ConflictException(
            'Category already exists or the twenty-category limit was reached.',
          );
        catalog.categories.push({ id: randomUUID(), name: name.trim() });
      }
      return manager.save(catalog);
    });
  }
  correction(
    userId: string,
    workspaceId: string,
    deviceId: string,
    applicationId: string,
    categoryId: string | null,
  ) {
    return this.source.transaction(async (manager) => {
      const catalog = await this.owner(manager, userId, workspaceId, deviceId);
      if (!catalog.applications.some((a) => a.applicationId === applicationId))
        throw new ForbiddenException(
          'Application has not been observed in this catalog.',
        );
      if (categoryId === null) delete catalog.overrides[applicationId];
      else {
        if (
          !builtinCategories.includes(categoryId) &&
          !catalog.categories.some((c) => c.id === categoryId)
        )
          throw new BadRequestException('Choose a known category.');
        catalog.overrides[applicationId] = categoryId;
      }
      return manager.save(catalog);
    });
  }
  report(
    userId: string,
    workspaceId: string,
    query: ApplicationQuery,
    exporting = false,
  ) {
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      const { workspace } = await reportDevices(
        manager,
        userId,
        workspaceId,
        query.deviceId,
        exporting,
      );
      const first = Date.parse(query.from + 'T00:00:00Z'),
        last = Date.parse(query.to + 'T00:00:00Z');
      if (
        !Number.isFinite(first) ||
        !Number.isFinite(last) ||
        last <= first ||
        last - first > 366 * 86400000 ||
        new Date(first).toISOString().slice(0, 10) !== query.from ||
        new Date(last).toISOString().slice(0, 10) !== query.to
      )
        throw new BadRequestException(
          'Choose valid local dates with an exclusive end, spanning at most 366 days.',
        );
      const prior = new Date(first - (last - first)).toISOString().slice(0, 10);
      const catalog =
        (await manager.findOneBy(ApplicationCatalog, {
          deviceId: query.deviceId,
        })) ??
        manager.create(ApplicationCatalog, {
          deviceId: query.deviceId,
          applications: [],
          categories: [],
          overrides: {},
        });
      const rows = await manager.find(ApplicationDay, {
        where: {
          deviceId: query.deviceId,
          timezone: workspace.timezone,
          localDate: Between(prior, query.to),
        },
        order: { localDate: 'ASC' },
        take: 10001,
      });
      if (rows.length > 10000)
        throw new BadRequestException('Narrow the application report.');
      const metadata = (id: string) => {
        const app = catalog.applications.find(
          (a) => a.applicationId === id,
        ) ?? { applicationId: id, label: null, platformCategory: 'unknown' };
        return { ...app, ...classification(app, catalog) };
      };
      const accepts = (id: string) =>
        id !== '' &&
        (!query.applicationId || id === query.applicationId) &&
        (!query.categoryId || metadata(id).categoryId === query.categoryId);
      const selected = rows.filter(
        (r) =>
          r.localDate >= query.from &&
          r.localDate < query.to &&
          accepts(r.applicationId),
      );
      const preceding = rows.filter(
        (r) =>
          r.localDate >= prior &&
          r.localDate < query.from &&
          accepts(r.applicationId),
      );
      const apps = [...new Set(selected.map((r) => r.applicationId))]
        .sort()
        .map((id) => {
          const own = selected.filter((r) => r.applicationId === id),
            before = preceding.filter((r) => r.applicationId === id);
          const seconds = own.reduce(
              (sum, r) => sum + Number(r.durationMs) / 1000,
              0,
            ),
            previous = before.length
              ? before.reduce((sum, r) => sum + Number(r.durationMs) / 1000, 0)
              : null;
          return {
            ...metadata(id),
            seconds,
            previousSeconds: previous,
            observedLaunches: own.reduce(
              (sum, r) => sum + r.observedLaunches,
              0,
            ),
            launchCount: own.every((r) => r.launchesComplete)
              ? own.reduce((sum, r) => sum + r.observedLaunches, 0)
              : null,
            firstUse:
              own
                .map((r) => r.firstUse)
                .filter((d) => d !== null)
                .sort((a, b) => a.getTime() - b.getTime())[0] ?? null,
            lastUse:
              own
                .map((r) => r.lastUse)
                .filter((d) => d !== null)
                .sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
            lateNightSeconds: own.reduce(
              (sum, r) => sum + Number(r.lateNightMs) / 1000,
              0,
            ),
            quality: 'estimated',
          };
        });
      const screen = rows.filter(
        (r) =>
          r.applicationId === '' &&
          r.localDate >= query.from &&
          r.localDate < query.to,
      );
      const days: { date: string; bucket: string; duration: number }[] =
        await manager.query(
          `SELECT d::date::text AS date,date_trunc($4,d)::date::text AS bucket,EXTRACT(EPOCH FROM (((d+interval '1 day') AT TIME ZONE $3)-(d AT TIME ZONE $3)))*1000 AS duration FROM generate_series($1::date::timestamp,($2::date-1)::timestamp,interval '1 day') d`,
          [query.from, query.to, workspace.timezone, query.period ?? 'day'],
        );
      const trends = [...new Set(days.map((d) => d.bucket))].map((bucket) => {
        const dates = days
            .filter((d) => d.bucket === bucket)
            .map((d) => d.date),
          part = selected.filter((r) => dates.includes(r.localDate)),
          screens = screen.filter((r) => dates.includes(r.localDate));
        const expectedMs = days
            .filter((d) => d.bucket === bucket)
            .reduce((sum, d) => sum + Number(d.duration), 0),
          coverageMs = Math.min(
            expectedMs,
            screens.reduce((sum, r) => sum + Number(r.coverageMs), 0),
          );
        return {
          periodStart: bucket,
          foregroundSeconds: part.length
            ? part.reduce((sum, r) => sum + Number(r.durationMs) / 1000, 0)
            : null,
          screenSeconds:
            screens.length && coverageMs > 0
              ? screens.reduce((sum, r) => sum + Number(r.durationMs) / 1000, 0)
              : null,
          screenLateNightSeconds:
            screens.length && coverageMs > 0
              ? screens.reduce(
                  (sum, r) => sum + Number(r.lateNightMs) / 1000,
                  0,
                )
              : null,
          expectedMs,
          coverageMs,
          missingMs: expectedMs - coverageMs,
        };
      });
      const categories = [...new Set(apps.map((a) => a.categoryId))].map(
        (id) => ({
          id,
          name: apps.find((a) => a.categoryId === id)!.category,
          seconds: apps
            .filter((a) => a.categoryId === id)
            .reduce((sum, a) => sum + a.seconds, 0),
        }),
      );
      const timeline =
        last - first <= 7 * 86400000
          ? await manager
              .getRepository(ApplicationWindow)
              .createQueryBuilder('w')
              .where(
                'w."deviceId"=:id AND w."intervalStart" < (:to::date::timestamp AT TIME ZONE :tz) AND w."intervalEnd" > (:from::date::timestamp AT TIME ZONE :tz)',
                {
                  id: query.deviceId,
                  from: query.from,
                  to: query.to,
                  tz: workspace.timezone,
                },
              )
              .orderBy('w."intervalStart"', 'ASC')
              .take(501)
              .getMany()
          : [];
      if (timeline.length > 500)
        throw new BadRequestException(
          'Narrow the timeline to at most 500 observation windows.',
        );
      const rules = await manager.findBy(AlertRule, {
        userId,
        workspaceId,
        deviceId: query.deviceId,
      });
      const limits = [];
      for (const rule of rules.filter(
        (r) =>
          r.config.enabled &&
          r.config.kind === 'threshold' &&
          ['screen_time_seconds', 'application_foreground_seconds'].includes(
            r.config.metric ?? '',
          ),
      )) {
        const [bounds] = await manager.query(
          `SELECT date_trunc($1,now() AT TIME ZONE $2)::date::text AS first,(date_trunc($1,now() AT TIME ZONE $2)+('1 '||$1)::interval)::date::text AS last`,
          [rule.config.period, workspace.timezone],
        );
        const [total] = await manager.query(
          `SELECT sum(value)::text AS value FROM daily_usage WHERE "deviceId"=$1 AND metric=$2 AND "applicationId"=$3 AND quality=$4 AND "localDate">=$5 AND "localDate"<$6`,
          [
            query.deviceId,
            rule.config.metric,
            rule.config.applicationId ?? '',
            rule.config.quality ?? 'measured',
            bounds.first,
            bounds.last,
          ],
        );
        limits.push({
          id: rule.id,
          metric: rule.config.metric,
          applicationId: rule.config.applicationId ?? null,
          period: rule.config.period,
          quality: rule.config.quality ?? 'measured',
          threshold: rule.config.threshold,
          observedValue: total.value,
          percent:
            total.value === null
              ? null
              : (Number(total.value) * 100) / rule.config.threshold,
        });
      }
      const [range]: { first: Date; last: Date }[] = await manager.query(
        'SELECT ($1::date::timestamp AT TIME ZONE $3) AS first,($2::date::timestamp AT TIME ZONE $3) AS last',
        [query.from, query.to, workspace.timezone],
      );
      const clip = (segments: AppBatch['screen']) =>
        segments
          .map((s) => ({
            start: new Date(
              Math.max(Date.parse(s.start), range.first.getTime()),
            ).toISOString(),
            end: new Date(
              Math.min(Date.parse(s.end), range.last.getTime()),
            ).toISOString(),
          }))
          .filter((s) => s.end > s.start);
      const report = {
        deviceId: query.deviceId,
        timezone: workspace.timezone,
        from: query.from,
        to: query.to,
        period: query.period ?? 'day',
        applications: apps,
        categories,
        customCategories: catalog.categories,
        builtinCategories,
        trends,
        limits,
        timeline: timeline.map((w) => ({
          batchId: w.batchId,
          intervalStart: w.intervalStart,
          intervalEnd: w.intervalEnd,
          screenKnown: w.payload.screenKnown,
          appKnown: w.payload.appKnown,
          issues: w.payload.issues,
          sessions: (w.payload.sessions as AppBatch['sessions'])
            .filter((s) => accepts(s.applicationId))
            .flatMap((s) =>
              clip([s]).map((part) => ({
                ...part,
                applicationId: s.applicationId,
              })),
            ),
          screen:
            query.applicationId || query.categoryId
              ? []
              : clip(w.payload.screen as AppBatch['screen']),
        })),
        comparison: {
          from: prior,
          to: query.from,
          currentSeconds: selected.length
            ? apps.reduce((sum, a) => sum + a.seconds, 0)
            : null,
          previousSeconds: preceding.length
            ? preceding.reduce((sum, r) => sum + Number(r.durationMs) / 1000, 0)
            : null,
          percentChange: null,
        },
        insights: applicationInsights(apps),
        qualityNote:
          'Device-reported estimated event history. Counts are observed foreground entries, not cold starts; null means incomplete context. First/last use refer only to observed segments in this range. App/category foreground can overlap in multi-window mode and must not be summed as screen time. Comparisons have no percentage claim when completeness differs. Late night is 22:00–06:00 in workspace time. Category corrections apply at report time. Daily rows from a former workspace timezone are excluded rather than reinterpreted. Timeline detail is limited to seven days and raw retention.',
      };
      if (!exporting) return report;
      const headers = [
        'applicationId',
        'label',
        'category',
        'confidence',
        'seconds',
        'previousSeconds',
        'observedLaunches',
        'launchCount',
        'firstUse',
        'lastUse',
        'lateNightSeconds',
        'quality',
      ];
      return {
        fileName: 'netsentry-applications.csv',
        contentType: 'text/csv',
        content: [
          headers.map(csvCell).join(','),
          ...apps.map((a) =>
            headers
              .map((h) =>
                csvCell(
                  (a as Record<string, unknown>)[h] instanceof Date
                    ? ((a as Record<string, unknown>)[h] as Date).toISOString()
                    : ((a as Record<string, unknown>)[h] as
                        string | number | null),
                ),
              )
              .join(','),
          ),
        ].join('\r\n'),
      };
    });
  }
}
