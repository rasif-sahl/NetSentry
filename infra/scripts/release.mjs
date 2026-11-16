import {
  createPrivateKey,
  createPublicKey,
  createHash,
  sign,
  verify,
} from "node:crypto";
import { constants } from "node:fs";
import {
  open,
  readFile,
  lstat,
  writeFile,
  mkdir,
  rename,
  rm,
} from "node:fs/promises";
import { basename, resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
async function regular(path, max, privateFile = false) {
  const i = await lstat(path);
  if (
    !i.isFile() ||
    i.isSymbolicLink() ||
    i.size > max ||
    (privateFile && (i.mode & 0o077) !== 0)
  )
    throw new Error("Release input rejected.");
  const h = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    return await h.readFile();
  } finally {
    await h.close();
  }
}
export async function packageRelease(
  artifact,
  keyFile,
  out,
  { release, version, platform, architecture, expiresAt },
) {
  if (
    !Number.isSafeInteger(release) ||
    release < 1 ||
    !/^\d+\.\d+\.\d+$/.test(version) ||
    !["darwin", "linux", "windows"].includes(platform) ||
    !["arm64", "amd64"].includes(architecture) ||
    !/[.]\d{3}Z$/.test(expiresAt) ||
    !Number.isFinite(Date.parse(expiresAt)) ||
    Date.parse(expiresAt) <= Date.now() ||
    Date.parse(expiresAt) > Date.now() + 30 * 86400000
  )
    throw new Error("Invalid release metadata.");
  const bytes = await regular(artifact, 128 * 1024 ** 2);
  if (bytes.length === 0) throw new Error("Empty artifact rejected.");
  const key = createPrivateKey(await regular(keyFile, 16384, true));
  if (key.asymmetricKeyType !== "ed25519")
    throw new Error("Ed25519 release key required.");
  const manifest = {
    schemaVersion: 1,
    release,
    version,
    platform,
    architecture,
    artifact: basename(artifact),
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    expiresAt,
  };
  await mkdir(out, { recursive: false, mode: 0o700 });
  try {
    await writeFile(join(out, manifest.artifact), bytes, {
      flag: "wx",
      mode: 0o600,
    });
    const raw = Buffer.from(JSON.stringify(manifest));
    await writeFile(join(out, "manifest.json"), raw, {
      flag: "wx",
      mode: 0o600,
    });
    await writeFile(
      join(out, "manifest.sig"),
      sign(null, raw, key).toString("base64"),
      { flag: "wx", mode: 0o600 },
    );
  } catch (e) {
    await rm(out, { recursive: true, force: true });
    throw e;
  }
  return manifest;
}
export async function verifyRelease(
  directory,
  pinnedKey,
  platform,
  architecture,
  minimum,
  stateFile,
) {
  const raw = await regular(join(directory, "manifest.json"), 16384),
    sig = Buffer.from(
      (await regular(join(directory, "manifest.sig"), 128)).toString(),
      "base64",
    );
  const keyBytes = Buffer.from(pinnedKey, "base64");
  if (keyBytes.length !== 32) throw new Error("Invalid pinned root.");
  const key = createPublicKey({
    key: Buffer.concat([
      Buffer.from("302a300506032b6570032100", "hex"),
      keyBytes,
    ]),
    format: "der",
    type: "spki",
  });
  if (!verify(null, raw, key, sig))
    throw new Error("Release signature rejected.");
  const m = JSON.parse(raw);
  if (JSON.stringify(m) !== raw.toString("utf8"))
    throw new Error("Canonical manifest required.");
  if (
    Object.keys(m).sort().join(",") !==
      [
        "schemaVersion",
        "release",
        "version",
        "platform",
        "architecture",
        "artifact",
        "bytes",
        "sha256",
        "expiresAt",
      ]
        .sort()
        .join(",") ||
    m.schemaVersion !== 1 ||
    !Number.isSafeInteger(m.release) ||
    m.release < minimum ||
    !Number.isSafeInteger(minimum) ||
    minimum < 1 ||
    !Number.isFinite(Date.parse(m.expiresAt)) ||
    !Number.isSafeInteger(m.bytes) ||
    m.bytes < 1 ||
    m.platform !== platform ||
    m.architecture !== architecture ||
    !/^\d+\.\d+\.\d+$/.test(m.version) ||
    basename(m.artifact) !== m.artifact ||
    m.artifact.startsWith(".") ||
    Date.parse(m.expiresAt) <= Date.now() ||
    Date.parse(m.expiresAt) > Date.now() + 30 * 86400000 ||
    !/[.]\d{3}Z$/.test(m.expiresAt)
  )
    throw new Error("Release target/freshness rejected.");
  const artifact = await regular(join(directory, m.artifact), 128 * 1024 ** 2);
  if (
    artifact.length !== m.bytes ||
    createHash("sha256").update(artifact).digest("hex") !== m.sha256
  )
    throw new Error("Release digest rejected.");
  if (stateFile) {
    const lock = await open(stateFile + ".lock", "wx", 0o600);
    try {
      let old;
      try {
        old = JSON.parse((await regular(stateFile, 4096, true)).toString());
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
      if (
        old &&
        (!Number.isSafeInteger(old.release) ||
          old.release < 1 ||
          !/^([a-f0-9]{64})$/.test(old.sha256))
      )
        throw new Error("Corrupt release state rejected.");
      if (
        old &&
        (old.platform !== platform ||
          old.architecture !== architecture ||
          m.release < old.release ||
          (m.release === old.release && m.sha256 !== old.sha256))
      )
        throw new Error("Rollback or release-number reuse rejected.");
      const tmp = stateFile + ".new";
      await writeFile(
        tmp,
        JSON.stringify({
          release: m.release,
          sha256: m.sha256,
          platform,
          architecture,
        }),
        { flag: "wx", mode: 0o600 },
      );
      await rename(tmp, stateFile);
    } finally {
      await lock.close();
      await rm(stateFile + ".lock", { force: true });
    }
  }
  return { verified: true, installed: false, release: m.release };
}
if (import.meta.url === pathToFileURL(resolve(process.argv[1] || "")).href) {
  try {
    const [mode, path, out, release, version, platform, architecture] =
      process.argv.slice(2);
    if (mode === "package")
      console.log(
        JSON.stringify(
          await packageRelease(
            path,
            process.env.RELEASE_PRIVATE_KEY_FILE,
            out,
            {
              release: Number(release),
              version,
              platform,
              architecture,
              expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
            },
          ),
        ),
      );
    else if (mode === "verify")
      console.log(
        JSON.stringify(
          await verifyRelease(
            path,
            process.env.RELEASE_PINNED_PUBLIC_KEY,
            out,
            release,
            Number(version),
            process.env.RELEASE_HIGH_WATER_FILE,
          ),
        ),
      );
    else throw new Error("Use package or verify.");
  } catch {
    console.error(
      "Release operation rejected. No executable was installed or run.",
    );
    process.exitCode = 1;
  }
}
