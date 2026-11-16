// Explicit disposable Docker integration. No deployment, real account or provider.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  mkdtemp,
  writeFile,
  readFile,
  mkdir,
  rm,
  realpath,
} from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../../backend/package.json", import.meta.url),
);
const { Client } = require("pg");
const run = promisify(execFile);
if (process.env.RUN_PRODUCTION_FIXTURE !== "1")
  throw new Error("Explicit RUN_PRODUCTION_FIXTURE=1 required.");
const backend = process.env.TEST_BACKEND_IMAGE,
  dashboard = process.env.TEST_DASHBOARD_IMAGE,
  pg = process.env.TEST_POSTGRES_IMAGE,
  nginx = process.env.TEST_INGRESS_IMAGE;
assert.ok(
  [backend, dashboard, pg, nginx].every(Boolean),
  "Explicit existing fixture images required.",
);
const name = "netsentry-fixture-" + randomUUID(),
  root = await realpath(await mkdtemp(join(tmpdir(), "ns-production-")));
const ids = [];
let network = false;
const docker = (...args) =>
  run("docker", args, { maxBuffer: 2 * 1024 * 1024, timeout: 180000 });
const delay = (ms) => new Promise((yes) => setTimeout(yes, ms));
const envFile = async (name, values) => {
  const path = join(root, name);
  await writeFile(
    path,
    Object.entries(values)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n",
    { mode: 0o600 },
  );
  return path;
};
async function ready(id) {
  for (let i = 0; i < 90; i++) {
    const { stdout } = await docker(
      "inspect",
      "--format",
      "{{.State.Health.Status}}",
      id,
    );
    if (stdout.trim() === "healthy") return;
    await delay(1000);
  }
  throw new Error("Fixture container not ready.");
}
try {
  await mkdir(join(root, "tls"), { mode: 0o755 });
  await mkdir(join(root, "secrets"), { mode: 0o750 });
  await run("openssl", [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-days",
    "1",
    "-subj",
    "/CN=NetSentry isolated test CA",
    "-keyout",
    join(root, "ca.key"),
    "-out",
    join(root, "ca.crt"),
  ]);
  await run("openssl", [
    "req",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-subj",
    "/CN=localhost",
    "-keyout",
    join(root, "tls/privkey.pem"),
    "-out",
    join(root, "server.csr"),
  ]);
  await writeFile(
    join(root, "extensions"),
    "subjectAltName=DNS:localhost,DNS:postgres,IP:127.0.0.1\nextendedKeyUsage=serverAuth\n",
  );
  await run("openssl", [
    "x509",
    "-req",
    "-in",
    join(root, "server.csr"),
    "-CA",
    join(root, "ca.crt"),
    "-CAkey",
    join(root, "ca.key"),
    "-CAcreateserial",
    "-days",
    "1",
    "-extfile",
    join(root, "extensions"),
    "-out",
    join(root, "tls/fullchain.pem"),
  ]);
  await docker("network", "create", name);
  network = true;
  const password = randomBytes(24).toString("hex");
  const pgEnv = await envFile("postgres.env", {
    POSTGRES_USER: "netsentry",
    POSTGRES_PASSWORD: password,
    POSTGRES_DB: "netsentry_runtime_test",
  });
  const { stdout: pgId } = await docker(
    "run",
    "-d",
    "--name",
    name + "-pg",
    "--network",
    name,
    "--network-alias",
    "postgres",
    "-p",
    "127.0.0.1::5432",
    "--env-file",
    pgEnv,
    "-v",
    root + ":/fixtures:ro",
    "--health-cmd",
    "pg_isready -U netsentry -d netsentry_runtime_test",
    "--health-interval",
    "1s",
    "--health-timeout",
    "3s",
    "--health-retries",
    "90",
    "--entrypoint",
    "sh",
    pg,
    "-c",
    "cp /fixtures/tls/fullchain.pem /tmp/server.crt; cp /fixtures/tls/privkey.pem /tmp/server.key; chown postgres:postgres /tmp/server.*; chmod 600 /tmp/server.key; exec docker-entrypoint.sh postgres -c ssl=on -c ssl_cert_file=/tmp/server.crt -c ssl_key_file=/tmp/server.key",
  );
  ids.push(pgId.trim());
  await ready(pgId.trim());
  const pgPort = (await docker("port", pgId.trim(), "5432/tcp")).stdout
    .trim()
    .split(":")
    .at(-1);
  // Existing database lifecycle/worker checks use a separate isolated DB and no TLS bypass in production containers.
  const ca = await readFile(join(root, "ca.crt"), "utf8");
  const admin = new Client({
    connectionString: `postgresql://netsentry:${password}@127.0.0.1:${pgPort}/netsentry_runtime_test`,
    ssl: { ca, rejectUnauthorized: true },
  });
  await admin.connect();
  try {
    await admin.query("CREATE DATABASE netsentry_deployment_test");
  } finally {
    await admin.end();
  }
  await run(process.execPath, ["backend/scripts/check-deployment.mjs"], {
    env: {
      ...process.env,
      TEST_DATABASE_URL: `postgresql://netsentry:${password}@127.0.0.1:${pgPort}/netsentry_deployment_test`,
    },
    timeout: 180000,
    maxBuffer: 1024 * 1024,
  });
  const secretValues = {
    "database-url": `postgresql://netsentry:${password}@postgres:5432/netsentry_runtime_test`,
    "database-ca": ca,
    "access-secret": randomBytes(40).toString("hex"),
    "refresh-secret": randomBytes(40).toString("hex"),
    "mail-key": randomBytes(32).toString("base64"),
    "router-key": randomBytes(32).toString("base64"),
  };
  for (const [key, value] of Object.entries(secretValues))
    await writeFile(join(root, "secrets", key), value, { mode: 0o440 });
  await docker(
    "run",
    "--rm",
    "-v",
    root + ":/fixtures",
    "--entrypoint",
    "sh",
    pg,
    "-c",
    "chown root:10001 /fixtures/secrets /fixtures/secrets/* /fixtures/tls /fixtures/tls/privkey.pem; chmod 750 /fixtures/secrets /fixtures/tls; chmod 440 /fixtures/secrets/* /fixtures/tls/privkey.pem; chmod 644 /fixtures/tls/fullchain.pem",
  );
  const env = {
    NODE_ENV: "production",
    APP_KIND: "backend",
    PORT: "3000",
    API_PREFIX: "api",
    DATABASE_SSL: "true",
    DB_SYNCHRONIZE: "false",
    BILLING_MODE: "disabled",
    BILLING_ENFORCEMENT: "false",
    CORS_ORIGINS: "https://localhost",
    PUBLIC_APP_URL: "https://localhost",
    DATABASE_URL_FILE: "/run/secrets/database-url",
    DATABASE_SSL_CA_FILE: "/run/secrets/database-ca",
    JWT_ACCESS_TOKEN_SECRET_FILE: "/run/secrets/access-secret",
    JWT_REFRESH_TOKEN_SECRET_FILE: "/run/secrets/refresh-secret",
    ACCOUNT_MAIL_ENCRYPTION_KEY_FILE: "/run/secrets/mail-key",
    ROUTER_CREDENTIAL_ENCRYPTION_KEY_FILE: "/run/secrets/router-key",
  };
  const backendEnv = await envFile("backend.env", env);
  const common = [
    "--network",
    name,
    "--read-only",
    "--user",
    "10001:10001",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges:true",
    "--tmpfs",
    "/tmp:rw,size=32m,mode=1777",
    "--env-file",
    backendEnv,
    "-v",
    join(root, "secrets") + ":/run/secrets:ro",
  ];
  // Explicit migration confirmation is mandatory; startup itself never migrates.
  await assert.rejects(docker("run", "--rm", ...common, backend, "migrate"));
  await docker(
    "run",
    "--rm",
    ...common,
    "-e",
    "MIGRATION_CONFIRM=APPLY_REVIEWED_MIGRATIONS",
    backend,
    "migrate",
  );
  await docker("run", "--rm", ...common, backend, "schema-check");
  const backendId = (
    await docker(
      "run",
      "-d",
      "--name",
      name + "-backend",
      ...common,
      "--network-alias",
      "backend",
      backend,
    )
  ).stdout.trim();
  ids.push(backendId);
  await ready(backendId);
  // Read-only root, private runtime user, mounted secrets and actual verified PostgreSQL TLS.
  await assert.rejects(
    docker(
      "exec",
      backendId,
      "node",
      "-e",
      "require('fs').writeFileSync('/app/forbidden','x')",
    ),
  );
  await docker(
    "exec",
    backendId,
    "node",
    "-e",
    "if(process.getuid()!==10001)process.exit(1)",
  );
  await docker("run", "--rm", ...common, backend, "maintenance-once");
  await docker("run", "--rm", ...common, backend, "maintenance-health");
  const dashboardEnv = await envFile("dashboard.env", {
    NODE_ENV: "production",
    APP_KIND: "dashboard",
    NETSENTRY_API_URL: "http://backend:3000/api/v1",
    DASHBOARD_ORIGIN: "https://localhost",
  });
  const dashboardId = (
    await docker(
      "run",
      "-d",
      "--name",
      name + "-dashboard",
      "--network",
      name,
      "--network-alias",
      "dashboard",
      "--read-only",
      "--user",
      "10001:10001",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges:true",
      "--tmpfs",
      "/tmp:rw,size=32m,mode=1777",
      "--tmpfs",
      "/app/.next/cache:rw,size=128m,uid=10001,gid=10001,mode=0700",
      "--env-file",
      dashboardEnv,
      dashboard,
    )
  ).stdout.trim();
  ids.push(dashboardId);
  await ready(dashboardId);
  const template = await readFile(
    resolve("infra/production/nginx.template.conf"),
    "utf8",
  );
  await writeFile(
    join(root, "nginx.conf"),
    template.replaceAll("__NETSENTRY_HOST__", "localhost"),
    { mode: 0o644 },
  );
  const ingressId = (
    await docker(
      "run",
      "-d",
      "--name",
      name + "-ingress",
      "--network",
      name,
      "--read-only",
      "--user",
      "10001:10001",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges:true",
      "--tmpfs",
      "/tmp:rw,size=32m,mode=1777",
      "-p",
      "127.0.0.1::8443",
      "-v",
      join(root, "nginx.conf") + ":/etc/netsentry/nginx.conf:ro",
      "-v",
      join(root, "tls") + ":/run/tls:ro",
      "--entrypoint",
      "nginx",
      nginx,
      "-c",
      "/etc/netsentry/nginx.conf",
      "-g",
      "daemon off;",
    )
  ).stdout.trim();
  ids.push(ingressId);
  const httpsPort = (await docker("port", ingressId, "8443/tcp")).stdout
    .trim()
    .split(":")
    .at(-1);
  await delay(1500);
  const smoke = await run(
    process.execPath,
    ["infra/scripts/smoke.mjs", `https://localhost:${httpsPort}`],
    {
      env: { ...process.env, NODE_EXTRA_CA_CERTS: join(root, "ca.crt") },
      timeout: 45000,
      maxBuffer: 100000,
    },
  );
  assert.equal(JSON.parse(smoke.stdout).status, "ok");
  await assert.rejects(
    run(
      process.execPath,
      ["infra/scripts/smoke.mjs", `https://localhost:${httpsPort}`],
      {
        env: { ...process.env, NODE_EXTRA_CA_CERTS: "" },
        timeout: 45000,
        maxBuffer: 100000,
      },
    ),
  );
  // Real authenticated dump/recovery into a different empty database, using matching tools in PG container.
  const restoreEnv = {
    ...process.env,
    NODE_ENV: "test",
    TEST_DATABASE_URL: `postgresql://netsentry:${password}@127.0.0.1:${pgPort}/netsentry_deployment_test`,
    PG_CONTAINER: pgId.trim(),
  };
  await run(process.execPath, ["infra/scripts/check-recovery.mjs"], {
    env: restoreEnv,
    timeout: 180000,
    maxBuffer: 1000000,
  });
  await docker("stop", "--time", "10", pgId.trim());
  await assert.rejects(
    run(
      process.execPath,
      ["infra/scripts/smoke.mjs", `https://localhost:${httpsPort}`],
      {
        env: { ...process.env, NODE_EXTRA_CA_CERTS: join(root, "ca.crt") },
        timeout: 45000,
        maxBuffer: 100000,
      },
    ),
  );
  console.log(
    "Disposable image runtime passed: private non-root read-only API/dashboard, explicit migrations/schema parity, DB TLS, worker health, HTTPS ingress/trust failure, database outage and encrypted recovery. No production deployment was performed.",
  );
} finally {
  for (const id of ids.reverse()) await docker("rm", "-f", id).catch(() => {});
  if (network) await docker("network", "rm", name).catch(() => {});
  await docker(
    "run",
    "--rm",
    "-v",
    root + ":/fixtures",
    "--entrypoint",
    "sh",
    pg,
    "-c",
    `chown -R ${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000} /fixtures; chmod -R u+rwX /fixtures`,
  ).catch(() => {});
  await rm(root, { recursive: true, force: true });
}
