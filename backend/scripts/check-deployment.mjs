import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('reflect-metadata');
const { DataSource } = require('typeorm'),
  { databaseOptions } = require('../dist/database/options.js');
const {
  maintenanceBatch,
  maintenanceHealth,
  maintenanceLock,
} = require('../dist/deployment/other/maintenance.js');
const {
  checkSchema,
  checkHistory,
} = require('../dist/deployment/other/schema.js');
const {
  DeploymentWorkerState,
} = require('../dist/deployment/entity/worker-state.entity.js');
const { cleanupAccountMail } = require('../dist/mail/other/cleanup.js');
const url = process.env.TEST_DATABASE_URL;
assert.ok(
  url && new URL(url).pathname.endsWith('_test'),
  'Isolated empty *_test database required.',
);
const source = await new DataSource(
  databaseOptions({ NODE_ENV: 'test', DATABASE_URL: url, DATABASE_SSL: false }),
).initialize();
let installedMigrationCount = 0;
try {
  assert.equal(
    (
      await source.query(
        "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'",
      )
    )[0].n,
    0,
  );
  await assert.rejects(checkHistory(source));
  installedMigrationCount = (await source.runMigrations({ transaction: 'all' }))
    .length;
  await checkSchema(source);
  const [{ id: userId }] = await source.query(
    `INSERT INTO users(email,"displayName","passwordHash") VALUES ('deployment-fixture@example.invalid','Synthetic deployment','not-a-password') RETURNING id`,
  );
  for (let i = 0; i < 3; i++)
    await source.query(
      `INSERT INTO workspaces(name,type,"ownerId") VALUES ('Synthetic workspace','PERSONAL',$1)`,
      [userId],
    );
  assert.equal((await maintenanceHealth(source)).healthy, false);
  const seen = [];
  for (let i = 0; i < 3; i++) {
    const result = await maintenanceBatch(source, 1);
    assert.equal(result.status, 'ok');
    assert.equal(result.processed, 1);
    seen.push(
      (
        await source
          .getRepository(DeploymentWorkerState)
          .findOneByOrFail({ name: 'maintenance' })
      ).cursor,
    );
  }
  assert.equal(new Set(seen).size, 3);
  assert.equal((await maintenanceBatch(source, 1)).processed, 0);
  assert.equal(
    (
      await source
        .getRepository(DeploymentWorkerState)
        .findOneByOrFail({ name: 'maintenance' })
    ).cursor,
    null,
  );
  assert.equal((await maintenanceHealth(source)).healthy, true);
  const lease = source.createQueryRunner();
  await lease.connect();
  await lease.query('SELECT pg_advisory_lock($1)', [maintenanceLock]);
  try {
    assert.equal((await maintenanceBatch(source, 1)).status, 'busy');
  } finally {
    await lease.query('SELECT pg_advisory_unlock($1)', [maintenanceLock]);
    await lease.release();
  }
  await source.query(`UPDATE deployment_worker_state SET status='failed'`);
  assert.equal((await maintenanceHealth(source)).healthy, false);
  await source.query(
    `UPDATE deployment_worker_state SET status='ok',"lastSucceededAt"=now()-interval '1 hour'`,
  );
  assert.equal((await maintenanceHealth(source)).healthy, false);
  await source.query(
    `INSERT INTO mail_outbox("userId","encryptedPayload","expiresAt") SELECT $1,'synthetic-unused',now()-interval '1 hour' FROM generate_series(1,1005)`,
    [userId],
  );
  assert.equal((await cleanupAccountMail(source)).messagesRemoved, 1000);
  assert.equal((await cleanupAccountMail(source)).messagesRemoved, 5);
  await source.query(
    `ALTER TABLE workspaces ALTER COLUMN name TYPE varchar(99)`,
  );
  await assert.rejects(checkSchema(source));
  await source.query(
    'ALTER TABLE workspaces ALTER COLUMN name TYPE varchar(100)',
  );
  console.log(
    'Deployment migration/schema parity, all-workspace cursor/restart, advisory exclusion, health staleness/failure and bounded cleanup checks passed with synthetic records.',
  );
} finally {
  try {
    for (let index = 0; index < installedMigrationCount; index++) {
      await source.undoLastMigration();
    }
  } finally {
    await source.destroy();
  }
}
