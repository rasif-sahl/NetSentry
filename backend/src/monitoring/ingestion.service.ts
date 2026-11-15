import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RegisteredDevice } from '../workspaces/registered-device.entity';
import { workspacePolicy } from '../workspaces/workspace-policy';
import { WorkspacePermission } from '../workspaces/workspace-access.service';
import { DeviceEvent } from '../devices/device-event.entity';
import { disclosures } from '../devices/disclosures';
import { aggregate } from './aggregate';
import {
  CollectionGap,
  DeviceUsageNetwork,
  Measurement,
  MeasurementReceipt,
  MonitoringRun,
  RetentionPolicy,
  SyncBatch,
} from './entities';
import { metrics, type Metric, fingerprint } from './values';
import { validateBatch } from './validation';

@Injectable()
export class IngestionService {
  constructor(private readonly source: DataSource) {}
  async ingest(authenticated: RegisteredDevice, input: unknown) {
    validateBatch(input);
    return this.source.transaction(async (manager) => {
      const { workspace } = await workspacePolicy(
        manager,
        authenticated.registeredById,
        authenticated.workspaceId,
        WorkspacePermission.REGISTER_DEVICE,
      );
      const device = await manager
        .getRepository(RegisteredDevice)
        .createQueryBuilder('d')
        .addSelect('d.credentialHash')
        .where('d.id=:id', { id: authenticated.id })
        .setLock('pessimistic_write')
        .getOneOrFail();
      if (
        device.state !== 'ACTIVE' ||
        device.credentialHash !== authenticated.credentialHash
      )
        throw new ForbiddenException('Device credentials were revoked.');
      if (device.generation !== input.generation)
        throw new ConflictException(
          'Refresh device configuration before retrying.',
        );
      if (!device.monitoringEnabled || device.permissionStatus !== 'granted')
        throw new ForbiddenException(
          'Monitoring consent and permission are required.',
        );
      const consent = await manager.findOneBy(DeviceEvent, {
        deviceId: device.id,
        generation: device.generation,
        kind: 'consent_granted',
      });
      if (
        !consent ||
        consent.details.disclosureVersion !== disclosures.monitoring.version
      )
        throw new ForbiddenException(
          'Accept the current monitoring disclosure.',
        );
      const previous = await manager.findOneBy(SyncBatch, {
        deviceId: device.id,
        batchId: input.batchId,
      });
      const payloadHash = fingerprint(input);
      if (previous) {
        if (previous.payloadHash !== payloadHash)
          throw new ConflictException(
            'Batch identifier was reused with different content.',
          );
        return {
          batchId: input.batchId,
          accepted: 0,
          duplicates: input.events.length,
          gaps: 0,
          replayed: true,
        };
      }
      let policy = await manager.findOneBy(RetentionPolicy, {
        workspaceId: workspace.id,
      });
      policy ??= await manager.save(
        manager.create(RetentionPolicy, { workspaceId: workspace.id }),
      );
      const network = await manager.findOneBy(DeviceUsageNetwork, {
        deviceId: device.id,
      });
      const now = Date.now();
      const validateInterval = (
        metric: string,
        app: string | undefined,
        start: string,
        end: string,
      ) => {
        const definition = metrics[metric as Metric];
        const first = Date.parse(start),
          last = Date.parse(end);
        if (!definition || !device.consentScopes.includes(definition.scope))
          throw new ForbiddenException('Metric is outside granted consent.');
        if ((metric === 'application_foreground_seconds') !== Boolean(app))
          throw new BadRequestException(
            'Application identifier does not match the metric.',
          );
        if (
          first >= last ||
          last - first > 26 * 3600000 ||
          last > now ||
          first < now - policy.rawDays * 86400000 ||
          first <
            Math.max(
              consent.createdAt.getTime(),
              device.enrolledAt!.getTime(),
            ) ||
          !/\.\d{3}Z$/.test(start) ||
          !/\.\d{3}Z$/.test(end)
        )
          throw new BadRequestException(
            'Interval must use millisecond UTC precision within consent and retention bounds.',
          );
        return { definition, first, last };
      };
      let accepted = 0,
        duplicates = 0,
        gaps = 0;
      for (const item of input.events) {
        if (item.workspaceId !== workspace.id || item.deviceId !== device.id)
          throw new ForbiddenException(
            'Observation belongs to another device or workspace.',
          );
        const { definition, first, last } = validateInterval(
          item.metric,
          item.applicationId,
          item.intervalStart,
          item.intervalEnd,
        );
        const capabilities = device.capabilityReport?.capabilities as
          | {
              id: string;
              status: string;
              source: string;
              checkedAt: string;
              availableActions: string[];
            }[]
          | undefined;
        const capability = capabilities?.find(
          (c) => c.id === definition.capability,
        );
        if (
          !capability ||
          capability.status !== 'supported' ||
          capability.source !== 'os' ||
          !capability.availableActions.includes('measure') ||
          Date.parse(capability.checkedAt) < now - 86400000
        )
          throw new ForbiddenException(
            'A fresh supported OS measurement capability is required.',
          );
        if (
          item.source.kind !== device.platform.toLowerCase() ||
          item.source.collectorVersion.length > 100
        )
          throw new ForbiddenException(
            'Collector source is not authorized for this device.',
          );
        if (
          item.unit !== definition.unit ||
          (item.unit === 'seconds' &&
            !Number.isSafeInteger(item.value * 1000000)) ||
          (item.unit === 'bytes' && !Number.isSafeInteger(item.value)) ||
          (item.unit === 'seconds' && item.value > (last - first) / 1000) ||
          Date.parse(item.collectedAt) < last ||
          Date.parse(item.collectedAt) > now + 300000
        )
          throw new BadRequestException(
            'Observation value, unit or collection time is invalid.',
          );
        const hash = fingerprint(item);
        const receipt = await manager.findOneBy(MeasurementReceipt, {
          deviceId: device.id,
          eventId: item.eventId,
        });
        if (receipt) {
          if (receipt.payloadHash !== hash)
            throw new ConflictException(
              'Event identifier was reused with different content.',
            );
          duplicates++;
          continue;
        }
        const overlaps = await manager
          .getRepository(Measurement)
          .createQueryBuilder('m')
          .where(
            'm.deviceId=:id AND m.metric=:metric AND m.applicationId=:app AND m.quality=:quality AND m."intervalStart" < :end AND m."intervalEnd" > :start',
            {
              id: device.id,
              metric: item.metric,
              app: item.applicationId ?? '',
              quality: item.quality,
              start: item.intervalStart,
              end: item.intervalEnd,
            },
          )
          .getExists();
        if (overlaps)
          throw new ConflictException(
            'Observation overlaps an existing interval.',
          );
        const event = await manager.save(
          manager.create(Measurement, {
            eventId: item.eventId,
            workspaceId: workspace.id,
            deviceId: device.id,
            networkId: network?.networkId ?? null,
            generation: device.generation,
            metric: item.metric,
            applicationId: item.applicationId ?? '',
            quality: item.quality,
            sourceKind: item.source.kind,
            collectorVersion: item.source.collectorVersion,
            value: item.value.toFixed(6),
            unit: item.unit,
            intervalStart: new Date(first),
            intervalEnd: new Date(last),
            collectedAt: new Date(item.collectedAt),
          }),
        );
        await aggregate(manager, event, workspace.timezone);
        await manager.save(
          manager.create(MeasurementReceipt, {
            deviceId: device.id,
            eventId: item.eventId,
            payloadHash: hash,
          }),
        );
        accepted++;
      }
      for (const gap of input.gaps) {
        validateInterval(
          gap.metric,
          gap.applicationId,
          gap.intervalStart,
          gap.intervalEnd,
        );
        const hash = fingerprint(gap),
          old = await manager.findOneBy(CollectionGap, {
            deviceId: device.id,
            gapId: gap.gapId,
          });
        if (old) {
          if (old.payloadHash !== hash)
            throw new ConflictException('Gap identifier was reused.');
          continue;
        }
        await manager.save(
          manager.create(CollectionGap, {
            ...gap,
            intervalStart: new Date(gap.intervalStart),
            intervalEnd: new Date(gap.intervalEnd),
            applicationId: gap.applicationId ?? '',
            workspaceId: workspace.id,
            deviceId: device.id,
            networkId: network?.networkId ?? null,
            generation: device.generation,
            payloadHash: hash,
          }),
        );
        gaps++;
      }
      await manager.save(
        manager.create(SyncBatch, {
          deviceId: device.id,
          batchId: input.batchId,
          payloadHash,
        }),
      );
      await manager.save(
        manager.create(MonitoringRun, {
          workspaceId: workspace.id,
          deviceId: device.id,
          kind: 'ingestion',
          status: 'succeeded',
          errorCode: null,
        }),
      );
      return {
        batchId: input.batchId,
        accepted,
        duplicates,
        gaps,
        replayed: false,
      };
    });
  }
}
