import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign, createHash } from "node:crypto";
import {
  mkdtemp,
  writeFile,
  mkdir,
  readFile,
  rm,
  symlink,
  realpath,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  verifyEnvelope,
  validatePolicy,
  UpdateStore,
} from "../dist/main/update-policy.js";
import { UpdateController } from "../dist/main/update-controller.js";
import { packagingConfig } from "../packaging/config.mjs";
const keys = generateKeyPairSync("ed25519");
const policy = {
  schemaVersion: 1,
  enabled: true,
  appId: "com.netsentry.desktop",
  teamId: "ABCDE12345",
  feedUrl: "https://updates.example.invalid/stable/",
  publicKey: keys.publicKey
    .export({ format: "der", type: "spki" })
    .subarray(-32)
    .toString("base64"),
  release: 1,
};
const artifact = Buffer.from("synthetic ZIP bytes; not an application");
function manifest(changes = {}) {
  return {
    schemaVersion: 1,
    appId: policy.appId,
    platform: "darwin",
    architecture: "arm64",
    release: 2,
    version: "0.2.0",
    issuedAt: new Date(Date.now() - 1000).toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    artifact: {
      name: "NetSentry-0.2.0-arm64.zip",
      size: artifact.length,
      sha512: createHash("sha512").update(artifact).digest("base64"),
    },
    ...changes,
  };
}
function envelope(m, key = keys.privateKey) {
  const bytes = Buffer.from(JSON.stringify(m));
  return Buffer.from(
    JSON.stringify({
      manifest: bytes.toString("base64"),
      signature: sign(null, bytes, key).toString("base64"),
    }),
  );
}
async function fixture(run) {
  const dir = await realpath(
    await mkdtemp(join(tmpdir(), "netsentry-updates-")),
  );
  try {
    const path = join(dir, "update.zip");
    await writeFile(path, artifact, { mode: 0o600 });
    await run(dir, path);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
test("policy and signed metadata reject disabled, wrong root/target, tamper, path and time", () => {
  assert.equal(
    validatePolicy({
      ...policy,
      enabled: false,
      teamId: "",
      feedUrl: "",
      publicKey: "",
    }).enabled,
    false,
  );
  for (const change of [
    { feedUrl: "http://updates.example.invalid/" },
    { feedUrl: "https://u:p@updates.example.invalid/" },
    { publicKey: "bad" },
    { teamId: "bad" },
  ])
    assert.throws(() => validatePolicy({ ...policy, ...change }));
  assert.throws(() =>
    validatePolicy({
      ...policy,
      enabled: false,
      feedUrl: "https://user:secret@updates.example.invalid/",
    }),
  );
  const m = manifest();
  assert.equal(verifyEnvelope(envelope(m), policy, "arm64").release, 2);
  assert.throws(() =>
    verifyEnvelope(envelope(m), { ...policy, enabled: false }, "arm64"),
  );
  assert.throws(() =>
    verifyEnvelope(
      envelope(m, generateKeyPairSync("ed25519").privateKey),
      policy,
      "arm64",
    ),
  );
  for (const changed of [
    { ...m, architecture: "x64" },
    { ...m, release: 0 },
    { ...m, expiresAt: new Date(Date.now() - 1).toISOString() },
    { ...m, expiresAt: new Date(Date.now() + 8 * 86400000).toISOString() },
    { ...m, artifact: { ...m.artifact, name: "../evil.zip" } },
    { ...m, artifact: { ...m.artifact, sha512: "invalid" } },
    { ...m, extra: true },
  ])
    assert.throws(() => verifyEnvelope(envelope(changed), policy, "arm64"));
  const bad = JSON.parse(envelope(m));
  bad.manifest = Buffer.from(
    JSON.stringify({ ...m, version: "9.0.0" }),
  ).toString("base64");
  assert.throws(() =>
    verifyEnvelope(Buffer.from(JSON.stringify(bad)), policy, "arm64"),
  );
});
test("persistent release journal rejects rollback, reuse, corruption and symlinks", async () =>
  fixture(async (dir) => {
    const store = new UpdateStore(join(dir, "state")),
      m = manifest();
    await store.accept(m, "checked");
    await store.accept(m, "downloaded");
    await assert.rejects(store.accept({ ...m, release: 1 }, "checked"));
    await assert.rejects(store.accept({ ...m, version: "0.3.0" }, "checked"));
    assert.equal(
      (await new UpdateStore(join(dir, "state")).read()).status,
      "downloaded",
    );
    await writeFile(join(dir, "state", "release.json"), "broken");
    await assert.rejects(store.read());
    await rm(join(dir, "state", "release.json"));
    await symlink(join(dir, "other"), join(dir, "state", "release.json"));
    await assert.rejects(store.read());
  }));
test("disabled installations never fetch, download or prompt", async () =>
  fixture(async (dir) => {
    let calls = 0;
    const controller = new UpdateController(
      { ...policy, enabled: false },
      "0.1.0",
      "arm64",
      new UpdateStore(join(dir, "state")),
      join(dir, "agent"),
      null,
      async () => {
        calls++;
        throw new Error();
      },
    );
    for (const action of ["check", "download", "install"])
      assert.equal(
        (
          await controller.act(action, async () => {
            calls++;
            return true;
          })
        ).state,
        "disabled",
      );
    assert.equal(calls, 0);
    await assert.rejects(controller.act("shell", async () => true));
  }));
test("check/download/install are explicit, digest-bound and blocked by a running or stale socket", async () =>
  fixture(async (dir, path) => {
    let downloads = 0,
      installs = 0;
    const m = manifest(),
      state = join(dir, "agent");
    await mkdir(state);
    const port = {
      check: async () => {},
      download: async () => {
        downloads++;
        return path;
      },
      install: () => {
        installs++;
      },
    };
    const controller = new UpdateController(
      policy,
      "0.1.0",
      "arm64",
      new UpdateStore(join(dir, "state")),
      state,
      port,
      async () => envelope(m),
    );
    assert.equal(
      (await controller.act("check", async () => true)).state,
      "available",
    );
    assert.equal(downloads, 0);
    assert.equal(
      (await controller.act("download", async () => false)).state,
      "available",
    );
    assert.equal(downloads, 0);
    assert.equal(
      (await controller.act("download", async () => true)).state,
      "downloaded",
    );
    assert.equal(installs, 0);
    await writeFile(join(state, "agent.sock"), "stale fixture");
    assert.equal(
      (await controller.act("install", async () => true)).state,
      "error",
    );
    assert.equal(installs, 0);
    await rm(join(state, "agent.sock"));
    await controller.act("check", async () => true);
    await controller.act("download", async () => true);
    assert.equal(
      (await controller.act("install", async () => false)).state,
      "downloaded",
    );
    assert.equal(installs, 0);
    assert.equal(
      (await controller.act("install", async () => true)).state,
      "installing",
    );
    assert.equal(installs, 1);
    assert.equal(
      (await new UpdateStore(join(dir, "state")).read()).status,
      "install_requested",
    );
  }));
test("modified cached artifact and failed downloads cannot install or authorize a downgrade", async () =>
  fixture(async (dir, path) => {
    let installs = 0;
    const m = manifest();
    const controller = new UpdateController(
      policy,
      "0.1.0",
      "arm64",
      new UpdateStore(join(dir, "state")),
      join(dir, "agent"),
      {
        check: async () => {},
        download: async () => path,
        install: () => installs++,
      },
      async () => envelope(m),
    );
    await controller.act("check", async () => true);
    await controller.act("download", async () => true);
    await writeFile(path, "modified");
    assert.equal(
      (await controller.act("install", async () => true)).state,
      "error",
    );
    assert.equal(installs, 0);
    const resumed = new UpdateController(
      policy,
      "0.1.0",
      "arm64",
      new UpdateStore(join(dir, "state")),
      join(dir, "agent"),
      {
        check: async () => {},
        download: async () => {
          throw new Error("interrupted");
        },
        install: () => installs++,
      },
      async () => envelope(m),
    );
    assert.equal(
      (await resumed.act("check", async () => true)).state,
      "available",
    );
    assert.equal(
      (await resumed.act("download", async () => true)).state,
      "error",
    );
    assert.equal(installs, 0);
  }));
test("preview packaging rejects wrong agent architecture and release credentials are mandatory", async () =>
  fixture(async (dir) => {
    const file = join(dir, "agent"),
      bytes = Buffer.alloc(32);
    bytes.writeUInt32LE(0xfeedfacf, 0);
    bytes.writeUInt32LE(0x100000c, 4);
    await writeFile(file, bytes, { mode: 0o700 });
    const env = {
      NETSENTRY_PACKAGE_AGENT: file,
      NETSENTRY_ELECTRON_DIST: dir,
      DESKTOP_ARCH: "arm64",
    };
    const result = await packagingConfig("preview", env);
    assert.equal(result.config.mac.identity, null);
    assert.equal(result.policy.enabled, false);
    assert.equal(result.config.publish, null);
    await assert.rejects(
      packagingConfig("preview", { ...env, DESKTOP_ARCH: "x64" }),
    );
    await assert.rejects(packagingConfig("release", env));
  }));

test("signed custom provider resolves only the verified artifact, never unsigned YAML", async () => {
  const { signedProvider } = await import("../dist/main/signed-provider.js");
  const m = manifest();
  const Provider = signedProvider(policy, m);
  const p = new Provider({}, null, {
    executor: {},
    platform: "darwin",
    isUseMultipleRangeRequest: false,
  });
  const info = await p.getLatestVersion();
  assert.equal(info.version, m.version);
  assert.equal(info.files[0].sha512, m.artifact.sha512);
  assert.equal(
    p.resolveFiles(info)[0].url.toString(),
    policy.feedUrl + m.artifact.name,
  );
  assert.throws(() => p.resolveFiles({ ...info, version: "9.0.0" }));
});
test("startup reports an interrupted install and native failure releases the update lease", async () =>
  fixture(async (dir, path) => {
    const m = manifest(),
      store = new UpdateStore(join(dir, "state"));
    await store.accept(m, "install_requested");
    let fail,
      releases = 0;
    const port = {
      check: async () => {},
      download: async () => path,
      install: () => {},
      onError: (callback) => {
        fail = callback;
      },
    };
    const controller = new UpdateController(
      policy,
      "0.1.0",
      "arm64",
      store,
      join(dir, "agent"),
      port,
      async () => envelope(m),
      async () => () => {
        releases++;
      },
    );
    await controller.restore();
    assert.match(controller.status().message, /did not complete/);
    await controller.act("check", async () => true);
    await controller.act("download", async () => true);
    await controller.act("install", async () => true);
    fail();
    assert.equal(controller.status().state, "error");
    assert.equal(releases, 1);
    const upgraded = new UpdateController(
      policy,
      m.version,
      "arm64",
      store,
      join(dir, "agent"),
      port,
      async () => envelope(m),
    );
    await upgraded.restore();
    assert.match(upgraded.status().message, /is installed/);
  }));
test(
  "actual Go update lock excludes another process and releases on pipe closure",
  { skip: !process.env.TEST_AGENT_BINARY },
  async () =>
    fixture(async (dir) => {
      const { holdAgentUpdateLock } =
        await import("../dist/main/update-lock.js");
      const state = join(dir, "agent");
      await mkdir(state, { mode: 0o700 });
      const lease = await holdAgentUpdateLock(
        process.env.TEST_AGENT_BINARY,
        state,
      );
      try {
        assert.equal(lease.isHeld(), true);
        await assert.rejects(
          holdAgentUpdateLock(process.env.TEST_AGENT_BINARY, state),
        );
      } finally {
        lease();
      }
      const deadline = Date.now() + 5000;
      while (lease.isHeld() && Date.now() < deadline)
        await new Promise((yes) => setTimeout(yes, 20));
      assert.equal(lease.isHeld(), false);
      const next = await holdAgentUpdateLock(
        process.env.TEST_AGENT_BINARY,
        state,
      );
      next();
    }),
);

test("offline signing CLI produces the exact envelope consumed by the update verifier", async () =>
  fixture(async (dir) => {
    const { spawnSync } = await import("node:child_process");
    const key = join(dir, "test-private.pem"),
      zip = join(dir, "NetSentry-0.2.0-arm64.zip"),
      out = join(dir, "desktop-update-arm64.json");
    await writeFile(
      key,
      keys.privateKey.export({ format: "pem", type: "pkcs8" }),
      { mode: 0o600 },
    );
    await writeFile(zip, artifact);
    const result = spawnSync(
      process.execPath,
      [
        "desktop/scripts/sign-desktop-update.mjs",
        zip,
        out,
        "arm64",
        "2",
        "0.2.0",
      ],
      {
        cwd: new URL("../../", import.meta.url),
        env: { ...process.env, DESKTOP_UPDATE_PRIVATE_KEY_FILE: key },
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      verifyEnvelope(await readFile(out), policy, "arm64").release,
      2,
    );
    const second = spawnSync(
      process.execPath,
      [
        "desktop/scripts/sign-desktop-update.mjs",
        zip,
        out,
        "arm64",
        "2",
        "0.2.0",
      ],
      {
        cwd: new URL("../../", import.meta.url),
        env: { ...process.env, DESKTOP_UPDATE_PRIVATE_KEY_FILE: key },
        encoding: "utf8",
      },
    );
    assert.equal(second.status, 1);
  }));
