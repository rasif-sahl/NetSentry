import type { EntityManager } from 'typeorm';
import { NetworkEvent } from '../entity/network.entities';

export async function recordNetworkEvent(
  m: EntityManager,
  networkId: string,
  kind: string,
  severity = 'info',
  agentId: string | null = null,
  endpointId: string | null = null,
  actorId: string | null = null,
  at = new Date(),
) {
  return m.save(
    m.create(NetworkEvent, {
      networkId,
      kind,
      severity,
      agentId,
      endpointId,
      actorId,
      occurredAt: at,
      acknowledgedAt: null,
    }),
  );
}
