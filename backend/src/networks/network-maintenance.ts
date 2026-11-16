import { DataSource } from 'typeorm';
import { Workspace } from '../workspaces/workspace.entity';
import { NetworkCollector, NetworkEvent } from './network.entities';
export async function maintainNetworks(
  source: DataSource,
  workspaceId: string,
  now = new Date(),
) {
  return source.transaction(async (m) => {
    await m.findOneOrFail(Workspace, {
      where: { id: workspaceId },
      lock: { mode: 'pessimistic_write' },
    });
    const collectors = await m.query(
      `SELECT c.*,a.state,a.generation AS "currentGeneration",a.modules FROM network_collectors c JOIN agents a ON a.id=c."agentId" JOIN users u ON u.id=a."userId" JOIN memberships m ON m."userId"=a."userId" AND m."workspaceId"=a."workspaceId" WHERE a."workspaceId"=$1 AND u.status='ACTIVE' AND u."emailVerifiedAt" IS NOT NULL AND m.role IN ('OWNER','ADMIN')`,
      [workspaceId],
    );
    for (const c of collectors) {
      if (
        c.enabled &&
        c.state === 'ACTIVE' &&
        c.generation === c.currentGeneration &&
        c.modules.network &&
        (!c.observedAt ||
          now.getTime() - new Date(c.observedAt).getTime() > 150000) &&
        c.health !== 'not_reporting'
      ) {
        await m.save(
          m.create(NetworkEvent, {
            networkId: c.networkId,
            agentId: c.agentId,
            endpointId: null,
            actorId: null,
            kind: 'collector_not_reporting',
            severity: 'warning',
            occurredAt: now,
            acknowledgedAt: null,
          }),
        );
        await m.update(
          NetworkCollector,
          { agentId: c.agentId },
          { health: 'not_reporting', interfaces: [] },
        );
      }
    }
    const removed: Record<string, number> = {};
    for (const table of [
      'network_events',
      'network_samples',
      'network_presence',
    ]) {
      const scope =
        table !== 'network_samples'
          ? '"networkId" IN (SELECT p."networkId" FROM network_profiles p JOIN usage_networks n ON n.id=p."networkId" WHERE n."workspaceId"=$1)'
          : '"routerId" IN (SELECT r.id FROM network_routers r JOIN usage_networks n ON n.id=r."networkId" WHERE n."workspaceId"=$1)';
      const column =
        table === 'network_events'
          ? 'occurredAt'
          : table === 'network_presence'
            ? 'lastObservedAt'
            : 'observedAt';
      const result = await m.query(
        `DELETE FROM ${table} WHERE id IN (SELECT id FROM ${table} WHERE ${scope} AND "${column}"<$2 ORDER BY id LIMIT 1000) RETURNING id`,
        [workspaceId, new Date(now.getTime() - 30 * 86400000)],
      );
      removed[table] = Array.isArray(result[0])
        ? result[0].length
        : result.length;
    }
    return removed;
  });
}
