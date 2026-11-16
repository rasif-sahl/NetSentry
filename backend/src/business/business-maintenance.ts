import { DataSource } from 'typeorm';
import { Workspace } from '../workspaces/workspace.entity';
export async function maintainBusiness(
  source: DataSource,
  workspaceId: string,
  now = new Date(),
) {
  return source.transaction(async (m) => {
    await m.findOneOrFail(Workspace, {
      where: { id: workspaceId },
      lock: { mode: 'pessimistic_write' },
    });
    const rows = await m.query(
      `DELETE FROM business_audit WHERE id IN (SELECT id FROM business_audit WHERE "workspaceId"=$1 AND "occurredAt"<$2 ORDER BY id LIMIT 1000) RETURNING id`,
      [workspaceId, new Date(now.getTime() - 90 * 86400000)],
    );
    return {
      auditRemoved: Array.isArray(rows[0]) ? rows[0].length : rows.length,
    };
  });
}
