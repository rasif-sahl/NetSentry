// Explicit opt-in native launchd fixture. No production label, monitoring or login plist.
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { launchdPorts } from "../dist/main/background-native.js";
if (process.platform !== "darwin" || process.env.RUN_LAUNCHD_FIXTURE !== "1")
  throw new Error(
    "Set RUN_LAUNCHD_FIXTURE=1 on an existing macOS GUI session; no tools are installed.",
  );
const dir = await realpath(
    await mkdtemp(join(tmpdir(), "netsentry-launchd-fixture-")),
  ),
  label = "com.netsentry.fixture." + randomUUID(),
  file = join(dir, "fixture.plist"),
  port = launchdPorts(label);
let attempted = false;
try {
  assert.equal((await port.inspect()).loaded, false);
  await writeFile(
    file,
    `<?xml version="1.0"?><plist version="1.0"><dict><key>Label</key><string>${label}</string><key>ProgramArguments</key><array><string>/bin/sleep</string><string>30</string></array><key>RunAtLoad</key><true/><key>KeepAlive</key><false/><key>StandardOutPath</key><string>/dev/null</string><key>StandardErrorPath</key><string>/dev/null</string></dict></plist>`,
    { mode: 0o600 },
  );
  attempted = true;
  await port.load(file);
  const end = Date.now() + 5000;
  let job;
  do {
    job = await port.inspect();
    if (job.running) break;
    await new Promise((yes) => setTimeout(yes, 50));
  } while (Date.now() < end);
  assert.equal(job.loaded, true);
  assert.equal(job.running, true);
  assert.equal(job.program, "/bin/sleep");
  assert.equal(job.path, file);
  await port.unload();
  assert.equal((await port.inspect()).loaded, false);
  await port.unload();
  console.log(
    "Actual per-user launchctl bootstrap/running-state/bootout and idempotent removal passed for a unique temporary 30-second sleep fixture. No NetSentry production job or login plist was installed.",
  );
} finally {
  if (attempted) await port.unload();
  await rm(dir, { recursive: true, force: true });
}
