import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { packageRelease, verifyRelease } from "../scripts/release.mjs";
test("release signatures, digest, target, root and persisted rollback protection fail closed", async () => {
  const root = await mkdtemp(join(tmpdir(), "netsentry-release-"));
  try {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const key = join(root, "root.pem"),
      artifact = join(root, "sample-agent"),
      bundle = join(root, "bundle"),
      state = join(root, "accepted.json");
    const pinned = publicKey
      .export({ type: "spki", format: "der" })
      .subarray(-32)
      .toString("base64");
    await writeFile(key, privateKey.export({ type: "pkcs8", format: "pem" }), {
      mode: 0o600,
    });
    await writeFile(artifact, "Explicit synthetic package. Never executable.");
    const platform = process.platform,
      architecture = process.arch === "x64" ? "amd64" : process.arch;
    await packageRelease(artifact, key, bundle, {
      release: 10,
      version: "0.14.0",
      platform,
      architecture,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    assert.equal(
      (await verifyRelease(bundle, pinned, platform, architecture, 1, state))
        .installed,
      false,
    );
    await verifyRelease(bundle, pinned, platform, architecture, 10, state);
    await assert.rejects(
      verifyRelease(bundle, pinned, "wrong", architecture, 1),
    );
    await assert.rejects(
      verifyRelease(bundle, pinned, platform, architecture, NaN),
    );
    await assert.rejects(
      verifyRelease(bundle, pinned, platform, architecture, 11),
    );
    await assert.rejects(
      packageRelease(artifact, key, join(root, "invalid-time"), {
        release: 11,
        version: "0.14.0",
        platform,
        architecture,
        expiresAt: "invalid.000Z",
      }),
    );
    const brokenState = join(root, "broken-state");
    await writeFile(brokenState, JSON.stringify({ release: "broken" }), {
      mode: 0o600,
    });
    await assert.rejects(
      verifyRelease(bundle, pinned, platform, architecture, 1, brokenState),
    );
    const other = generateKeyPairSync("ed25519")
      .publicKey.export({ type: "spki", format: "der" })
      .subarray(-32)
      .toString("base64");
    await assert.rejects(
      verifyRelease(bundle, other, platform, architecture, 1),
    );
    if (process.env.TEST_AGENT_BINARY) {
      const keyPath = join(root, "root.public");
      await writeFile(keyPath, pinned);
      const result = JSON.parse(
        execFileSync(
          process.env.TEST_AGENT_BINARY,
          [
            "verify-package",
            "--manifest",
            join(bundle, "manifest.json"),
            "--signature",
            join(bundle, "manifest.sig"),
            "--public-key",
            keyPath,
            "--artifact",
            join(bundle, "sample-agent"),
            "--minimum-release",
            "10",
          ],
          { encoding: "utf8" },
        ),
      );
      assert.equal(result.verified, true);
      assert.equal(result.installed, false);
    }
    const lower = join(root, "lower");
    await packageRelease(artifact, key, lower, {
      release: 9,
      version: "0.13.0",
      platform,
      architecture,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    await assert.rejects(
      verifyRelease(lower, pinned, platform, architecture, 1, state),
    );
    await writeFile(join(bundle, "sample-agent"), "tampered");
    await assert.rejects(
      verifyRelease(bundle, pinned, platform, architecture, 1),
    );
    assert.equal(JSON.parse(await readFile(state)).release, 10);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
