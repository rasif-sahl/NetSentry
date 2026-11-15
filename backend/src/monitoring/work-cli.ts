import 'reflect-metadata';
import 'dotenv/config';
import { isUUID } from 'class-validator';
import { DataSource } from 'typeorm';
import { databaseOptions } from '../database/options';
import { Workspace } from '../workspaces/workspace.entity';
import { evaluateWorkspace, deliverWorkspace } from './alert.service';
import { retainWorkspace } from './retention';
import { recordFailure } from './diagnostics';
async function main() {
  const id = process.argv[2];
  if (!id || !isUUID(id))
    throw new Error(
      'Supply one workspace UUID. Schedule repeated passes in your deployment.',
    );
  const source = await new DataSource(
    databaseOptions(process.env),
  ).initialize();
  try {
    if (!(await source.manager.existsBy(Workspace, { id })))
      throw new Error('Workspace is unavailable.');
    let failed = false;
    for (const [kind, work] of [
      ['alert_evaluation', evaluateWorkspace],
      ['delivery', deliverWorkspace],
      ['retention', retainWorkspace],
    ] as const) {
      try {
        await work(source, id);
        console.log(`${kind}: completed`);
      } catch {
        failed = true;
        await recordFailure(source, id, kind);
        console.error(`${kind}: failed; inspect monitoring diagnostics`);
      }
    }
    if (failed) process.exitCode = 1;
  } finally {
    await source.destroy();
  }
}
void main().catch(() => {
  console.error(
    'Monitoring worker could not start. Check configuration and the workspace UUID.',
  );
  process.exitCode = 1;
});
