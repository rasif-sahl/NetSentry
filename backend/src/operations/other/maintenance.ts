import { DataSource } from 'typeorm';
export async function maintainOperations(source: DataSource, now = new Date()) {
  return source.transaction(async (m) => {
    const grants = await m.query(
      'DELETE FROM operator_grants WHERE "userId" IN (SELECT "userId" FROM operator_grants WHERE "expiresAt"<$1 LIMIT 1000) RETURNING "userId"',
      [now],
    );
    const audit = await m.query(
      'DELETE FROM operator_audit WHERE id IN (SELECT id FROM operator_audit WHERE "occurredAt"<$1 ORDER BY id LIMIT 1000) RETURNING id',
      [new Date(now.getTime() - 90 * 86400000)],
    );
    return {
      expiredGrants: Array.isArray(grants[0])
        ? grants[0].length
        : grants.length,
      expiredAudit: Array.isArray(audit[0]) ? audit[0].length : audit.length,
    };
  });
}
