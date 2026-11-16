import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
const root = await mkdtemp(join(tmpdir(), "netsentry-compose-"));
try {
  const envFile = join(root, "empty.env");
  await writeFile(envFile, "", { mode: 0o600 });
  const env = {
    ...process.env,
    BACKEND_IMAGE: "example.invalid/backend@sha256:" + "a".repeat(64),
    DASHBOARD_IMAGE: "example.invalid/dashboard@sha256:" + "b".repeat(64),
    SERVER_ENV_FILE: envFile,
    DASHBOARD_ENV_FILE: envFile,
    SERVER_SECRET_DIR: root,
  };
  execFileSync(
    "docker",
    [
      "compose",
      "--env-file",
      envFile,
      "-f",
      resolve("infra/compose.yaml"),
      "config",
      "--quiet",
    ],
    { env, stdio: "pipe" },
  );
  console.log(
    "Compose configuration parses with explicit synthetic image/configuration inputs; no daemon or container was started.",
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
