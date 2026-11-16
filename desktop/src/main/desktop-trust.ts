import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { lstat, realpath } from "node:fs/promises";
import { join } from "node:path";
const run = promisify(execFile);
export async function verifyDesktopTrust(
  bundle: string,
  resources: string,
  teamId: string,
) {
  if (process.platform !== "darwin" || !/^[A-Z0-9]{10}$/.test(teamId))
    throw new Error("Signed macOS installation required.");
  const agent = join(resources, "agent", "netsentry-agent");
  const s = await lstat(agent);
  if (
    !s.isFile() ||
    s.isSymbolicLink() ||
    s.mode & 0o022 ||
    !(s.mode & 0o100) ||
    ![0, process.getuid?.()].includes(s.uid) ||
    (await realpath(agent)) !== agent
  )
    throw new Error("Trusted bundled agent required.");
  const anchor = `anchor apple generic and certificate leaf[subject.OU] = "${teamId}"`;
  await run(
    "/usr/bin/codesign",
    [
      "--verify",
      "--strict",
      "--deep",
      "-R",
      `${anchor} and identifier "com.netsentry.desktop"`,
      bundle,
    ],
    { timeout: 15000, maxBuffer: 16384 },
  );
  await run(
    "/usr/bin/codesign",
    ["--verify", "--strict", "-R", anchor, agent],
    { timeout: 15000, maxBuffer: 16384 },
  );
}
