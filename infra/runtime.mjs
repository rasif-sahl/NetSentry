import { readFileSync, lstatSync } from "node:fs";
import { spawn } from "node:child_process";
const keys = [
  "DATABASE_URL",
  "DATABASE_SSL_CA",
  "JWT_ACCESS_TOKEN_SECRET",
  "JWT_REFRESH_TOKEN_SECRET",
  "ACCOUNT_MAIL_ENCRYPTION_KEY",
  "ROUTER_CREDENTIAL_ENCRYPTION_KEY",
  "BILLING_EVENT_SECRET",
];
try {
  for (const key of keys) {
    const file = process.env[key + "_FILE"];
    if (file) {
      const st = lstatSync(file);
      if (!st.isFile() || st.isSymbolicLink() || st.size > 65536)
        throw new Error("Secret input rejected.");
      process.env[key] = readFileSync(file, "utf8").trim();
      delete process.env[key + "_FILE"];
    }
  }
  const args =
    process.env.APP_KIND === "dashboard"
      ? [
          "node_modules/next/dist/bin/next",
          "start",
          "--hostname",
          "0.0.0.0",
          "--port",
          "3001",
        ]
      : process.env.APP_KIND === "operations-worker"
        ? ["dist/operations/work-cli.js"]
        : ["dist/main.js"];
  const child = spawn(process.execPath, args, {
    stdio: "inherit",
    env: process.env,
  });
  for (const s of ["SIGTERM", "SIGINT"]) process.on(s, () => child.kill(s));
  child.on("error", () => {
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
} catch {
  console.error("Runtime secret/configuration input failed.");
  process.exitCode = 1;
}
