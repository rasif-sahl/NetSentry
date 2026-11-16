import { DataSource } from 'typeorm';
import { Workspace } from '../workspaces/workspace.entity';
export async function maintainFamily(
  source: DataSource,
  workspaceId: string,
  now = new Date(),
) {
  return source.transaction(async (m) => {
    await m.findOneOrFail(Workspace, {
      where: { id: workspaceId },
      lock: { mode: 'pessimistic_write' },
    });
    const removed: Record<string, number> = {};
    for (const [table, column, days] of [
      ['family_requests', 'requestedAt', 30],
      ['family_events', 'occurredAt', 90],
    ] as const) {
      const result = await m.query(
        `DELETE FROM ${table} WHERE id IN (SELECT id FROM ${table} WHERE "profileId" IN (SELECT id FROM family_profiles WHERE "workspaceId"=$1) AND "${column}"<$2 ORDER BY id LIMIT 1000) RETURNING id`,
        [workspaceId, new Date(now.getTime() - days * 86400000)],
      );
      removed[table] = Array.isArray(result[0])
        ? result[0].length
        : result.length;
    }
    return removed;
  });
}
