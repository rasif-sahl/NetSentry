import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  realpath,
  symlink,
  access,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  BackgroundService,
  agentPlist,
  backgroundLabel,
} from "../dist/main/background-service.js";
async function fixture(run) {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), "netsentry-background-")),
  );
  try {
    const home = join(root, "home"),
      state = join(root, "agent"),
      data = join(root, "desktop"),
      binary = join(
        root,
        "NetSentry.app/Contents/Resources/agent/netsentry-agent",
      );
    await mkdir(join(home, "Library"), { recursive: true, mode: 0o700 });
    await mkdir(state, { mode: 0o700 });
    const calls = [];
    let job = { loaded: false, running: false },
      trusted = true,
      local = true,
      grant = true,
      held = false,
      failLoad = false,
      failUnload = false;
    const ports = {
      trusted: async () => {
        if (!trusted) throw new Error("unsigned");
      },
      eligible: async () => {
        calls.push("eligibility");
        if (!grant) throw new Error("denied");
        local = true;
      },
      disableConsent: async () => {
        if (!trusted) return false;
        local = false;
        calls.push("disable");
        return true;
      },
      reserve: async () => {
        calls.push("reserve");
        held = true;
        return Object.assign(
          () => {
            held = false;
            calls.push("release");
          },
          { isHeld: () => held },
        );
      },
      inspect: async () => ({ ...job }),
      load: async (path) => {
        assert.equal(held, false);
        calls.push("load");
        if (failLoad) throw new Error("bootstrap failed");
        job = { loaded: true, running: true, program: binary, path };
      },
      start: async () => {
        assert.equal(held, false);
        calls.push("start");
        job.running = true;
      },
      unload: async () => {
        calls.push("unload");
        if (failUnload) throw new Error("bootout failed");
        job = { loaded: false, running: false };
      },
    };
    const manager = new BackgroundService(home, binary, state, data, ports);
    await run({
      root,
      home,
      state,
      data,
      binary,
      calls,
      ports,
      manager,
      flags: {
        set trusted(v) {
          trusted = v;
        },
        set local(v) {
          local = v;
        },
        set grant(v) {
          grant = v;
        },
        set failLoad(v) {
          failLoad = v;
        },
        set failUnload(v) {
          failUnload = v;
        },
        set job(v) {
          job = v;
        },
        get local() {
          return local;
        },
      },
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
test("plist is a fixed per-user command with no shell, secrets, logs or restart loop", () => {
  const xml = agentPlist(
    "/Applications/Net&Sentry.app/Contents/Resources/agent/netsentry-agent",
    "/Users/A & B/Library/Application Support/NetSentry/agent",
  );
  assert.ok(xml.includes("Net&amp;Sentry"));
  assert.ok(xml.includes("<key>KeepAlive</key><false/>"));
  assert.ok(xml.includes("<key>RunAtLoad</key><true/>"));
  assert.ok(xml.includes("<string>--background</string>"));
  assert.ok(!xml.includes("EnvironmentVariables"));
  assert.ok(!xml.includes("StartInterval"));
  assert.ok(!xml.includes("/bin/sh"));
  assert.throws(() => agentPlist("relative", "/tmp/state"));
  assert.throws(() => agentPlist("/tmp/agent", "/tmp/state\nextra"));
  if (process.platform === "darwin")
    execFileSync("/usr/bin/plutil", ["-lint", "-"], {
      input: xml,
      stdio: ["pipe", "pipe", "pipe"],
    });
});
test("registration checks current grants, requires confirmation and keeps runtime reserved until files are saved", async () =>
  fixture(async ({ manager, calls, ports, state, data }) => {
    await writeFile(join(state, "credentials"), "private fixture credentials", {
      mode: 0o600,
    });
    assert.equal((await manager.status()).registered, false);
    assert.deepEqual(calls, []);
    assert.equal(
      (await manager.act("register", async () => false)).registered,
      false,
    );
    assert.deepEqual(calls, []);
    const result = await manager.act("register", async () => true);
    assert.equal(result.registered, true);
    assert.equal(result.running, true);
    assert.deepEqual(calls, ["eligibility", "reserve", "release", "load"]);
    assert.equal(
      await readFile(manager.plistPath, "utf8"),
      agentPlist(
        JSON.parse(
          await readFile(join(data, "background-service.json"), "utf8"),
        ).binary,
        state,
      ),
    );
    await manager.act("register", async () => true);
    assert.equal(calls.filter((x) => x === "load").length, 1);
    await assert.rejects(manager.assertRemovedForUpdate());
    await manager.act("remove", async () => true);
    assert.equal((await manager.status()).registered, false);
    assert.equal(
      await readFile(join(state, "credentials"), "utf8"),
      "private fixture credentials",
    );
    await manager.assertRemovedForUpdate();
  }));
test("cancelled consent, workspace denial and unsigned registration create no files or jobs", async () =>
  fixture(async ({ manager, calls, flags }) => {
    flags.local = false;
    await manager.act("register", async () => false);
    assert.equal(flags.local, false);
    assert.ok(!calls.includes("load"));
    await assert.rejects(access(manager.plistPath));
    flags.local = true;
    flags.grant = false;
    await manager.act("register", async () => true);
    await assert.rejects(access(manager.plistPath));
    flags.grant = true;
    flags.trusted = false;
    const result = await manager.act("register", async () => true);
    assert.equal(result.canRegister, false);
    assert.ok(!calls.includes("load"));
  }));
test("owned removal works after trust loss and is cancelled without mutation", async () =>
  fixture(async ({ manager, flags, calls }) => {
    await manager.act("register", async () => true);
    flags.trusted = false;
    const before = calls.length;
    await manager.act("remove", async () => false);
    assert.equal(calls.length, before);
    assert.equal((await manager.status()).registered, true);
    const result = await manager.act("remove", async () => true);
    assert.equal(result.registered, false);
    assert.match(result.message, /could not be changed/);
    await assert.rejects(access(manager.plistPath));
  }));
test("unknown or modified jobs/files are never unloaded, overwritten or deleted", async () =>
  fixture(async ({ manager, flags, calls, binary }) => {
    await manager.act("register", async () => true);
    await writeFile(manager.plistPath, "foreign file");
    assert.equal((await manager.status()).verified, false);
    const before = calls.length;
    await manager.act("remove", async () => true);
    assert.equal(calls.length, before);
    assert.equal(await readFile(manager.plistPath, "utf8"), "foreign file");
    flags.job = {
      loaded: true,
      running: true,
      program: binary + ".foreign",
      path: manager.plistPath,
    };
    await manager.act("register", async () => true);
    assert.equal(calls.length, before);
  }));
test("partial bootstrap/bootout failures keep ownership evidence for safe recovery", async () =>
  fixture(async ({ manager, flags, data, calls }) => {
    flags.failLoad = true;
    await manager.act("register", async () => true);
    assert.equal((await manager.status()).registered, true);
    await access(join(data, "background-service.json"));
    flags.failLoad = false;
    const started = await manager.act("start", async () => true);
    assert.equal(started.running, true);
    flags.failUnload = true;
    await manager.act("remove", async () => true);
    await access(manager.plistPath);
    await access(join(data, "background-service.json"));
    flags.failUnload = false;
    await manager.act("remove", async () => true);
    await assert.rejects(access(manager.plistPath));
    assert.ok(calls.includes("disable"));
  }));
test("stale sockets and symlinked LaunchAgents directories fail closed", async () =>
  fixture(async ({ manager, state, home, root, calls }) => {
    await writeFile(join(state, "agent.sock"), "stale");
    await manager.act("register", async () => true);
    assert.ok(!calls.includes("load"));
    await assert.rejects(access(manager.plistPath));
    await rm(join(state, "agent.sock"));
    const foreign = join(root, "foreign");
    await mkdir(foreign);
    await symlink(foreign, join(home, "Library", "LaunchAgents"));
    await manager.act("register", async () => true);
    assert.ok(!calls.includes("load"));
    await assert.rejects(access(join(foreign, backgroundLabel + ".plist")));
  }));
test("explicit start does not happen automatically after a process exit", async () =>
  fixture(async ({ manager, flags, calls, binary }) => {
    await manager.act("register", async () => true);
    flags.job = {
      loaded: true,
      running: false,
      program: binary,
      path: manager.plistPath,
    };
    assert.equal((await manager.status()).running, false);
    assert.equal(calls.filter((x) => x === "start").length, 0);
    assert.equal((await manager.act("start", async () => true)).running, true);
    assert.equal(calls.filter((x) => x === "start").length, 1);
  }));

test("ownership is rechecked after confirmation before a job or file is removed", async () =>
  fixture(async ({ manager, calls }) => {
    await manager.act("register", async () => true);
    const before = calls.length;
    await manager.act("remove", async () => {
      await writeFile(manager.plistPath, "changed during confirmation");
      return true;
    });
    assert.equal(calls.length, before);
    assert.equal(
      await readFile(manager.plistPath, "utf8"),
      "changed during confirmation",
    );
  }));
test(
  "actual Go consent withdrawal preserves credentials and module choices and respects the runtime lock",
  { skip: !process.env.TEST_AGENT_BINARY },
  async () =>
    fixture(async ({ state }) => {
      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const run = promisify(execFile),
        binary = process.env.TEST_AGENT_BINARY;
      const { holdAgentUpdateLock } =
        await import("../dist/main/update-lock.js");
      await run(binary, [
        "init",
        "--state-dir",
        state,
        "--api",
        "http://127.0.0.1:1/api/v1",
        "--development-store",
      ]);
      const configPath = join(state, "config.json"),
        config = JSON.parse(await readFile(configPath, "utf8"));
      config.backgroundAllowed = true;
      config.requested = { network: true, developer: true };
      await writeFile(configPath, JSON.stringify(config), { mode: 0o600 });
      const secret = await readFile(join(state, "development-ipc.json"));
      await assert.rejects(
        run(binary, ["background-check", "--state-dir", state]),
      ); // unpaired: no network or collector starts
      const lease = await holdAgentUpdateLock(binary, state);
      try {
        await assert.rejects(
          run(binary, ["background-disable", "--state-dir", state]),
        );
        assert.equal(
          JSON.parse(await readFile(configPath, "utf8")).backgroundAllowed,
          true,
        );
      } finally {
        lease();
      }
      const end = Date.now() + 5000;
      while (lease.isHeld() && Date.now() < end)
        await new Promise((yes) => setTimeout(yes, 20));
      const result = await run(binary, [
        "background-disable",
        "--state-dir",
        state,
      ]);
      assert.equal(result.stdout, '{"disabled":true}\n');
      assert.deepEqual(JSON.parse(await readFile(configPath, "utf8")), {
        ...config,
        backgroundAllowed: false,
      });
      assert.deepEqual(
        await readFile(join(state, "development-ipc.json")),
        secret,
      );
    }),
);

test(
  "explicit Go background opt-in saves consent only after a fresh workspace grant",
  { skip: !process.env.TEST_AGENT_BINARY },
  async () =>
    fixture(async ({ state }) => {
      const { createServer } = await import("node:http");
      const { randomUUID } = await import("node:crypto");
      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const run = promisify(execFile),
        binary = process.env.TEST_AGENT_BINARY;
      const agentId = randomUUID(),
        workspaceId = randomUUID(),
        token = "t".repeat(43);
      let allowed = false,
        calls = 0;
      const server = createServer((req, res) => {
        calls++;
        assert.equal(req.method, "GET");
        assert.equal(req.url, `/agents/${agentId}/configuration`);
        assert.equal(req.headers.authorization, `Bearer ${token}`);
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            schemaVersion: 1,
            agentId,
            workspaceId,
            generation: 1,
            modules: { network: true, developer: true },
            backgroundAllowed: allowed,
            remoteControlAllowed: false,
            heartbeatSeconds: 30,
            maxBufferedEvents: 1000,
            maxBufferBytes: 1048576,
            maxEventAgeSeconds: 86400,
            maxBatchEvents: 50,
            maxAttempts: 8,
            maxBackoffSeconds: 300,
          }),
        );
      });
      await new Promise((yes, no) => {
        server.once("error", no);
        server.listen(0, "127.0.0.1", yes);
      });
      try {
        const apiUrl = `http://127.0.0.1:${server.address().port}`;
        await run(binary, [
          "init",
          "--state-dir",
          state,
          "--api",
          apiUrl,
          "--development-store",
        ]);
        const configPath = join(state, "config.json"),
          original = JSON.parse(await readFile(configPath, "utf8"));
        const bindingPath = join(state, "development-backend.json");
        await writeFile(
          bindingPath,
          JSON.stringify({
            value: JSON.stringify({
              agentId,
              workspaceId,
              generation: 1,
              token,
              apiUrl,
            }),
          }),
          { mode: 0o600 },
        );
        const binding = await readFile(bindingPath);
        await assert.rejects(
          run(binary, ["background-check", "--state-dir", state]),
        );
        assert.equal(calls, 0);
        await assert.rejects(
          run(binary, ["background-enable", "--state-dir", state]),
        );
        assert.deepEqual(
          JSON.parse(await readFile(configPath, "utf8")),
          original,
        );
        allowed = true;
        assert.equal(
          (await run(binary, ["background-enable", "--state-dir", state]))
            .stdout,
          '{"allowed":true}\n',
        );
        assert.deepEqual(JSON.parse(await readFile(configPath, "utf8")), {
          ...original,
          backgroundAllowed: true,
        });
        assert.deepEqual(await readFile(bindingPath), binding);
        assert.equal(calls, 2);
      } finally {
        await new Promise((yes) => server.close(yes));
      }
    }),
);

