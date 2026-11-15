import assert from 'node:assert/strict';
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
  await source.query(
    `INSERT INTO registered_devices ("installationId", "workspaceId", "registeredById", name, platform) VALUES ('fixture-installation', $1, $2, 'Fixture phone', 'ANDROID')`,
    [workspace.id, user.id],
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
