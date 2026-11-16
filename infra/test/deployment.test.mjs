import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  realpath,
  writeFile,
  chmod,
  symlink,
  rm,
  readFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes, createCipheriv } from "node:crypto";
import { loadSecrets, runtimeCommand } from "../runtime-lib.mjs";
import {
  pinnedImage,
  privateEnvironment,
  ingressConfig,
} from "../scripts/deployment.mjs";
import { backupCycle, backupHealth } from "../scripts/backup-cycle.mjs";
import { verifyBackup } from "../scripts/backup.mjs";
import { smokeHttps } from "../scripts/smoke.mjs";
async function temporary(fn) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "ns-deploy-")));
  try {
    await fn(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
test("runtime modes are explicit and secret inputs reject ambiguity, links and loose permissions", async () =>
  temporary(async (root) => {
    const key = join(root, "secret");
    await writeFile(key, "private-value", { mode: 0o600 });
    assert.equal(
      (await loadSecrets({ DATABASE_URL_FILE: key })).DATABASE_URL,
      "private-value",
    );
    await assert.rejects(
      loadSecrets({ DATABASE_URL: "inline", DATABASE_URL_FILE: key }),
    );
    await chmod(key, 0o644);
    await assert.rejects(loadSecrets({ DATABASE_URL_FILE: key }));
    await chmod(key, 0o600);
    const link = join(root, "link");
    await symlink(key, link);
    await assert.rejects(loadSecrets({ DATABASE_URL_FILE: link }));
    assert.deepEqual(runtimeCommand("migrate"), [
      "dist/deployment/cli.js",
      "migrate",
    ]);
    assert.throws(() => runtimeCommand("shell"));
    assert.throws(() => runtimeCommand(undefined));
  }));
test("deployment accepts immutable image references and rejects injected hosts/private env links", async () =>
  temporary(async (root) => {
    assert.equal(
      pinnedImage("registry.example.invalid/backend@sha256:" + "a".repeat(64)),
      true,
    );
    for (const value of [
      "node:latest",
      "node:24",
      "x@sha256:bad",
      "https://example.invalid@sha256:" + "a".repeat(64),
    ])
      assert.equal(pinnedImage(value), false);
    assert.equal(
      ingressConfig("server_name __NETSENTRY_HOST__;", "app.example.invalid"),
      "server_name app.example.invalid;",
    );
    assert.throws(() => ingressConfig("x", "a; include /tmp/x;"));
    const env = join(root, "config");
    await writeFile(env, "VALUE=public", { mode: 0o600 });
    assert.equal((await privateEnvironment(env)).VALUE, "public");
    await chmod(env, 0o644);
    await assert.rejects(privateEnvironment(env));
  }));
function sealed(data, key) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  return Buffer.concat([
    Buffer.from("NETSBK01"),
    iv,
    cipher.update(data),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
}
test("backup cycles authenticate before retention, preserve snapshots on failure and detect missing/modified backups", async () =>
  temporary(async (dir) => {
    const key = randomBytes(32);
    const perform = async (_url, path) => {
      await writeFile(
        path,
        sealed(Buffer.from("synthetic private dump"), key),
        { mode: 0o600 },
      );
    };
    for (let i = 0; i < 3; i++) {
      await backupCycle({ dir, key, url: "unused", keep: 2 }, perform);
      await new Promise((yes) => setTimeout(yes, 2));
    }
    const { readdir } = await import("node:fs/promises");
    assert.equal(
      (await readdir(dir)).filter((n) => n.endsWith(".netsbk")).length,
      2,
    );
    assert.equal((await backupHealth(dir)).healthy, true);
    const before = await readFile(join(dir, "status.json"));
    await assert.rejects(
      backupCycle({ dir, key, url: "unused", keep: 2 }, async () => {
        throw new Error("tool failed");
      }),
    );
    assert.deepEqual(await readFile(join(dir, "status.json")), before);
    const status = JSON.parse(before);
    const path = join(dir, status.file),
      bytes = await readFile(path);
    bytes[bytes.length - 1] ^= 1;
    await writeFile(path, bytes);
    await assert.rejects(verifyBackup(path, key));
    await assert.rejects(backupHealth(dir));
  }));
test("backup lock and unsupported retention fail closed", async () =>
  temporary(async (dir) => {
    const key = randomBytes(32);
    await writeFile(join(dir, ".cycle.lock"), "interrupted", { mode: 0o600 });
    await assert.rejects(backupCycle({ dir, key, url: "unused" }));
    await assert.rejects(backupCycle({ dir, key, url: "unused", keep: 1 }));
  }));
test("HTTPS smoke checks require trusted HTTPS, headers and dependency readiness", async () => {
  await assert.rejects(smokeHttps("http://example.invalid"));
  const good = async (url) =>
    new Response(
      url.endsWith("/ready")
        ? '{"status":"ready"}'
        : url.endsWith("/health")
          ? '{"status":"ok"}'
          : "html",
      {
        headers: {
          "strict-transport-security": "max-age=31536000",
          "x-content-type-options": "nosniff",
        },
      },
    );
  assert.equal(
    (await smokeHttps("https://example.invalid", good)).checks.length,
    3,
  );
  await assert.rejects(
    smokeHttps(
      "https://example.invalid",
      async () => new Response("{}", { status: 503 }),
    ),
  );
});
