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
  deploymentConfiguration,
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
      "dist/deployment/other/cli.js",
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

test("backup retention always keeps the new authenticated snapshot after clock rollback", async () =>
  temporary(async (dir) => {
    const key = randomBytes(32),
      { randomUUID } = await import("node:crypto");
    for (let i = 0; i < 3; i++)
      await writeFile(
        join(dir, `netsentry-9999999999999-${randomUUID()}.netsbk`),
        sealed(Buffer.from("synthetic older dump"), key),
        { mode: 0o600 },
      );
    await backupCycle(
      { dir, key, url: "unused", keep: 2 },
      async (_url, path) => {
        await writeFile(path, sealed(Buffer.from("new synthetic dump"), key), {
          mode: 0o600,
        });
      },
    );
    const receipt = JSON.parse(
      await readFile(join(dir, "status.json"), "utf8"),
    );
    await verifyBackup(join(dir, receipt.file), key);
    assert.equal((await backupHealth(dir)).healthy, true);
  }));

test("complete deployment preflight rejects inline secrets, mismatched origins and mutable images", async () =>
  temporary(async (root) => {
    const { mkdir } = await import("node:fs/promises");
    const secretDir = join(root, "secrets"),
      tls = join(root, "tls");
    await mkdir(secretDir, { mode: 0o700 });
    await mkdir(tls, { mode: 0o700 });
    for (const name of [
      "database-url",
      "access-secret",
      "refresh-secret",
      "mail-key",
      "router-key",
    ])
      await writeFile(join(secretDir, name), "synthetic", { mode: 0o600 });
    await writeFile(join(tls, "fullchain.pem"), "synthetic public certificate");
    await writeFile(join(tls, "privkey.pem"), "synthetic key", { mode: 0o600 });
    const backend = join(root, "backend.env"),
      dashboard = join(root, "dashboard.env"),
      path = join(root, "deployment.env");
    const publicHost = "app.example.org";
    const server = {
      PORT: "3000",
      API_PREFIX: "api",
      BILLING_MODE: "disabled",
      CORS_ORIGINS: `https://${publicHost}`,
      PUBLIC_APP_URL: `https://${publicHost}`,
      DATABASE_URL_FILE: "/run/secrets/database-url",
      JWT_ACCESS_TOKEN_SECRET_FILE: "/run/secrets/access-secret",
      JWT_REFRESH_TOKEN_SECRET_FILE: "/run/secrets/refresh-secret",
      ACCOUNT_MAIL_ENCRYPTION_KEY_FILE: "/run/secrets/mail-key",
      ROUTER_CREDENTIAL_ENCRYPTION_KEY_FILE: "/run/secrets/router-key",
    };
    const env = {
      COMPOSE_PROJECT_NAME: "netsentry-test",
      BACKEND_IMAGE: "registry.example.org/backend@sha256:" + "a".repeat(64),
      DASHBOARD_IMAGE:
        "registry.example.org/dashboard@sha256:" + "b".repeat(64),
      INGRESS_IMAGE: "nginx@sha256:" + "c".repeat(64),
      SERVER_ENV_FILE: backend,
      DASHBOARD_ENV_FILE: dashboard,
      SERVER_SECRET_DIR: secretDir,
      TLS_CERT_DIR: tls,
      INGRESS_CONFIG_FILE: join(root, "nginx.conf"),
      PUBLIC_HOST: publicHost,
      HTTPS_BIND_ADDRESS: "127.0.0.1",
    };
    const write = async (path, values) =>
      writeFile(
        path,
        Object.entries(values)
          .map(([key, value]) => `${key}=${value}`)
          .join("\n"),
        { mode: 0o600 },
      );
    await write(backend, server);
    await write(dashboard, {
      DASHBOARD_ORIGIN: `https://${publicHost}`,
      NETSENTRY_API_URL: "http://backend:3000/api/v1",
    });
    await write(path, env);
    assert.equal((await deploymentConfiguration(path)).PUBLIC_HOST, publicHost);
    await write(backend, { ...server, DATABASE_URL: "do-not-print-this" });
    await assert.rejects(deploymentConfiguration(path));
    await write(backend, server);
    await write(dashboard, {
      DASHBOARD_ORIGIN: "https://other.example.org",
      NETSENTRY_API_URL: "http://backend:3000/api/v1",
    });
    await assert.rejects(deploymentConfiguration(path));
    await write(dashboard, {
      DASHBOARD_ORIGIN: `https://${publicHost}`,
      NETSENTRY_API_URL: "http://backend:3000/api/v1",
    });
    await write(path, { ...env, BACKEND_IMAGE: "backend:latest" });
    await assert.rejects(deploymentConfiguration(path));
  }));
