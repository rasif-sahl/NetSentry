import { spawn } from "node:child_process";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { lstat } from "node:fs/promises";
import { connect, type Socket } from "node:net";
import { join } from "node:path";
import type { AgentResult, AgentStatus, Modules } from "./agent-types.js";

const HEX = /^[a-f0-9]{64}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export type AgentOptions = { stateDir: string; binary: string };
export function digest(secret: string, context: string, nonce: string, instance: string, client: string): string {
  return createHmac("sha256", Buffer.from(secret, "hex")).update(`${context}\n${nonce}\n${instance}\n${client}`).digest("hex");
}
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function keys(value: unknown, names: string[]): value is Record<string, unknown> {
  return object(value) && Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
}
function modules(value: unknown): value is Modules {
  return keys(value, ["network", "developer"]) && typeof value.network === "boolean" && typeof value.developer === "boolean";
}
function status(value: unknown): value is AgentStatus {
  if (!keys(value, ["schemaVersion", "installationId", "version", "platform", "paired", "connection", "requested", "authorized", "effective", "backgroundRequested", "backgroundAllowed", "bufferedEvents", "droppedEvents", "lastContact", "code", "serviceControlAvailable"])) return false;
  return value.schemaVersion === 1 && typeof value.installationId === "string" && UUID.test(value.installationId)
    && typeof value.version === "string" && typeof value.platform === "string" && typeof value.paired === "boolean"
    && ["unpaired", "offline", "online", "revoked"].includes(String(value.connection))
    && modules(value.requested) && modules(value.authorized) && modules(value.effective)
    && typeof value.backgroundRequested === "boolean" && typeof value.backgroundAllowed === "boolean"
    && Number.isInteger(value.bufferedEvents) && Number(value.bufferedEvents) >= 0 && Number(value.bufferedEvents) <= 1000
    && Number.isInteger(value.droppedEvents) && Number(value.droppedEvents) >= 0
    && typeof value.lastContact === "string" && typeof value.code === "string" && value.serviceControlAvailable === false;
}
async function privatePath(path: string, kind: "dir" | "socket"): Promise<void> {
  const stat = await lstat(path);
  if (stat.isSymbolicLink() || stat.uid !== process.getuid?.() || (stat.mode & 0o777) !== (kind === "dir" ? 0o700 : 0o600)
    || (kind === "dir" ? !stat.isDirectory() : !stat.isSocket())) throw new Error("unsafe local path");
}
export async function credential(options: AgentOptions): Promise<string> {
  const stat = await lstat(options.binary);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o022) !== 0 || !(stat.mode & 0o100)
    || (stat.uid !== 0 && stat.uid !== process.getuid?.())) throw new Error("untrusted agent executable");
  return new Promise((resolve, reject) => {
    const child = spawn(options.binary, ["desktop-credential", "--state-dir", options.stateDir], { stdio: ["ignore", "ignore", "ignore", "pipe"], shell: false });
    const pipe = child.stdio[3];
    let value = Buffer.alloc(0);
    const timer = setTimeout(() => { child.kill(); reject(new Error("credential helper timed out")); }, 5000);
    child.on("error", () => { clearTimeout(timer); reject(new Error("credential helper unavailable")); });
    pipe?.on("data", (chunk: Buffer) => { value = Buffer.concat([value, chunk]); if (value.length > 64) child.kill(); });
    child.on("close", (code) => { clearTimeout(timer); const secret = value.toString("ascii"); if (code === 0 && HEX.test(secret)) resolve(secret); else reject(new Error("local credential unavailable")); });
  });
}
class Frames {
  private pending = Buffer.alloc(0);
  private ready: unknown[] = [];
  private waiter?: { resolve(value: unknown): void; reject(error: Error): void };
  private failure?: Error;
  constructor(private socket: Socket) {
    socket.on("data", (data: Buffer) => {
      this.pending = Buffer.concat([this.pending, data]);
      while (this.pending.length >= 4) {
        const length = this.pending.readUInt32BE(0);
        if (!length || length > 65536 || this.ready.length > 2) { this.fail(); return; }
        if (this.pending.length < length + 4) return;
        try {
          const value: unknown = JSON.parse(this.pending.subarray(4, 4 + length).toString("utf8"));
          this.pending = this.pending.subarray(4 + length);
          if (this.waiter) { const waiter = this.waiter; this.waiter = undefined; waiter.resolve(value); } else this.ready.push(value);
        } catch { this.fail(); return; }
      }
    });
    socket.on("error", () => this.fail()); socket.on("close", () => this.fail()); socket.on("timeout", () => this.fail());
  }
  private fail() { this.failure = new Error("local connection unavailable"); this.waiter?.reject(this.failure); this.waiter = undefined; this.socket.destroy(); }
  read(): Promise<unknown> {
    if (this.ready.length) return Promise.resolve(this.ready.shift());
    if (this.failure) return Promise.reject(this.failure);
    return new Promise((resolve, reject) => { this.waiter = { resolve, reject }; });
  }
  write(value: unknown) { const data = Buffer.from(JSON.stringify(value)); if (data.length > 65536) throw new Error("oversize request"); const header = Buffer.alloc(4); header.writeUInt32BE(data.length); this.socket.write(Buffer.concat([header, data])); }
}
export async function request(options: AgentOptions, method: string, payload: unknown): Promise<AgentResult> {
  // A single allowlist is enforced in main as well as in the agent. No renderer-selected paths or commands.
  if (!(method === "get_status" && keys(payload, []))
    && !(method === "set_modules" && modules(payload))
    && !(method === "set_background" && keys(payload, ["allowed"]) && typeof payload.allowed === "boolean")
    && !(method === "pair" && keys(payload, ["token"]) && typeof payload.token === "string" && /^[A-Za-z0-9_-]{43}$/.test(payload.token))) return { ok: false, code: "INVALID_REQUEST" };
  if (process.platform === "win32") return { ok: false, code: "PLATFORM_UNAVAILABLE" };
  let socket: Socket | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await privatePath(options.stateDir, "dir");
    const path = join(options.stateDir, "agent.sock");
    await privatePath(path, "socket");
    const secret = await credential(options);
    socket = connect(path);
    socket.setTimeout(15000);
    timer = setTimeout(() => socket?.destroy(), 20000);
    const frames = new Frames(socket);
    const challenge = await frames.read();
    if (!keys(challenge, ["protocol", "version", "nonce", "instanceId"]) || challenge.protocol !== "netsentry-local" || challenge.version !== 1
      || typeof challenge.nonce !== "string" || !HEX.test(challenge.nonce) || typeof challenge.instanceId !== "string" || !HEX.test(challenge.instanceId)) throw new Error("invalid challenge");
    const client = randomBytes(32).toString("hex");
    frames.write({ version: 1, clientNonce: client, proof: digest(secret, "netsentry-local/v1", challenge.nonce, challenge.instanceId, client) });
    const ack = await frames.read();
    const expected = digest(secret, "netsentry-local/v1/accepted", challenge.nonce, challenge.instanceId, client);
    if (!keys(ack, ["authenticated", "proof"]) || ack.authenticated !== true || typeof ack.proof !== "string" || !HEX.test(ack.proof)
      || !timingSafeEqual(Buffer.from(ack.proof, "hex"), Buffer.from(expected, "hex"))) throw new Error("agent proof rejected");
    const requestId = randomUUID();
    frames.write({ schemaVersion: 2, requestId, method, payload });
    const reply = await frames.read();
    if (!keys(reply, ["schemaVersion", "requestId", "ok", "code", "data"]) || reply.schemaVersion !== 2 || reply.requestId !== requestId || typeof reply.code !== "string" || typeof reply.ok !== "boolean") throw new Error("invalid agent response");
    if (reply.ok && reply.code === "OK" && status(reply.data)) return { ok: true, status: reply.data };
    const codes = ["INVALID_REQUEST", "SETTINGS_WRITE_FAILED", "PAIRING_FAILED", "MODULE_DISABLED", "UNAVAILABLE_PHASE"];
    return { ok: false, code: codes.includes(reply.code) ? reply.code : "INVALID_AGENT_RESPONSE" };
  } catch { return { ok: false, code: "AGENT_UNAVAILABLE" }; }
  finally { if (timer) clearTimeout(timer); socket?.destroy(); }
}
