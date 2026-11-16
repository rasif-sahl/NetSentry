import { createHash, randomUUID } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import {
  open,
  lstat,
  readdir,
  rename,
  unlink,
  readFile,
  realpath,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { privateKey, backupDatabase, verifyBackup } from "./backup.mjs";
import { loadSecrets } from "../runtime-lib.mjs";
export async function privateBackupDirectory(dir) {
  const st = await lstat(dir);
  if (
    (await realpath(dir)) !== dir ||
    !st.isDirectory() ||
    st.isSymbolicLink() ||
    st.mode & 0o077 ||
    st.uid !== process.getuid?.()
  )
    throw new Error("Private backup directory required.");
}
async function digestFile(path) {
  const h = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const st = await h.stat();
    if (!st.isFile() || st.mode & 0o077) throw new Error("Invalid backup.");
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(path, {
      fd: h.fd,
      autoClose: false,
    }))
      hash.update(chunk);
    return { bytes: st.size, sha256: hash.digest("hex") };
  } finally {
    await h.close();
  }
}
export async function backupCycle(
  { dir, key, url, keep = 7 },
  perform = backupDatabase,
) {
  if (!Number.isInteger(keep) || keep < 2 || keep > 365)
    throw new Error("Keep between 2 and 365 backups.");
  await privateBackupDirectory(dir);
  const lock = await open(join(dir, ".cycle.lock"), "wx", 0o600);
  let temporary;
  try {
    const name = `netsentry-${Date.now()}-${randomUUID()}.netsbk`,
      path = join(dir, name);
    await perform(url, path, key);
    await verifyBackup(path, key);
    const digest = await digestFile(path),
      receipt = {
        schemaVersion: 1,
        lastSucceededAt: new Date().toISOString(),
        file: name,
        ...digest,
      };
    temporary = join(dir, ".status-" + randomUUID() + ".new");
    const status = await open(temporary, "wx", 0o600);
    try {
      await status.writeFile(JSON.stringify(receipt) + "\n");
      await status.sync();
    } finally {
      await status.close();
    }
    const statusPath = join(dir, "status.json");
    try {
      const old = await lstat(statusPath);
      if (!old.isFile() || old.isSymbolicLink() || old.mode & 0o077)
        throw new Error("Unsafe status.");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await rename(temporary, statusPath);
    temporary = undefined;
    const files = (await readdir(dir))
      .filter((n) => /^netsentry-[0-9]{13}-[a-f0-9-]{36}\.netsbk$/.test(n))
      .sort()
      .reverse();
    let pruned = 0;
    for (const old of files.slice(keep)) {
      // Never remove unknown, modified, inaccessible or old-key backups.
      await verifyBackup(join(dir, old), key);
      await unlink(join(dir, old));
      pruned++;
    }
    return {
      status: "ok",
      authenticated: true,
      retained: files.length - pruned,
      pruned,
    };
  } finally {
    if (temporary) await unlink(temporary).catch(() => {});
    await lock.close();
    await unlink(join(dir, ".cycle.lock"));
  }
}
export async function backupHealth(dir, maxAgeHours = 36) {
  await privateBackupDirectory(dir);
  if (!Number.isFinite(maxAgeHours) || maxAgeHours < 1 || maxAgeHours > 168)
    throw new Error("Invalid backup age.");
  const path = join(dir, "status.json");
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const st = await file.stat();
    if (!st.isFile() || st.mode & 0o077 || st.size > 4096)
      throw new Error("Invalid status.");
    const result = JSON.parse(await file.readFile("utf8"));
    if (
      result.schemaVersion !== 1 ||
      !/^netsentry-[0-9]{13}-[a-f0-9-]{36}\.netsbk$/.test(result.file) ||
      !/^[a-f0-9]{64}$/.test(result.sha256)
    )
      throw new Error("Invalid status.");
    if (
      typeof result.lastSucceededAt !== "string" ||
      !Number.isFinite(Date.parse(result.lastSucceededAt)) ||
      new Date(result.lastSucceededAt).toISOString() !== result.lastSucceededAt
    )
      throw new Error("Invalid backup time.");
    const age = Date.now() - Date.parse(result.lastSucceededAt);
    const backup = await lstat(join(dir, result.file));
    if (
      !backup.isFile() ||
      backup.isSymbolicLink() ||
      backup.mode & 0o077 ||
      backup.size !== result.bytes ||
      (await digestFile(join(dir, result.file))).sha256 !== result.sha256
    )
      throw new Error("Backup no longer matches status.");
    return {
      healthy: Number.isFinite(age) && age >= 0 && age <= maxAgeHours * 3600000,
      lastSucceededAt: result.lastSucceededAt,
    };
  } finally {
    await file.close();
  }
}
async function main() {
  const [mode] = process.argv.slice(2);
  const env = await loadSecrets(process.env);
  Object.assign(process.env, env);
  const dir = resolve(process.env.BACKUP_DIR || "");
  if (!process.env.BACKUP_DIR)
    throw new Error("Private backup directory required.");
  if (mode === "run") {
    const key = await privateKey(process.env.BACKUP_KEY_FILE || "");
    console.log(
      JSON.stringify(
        await backupCycle({
          dir,
          key,
          url: env.DATABASE_URL,
          keep: Number(process.env.BACKUP_KEEP_COUNT || 7),
        }),
      ),
    );
  } else if (mode === "health") {
    const report = await backupHealth(
      dir,
      Number(process.env.BACKUP_MAX_AGE_HOURS || 36),
    );
    console.log(JSON.stringify(report));
    if (!report.healthy) process.exitCode = 1;
  } else throw new Error("Use run or health.");
}
if (import.meta.url === pathToFileURL(resolve(process.argv[1] || "")).href)
  main().catch(() => {
    console.error(
      "Backup cycle/health failed. Review private configuration, storage, key and retained snapshots; no secrets are logged.",
    );
    process.exitCode = 1;
  });
