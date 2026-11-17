import { lstat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { join } from "node:path";
import type { DesktopManifest, ReleasePolicy } from "./update-policy.js";
import {
  verifyEnvelope,
  getEnvelope,
  newerVersion,
  UpdateStore,
} from "./update-policy.js";
import type { UpdateLease } from "./update-lock.js";
export type UpdateView = {
  state:
    | "disabled"
    | "idle"
    | "checking"
    | "available"
    | "downloading"
    | "downloaded"
    | "installing"
    | "error";
  version: string;
  message: string;
};
export interface UpdaterPort {
  check(manifest: DesktopManifest): Promise<void>;
  download(): Promise<string>;
  install(): void;
  onError?(callback: () => void): void;
}
export class UpdateController {
  private view: UpdateView;
  private candidate?: DesktopManifest;
  private file = "";
  private busy = false;
  private unlock?: UpdateLease;
  constructor(
    private readonly policy: ReleasePolicy,
    private readonly currentVersion: string,
    private readonly architecture: string,
    private readonly store: UpdateStore,
    private readonly agentState: string,
    private readonly port: UpdaterPort | null,
    private readonly fetchEnvelope = (p: ReleasePolicy, a: string) =>
      getEnvelope(p, a),
    private readonly quiesce: () => Promise<UpdateLease> = async () => () => {},
  ) {
    this.view = {
      state: port && policy.enabled ? "idle" : "disabled",
      version: currentVersion,
      message:
        port && policy.enabled
          ? "Updates are checked only when you request them."
          : "Production updates are unavailable until a signed macOS release and update host are configured.",
    };
    port?.onError?.(() => this.failed());
  }
  async restore() {
    if (!this.port || !this.policy.enabled) return;
    try {
      const old = await this.store.read();
      if (old?.status === "install_requested")
        this.view.message =
          old.version === this.currentVersion
            ? "The requested update is installed. Check again for newer releases."
            : "The previous update did not complete. Check again to recover; no automatic retry was started.";
    } catch {
      this.failed();
    }
  }
  private failed() {
    this.unlock?.();
    this.unlock = undefined;
    this.view = {
      state: "error",
      version: this.currentVersion,
      message:
        "Update could not continue. Stop any foreground agent, remove the background service, check the host and signed release, then check again. No downgrade was authorized.",
    };
  }
  status() {
    return { ...this.view };
  }
  async act(action: string, confirm: () => Promise<boolean>) {
    if (!["status", "check", "download", "install"].includes(action))
      throw new Error("Unknown update action.");
    if (
      action === "status" ||
      !this.port ||
      !this.policy.enabled ||
      this.busy ||
      this.view.state === "installing"
    )
      return this.status();
    this.busy = true;
    try {
      if (action === "check") {
        this.candidate = undefined;
        this.file = "";
        this.view = {
          state: "checking",
          version: this.currentVersion,
          message: "Checking signed release information…",
        };
        const m = verifyEnvelope(
          await this.fetchEnvelope(this.policy, this.architecture),
          this.policy,
          this.architecture,
        );
        await this.store.accept(m, "checked");
        if (!newerVersion(m.version, this.currentVersion)) {
          this.view = {
            state: "idle",
            version: this.currentVersion,
            message: "This version is current.",
          };
          return this.status();
        }
        await this.port.check(m);
        this.candidate = m;
        this.view = {
          state: "available",
          version: m.version,
          message:
            "A verified release is available. Downloading does not install it.",
        };
      } else if (action === "download") {
        if (this.view.state !== "available" || !this.candidate)
          throw new Error("Check for an update first.");
        this.fresh();
        if (!(await confirm())) return this.status();
        this.fresh();
        this.view = {
          state: "downloading",
          version: this.candidate.version,
          message: "Downloading the verified release…",
        };
        this.file = await this.port.download();
        await this.verifyDownload();
        await this.store.accept(this.candidate, "downloaded");
        this.view = {
          state: "downloaded",
          version: this.candidate.version,
          message:
            "Download verified. Stop the foreground agent and remove any registered background service before installing.",
        };
      } else {
        if (this.view.state !== "downloaded" || !this.candidate)
          throw new Error("Download an update first.");
        this.fresh();
        try {
          await lstat(join(this.agentState, "agent.sock"));
          throw new Error("Agent must be stopped.");
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
        }
        if (!(await confirm())) return this.status();
        this.fresh();
        this.unlock = await this.quiesce();
        try {
          await lstat(join(this.agentState, "agent.sock"));
          throw new Error("Agent socket exists.");
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
        }
        await this.verifyDownload();
        await this.store.accept(this.candidate, "install_requested");
        this.fresh();
        this.view = {
          state: "installing",
          version: this.candidate.version,
          message:
            "Handing the signed update to macOS. The app will restart after validation.",
        };
        if (this.unlock?.isHeld && !this.unlock.isHeld())
          throw new Error("Agent lock lost.");
        this.port.install();
      }
    } catch {
      this.failed();
    } finally {
      this.busy = false;
    }
    return this.status();
  }
  private fresh() {
    if (!this.candidate || Date.parse(this.candidate.expiresAt) <= Date.now())
      throw new Error("Update expired.");
  }
  private async verifyDownload() {
    this.fresh();
    const s = await lstat(this.file);
    if (
      !s.isFile() ||
      s.isSymbolicLink() ||
      s.mode & 0o022 ||
      s.uid !== process.getuid?.() ||
      s.size !== this.candidate!.artifact.size
    )
      throw new Error("Invalid update artifact.");
    const digest = createHash("sha512");
    for await (const chunk of createReadStream(this.file)) digest.update(chunk);
    if (digest.digest("base64") !== this.candidate!.artifact.sha512)
      throw new Error("Update digest mismatch.");
  }
}