test("service failures return a fixed actionable reason without leaking raw errors", async () =>
  fixture(async ({ manager, ports }) => {
    const { DiagnosticFailure } =
      await import("../dist/main/diagnostic-codes.js");
    ports.eligible = async () => {
      throw new DiagnosticFailure("WORKSPACE_BACKGROUND_DENIED");
    };
    const denied = await manager.act("register", async () => true);
    assert.equal(denied.code, "WORKSPACE_BACKGROUND_DENIED");
    assert.match(denied.message, /workspace has not authorized/);
    ports.eligible = async () => {
      throw new Error("token-secret /Users/private");
    };
    const failed = await manager.act("register", async () => true);
    assert.equal(failed.code, "OPERATION_FAILED");
    assert.doesNotMatch(failed.message, /token-secret|\/Users/);
  }));

test("receipt-only interrupted registration provides explicit removal guidance", async () =>
  fixture(async ({ manager, flags }) => {
    await manager.act("register", async () => true);
    flags.job = { loaded: false, running: false };
    await rm(manager.plistPath);
    const partial = await manager.status();
    assert.equal(partial.recoveryRequired, true);
    assert.match(partial.message, /Partial service registration/);
    await manager.act("remove", async () => true);
    assert.equal((await manager.status()).recoveryRequired, false);
  }));
