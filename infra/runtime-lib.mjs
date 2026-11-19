import { constants } from "node:fs";
import { open } from "node:fs/promises";
export const secretKeys = [
  "DATABASE_URL",
  "DATABASE_SSL_CA",
  "JWT_ACCESS_TOKEN_SECRET",
  "JWT_REFRESH_TOKEN_SECRET",
  "ACCOUNT_MAIL_ENCRYPTION_KEY",
  "ROUTER_CREDENTIAL_ENCRYPTION_KEY",
  "BILLING_EVENT_SECRET",
];
export async function loadSecrets(input) {
  const env = { ...input };
  for (const key of secretKeys) {
    const path = env[key + "_FILE"];
    if (!path) continue;
    if (env[key]) throw new Error("Ambiguous secret input.");
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const st = await file.stat();
      if (
        !st.isFile() ||
        st.size < 1 ||
        st.size > 65536 ||
        ![0o400, 0o600, 0o440].includes(st.mode & 0o777) ||
        ![0, process.getuid?.()].includes(st.uid)
      )
        throw new Error("Secret permissions rejected.");
      // 0400/0600 owner-only, or root-owned 0440 accessible to the runtime group.
      if (
        st.mode & 0o040 &&
        (st.uid !== 0 || st.gid !== process.getgid?.() || st.mode & 0o200)
      )
        throw new Error("Secret group access rejected.");
      const bytes = await file.readFile();
      if (bytes.length !== st.size) throw new Error("Secret changed.");
      env[key] = bytes.toString("utf8").trim();
      if (!env[key]) throw new Error("Empty secret.");
      delete env[key + "_FILE"];
    } finally {
      await file.close();
    }
  }
  return env;
}
export function runtimeCommand(kind) {
  if (kind === "backend") return ["dist/main.js"];
  if (kind === "dashboard")
    return [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "0.0.0.0",
      "--port",
      "3001",
    ];
  if (
    [
      "config-check",
      "migrate",
      "schema-check",
      "maintenance-once",
      "maintenance-health",
      "maintenance-worker",
    ].includes(kind)
  )
    return ["dist/deployment/other/cli.js", kind];
  if (kind === "operations-worker")
    return ["dist/operations/other/work-cli.js"];
  throw new Error("Unsupported runtime mode.");
}
