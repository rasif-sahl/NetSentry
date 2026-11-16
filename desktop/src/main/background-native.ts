import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { lstat, realpath } from "node:fs/promises";
import { join } from "node:path";
import {
  backgroundLabel,
  type BackgroundPorts,
  type LaunchState,
} from "./background-service.js";
import { holdAgentUpdateLock } from "./update-lock.js";
import { verifyDesktopTrust } from "./desktop-trust.js";
import { request } from "./agent-client.js";
const run = promisify(execFile);
const sleep = (ms: number) => new Promise((yes) => setTimeout(yes, ms));
// Fixture labels are available only to repository tests, never from renderer IPC.
export function launchdPorts(label: string = backgroundLabel) {
  if (
    label !== backgroundLabel &&
    !/^com\.netsentry\.fixture\.[a-f0-9-]{36}$/.test(label)
  )
    throw new Error("Unsupported service label.");
  const uid = process.getuid?.() ?? -1;
  const domain = `gui/${uid}`,
    target = `${domain}/${label}`;
  const command = (args: string[]) => {
    if (process.platform !== "darwin" || !Number.isInteger(uid) || uid <= 0)
      throw new Error("Per-user macOS service required.");
    return run("/bin/launchctl", args, { timeout: 10000, maxBuffer: 32768 });
  };
  const inspect = async (): Promise<LaunchState> => {
    try {
      const { stdout } = await command(["print", target]);
      const program = stdout.match(/^\s*program = (.+)$/m)?.[1],
        path = stdout.match(/^\s*path = (.+)$/m)?.[1];
      return {
        loaded: true,
        running:
          /^\s*state = running\s*$/m.test(stdout) &&
          /^\s*pid = [1-9][0-9]*\s*$/m.test(stdout),
        program,
        path,
      };
    } catch (e) {
      const err = e as { stderr?: string };
      if (err.stderr?.includes(`Could not find service "${label}"`))
        return { loaded: false, running: false };
      throw new Error("Service state unavailable.");
    }
  };
  return {
    inspect,
    async load(path: string) {
      await command(["bootstrap", domain, path]);
    },
    async start() {
      await command(["kickstart", target]);
    },
    async unload() {
      try {
        await command(["bootout", target]);
      } catch {
        if (!(await inspect()).loaded) return;
        throw new Error("Service bootout failed.");
      }
      const end = Date.now() + 15000;
      while ((await inspect()).loaded) {
        if (Date.now() >= end) throw new Error("Service stop not confirmed.");
        await sleep(100);
      }
    },
  };
}
export function nativeBackgroundPorts(
  home: string,
  bundle: string,
  resources: string,
  stateDir: string,
  teamId: () => string,
  packaged: boolean,
): BackgroundPorts {
  const binary = join(resources, "agent", "netsentry-agent");
  const trusted = async () => {
    if (
      process.platform !== "darwin" ||
      (process.getuid?.() ?? 0) <= 0 ||
      !packaged
    )
      throw new Error("Signed per-user macOS application required.");
    const location = await realpath(bundle);
    if (
      ![
        join("/Applications", "NetSentry.app"),
        join(home, "Applications", "NetSentry.app"),
      ].includes(location)
    )
      throw new Error("Install in Applications first.");
    await verifyDesktopTrust(location, resources, teamId());
  };
  const helper = async (mode: string, expected: string) => {
    await trusted();
    const { stdout } = await run(binary, [mode, "--state-dir", stateDir], {
      timeout: 15000,
      maxBuffer: 4096,
    });
    if (stdout !== expected) throw new Error("Unexpected lifecycle response.");
  };
  return {
    ...launchdPorts(),
    trusted,
    eligible: () => helper("background-enable", '{"allowed":true}\n'),
    reserve: async () => {
      await trusted();
      return holdAgentUpdateLock(binary, stateDir);
    },
    async disableConsent() {
      await trusted();
      try {
        await lstat(join(stateDir, "agent.sock"));
        const result = await request({ binary, stateDir }, "set_background", {
          allowed: false,
        });
        if (result.ok && !result.status.backgroundRequested) return true;
      } catch {}
      await helper("background-disable", '{"disabled":true}\n');
      return true;
    },
  };
}
