import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { open, lstat, unlink } from "node:fs/promises";
import { constants } from "node:fs";
import { parseAgentDiagnostics } from "./diagnostics.js";
const run = promisify(execFile);
// Binary/state are fixed by main, never supplied by renderer IPC.
export async function agentDiagnostics(
  binary: string,
  state: string,
  repair: boolean,
) {
  const { stdout } = await run(
    binary,
    [repair ? "repair-socket" : "diagnose", "--state-dir", state],
    { timeout: 15000, maxBuffer: 8192 },
  );
  return parseAgentDiagnostics(JSON.parse(stdout));
}
// Native save dialog supplies the destination. Refuse existing files/symlinks.
export async function saveDiagnosticReport(path: string, content: string) {
  const file = await open(
    path,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      constants.O_NOFOLLOW,
    0o600,
  );
  let complete = false;
  try {
    await file.writeFile(content, "utf8");
    await file.sync();
    complete = true;
  } finally {
    const original = await file.stat();
    await file.close();
    if (!complete) {
      const current = await lstat(path).catch(() => undefined);
      if (current?.dev === original.dev && current?.ino === original.ino)
        await unlink(path);
    }
  }
}
