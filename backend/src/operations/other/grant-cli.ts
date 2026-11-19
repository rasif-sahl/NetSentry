import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { isUUID } from 'class-validator';
import { databaseOptions } from '../../database/options';
import { OperatorGrant, OperatorAudit } from '../entity/operations.entities';
import { User, AccountStatus } from '../../users/entity/user.entity';
import { Workspace } from '../../workspaces/entity/workspace.entity';
async function main() {
  const [userId, role, scopeList, confirmation] = process.argv.slice(2);
  const ids = (scopeList ?? '').split(',').filter(Boolean);
  if (
    !isUUID(userId) ||
    !['SUPPORT', 'BILLING', 'ADMIN'].includes(role) ||
    ids.length > 100 ||
    !ids.every((id) => isUUID(id)) ||
    confirmation !== 'GRANT_FOR_8_HOURS'
  )
    throw new Error(
      'Provide user UUID, SUPPORT/BILLING/ADMIN, comma-separated workspace UUIDs, GRANT_FOR_8_HOURS.',
    );
  const source = await new DataSource(
    databaseOptions({ ...process.env, DB_SYNCHRONIZE: false }),
  ).initialize();
  try {
    await source.transaction(async (m) => {
      const user = await m.findOneBy(User, {
        id: userId,
        status: AccountStatus.ACTIVE,
      });
      if (!user?.emailVerifiedAt)
        throw new Error('Verified active account required.');
      for (const id of ids)
        if (!(await m.existsBy(Workspace, { id })))
          throw new Error('Unknown workspace.');
      await m.save(
        m.create(OperatorGrant, {
          userId,
          role,
          workspaceIds: ids,
          globalAccounts:
            role === 'ADMIN' &&
            process.env.OPS_GRANT_GLOBAL_ACCOUNTS === 'true',
          globalCatalog:
            role === 'ADMIN' && process.env.OPS_GRANT_GLOBAL_CATALOG === 'true',
          expiresAt: new Date(Date.now() + 8 * 3600000),
        }),
      );
      await m.save(
        m.create(OperatorAudit, {
          actorId: null,
          workspaceId: null,
          targetId: userId,
          action: 'operator_granted_by_cli',
        }),
      );
    });
    console.log('Expiring operator grant recorded.');
  } finally {
    await source.destroy();
  }
}
void main().catch(() => {
  console.error(
    'Operator grant failed; validate private configuration and explicit scope.',
  );
  process.exitCode = 1;
});
