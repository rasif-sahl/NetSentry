import { BadRequestException, ConflictException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { NetworkSnapshotDto } from './dto/network.dto';
import { NetworkRouter, NetworkSample } from './network.entities';
import { recordNetworkEvent } from './network-events';
import { counter } from './network-values';

export async function recordRouterSample(
  manager: EntityManager,
  networkId: string,
  agentId: string,
  snapshotId: string,
  observed: Date,
  value: NonNullable<NetworkSnapshotDto['router']>,
) {
  const router = await manager.findOneBy(NetworkRouter, {
    id: value.routerId,
    networkId,
    agentId,
  });
  if (!router || router.revision !== value.revision)
    throw new ConflictException('Router source/revision changed.');
  const rx = counter(value.rxBytes);
  const tx = counter(value.txBytes);
  if (
    (rx === null) !== (tx === null) ||
    (value.status !== 'ok' &&
      (rx !== null ||
        tx !== null ||
        value.wanUp !== null ||
        value.uptimeSeconds !== null))
  )
    throw new BadRequestException(
      'Unavailable router data cannot contain active counters/state.',
    );
  if ((await manager.countBy(NetworkSample, { routerId: router.id })) >= 100000)
    throw new BadRequestException(
      'Router history capacity reached; run retention.',
    );
  const previous = await manager.findOne(NetworkSample, {
    where: { routerId: router.id },
    order: { observedAt: 'DESC' },
  });
  if (previous && observed <= previous.observedAt)
    throw new ConflictException(
      'Router time must advance across sources and revisions.',
    );
  let quality = 'unavailable',
    rxDelta: string | null = null,
    txDelta: string | null = null,
    intervalStart: Date | null = null;
  if (rx !== null && tx !== null) {
    quality = 'baseline';
    if (
      previous &&
      previous.agentId === agentId &&
      previous.revision === router.revision &&
      previous.rxBytes !== null &&
      previous.txBytes !== null
    ) {
      const gap = observed.getTime() - previous.observedAt.getTime();
      if (gap <= 0)
        throw new ConflictException('Router source time did not advance.');
      if (
        rx < BigInt(previous.rxBytes) ||
        tx < BigInt(previous.txBytes) ||
        (value.uptimeSeconds !== null &&
          previous.uptimeSeconds !== null &&
          BigInt(value.uptimeSeconds) < BigInt(previous.uptimeSeconds))
      ) {
        quality = 'counter_reset';
        await recordNetworkEvent(
          manager,
          networkId,
          'router_counter_reset',
          'info',
          agentId,
          null,
          null,
          observed,
        );
      } else if (gap > 300000) quality = 'gap';
      else {
        quality = 'measured';
        intervalStart = previous.observedAt;
        rxDelta = (rx - BigInt(previous.rxBytes)).toString();
        txDelta = (tx - BigInt(previous.txBytes)).toString();
      }
    }
  }
  await manager.save(
    manager.create(NetworkSample, {
      routerId: router.id,
      agentId,
      snapshotId,
      revision: router.revision,
      observedAt: observed,
      status: value.status,
      wanUp: value.wanUp,
      uptimeSeconds: value.uptimeSeconds,
      rxBytes: value.rxBytes,
      txBytes: value.txBytes,
      rxDelta,
      txDelta,
      intervalStart,
      quality,
    }),
  );
  if (previous?.status !== value.status) {
    await recordNetworkEvent(
      manager,
      networkId,
      value.status === 'ok'
        ? 'router_recovered'
        : value.status === 'auth_failed'
          ? 'router_auth_failed'
          : 'router_unavailable',
      value.status === 'ok' ? 'info' : 'warning',
      agentId,
      null,
      null,
      observed,
    );
  }
  if (previous?.wanUp === true && value.wanUp === false)
    await recordNetworkEvent(
      manager,
      networkId,
      'wan_interface_down',
      'warning',
      agentId,
      null,
      null,
      observed,
    );
  router.reportedModel = value.model;
  router.reportedFirmware = value.firmware;
  if (
    value.testRequestId &&
    value.testRequestId === router.testRequestId &&
    router.testStatus === 'pending' &&
    router.testRequestedAt &&
    Date.now() - router.testRequestedAt.getTime() <= 90000
  )
    router.testStatus = value.status === 'ok' ? 'succeeded' : 'failed';
  await manager.save(router);
}
