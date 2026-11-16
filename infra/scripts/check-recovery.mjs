import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { backupDatabase, restoreDatabase } from "./backup.mjs";
const require = createRequire(
  new URL("../../backend/package.json", import.meta.url),
);
require("reflect-metadata");
const { DataSource } = require("typeorm"),
  { Client } = require("pg"),
  { databaseOptions } = require("./dist/database/options.js");
const url = process.env.TEST_DATABASE_URL;
assert.ok(
  url && new URL(url).pathname.endsWith("_test"),
  "Dedicated empty *_test database required.",
);
process.env.NODE_ENV = "test";
const source = await new DataSource(
  databaseOptions({ NODE_ENV: "test", DATABASE_URL: url, DATABASE_SSL: false }),
).initialize();
let targetCreated = false;
const targetURL = new URL(url);
targetURL.pathname = "/netsentry_phase14_restore_test";
const admin = new Client({ connectionString: url, ssl: false }),
  temp = await mkdtemp(join(tmpdir(), "netsentry-recovery-"));
const target = new DataSource(
  databaseOptions({
    NODE_ENV: "test",
    DATABASE_URL: targetURL.toString(),
    DATABASE_SSL: false,
  }),
);
try {
  assert.equal(
    (
      await source.query(
        "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name<>'netsentry_migrations'",
      )
    )[0].n,
    0,
  );
  await source.runMigrations();
  await source.query(
    `INSERT INTO users(email,"displayName","passwordHash") VALUES ('synthetic-recovery@example.invalid','Recovery fixture','not-a-real-password')`,
  );
  await admin.connect();
  await admin.query("CREATE DATABASE netsentry_phase14_restore_test");
  targetCreated = true;
  const encrypted = join(temp, "backup.enc"),
    key = randomBytes(32);
  await backupDatabase(url, encrypted, key);
  const bytes = await readFile(encrypted);
  assert.ok(!bytes.includes(Buffer.from("synthetic-recovery@example.invalid")));
  await target.initialize();
  await target.query(
    "CREATE FUNCTION public.fixture_restore_guard() RETURNS integer LANGUAGE sql AS 'SELECT 1'",
  );
  await assert.rejects(
    restoreDatabase(
      targetURL.toString(),
      encrypted,
      key,
      "netsentry_phase14_restore_test",
    ),
  );
  await target.query("DROP FUNCTION public.fixture_restore_guard()");
  await restoreDatabase(
    targetURL.toString(),
    encrypted,
    key,
    "netsentry_phase14_restore_test",
  );
  assert.equal(
    (await target.query("SELECT email FROM users"))[0].email,
    "synthetic-recovery@example.invalid",
  );
  assert.equal(
    (await target.driver.createSchemaBuilder().log()).upQueries.length,
    0,
  );
  await assert.rejects(
    restoreDatabase(
      targetURL.toString(),
      encrypted,
      key,
      "netsentry_phase14_restore_test",
    ),
  );
  bytes[bytes.length - 1] ^= 1;
  const tampered = join(temp, "bad.enc");
  await writeFile(tampered, bytes, { mode: 0o600 });
  await assert.rejects(
    restoreDatabase(
      targetURL.toString(),
      tampered,
      key,
      "netsentry_phase14_restore_test",
    ),
  );
  assert.equal(
    (await target.query("SELECT count(*)::int AS n FROM users"))[0].n,
    1,
  );
  console.log(
    "Actual encrypted PostgreSQL backup/recovery, restored schema parity, nonempty-target refusal and tamper rejection passed. All records were synthetic.",
  );
} finally {
  if (target.isInitialized) await target.destroy();
  if (targetCreated)
    await admin.query("DROP DATABASE netsentry_phase14_restore_test");
  await admin.end().catch(() => {});
  while (
    Number(
      (await source.query("SELECT count(*) AS n FROM netsentry_migrations"))[0]
        .n,
    )
  )
    await source.undoLastMigration();
  await source.destroy();
  await rm(temp, { recursive: true, force: true });
}
