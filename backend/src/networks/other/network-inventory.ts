import { BadRequestException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { NetworkSnapshotDto } from './dto/network.dto';
import {
  NetworkEndpoint,
  NetworkPresence,
  NetworkSighting,
} from '../entity/network.entities';
import { recordNetworkEvent } from './network-events';
import { contains } from './network-values';

export async function recordNeighborObservations(
  manager: EntityManager,
  networkId: string,
  agentId: string,
  cidrs: string[],
  observed: Date,
  neighbors: NetworkSnapshotDto['neighbors'],
) {
  if (new Set(neighbors.map((n) => n.address)).size !== neighbors.length)
    throw new BadRequestException(
      'Neighbor addresses must be unique per source snapshot.',
    );
  for (const neighbor of neighbors) {
    if (
      !contains(cidrs, neighbor.address) ||
      neighbor.mac === '00:00:00:00:00:00' ||
      neighbor.mac === 'ff:ff:ff:ff:ff:ff' ||
      (neighbor.mac !== null &&
        (parseInt(neighbor.mac.slice(0, 2), 16) & 1) !== 0)
    )
      throw new BadRequestException(
        'Neighbor identity is outside supported unicast scope.',
      );
    const identity = neighbor.mac
      ? `mac:${neighbor.mac}`
      : `source:${agentId}:${neighbor.address}`;
    let endpoint = await manager
      .getRepository(NetworkEndpoint)
      .createQueryBuilder('e')
      .addSelect('e.identity')
      .where('e."networkId"=:network AND e.identity=:identity', {
        network: networkId,
        identity,
      })
      .getOne();
    if (!endpoint) {
      if ((await manager.countBy(NetworkEndpoint, { networkId })) >= 2000)
        throw new BadRequestException('Network endpoint capacity reached.');
      endpoint = await manager.save(
        manager.create(NetworkEndpoint, {
          networkId,
          identity,
          mac: neighbor.mac,
          sourceAgentIds: [agentId],
          firstSeenAt: observed,
          lastSeenAt: observed,
          name: '',
          notes: '',
          category: 'unknown',
          trust: 'unknown',
          archived: false,
          assignedUserId: null,
          registeredDeviceId: null,
        }),
      );
      await recordNetworkEvent(
        manager,
        networkId,
        'new_endpoint',
        'warning',
        agentId,
        endpoint.id,
        null,
        observed,
      );
    } else {
      if (!endpoint.sourceAgentIds.includes(agentId))
        endpoint.sourceAgentIds.push(agentId);
      if (endpoint.sourceAgentIds.length > 20)
        throw new BadRequestException('Endpoint source limit reached.');
      if (endpoint.lastSeenAt < observed) endpoint.lastSeenAt = observed;
      await manager.save(endpoint);
    }
    const old = await manager.findOneBy(NetworkSighting, {
      agentId,
      endpointId: endpoint.id,
    });
    if (old && old.address !== neighbor.address)
      await recordNetworkEvent(
        manager,
        networkId,
        'address_changed',
        'info',
        agentId,
        endpoint.id,
        null,
        observed,
      );
    const conflict = await manager
      .getRepository(NetworkSighting)
      .createQueryBuilder('s')
      .innerJoin(NetworkEndpoint, 'e', 'e.id=s."endpointId"')
      .where(
        'e."networkId"=:network AND s.address=:address AND s."endpointId"<>:endpoint AND s."observedAt">:fresh',
        {
          network: networkId,
          address: neighbor.address,
          endpoint: endpoint.id,
          fresh: new Date(Date.now() - 120000),
        },
      )
      .getExists();
    if (conflict)
      await recordNetworkEvent(
        manager,
        networkId,
        'conflicting_address_observations',
        'warning',
        agentId,
        endpoint.id,
        null,
        observed,
      );
    const previousPresence = await manager.findOne(NetworkPresence, {
      where: { agentId, endpointId: endpoint.id },
      order: { lastObservedAt: 'DESC' },
    });
    if (
      previousPresence &&
      previousPresence.address === neighbor.address &&
      observed.getTime() - previousPresence.lastObservedAt.getTime() <= 120000
    ) {
      previousPresence.lastObservedAt = observed;
      previousPresence.evidence = neighbor.evidence;
      await manager.save(previousPresence);
    } else {
      if ((await manager.countBy(NetworkPresence, { networkId })) >= 100000)
        throw new BadRequestException(
          'Presence history capacity reached; run retention.',
        );
      await manager.save(
        manager.create(NetworkPresence, {
          networkId,
          agentId,
          endpointId: endpoint.id,
          address: neighbor.address,
          evidence: neighbor.evidence,
          firstObservedAt: observed,
          lastObservedAt: observed,
        }),
      );
    }
    await manager.upsert(
      NetworkSighting,
      {
        agentId,
        endpointId: endpoint.id,
        address: neighbor.address,
        evidence: neighbor.evidence,
        observedAt: observed,
      },
      ['agentId', 'endpointId'],
    );
  }
}
