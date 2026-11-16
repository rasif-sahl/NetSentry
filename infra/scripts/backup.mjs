import { loadSecrets } from "../runtime-lib.mjs";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  constants,
  openSync,
  writeSync,
} from "node:fs";
import { readFile, lstat, mkdtemp, rm, open } from "node:fs/promises";
import { Transform, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../../backend/package.json", import.meta.url),
);
const magic = Buffer.from("NETSBK01");
export async function privateKey(path) {
  const info = await lstat(path);
  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    (info.mode & 0o077) !== 0 ||
    info.size !== 32
  )
    throw new Error(
      "Backup key must be a private regular file containing exactly 32 bytes.",
    );
  const h = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    return await h.readFile();
  } finally {
    await h.close();
  }
}
function settings(url) {
  const u = new URL(url);
  if (
    !["postgres:", "postgresql:"].includes(u.protocol) ||
    u.search ||
    u.hash ||
    !u.pathname.slice(1)
  )
    throw new Error("Invalid private database configuration.");
  const test = process.env.NODE_ENV === "test" && u.pathname.endsWith("_test");
  if (!test && process.env.DATABASE_SSL !== "true")
    throw new Error(
      "Verified PostgreSQL TLS is required outside isolated tests.",
    );
  return {
    host: u.hostname,
    port: u.port || "5432",
    database: decodeURIComponent(u.pathname.slice(1)),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    connectionTimeoutMillis: 10000,
    statement_timeout: 900000,
    ssl: test
      ? false
      : {
          rejectUnauthorized: true,
          ...(process.env.DATABASE_SSL_CA
            ? { ca: process.env.DATABASE_SSL_CA }
            : {}),
        },
  };
}
function tool(name, args, s) {
  const env = {
    PATH: process.env.PATH,
    PGHOST: s.host,
    PGPORT: s.port,
    PGDATABASE: s.database,
    PGUSER: s.user,
    PGPASSWORD: s.password,
    PGCONNECT_TIMEOUT: "10",
    PGOPTIONS: "-c statement_timeout=900000 -c lock_timeout=10000",
    PGSSLMODE: s.ssl ? "verify-full" : "disable",
    ...(process.env.PGSSLROOTCERT
      ? { PGSSLROOTCERT: process.env.PGSSLROOTCERT }
      : {}),
  };
  let command = process.env.PG_BIN_DIR
    ? join(process.env.PG_BIN_DIR, name)
    : name;
  if (process.env.PG_CONTAINER) {
    if (
      process.env.NODE_ENV !== "test" ||
      !s.database.endsWith("_test") ||
      !/^[a-zA-Z0-9_.-]+$/.test(process.env.PG_CONTAINER)
    )
      throw new Error("Container tools are restricted to isolated tests.");
    env.PGHOST = "127.0.0.1";
    env.PGPORT = "5432";
    args = [
      "exec",
      "-i",
      ...Object.keys(env)
        .filter((k) => k.startsWith("PG"))
        .flatMap((k) => ["-e", k]),
      process.env.PG_CONTAINER,
      name,
      ...args,
    ];
    command = "docker";
  }
  const child = spawn(command, args, {
    env,
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 1800000,
    killSignal: "SIGKILL",
  });
  child.stderr.resume();
  const done = new Promise((yes, no) => {
    child.on("error", () =>
      no(new Error("PostgreSQL recovery tool unavailable.")),
    );
    child.on("exit", (code) =>
      code === 0 ? yes() : no(new Error("PostgreSQL recovery command failed.")),
    );
  });
  done.catch(() => {});
  return { child, done };
}
export async function backupDatabase(url, path, key) {
  const s = settings(url),
    iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  const fd = openSync(
    path,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      constants.O_NOFOLLOW,
    0o600,
  );
  writeSync(fd, Buffer.concat([magic, iv]));
  const seal = new Transform({
    transform(chunk, _enc, cb) {
      try {
        cb(null, cipher.update(chunk));
      } catch (e) {
        cb(e);
      }
    },
    flush(cb) {
      try {
        this.push(cipher.final());
        this.push(cipher.getAuthTag());
        cb();
      } catch (e) {
        cb(e);
      }
    },
  });
  const { child, done } = tool(
    "pg_dump",
    ["--format=custom", "--no-owner", "--no-acl"],
    s,
  );
  child.stdin.end();
  try {
    await pipeline(
      child.stdout,
      seal,
      createWriteStream(path, { fd, autoClose: true }),
    );
    await done;
  } catch {
    child.kill();
    await rm(path, { force: true });
    throw new Error("Encrypted backup failed. No usable backup was retained.");
  }
  return { encrypted: true, format: 1 };
}
export async function restoreDatabase(url, path, key, confirmation) {
  const s = settings(url);
  if (process.env.DATABASE_URL && url === process.env.DATABASE_URL)
    throw new Error("Restore must use a separate target database.");
  if (confirmation !== s.database)
    throw new Error("Confirm the exact empty recovery database name.");
  const info = await lstat(path);
  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    info.size < 36 ||
    info.size > 10 * 1024 ** 3
  )
    throw new Error("Invalid encrypted backup.");
  const h = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  const dir = await mkdtemp(join(tmpdir(), "netsentry-restore-"));
  const dump = join(dir, "verified.dump");
  let client;
  try {
    const header = Buffer.alloc(20),
      tag = Buffer.alloc(16);
    await h.read(header, 0, 20, 0);
    await h.read(tag, 0, 16, info.size - 16);
    if (!header.subarray(0, 8).equals(magic))
      throw new Error("Backup format rejected.");
    const decipher = createDecipheriv("aes-256-gcm", key, header.subarray(8));
    decipher.setAuthTag(tag);
    await pipeline(
      createReadStream(path, {
        fd: h.fd,
        autoClose: false,
        start: 20,
        end: info.size - 17,
      }),
      decipher,
      createWriteStream(dump, { flags: "wx", mode: 0o600 }),
    );
    // Authenticate the entire backup before any restore command can execute SQL.
    const { Client } = require("pg");
    client = new Client(s);
    await client.connect();
    if (
      !(await client.query("SELECT pg_try_advisory_lock(17949314) AS locked"))
        .rows[0].locked
    )
      throw new Error("Another restore is in progress.");
    const { rows } = await client.query(
      `SELECT count(*)::int AS n FROM (
        SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','v','m','S','f')
        UNION ALL SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
          WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_%'
          AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
        UNION ALL SELECT t.oid FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
          WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_%' AND t.typtype IN ('e','d')
          AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_type'::regclass AND d.objid=t.oid AND d.deptype='e')
        UNION ALL SELECT oid FROM pg_namespace WHERE nspname NOT IN ('public','pg_catalog','information_schema') AND nspname NOT LIKE 'pg_%'
      ) objects`,
    );
    if (rows[0].n !== 0) throw new Error("Recovery target must be empty.");
    const { child, done } = tool(
      "pg_restore",
      [
        "--exit-on-error",
        "--single-transaction",
        "--no-owner",
        "--no-acl",
        "--dbname",
        s.database,
      ],
      s,
    );
    try {
      await pipeline(createReadStream(dump), child.stdin);
      await done;
    } catch {
      child.kill();
      throw new Error("Recovery failed; target transaction was rolled back.");
    }
    return { restored: true, authenticated: true };
  } finally {
    await client?.end().catch(() => {});
    await h.close().catch(() => {});
    await rm(dir, { recursive: true, force: true });
  }
}
// Authenticate without writing plaintext or executing SQL. Used before retention.
export async function verifyBackup(path, key) {
  const info = await lstat(path);
  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    info.mode & 0o077 ||
    info.size < 36 ||
    info.size > 10 * 1024 ** 3
  )
    throw new Error("Invalid private backup.");
  const h = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const header = Buffer.alloc(20),
      tag = Buffer.alloc(16);
    await h.read(header, 0, 20, 0);
    await h.read(tag, 0, 16, info.size - 16);
    if (!header.subarray(0, 8).equals(magic))
      throw new Error("Invalid backup format.");
    const decipher = createDecipheriv("aes-256-gcm", key, header.subarray(8));
    decipher.setAuthTag(tag);
    await pipeline(
      createReadStream(path, {
        fd: h.fd,
        autoClose: false,
        start: 20,
        end: info.size - 17,
      }),
      decipher,
      new Writable({
        write(_chunk, _encoding, done) {
          done();
        },
      }),
    );
    return { authenticated: true, bytes: info.size };
  } finally {
    await h.close();
  }
}
if (import.meta.url === pathToFileURL(resolve(process.argv[1] || "")).href) {
  const [mode, path, confirm] = process.argv.slice(2);
  try {
    Object.assign(process.env, await loadSecrets(process.env));
    if (process.env.RESTORE_DATABASE_URL_FILE) {
      if (process.env.RESTORE_DATABASE_URL)
        throw new Error("Ambiguous restore target.");
      const target = await loadSecrets({
        DATABASE_URL_FILE: process.env.RESTORE_DATABASE_URL_FILE,
      });
      process.env.RESTORE_DATABASE_URL = target.DATABASE_URL;
    }
    const key = await privateKey(process.env.BACKUP_KEY_FILE || "");
    if (mode === "backup")
      console.log(
        JSON.stringify(
          await backupDatabase(process.env.DATABASE_URL, path, key),
        ),
      );
    else if (mode === "restore")
      console.log(
        JSON.stringify(
          await restoreDatabase(
            process.env.RESTORE_DATABASE_URL,
            path,
            key,
            confirm,
          ),
        ),
      );
    else throw new Error("Use backup or restore.");
  } catch {
    console.error(
      "Backup/recovery failed. Check private configuration, authenticated backup and empty-target confirmation.",
    );
    process.exitCode = 1;
  }
}
