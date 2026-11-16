import { spawn } from "node:child_process";
import { loadSecrets, runtimeCommand } from "./runtime-lib.mjs";
try {
  const kind = process.argv[2] || process.env.APP_KIND;
  const args = runtimeCommand(kind);
  const env = await loadSecrets(process.env);
  const child = spawn(process.execPath, args, {
    stdio: "inherit",
    env,
    shell: false,
  });
  for (const signal of ["SIGTERM", "SIGINT"])
    process.on(signal, () => child.kill(signal));
  child.on("error", () => {
    console.error("Runtime process could not start.");
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    process.exitCode = code ?? (["SIGTERM", "SIGINT"].includes(signal) ? 0 : 1);
  });
} catch {
  console.error("Runtime secret/configuration input failed.");
  process.exitCode = 1;
}
