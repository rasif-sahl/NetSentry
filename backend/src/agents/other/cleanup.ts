import { DataSource } from 'typeorm';
import { Workspace } from '../../workspaces/entity/workspace.entity';
export async function cleanupAgents(
  source: DataSource,
  workspaceId: string,
  now = new Date(),
) {
  return source.transaction(async (manager) => {
    await manager.findOneOrFail(Workspace, {
      where: { id: workspaceId },
      lock: { mode: 'pessimistic_write' },
    });
    const events = await manager.query(
      'DELETE FROM agent_events WHERE id IN (SELECT e.id FROM agent_events e JOIN agents a ON a.id=e."agentId" WHERE a."workspaceId"=$1 AND e."receivedAt"<$2 ORDER BY e.id LIMIT 1000) RETURNING id',
      [workspaceId, new Date(now.getTime() - 7 * 86400000)],
    );
    await manager.query(
      'DELETE FROM developer_commands WHERE id IN (SELECT c.id FROM developer_commands c JOIN agents a ON a.id=c."agentId" WHERE a."workspaceId"=$1 AND c."requestedAt"<$2 ORDER BY c.id LIMIT 1000)',
      [workspaceId, new Date(now.getTime() - 7 * 86400000)],
    );
    await manager.query(
      `UPDATE agent_developer SET services='[]'::jsonb, observations='[]'::jsonb, "localControlReady"=false WHERE "agentId" IN (SELECT id FROM agents WHERE "workspaceId"=$1) AND "reportedAt"<$2`,
      [workspaceId, new Date(now.getTime() - 60000)],
    );
    const codes = await manager.query(
      'DELETE FROM agent_enrolments WHERE id IN (SELECT id FROM agent_enrolments WHERE "workspaceId"=$1 AND "expiresAt"<$2 ORDER BY id LIMIT 1000) RETURNING id',
      [workspaceId, now],
    );
    return {
      eventsRemoved: Array.isArray(events[0])
        ? events[0].length
        : events.length,
      codesRemoved: Array.isArray(codes[0]) ? codes[0].length : codes.length,
    };
  });
}
