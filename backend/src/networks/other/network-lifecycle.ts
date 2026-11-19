import type { EntityManager } from 'typeorm';
import {
  NetworkPresence,
  NetworkCollector,
  NetworkRouter,
  NetworkSighting,
  NetworkSample,
  NetworkEvent,
} from '../entity/network.entities';
export async function eraseNetworkAgent(
  manager: EntityManager,
  agentId: string,
) {
  await manager.delete(NetworkPresence, { agentId });
  await manager.delete(NetworkCollector, { agentId });
  await manager.delete(NetworkSighting, { agentId });
  await manager.delete(NetworkSample, { agentId });
  await manager.delete(NetworkEvent, { agentId });
  await manager.update(
    NetworkRouter,
    { agentId },
    {
      agentId: null,
      encryptedCredentials: null,
      testStatus: 'not_tested',
      testRequestId: null,
      testRequestedAt: null,
    },
  );
  const result = await manager.query(
    `UPDATE network_endpoints SET "sourceAgentIds"="sourceAgentIds"-$1 WHERE "sourceAgentIds" ? $1 RETURNING id`,
    [agentId],
  );
  const rows: { id: string }[] = Array.isArray(result[0]) ? result[0] : result;
  for (const row of rows)
    await manager.query(
      `DELETE FROM network_endpoints WHERE id=$1 AND "sourceAgentIds"='[]'::jsonb`,
      [row.id],
    );
}
