import { DataSource } from 'typeorm';
import { Workspace } from '../workspaces/workspace.entity';
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
    const codes = await manager.query(
      'DELETE FROM agent_enrolments WHERE id IN (SELECT id FROM agent_enrolments WHERE "workspaceId"=$1 AND "expiresAt"<$2 ORDER BY id LIMIT 1000) RETURNING id',
      [workspaceId, now],
    );
    return {
      eventsRemoved: events[1] ?? events.length,
      codesRemoved: codes[1] ?? codes.length,
    };
  });
}
