import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('reflect-metadata');
const { DataSource } = require('typeorm');
const { databaseOptions } = require('../dist/database/options.js');
const { baselineEntities } = require('../dist/database/baseline/index.js');
const { adoptBaseline } = require('../dist/database/adopt-baseline.js');

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test')) {
  throw new Error(
    'Set TEST_DATABASE_URL to a disposable, empty PostgreSQL database whose name ends in _test.',
  );
}
const source = new DataSource(
  databaseOptions({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    DATABASE_SSL: process.env.TEST_DATABASE_SSL ?? 'false',
  }),
);
try {
  await source.initialize();
  const tables = await source.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name <> 'netsentry_migrations'",
  );
  assert.equal(
    tables.length,
    0,
    'Refusing to test against a nonempty public schema.',
  );
  assert.equal(
    (
      await source.query(
        "SELECT to_regclass('public.netsentry_migrations') AS history",
      )
    )[0].history === null ||
      Number(
        (
          await source.query(
            'SELECT count(*) AS count FROM netsentry_migrations',
          )
        )[0].count,
      ) === 0,
    true,
    'Refusing nonempty migration history.',
  );
  await source.runMigrations();
  assert.equal(
    (await source.driver.createSchemaBuilder().log()).upQueries.length,
    0,
    'Migrated schema must match entity metadata.',
  );
  const [user] = await source.query(
    `INSERT INTO users (email, "displayName", "passwordHash") VALUES ('fixture@example.invalid', 'Migration fixture', 'not-a-real-password') RETURNING id`,
  );
  const [workspace] = await source.query(
    `INSERT INTO workspaces (name, type, "ownerId") VALUES ('Fixture', 'PERSONAL', $1) RETURNING id`,
    [user.id],
  );
  await source.query(
    `INSERT INTO memberships ("workspaceId", "userId", role) VALUES ($1, $2, 'OWNER')`,
    [workspace.id, user.id],
  );
  const [measurementDevice] = await source.query(
    `INSERT INTO registered_devices ("installationId", "workspaceId", "registeredById", name, platform) VALUES ('fixture-installation', $1, $2, 'Fixture phone', 'ANDROID') RETURNING id`,
    [workspace.id, user.id],
  );
  // Upgrade a previously running Phase 3 pipeline, including a receipt whose raw row expired.
  while (
    (
      await source.query(
        'SELECT name FROM netsentry_migrations ORDER BY id DESC LIMIT 1',
      )
    )[0].name !== 'RetainedIntervalIndex1794747169411'
  )
    await source.undoLastMigration();
  await source.undoLastMigration();
  const eventId = randomUUID();
  await source.query(
    `INSERT INTO measurements ("eventId","workspaceId","deviceId",generation,metric,"applicationId",quality,"sourceKind","collectorVersion",value,unit,"intervalStart","intervalEnd","collectedAt") VALUES ($1,$2,$3,1,'mobile_data_bytes','','measured','android','synthetic-1',1,'bytes','2026-11-01T00:00:00Z','2026-11-01T00:00:01Z','2026-11-01T00:00:01Z')`,
    [eventId, workspace.id, measurementDevice.id],
  );
  await source.query(
    `INSERT INTO measurement_receipts ("eventId","deviceId","payloadHash") VALUES ($1,$2,$3),($4,$2,$3)`,
    [eventId, measurementDevice.id, 'a'.repeat(64), randomUUID()],
  );
  await source.query(
    'UPDATE registered_devices SET "monitoringEnabled"=true WHERE id=$1',
    [measurementDevice.id],
  );
  await source.runMigrations();
  const { fingerprint } = require('../dist/monitoring/values.js');
  const backfilled = (
    await source.query(
      'SELECT * FROM measurement_receipts WHERE "eventId"=$1',
      [eventId],
    )
  )[0];
  assert.equal(
    backfilled.partitionHash,
    fingerprint(['mobile_data_bytes', '', 'measured']),
  );
  assert.equal(
    backfilled.intervalStart.toISOString(),
    '2026-11-01T00:00:00.000Z',
  );
  assert.equal(
    (
      await source.query(
        'SELECT "monitoringEnabled" FROM registered_devices WHERE id=$1',
        [measurementDevice.id],
      )
    )[0].monitoringEnabled,
    false,
  );
  assert.equal(
    (await source.driver.createSchemaBuilder().log()).upQueries.length,
    0,
  );
  await assert.rejects(
    source.query(
      `INSERT INTO memberships ("workspaceId", "userId", role) VALUES ($1, $2, 'MEMBER')`,
      [workspace.id, user.id],
    ),
  );
  await source.query('DELETE FROM workspaces WHERE id=$1', [workspace.id]);
  assert.equal(
    Number(
      (
        await source.query('SELECT count(*) AS count FROM registered_devices')
      )[0].count,
    ),
    0,
    'Workspace deletion must cascade to devices.',
  );
  while (
    Number(
      (
        await source.query('SELECT count(*) AS count FROM netsentry_migrations')
      )[0].count,
    )
  )
    await source.undoLastMigration();
  assert.equal(
    (
      await source.query(
        "SELECT count(*) AS count FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('users','sessions','workspaces','memberships','registered_devices')",
      )
    )[0].count,
    '0',
  );

  // Reproduce a development schema created through synchronize, then adopt it.
  const baseline = new DataSource({
    ...source.options,
    entities: baselineEntities,
    migrations: [],
    synchronize: false,
  });
  try {
    await baseline.initialize();
    await baseline.synchronize();
  } finally {
    if (baseline.isInitialized) await baseline.destroy();
  }
  const [preserved] = await source.query(
    `INSERT INTO users (email, "displayName", "passwordHash") VALUES ('preserved@example.invalid', 'Preserved fixture', 'not-a-real-password') RETURNING id`,
  );
  const [legacyWorkspace] = await source.query(
    `INSERT INTO workspaces (name, type, "ownerId") VALUES ('Legacy fixture', 'PERSONAL', $1) RETURNING id`,
    [preserved.id],
  );
  await source.query(
    `INSERT INTO memberships ("workspaceId", "userId", role) VALUES ($1, $2, 'OWNER')`,
    [legacyWorkspace.id, preserved.id],
  );
  const [legacyDevice] = await source.query(
    `INSERT INTO registered_devices ("installationId", "workspaceId", "registeredById", name, platform) VALUES ('legacy-installation', $1, $2, 'Legacy phone', 'ANDROID') RETURNING id`,
    [legacyWorkspace.id, preserved.id],
  );
  await source.query('ALTER TABLE users ADD COLUMN unexpected_column text');
  await assert.rejects(adoptBaseline(source), /does not match/);
  await source.query('ALTER TABLE users DROP COLUMN unexpected_column');
  await adoptBaseline(source);
  await source.runMigrations();
  assert.equal(
    (await source.query('SELECT id FROM users WHERE id=$1', [preserved.id]))
      .length,
    1,
    'Baseline adoption must preserve existing rows.',
  );
  const [migratedUser] = await source.query(
    'SELECT "emailVerifiedAt" FROM users WHERE id=$1',
    [preserved.id],
  );
  const [migratedDevice] = await source.query(
    'SELECT state, "monitoringEnabled", "credentialHash" FROM registered_devices WHERE id=$1',
    [legacyDevice.id],
  );
  assert.equal(
    migratedUser.emailVerifiedAt,
    null,
    'Historical users must not be silently email-verified.',
  );
  assert.equal(migratedDevice.state, 'UNVERIFIED');
  assert.equal(migratedDevice.monitoringEnabled, false);
  assert.equal(migratedDevice.credentialHash, null);
  assert.equal(await source.showMigrations(), false);
  assert.equal(
    (await source.driver.createSchemaBuilder().log()).upQueries.length,
    0,
  );
  while (
    Number(
      (
        await source.query('SELECT count(*) AS count FROM netsentry_migrations')
      )[0].count,
    )
  )
    await source.undoLastMigration();
  console.log(
    'Passed clean migration, constraints/cascades, rollback, drift refusal and data-preserving baseline adoption.',
  );
} finally {
  if (source.isInitialized) await source.destroy();
}
