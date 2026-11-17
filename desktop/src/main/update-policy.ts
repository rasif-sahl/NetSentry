import { createHash, createPublicKey, verify } from "node:crypto";
import { constants } from "node:fs";
import { open, mkdir, rename, rm, lstat } from "node:fs/promises";
import { join } from "node:path";
import { request } from "node:https";
export type ReleasePolicy = {
  schemaVersion: 1;
  enabled: boolean;
  appId: string;
  teamId: string;
  feedUrl: string;
  publicKey: string;
  release: number;
};
export type DesktopManifest = {
  schemaVersion: 1;
  appId: string;
  platform: "darwin";
  architecture: "arm64" | "x64";
  release: number;
  version: string;
  issuedAt: string;
  expiresAt: string;
  artifact: { name: string; size: number; sha512: string };
};
function assert(value: unknown): asserts value {
  if (!value) throw new Error("Update evidence rejected.");
}
function exact(
  value: unknown,
  names: string[],
): asserts value is Record<string, unknown> {
  assert(value && typeof value === "object" && !Array.isArray(value));
  assert(Object.keys(value).sort().join(",") === names.sort().join(","));
}
export function versionParts(version: string) {
  assert(/^\d+\.\d+\.\d+$/.test(version));
  const p = version.split(".").map(Number);
  assert(p.every((n) => Number.isSafeInteger(n) && n >= 0));
  return p;
}
export function newerVersion(a: string, b: string) {
  const x = versionParts(a),
    y = versionParts(b);
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return x[i] > y[i];
  }
  return false;
}
export function validatePolicy(value: unknown): ReleasePolicy {
  exact(value, [
    "schemaVersion",
    "enabled",
    "appId",
    "teamId",
    "feedUrl",
    "publicKey",
    "release",
  ]);
  assert(
    value.schemaVersion === 1 &&
      typeof value.enabled === "boolean" &&
      value.appId === "com.netsentry.desktop" &&
      Number.isSafeInteger(value.release) &&
      Number(value.release) > 0,
  );
  assert(
    typeof value.teamId === "string" &&
      typeof value.feedUrl === "string" &&
      typeof value.publicKey === "string",
  );
  if (value.feedUrl) {
    const url = new URL(value.feedUrl);
    assert(
      url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        url.pathname.endsWith("/"),
    );
  }
  if (value.teamId) assert(/^[A-Z0-9]{10}$/.test(value.teamId));
  if (value.publicKey) {
    assert(
      /^[A-Za-z0-9+/]{43}=$/.test(value.publicKey) &&
        Buffer.from(value.publicKey, "base64").length === 32,
    );
  }
  if (value.enabled) assert(value.feedUrl && value.teamId && value.publicKey);
  return value as unknown as ReleasePolicy;
}
export async function privateRead(path: string, max: number) {
  const h = await open(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const s = await h.stat();
    assert(s.isFile() && s.size > 0 && s.size <= max);
    return await h.readFile();
  } finally {
    await h.close();
  }
}
export function verifyEnvelope(
  raw: Buffer,
  policy: ReleasePolicy,
  architecture: string,
  now = Date.now(),
): DesktopManifest {
  assert(policy.enabled && raw.length <= 32768);
  const envelope: unknown = JSON.parse(raw.toString("utf8"));
  exact(envelope, ["manifest", "signature"]);
  assert(
    typeof envelope.manifest === "string" &&
      typeof envelope.signature === "string",
  );
  const bytes = Buffer.from(envelope.manifest, "base64"),
    signature = Buffer.from(envelope.signature, "base64");
  assert(
    bytes.length <= 16384 &&
      signature.length === 64 &&
      bytes.toString("base64") === envelope.manifest &&
      signature.toString("base64") === envelope.signature,
  );
  const key = createPublicKey({
    key: Buffer.concat([
      Buffer.from("302a300506032b6570032100", "hex"),
      Buffer.from(policy.publicKey, "base64"),
    ]),
    type: "spki",
    format: "der",
  });
  assert(verify(null, bytes, key, signature));
  const m: unknown = JSON.parse(bytes.toString("utf8"));
  exact(m, [
    "schemaVersion",
    "appId",
    "platform",
    "architecture",
    "release",
    "version",
    "issuedAt",
    "expiresAt",
    "artifact",
  ]);
  assert(JSON.stringify(m) === bytes.toString("utf8"));
  assert(
    m.schemaVersion === 1 &&
      m.appId === policy.appId &&
      m.platform === "darwin" &&
      m.architecture === architecture &&
      Number.isSafeInteger(m.release) &&
      Number(m.release) >= policy.release &&
      typeof m.version === "string",
  );
  versionParts(m.version);
  assert(
    typeof m.issuedAt === "string" &&
      typeof m.expiresAt === "string" &&
      /\.\d{3}Z$/.test(m.issuedAt) &&
      /\.\d{3}Z$/.test(m.expiresAt),
  );
  const issued = Date.parse(m.issuedAt),
    expiry = Date.parse(m.expiresAt);
  assert(
    Number.isFinite(issued) &&
      Number.isFinite(expiry) &&
      issued <= now + 300000 &&
      expiry > now &&
      expiry > issued &&
      expiry - issued <= 7 * 86400000,
  );
  exact(m.artifact, ["name", "size", "sha512"]);
  assert(
    typeof m.artifact.name === "string" &&
      /^NetSentry-\d+\.\d+\.\d+-(arm64|x64)\.zip$/.test(m.artifact.name) &&
      m.artifact.name === `NetSentry-${m.version}-${architecture}.zip` &&
      Number.isSafeInteger(m.artifact.size) &&
      Number(m.artifact.size) > 0 &&
      Number(m.artifact.size) <= 1024 ** 3 &&
      typeof m.artifact.sha512 === "string" &&
      /^[A-Za-z0-9+/]{86}==$/.test(m.artifact.sha512) &&
      Buffer.from(m.artifact.sha512, "base64").length === 64,
  );
  return m as unknown as DesktopManifest;
}
export function getEnvelope(
  policy: ReleasePolicy,
  architecture: string,
): Promise<Buffer> {
  const url = new URL(`desktop-update-${architecture}.json`, policy.feedUrl);
  return new Promise((yes, no) => {
    const req = request(
      url,
      {
        method: "GET",
        timeout: 15000,
        headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          no(new Error("Update host unavailable."));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 32768) {
            req.destroy();
            no(new Error("Update response too large."));
          } else chunks.push(chunk);
        });
        res.on("end", () => yes(Buffer.concat(chunks)));
        res.on("error", () => no(new Error("Update response failed.")));
      },
    );
    req.on("timeout", () => req.destroy());
    req.on("error", () => no(new Error("Update connection failed.")));
    req.end();
  });
}
export type UpdateReceipt = {
  release: number;
  hash: string;
  version: string;
  status: "checked" | "downloaded" | "install_requested" | "installed";
};
export class UpdateStore {
  constructor(private readonly dir: string) {}
  private async directory() {
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    const s = await lstat(this.dir);
    assert(
      s.isDirectory() &&
        !s.isSymbolicLink() &&
        (s.mode & 0o077) === 0 &&
        s.uid === process.getuid?.(),
    );
  }
  async read(): Promise<UpdateReceipt | null> {
    await this.directory();
    try {
      const path = join(this.dir, "release.json");
      const s = await lstat(path);
      assert((s.mode & 0o077) === 0 && s.uid === process.getuid?.());
      const data: unknown = JSON.parse(
        (await privateRead(path, 4096)).toString(),
      );
      exact(data, ["release", "hash", "version", "status"]);
      assert(
        Number.isSafeInteger(data.release) &&
          Number(data.release) > 0 &&
          typeof data.hash === "string" &&
          /^[a-f0-9]{64}$/.test(data.hash) &&
          typeof data.version === "string" &&
          ["checked", "downloaded", "install_requested", "installed"].includes(
            String(data.status),
          ),
      );
      versionParts(data.version);
      return data as unknown as UpdateReceipt;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }
  async accept(manifest: DesktopManifest, status: UpdateReceipt["status"]) {
    const old = await this.read(),
      hash = createHash("sha256")
        .update(JSON.stringify(manifest))
        .digest("hex");
    assert(
      !old ||
        manifest.release > old.release ||
        (manifest.release === old.release && hash === old.hash),
    );
    const path = join(this.dir, "release.json"),
      tmp = path + ".new";
    const h = await open(tmp, "wx", 0o600);
    try {
      await h.writeFile(
        JSON.stringify({
          release: manifest.release,
          hash,
          version: manifest.version,
          status,
        }),
      );
      await h.sync();
      await h.close();
      await rename(tmp, path);
    } catch (e) {
      await h.close().catch(() => {});
      await rm(tmp, { force: true });
      throw e;
    }
  }
}
