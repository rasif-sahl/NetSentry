import { createHash } from "node:crypto";
import { lstat, mkdir, open, link, rm } from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import { privateRead } from "./update-policy.js";
import type { UpdateLease } from "./update-lock.js";
export const backgroundLabel = "com.netsentry.agent";
export type LaunchState = {
  loaded: boolean;
  running: boolean;
  program?: string;
  path?: string;
};
export interface BackgroundPorts {
  trusted(): Promise<void>;
  eligible(): Promise<void>;
  disableConsent(): Promise<boolean>;
  reserve(): Promise<UpdateLease>;
  inspect(): Promise<LaunchState>;
  load(path: string): Promise<void>;
  start(): Promise<void>;
  unload(): Promise<void>;
}
export type BackgroundView = {
  checkedAt?: string;
  verified: boolean;
  registered: boolean;
  loaded: boolean;
  running: boolean;
  canRegister: boolean;
  message: string;
};
type Receipt = {
  schemaVersion: 1;
  binary: string;
  stateDir: string;
  plistHash: string;
};
const xml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
export function agentPlist(binary: string, stateDir: string) {
  for (const p of [binary, stateDir])
    if (!isAbsolute(p) || /[\x00-\x1f]/.test(p))
      throw new Error("Invalid managed path.");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n<key>Label</key><string>${backgroundLabel}</string>\n<key>ProgramArguments</key><array>${[binary, "run", "--background", "--state-dir", stateDir].map((v) => `<string>${xml(v)}</string>`).join("")}</array>\n<key>RunAtLoad</key><true/>\n<key>KeepAlive</key><false/>\n<key>ProcessType</key><string>Background</string>\n<key>LimitLoadToSessionType</key><string>Aqua</string>\n<key>Umask</key><integer>63</integer>\n<key>ExitTimeOut</key><integer>10</integer>\n<key>StandardOutPath</key><string>/dev/null</string>\n<key>StandardErrorPath</key><string>/dev/null</string>\n</dict></plist>\n`;
}
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
async function safe(path: string, directory: boolean, privateMode = false) {
  const s = await lstat(path);
  if (
    s.isSymbolicLink() ||
    (directory ? !s.isDirectory() : !s.isFile()) ||
    s.uid !== process.getuid?.() ||
    s.mode & (privateMode ? 0o077 : 0o022)
  )
    throw new Error("Unsafe service state.");
}
async function present(path: string) {
  try {
    await lstat(path);
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw e;
  }
}
export class BackgroundService {
  readonly plistPath: string;
  private receiptPath: string;
  private busy = false;
  constructor(
    private readonly home: string,
    private readonly binary: string,
    private readonly stateDir: string,
    private readonly dataDir: string,
    private readonly ports: BackgroundPorts,
  ) {
    this.plistPath = join(
      home,
      "Library",
      "LaunchAgents",
      backgroundLabel + ".plist",
    );
    this.receiptPath = join(dataDir, "background-service.json");
  }
  private async receipt(): Promise<Receipt | null> {
    if (!(await present(this.receiptPath))) return null;
    await safe(this.dataDir, true, true);
    await safe(this.receiptPath, false, true);
    const r = JSON.parse(
      (await privateRead(this.receiptPath, 8192)).toString(),
    );
    if (
      !r ||
      Object.keys(r).sort().join(",") !==
        "binary,plistHash,schemaVersion,stateDir" ||
      r.schemaVersion !== 1 ||
      typeof r.binary !== "string" ||
      r.stateDir !== this.stateDir ||
      typeof r.plistHash !== "string" ||
      r.plistHash !== digest(agentPlist(r.binary, r.stateDir))
    )
      throw new Error("Invalid service receipt.");
    return r;
  }
  private async owned() {
    const receipt = await this.receipt(),
      exists = await present(this.plistPath),
      job = await this.ports.inspect();
    if (exists) {
      await safe(join(this.home, "Library", "LaunchAgents"), true);
      await safe(this.plistPath, false);
      if (
        !receipt ||
        (await privateRead(this.plistPath, 8192)).toString() !==
          agentPlist(receipt.binary, receipt.stateDir)
      )
        throw new Error("Service file conflict.");
    }
    if (
      job.loaded &&
      (!receipt ||
        job.program !== receipt.binary ||
        job.path !== this.plistPath)
    )
      throw new Error("Service job conflict.");
    return { receipt, exists, job };
  }
  async status(): Promise<BackgroundView> {
    try {
      const { exists, job } = await this.owned();
      const checkedAt = new Date().toISOString();
      let canRegister = false;
      try {
        await this.ports.trusted();
        canRegister = true;
      } catch {}
      return {
        checkedAt,
        verified: true,
        registered: exists || job.loaded,
        loaded: job.loaded,
        running: job.running,
        canRegister,
        message: job.running
          ? "The managed service process is running. Monitoring still requires its own consent and workspace permissions."
          : exists
            ? "Registered for login; the process is stopped. Use Start after resolving authorization, connection or socket errors."
            : canRegister
              ? "No managed background service is registered."
              : "Registration requires the signed macOS app installed in Applications. Removal of an owned job remains available.",
      };
    } catch {
      return {
        verified: false,
        registered: false,
        loaded: false,
        running: false,
        canRegister: false,
        message:
          "Service ownership or system state could not be verified. No job or file was changed; review before retrying.",
      };
    }
  }
  async act(
    action: string,
    confirm: () => Promise<boolean>,
  ): Promise<BackgroundView> {
    if (!["status", "register", "start", "remove"].includes(action))
      throw new Error("Unknown background action.");
    if (action === "status" || this.busy) return this.status();
    this.busy = true;
    try {
      let current = await this.owned();
      if (action === "remove") {
        if (!(await confirm())) return this.status();
        current = await this.owned();
        if (current.job.loaded) await this.ports.unload();
        current = await this.owned();
        if (current.job.loaded)
          throw new Error("Service removal not confirmed.");
        if (current.exists) await rm(this.plistPath);
        if (current.receipt) await rm(this.receiptPath);
        let disabled = false;
        try {
          disabled = await this.ports.disableConsent();
        } catch {}
        return {
          ...(await this.status()),
          message: disabled
            ? "Background service removed and local background permission disabled. Credentials, modules and sharing settings are preserved."
            : "No managed service remains. Local background permission could not be changed; review the signed agent settings separately.",
        };
      }
      await this.ports.trusted();
      if (current.receipt && current.receipt.binary !== this.binary)
        throw new Error("Remove the old app registration first.");
      if (action === "start" && !current.exists)
        throw new Error("Register the service first.");
      if (current.job.running) return this.status();
      if (!(await confirm())) return this.status();
      current = await this.owned();
      if (current.receipt && current.receipt.binary !== this.binary)
        throw new Error("Remove the old app registration first.");
      if (current.job.running) return this.status();
      await this.ports.eligible();
      const lease = await this.ports.reserve();
      try {
        if (await present(join(this.stateDir, "agent.sock")))
          throw new Error(
            "Stop the foreground agent and review any stale socket first.",
          );
        if (action === "register") {
          const library = join(this.home, "Library"),
            agents = join(library, "LaunchAgents");
          await safe(this.home, true);
          await safe(library, true);
          await mkdir(agents, { recursive: true, mode: 0o700 });
          await safe(agents, true);
          await mkdir(this.dataDir, { recursive: true, mode: 0o700 });
          await safe(this.dataDir, true, true);
          const receipt: Receipt = {
            schemaVersion: 1,
            binary: this.binary,
            stateDir: this.stateDir,
            plistHash: digest(agentPlist(this.binary, this.stateDir)),
          };
          if (!current.receipt)
            await this.exclusive(this.receiptPath, JSON.stringify(receipt));
          if (!current.exists)
            await this.exclusive(
              this.plistPath,
              agentPlist(this.binary, this.stateDir),
            );
        }
        if (lease.isHeld && !lease.isHeld())
          throw new Error("Runtime reservation was lost.");
      } finally {
        lease();
        const end = Date.now() + 5000;
        while (lease.isHeld?.()) {
          if (Date.now() >= end)
            throw new Error("Runtime reservation release not confirmed.");
          await new Promise((yes) => setTimeout(yes, 20));
        }
      }
      // The agent checks its own runtime lock and fresh grants again on startup.
      if (current.job.loaded) await this.ports.start();
      else await this.ports.load(this.plistPath);
      const result = await this.status();
      return {
        ...result,
        message: result.running
          ? "Background service registered and its process is running. Login startup is enabled; no restart loop is installed."
          : "Registration is saved. Process startup is not confirmed; refresh status and review consent, connectivity or stale sockets before retrying.",
      };
    } catch {
      return {
        ...(await this.status()),
        message:
          "Background operation could not complete. Stop any foreground agent, verify local/workspace consent and signed app placement, then retry. Existing ownership records were retained for safe recovery.",
      };
    } finally {
      this.busy = false;
    }
  }
  private async exclusive(path: string, value: string) {
    const temporary = path + ".netsentry-new";
    if (await present(temporary)) {
      await safe(temporary, false, true);
      if ((await privateRead(temporary, 8192)).toString() !== value)
        throw new Error("Unverified staging file.");
      await rm(temporary);
    }
    const h = await open(temporary, "wx", 0o600);
    try {
      await h.writeFile(value);
      await h.sync();
      await h.close();
      // Hard-link publication is atomic and refuses an existing destination.
      await link(temporary, path);
    } finally {
      await h.close().catch(() => {});
      await rm(temporary, { force: true });
    }
  }
  async assertRemovedForUpdate() {
    if (
      (await present(this.plistPath)) ||
      (await present(this.receiptPath)) ||
      (await this.ports.inspect()).loaded
    )
      throw new Error("Remove the background service before updating.");
  }
}
