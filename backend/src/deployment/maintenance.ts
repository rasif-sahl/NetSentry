import { DataSource, MoreThan } from 'typeorm';
import { Workspace } from '../workspaces/workspace.entity';
import { DeploymentWorkerState } from './worker-state.entity';
import {
  evaluateWorkspace,
  deliverWorkspace,
} from '../monitoring/alert.service';
import { retainWorkspace } from '../monitoring/retention';
import { recordFailure } from '../monitoring/diagnostics';
import { cleanupAgents } from '../agents/cleanup';
import { maintainNetworks } from '../networks/network-maintenance';
import { maintainFamily } from '../family/family-maintenance';
import { maintainBusiness } from '../business/business-maintenance';
import { maintainOperations } from '../operations/maintenance';
import { cleanupAccountMail } from '../mail/cleanup';
import { checkHistory } from './schema';
export const maintenanceLock = 17949312;
const tasks = [
  ['alert_evaluation', evaluateWorkspace],
  ['delivery', deliverWorkspace],
  ['retention', retainWorkspace],
  ['agents', cleanupAgents],
  ['networks', maintainNetworks],
  ['family', maintainFamily],
  ['business', maintainBusiness],
] as const;
// One bounded batch, with a database cursor and session lock shared by replicas.
// No SMTP/push provider or OS enforcement is activated here.
export async function maintenanceBatch(source: DataSource, limit = 50) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new Error('Invalid batch limit.');
  const lease = source.createQueryRunner();
  await lease.connect();
  let locked = false;
  try {
    locked = (
      await lease.query('SELECT pg_try_advisory_lock($1) AS locked', [
        maintenanceLock,
      ])
    )[0].locked;
    if (!locked) return { status: 'busy', processed: 0, failures: 0 };
    await checkHistory(source);
    const repo = source.getRepository(DeploymentWorkerState);
    await repo
      .createQueryBuilder()
      .insert()
      .values({ name: 'maintenance' })
      .orIgnore()
      .execute();
    const state = await repo.findOneByOrFail({ name: 'maintenance' });
    await repo.update(state.name, {
      status: 'running',
      lastStartedAt: new Date(),
      processed: 0,
      failures: 0,
    });
    let failures = 0,
      processed = 0;
    for (const work of [maintainOperations, cleanupAccountMail]) {
      try {
        await work(source);
      } catch {
        failures++;
      }
    }
    const workspaces = await source
      .getRepository(Workspace)
      .find({
        select: { id: true },
        where: state.cursor ? { id: MoreThan(state.cursor) } : {},
        order: { id: 'ASC' },
        take: limit,
      });
    for (const workspace of workspaces) {
      for (const [kind, work] of tasks) {
        try {
          await work(source, workspace.id);
        } catch {
          failures++;
          await recordFailure(source, workspace.id, kind);
        }
      }
      processed++;
      await repo.update(state.name, {
        cursor: workspace.id,
        processed,
        failures,
      });
    }
    // An empty end-page resets the cursor; deletion of a cursor workspace is safe.
    const cursor = workspaces.length < limit ? null : workspaces.at(-1)!.id;
    await repo.update(state.name, {
      cursor,
      status: failures ? 'failed' : 'ok',
      lastCompletedAt: new Date(),
      ...(failures ? {} : { lastSucceededAt: new Date() }),
      processed,
      failures,
    });
    return { status: failures ? 'failed' : 'ok', processed, failures };
  } finally {
    if (locked)
      await lease
        .query('SELECT pg_advisory_unlock($1)', [maintenanceLock])
        .catch(() => {});
    await lease.release();
  }
}
export async function maintenanceHealth(
  source: DataSource,
  maxAgeSeconds = 300,
) {
  const state = await source
    .getRepository(DeploymentWorkerState)
    .findOneBy({ name: 'maintenance' });
  const now = Date.now();
  const healthy =
    !!state?.lastSucceededAt &&
    state.status !== 'failed' &&
    now - state.lastSucceededAt.getTime() <= maxAgeSeconds * 1000 &&
    (!state.lastStartedAt ||
      state.status !== 'running' ||
      now - state.lastStartedAt.getTime() <= maxAgeSeconds * 1000);
  return {
    healthy,
    status: state?.status ?? 'missing',
    lastCompletedAt: state?.lastCompletedAt ?? null,
    processed: state?.processed ?? 0,
    failures: state?.failures ?? 0,
  };
}
