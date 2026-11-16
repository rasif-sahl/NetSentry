import {
  createPrivateKey,
  createPublicKey,
  createHash,
  sign,
} from "node:crypto";
import { readFile, lstat, writeFile } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { createReadStream } from "node:fs";
try {
  const [artifact, out, architecture, release, version] = process.argv.slice(2);
  const file = resolve(artifact),
    s = await lstat(file),
    keyFile = process.env.DESKTOP_UPDATE_PRIVATE_KEY_FILE;
  if (
    !s.isFile() ||
    s.isSymbolicLink() ||
    s.size < 1 ||
    s.size > 1024 ** 3 ||
    !keyFile ||
    !["arm64", "x64"].includes(architecture) ||
    !Number.isSafeInteger(Number(release)) ||
    Number(release) < 1 ||
    !/^\d+\.\d+\.\d+$/.test(version) ||
    basename(file) !== `NetSentry-${version}-${architecture}.zip`
  )
    throw new Error();
  const keyStat = await lstat(keyFile);
  if (
    !keyStat.isFile() ||
    keyStat.isSymbolicLink() ||
    keyStat.mode & 0o077 ||
    keyStat.size > 16384
  )
    throw new Error();
  const key = createPrivateKey(await readFile(keyFile));
  if (key.asymmetricKeyType !== "ed25519") throw new Error();
  const digest = createHash("sha512");
  for await (const bytes of createReadStream(file)) digest.update(bytes);
  const now = Date.now();
  const manifest = {
    schemaVersion: 1,
    appId: "com.netsentry.desktop",
    platform: "darwin",
    architecture,
    release: Number(release),
    version,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 7 * 86400000).toISOString(),
    artifact: {
      name: basename(file),
      size: s.size,
      sha512: digest.digest("base64"),
    },
  };
  const bytes = Buffer.from(JSON.stringify(manifest));
  await writeFile(
    out,
    JSON.stringify({
      manifest: bytes.toString("base64"),
      signature: sign(null, bytes, key).toString("base64"),
    }) + "\n",
    { flag: "wx", mode: 0o600 },
  );
  const pub = createPublicKey(key)
    .export({ format: "der", type: "spki" })
    .subarray(-32)
    .toString("base64");
  console.log(
    JSON.stringify({
      manifestCreated: true,
      release: manifest.release,
      publicKey: pub,
      published: false,
    }),
  );
} catch {
  console.error(
    "Desktop update signing rejected. Check private key, ZIP, target and release metadata. Nothing was published.",
  );
  process.exitCode = 1;
}
