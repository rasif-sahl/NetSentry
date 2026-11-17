import { spawn } from "node:child_process";
import { lstat } from "node:fs/promises";
export type UpdateLease = (() => void) & { isHeld?: () => boolean };
// Executable is the already signature-verified bundled agent, never renderer input.
export async function holdAgentUpdateLock(
  binary: string,
  state: string,
): Promise<UpdateLease> {
  try {
    await lstat(state);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return () => {};
    throw e;
  }
  return new Promise((yes, no) => {
    const child = spawn(binary, ["hold-update-lock", "--state-dir", state], {
      shell: false,
      stdio: ["pipe", "pipe", "ignore"],
    });
    let output = "",
      settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        child.stdin.end();
        child.kill();
        no(new Error("Agent lock timed out."));
      }
    }, 5000);
    child.stdin.on("error", () => {});
    child.once("error", () => {
      clearTimeout(timer);
      if (!settled) no(new Error("Agent lock unavailable."));
    });
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
      if (output.length > 64) {
        child.kill();
        return;
      }
      if (output === '{"locked":true}\n' && !settled) {
        settled = true;
        clearTimeout(timer);
        yes(
          Object.assign(
            () => {
              child.stdin.end();
            },
            { isHeld: () => child.exitCode === null && !child.killed },
          ),
        );
      }
    });
    child.once("exit", () => {
      clearTimeout(timer);
      if (!settled) no(new Error("Stop the agent before installing."));
    });
  });
}
