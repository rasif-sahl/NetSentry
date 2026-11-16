import { readFile, lstat, open } from "node:fs/promises";
import { constants } from "node:fs";
import { parseEnv } from "node:util";
import { resolve, isAbsolute, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { smokeHttps } from "./smoke.mjs";
import { spawn } from "node:child_process";
const root = fileURLToPath(new URL("../../", import.meta.url));
export function pinnedImage(value) {
  return (
    typeof value === "string" &&
    !value.includes("://") &&
    !value.includes("//") &&
    /^[a-z0-9][a-z0-9./:_-]*@sha256:[a-f0-9]{64}$/.test(value)
  );
}
export async function privateEnvironment(path) {
  if (!isAbsolute(path))
    throw new Error("Absolute private configuration required.");
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const st = await file.stat();
    if (
      !st.isFile() ||
      st.size > 65536 ||
      st.mode & 0o077 ||
      ![0, process.getuid?.()].includes(st.uid)
    )
      throw new Error("Private configuration rejected.");
    return parseEnv(await file.readFile("utf8"));
  } finally {
    await file.close();
  }
}
const fields = [
  "COMPOSE_PROJECT_NAME",
  "BACKEND_IMAGE",
  "DASHBOARD_IMAGE",
  "INGRESS_IMAGE",
  "SERVER_ENV_FILE",
  "DASHBOARD_ENV_FILE",
  "SERVER_SECRET_DIR",
  "TLS_CERT_DIR",
  "INGRESS_CONFIG_FILE",
  "PUBLIC_HOST",
  "HTTPS_BIND_ADDRESS",
];
export async function deploymentConfiguration(path) {
  const env = await privateEnvironment(path);
  if (
    Object.keys(env).some((k) => !fields.includes(k)) ||
    fields.some((k) => !env[k] || /[\r\n\0$`]/.test(env[k]))
  )
    throw new Error("Deployment fields rejected.");
  for (const key of ["BACKEND_IMAGE", "DASHBOARD_IMAGE", "INGRESS_IMAGE"])
    if (!pinnedImage(env[key]))
      throw new Error("Reviewed image digests required.");
  if (
    env.PUBLIC_HOST.endsWith(".invalid") ||
    !/^[a-z][a-z0-9-]{2,40}$/.test(env.COMPOSE_PROJECT_NAME) ||
    !/^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
      env.PUBLIC_HOST,
    ) ||
    !["127.0.0.1", "0.0.0.0"].includes(env.HTTPS_BIND_ADDRESS)
  )
    throw new Error("Invalid project, public host or bind address.");
  for (const key of [
    "SERVER_ENV_FILE",
    "DASHBOARD_ENV_FILE",
    "SERVER_SECRET_DIR",
    "TLS_CERT_DIR",
    "INGRESS_CONFIG_FILE",
  ])
    if (!isAbsolute(env[key]))
      throw new Error("Absolute deployment paths required.");
  const server = await privateEnvironment(env.SERVER_ENV_FILE),
    dashboard = await privateEnvironment(env.DASHBOARD_ENV_FILE);
  for (const key of [
    "DATABASE_URL",
    "DATABASE_SSL_CA",
    "JWT_ACCESS_TOKEN_SECRET",
    "JWT_REFRESH_TOKEN_SECRET",
    "ACCOUNT_MAIL_ENCRYPTION_KEY",
    "ROUTER_CREDENTIAL_ENCRYPTION_KEY",
    "BILLING_EVENT_SECRET",
  ])
    if (server[key])
      throw new Error("Use mounted secret files, never inline secrets.");
  for (const key of [
    "DATABASE_URL",
    "JWT_ACCESS_TOKEN_SECRET",
    "JWT_REFRESH_TOKEN_SECRET",
    "ACCOUNT_MAIL_ENCRYPTION_KEY",
    "ROUTER_CREDENTIAL_ENCRYPTION_KEY",
  ])
    if (!/^\/run\/secrets\/[a-z0-9-]+$/.test(server[key + "_FILE"] || ""))
      throw new Error("Required mounted secret missing.");
  if (
    server.API_PREFIX !== "api" ||
    server.PORT !== "3000" ||
    server.BILLING_MODE !== "disabled" ||
    server.CORS_ORIGINS !== `https://${env.PUBLIC_HOST}` ||
    server.PUBLIC_APP_URL !== `https://${env.PUBLIC_HOST}` ||
    dashboard.DASHBOARD_ORIGIN !== `https://${env.PUBLIC_HOST}` ||
    dashboard.NETSENTRY_API_URL !== "http://backend:3000/api/v1"
  )
    throw new Error("Origins, production mode or service URLs do not match.");
  for (const key of ["SERVER_SECRET_DIR", "TLS_CERT_DIR"]) {
    const st = await lstat(env[key]);
    if (!st.isDirectory() || st.isSymbolicLink() || st.mode & 0o027)
      throw new Error("Private mount directory rejected.");
  }
  for (const [key, value] of Object.entries(server).filter(([key]) =>
    key.endsWith("_FILE"),
  )) {
    if (!/^\/run\/secrets\/[a-z0-9-]+$/.test(value))
      throw new Error("Unsupported secret path.");
    const st = await lstat(
      join(env.SERVER_SECRET_DIR, value.slice("/run/secrets/".length)),
    );
    if (!st.isFile() || st.isSymbolicLink() || st.size < 1 || st.mode & 0o027)
      throw new Error("Secret mount rejected.");
  }
  for (const name of ["fullchain.pem", "privkey.pem"]) {
    const st = await lstat(join(env.TLS_CERT_DIR, name));
    if (
      !st.isFile() ||
      st.isSymbolicLink() ||
      (name === "privkey.pem" && st.mode & 0o027)
    )
      throw new Error("TLS material rejected.");
  }
  return env;
}
export function composeArgs(env) {
  return [
    "compose",
    "--project-name",
    env.COMPOSE_PROJECT_NAME,
    "--project-directory",
    root,
    "-f",
    join(root, "infra/compose.yaml"),
    "-f",
    join(root, "infra/compose.https.yaml"),
  ];
}
export function executeCompose(env, args) {
  return new Promise((yes, no) => {
    const child = spawn("docker", [...composeArgs(env), ...args], {
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        DOCKER_HOST: process.env.DOCKER_HOST,
        DOCKER_CONTEXT: process.env.DOCKER_CONTEXT,
        ...env,
      },
      stdio: ["ignore", "ignore", "ignore"],
      shell: false,
    });
    child.once("error", () => no(new Error("Docker unavailable.")));
    child.once("exit", (code) =>
      code === 0 ? yes() : no(new Error("Compose operation failed.")),
    );
  });
}
export function ingressConfig(template, host) {
  if (!/^([a-z0-9-]+\.)+[a-z]{2,63}$/.test(host))
    throw new Error("Invalid HTTPS host.");
  return template.replaceAll("__NETSENTRY_HOST__", host);
}
async function main() {
  const [action, path, confirmation] = process.argv.slice(2);
  if (
    !["check", "render-ingress", "migrate", "start", "status", "stop"].includes(
      action,
    )
  )
    throw new Error("Unknown deployment action.");
  const env = await deploymentConfiguration(resolve(path || ""));
  if (action === "render-ingress") {
    const template = await readFile(
      join(root, "infra/production/nginx.template.conf"),
      "utf8",
    );
    const file = await open(env.INGRESS_CONFIG_FILE, "wx", 0o644);
    try {
      await file.writeFile(ingressConfig(template, env.PUBLIC_HOST));
      await file.sync();
    } finally {
      await file.close();
    }
  } else {
    const expected = ingressConfig(
      await readFile(
        join(root, "infra/production/nginx.template.conf"),
        "utf8",
      ),
      env.PUBLIC_HOST,
    );
    const st = await lstat(env.INGRESS_CONFIG_FILE);
    if (
      !st.isFile() ||
      st.isSymbolicLink() ||
      st.mode & 0o022 ||
      (await readFile(env.INGRESS_CONFIG_FILE, "utf8")) !== expected
    )
      throw new Error("Generate the matching ingress configuration first.");
    await executeCompose(env, ["config", "--quiet"]);
    if (action === "migrate") {
      if (confirmation !== "APPLY_REVIEWED_MIGRATIONS")
        throw new Error("Explicit migration confirmation required.");
      await executeCompose(env, [
        "run",
        "--rm",
        "--no-deps",
        "-e",
        "MIGRATION_CONFIRM=APPLY_REVIEWED_MIGRATIONS",
        "backend",
        "migrate",
      ]);
    } else if (action === "start") {
      await executeCompose(env, [
        "run",
        "--rm",
        "--no-deps",
        "backend",
        "schema-check",
      ]);
      await executeCompose(env, [
        "up",
        "-d",
        "--wait",
        "--wait-timeout",
        "180",
      ]);
      await smokeHttps(`https://${env.PUBLIC_HOST}`);
    } else if (action === "stop") await executeCompose(env, ["stop"]);
    else if (action === "status") {
      await executeCompose(env, [
        "exec",
        "-T",
        "backend",
        "node",
        "infra/runtime.mjs",
        "schema-check",
      ]);
      await executeCompose(env, [
        "exec",
        "-T",
        "maintenance",
        "node",
        "infra/runtime.mjs",
        "maintenance-health",
      ]);
      await smokeHttps(`https://${env.PUBLIC_HOST}`);
    } else
      await executeCompose(env, [
        "run",
        "--rm",
        "--no-deps",
        "backend",
        "config-check",
      ]);
  }
  console.log(
    JSON.stringify({
      status: "completed",
      operation: action,
      liveAcceptance: false,
    }),
  );
}
if (import.meta.url === pathToFileURL(resolve(process.argv[1] || "")).href)
  main().catch(() => {
    console.error(
      "Deployment action failed. Check private configuration, image digests, TLS material, migration parity and container health. No secrets or container logs are printed.",
    );
    process.exitCode = 1;
  });
