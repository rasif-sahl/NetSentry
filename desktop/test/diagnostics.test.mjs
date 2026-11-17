import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  realpath,
  mkdir,
  readFile,
  writeFile,
  rm,
  symlink,
  stat,
  access,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:net";
import { once } from "node:events";
import {
  DesktopDiagnostics,
  parseAgentDiagnostics,
  redactedReport,
} from "../dist/main/diagnostics.js";
import { DiagnosticFailure } from "../dist/main/diagnostic-codes.js";
import { saveDiagnosticReport } from "../dist/main/diagnostics-native.js";
import { holdAgentUpdateLock } from "../dist/main/update-lock.js";
const environment = {
  platform: "darwin",
  architecture: "arm64",
  appVersion: "0.1.0",
};
function fixture() {
  const flags = {
    trusted: true,
    registered: false,
    verified: true,
    incomplete: false,
    codes: ["SOCKET_STALE", "LOCAL_BACKGROUND_DISABLED", "PAIRING_REQUIRED"],
    repairs: 0,
    probes: 0,
  };
  const ports = {
    trusted: async () => {
      if (!flags.trusted) throw new DiagnosticFailure("SIGNING_REQUIRED");
    },
    service: async () => ({
      verified: flags.verified,
      recoveryRequired: flags.incomplete,
      registered: flags.registered,
      loaded: flags.registered,
      running: false,
      canRegister: flags.trusted,
      message: "secret raw log /Users/example",
    }),
    agent: async (repair) => {
      flags.probes++;
      if (repair) {
        flags.repairs++;
        flags.codes = ["SOCKET_ABSENT"];
        return ["SOCKET_REPAIRED"];
      }
      return flags.codes;
    },
  };
  return { flags, ports, manager: new DesktopDiagnostics(ports, environment) };
}
test("untrusted diagnostics never executes the agent and still reports service state", async () => {
  const { flags, manager } = fixture();
  flags.trusted = false;
  const report = await manager.scan();
  assert.equal(report.canRepair, false);
  assert.equal(flags.probes, 0);
  assert.deepEqual(
    report.checks.map((c) => c.code),
    ["SERVICE_ABSENT", "SIGNING_REQUIRED"],
  );
  assert.equal(
    (
      await manager.repair(async () => {
        throw new Error("must not ask");
      })
    ).outcome,
    "REPAIR_BLOCKED",
  );
});
test("repair cancels without mutation and rechecks service/trust/socket after confirmation", async () => {
  for (const change of [
    "cancel",
    "registered",
    "trusted",
    "socket",
    "verified",
    "incomplete",
  ]) {
    const { flags, manager } = fixture();
    const result = await manager.repair(async () => {
      if (change === "cancel") return false;
      if (change === "registered") flags.registered = true;
      if (change === "incomplete") flags.incomplete = true;
      if (change === "trusted") flags.trusted = false;
      if (change === "socket") flags.codes = ["SOCKET_LIVE"];
      if (change === "verified") flags.verified = false;
      return true;
    });
    assert.equal(flags.repairs, 0);
    assert.equal(
      result.outcome,
      change === "cancel" ? "REPAIR_CANCELLED" : "REPAIR_BLOCKED",
    );
  }
  const { flags, manager } = fixture();
  const result = await manager.repair(async () => true);
  assert.equal(flags.repairs, 1);
  assert.equal(result.outcome, "SOCKET_REPAIRED");
  assert.equal(result.canRepair, false);
});
test("busy/unknown sockets and invalid helper responses cannot enable recovery", async () => {
  for (const code of [
    "RUNTIME_BUSY",
    "SOCKET_UNKNOWN",
    "SOCKET_UNSAFE",
    "LOCK_UNAVAILABLE",
    "STATE_UNSAFE",
  ]) {
    const { flags, manager } = fixture();
    flags.codes = [code];
    assert.equal((await manager.scan()).canRepair, false);
  }
  for (const value of [
    null,
    { schemaVersion: 1, codes: ["SOCKET_STALE"], token: "private" },
    { schemaVersion: 1, codes: ["SECRET"] },
    { schemaVersion: 1, codes: ["SOCKET_STALE", "SOCKET_STALE"] },
    { schemaVersion: 1, codes: ["SOCKET_STALE", "RUNTIME_BUSY"] },
  ])
    assert.throws(() => parseAgentDiagnostics(value));
});
test("exports rebuild messages from the allowlist and omit arbitrary attached data", async () => {
  const { manager } = fixture();
  const report = await manager.scan();
  report.secret = "private-token";
  report.checks[0].message = "private-token /Users/example";
  report.checks[0].nextStep = "private-address";
  report.checks[0].extra = "private-token";
  const output = redactedReport(report);
  assert.doesNotMatch(
    output,
    /private-token|private-address|\/Users|extra|secret/,
  );
  assert.equal(JSON.parse(output).schemaVersion, 1);
  const root = await mkdtemp(join(tmpdir(), "ns-export-"));
  try {
    const file = join(root, "report.json");
    await saveDiagnosticReport(file, output);
    assert.equal((await stat(file)).mode & 0o777, 0o600);
    await assert.rejects(saveDiagnosticReport(file, "overwrite"));
    assert.equal(await readFile(file, "utf8"), output);
    const link = join(root, "link.json");
    await symlink(file, link);
    await assert.rejects(saveDiagnosticReport(link, "overwrite"));
    assert.equal(await readFile(file, "utf8"), output);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
const run = promisify(execFile);
async function withAgent(fn) {
  const binary = process.env.TEST_AGENT_BINARY;
  const root = await realpath(await mkdtemp(join(tmpdir(), "ns-crash-"))),
    state = join(root, "agent");
  try {
    await run(binary, [
      "init",
      "--state-dir",
      state,
      "--api",
      "http://127.0.0.1:1/api/v1",
      "--development-store",
    ]);
    const call = async (mode) =>
      JSON.parse((await run(binary, [mode, "--state-dir", state])).stdout);
    await fn({ binary, state, root, call });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
test(
  "actual agent crash recovery preserves config/credentials, refuses active runtime and permits explicit restart",
  { skip: !process.env.TEST_AGENT_BINARY },
  async () =>
    withAgent(async ({ binary, state, call }) => {
      const original = await readFile(join(state, "config.json")),
        secret = await readFile(join(state, "development-ipc.json"));
      let child;
      const start = async () => {
        child = spawn(binary, ["run", "--state-dir", state], {
          stdio: "ignore",
        });
        for (let i = 0; i < 200; i++) {
          if (
            await stat(join(state, "agent.sock")).then(
              (s) => s.isSocket(),
              () => false,
            )
          )
            return;
          await new Promise((yes) => setTimeout(yes, 25));
        }
        throw new Error("fixture agent did not start");
      };
      try {
        await start();
        assert.deepEqual((await call("repair-socket")).codes, ["RUNTIME_BUSY"]);
        const exited = once(child, "exit");
        child.kill("SIGKILL");
        await exited;
        const diagnostic = await call("diagnose");
        assert.ok(diagnostic.codes.includes("SOCKET_STALE"));
        assert.ok(diagnostic.codes.includes("PAIRING_REQUIRED"));
        assert.deepEqual(await call("repair-socket"), {
          schemaVersion: 1,
          codes: ["SOCKET_REPAIRED"],
        });
        await assert.rejects(access(join(state, "agent.sock")));
        assert.deepEqual(await readFile(join(state, "config.json")), original);
        assert.deepEqual(
          await readFile(join(state, "development-ipc.json")),
          secret,
        );
        assert.deepEqual((await call("repair-socket")).codes, [
          "SOCKET_ABSENT",
        ]);
        await start();
        assert.deepEqual((await call("diagnose")).codes, ["RUNTIME_BUSY"]);
      } finally {
        if (child && child.exitCode === null && child.signalCode === null) {
          const end = once(child, "exit");
          child.kill("SIGTERM");
          await end;
        }
      }
    }),
);
test(
  "actual helper refuses a live socket without an agent lock, files, links and an update lease",
  { skip: !process.env.TEST_AGENT_BINARY },
  async () =>
    withAgent(async ({ binary, state, root, call }) => {
      const path = join(state, "agent.sock");
      const server = createServer((socket) => socket.end());
      server.listen(path);
      await once(server, "listening");
      const { chmod } = await import("node:fs/promises");
      await chmod(path, 0o600);
      try {
        assert.deepEqual((await call("repair-socket")).codes, ["SOCKET_LIVE"]);
      } finally {
        await new Promise((yes) => server.close(yes));
      }
      await writeFile(path, "preserve", { mode: 0o600 });
      assert.deepEqual((await call("repair-socket")).codes, ["SOCKET_UNSAFE"]);
      assert.equal(await readFile(path, "utf8"), "preserve");
      await rm(path);
      const target = join(root, "target");
      await writeFile(target, "private");
      await symlink(target, path);
      assert.deepEqual((await call("repair-socket")).codes, ["SOCKET_UNSAFE"]);
      assert.equal(await readFile(target, "utf8"), "private");
      await rm(path);
      const lease = await holdAgentUpdateLock(binary, state);
      try {
        assert.deepEqual((await call("repair-socket")).codes, ["RUNTIME_BUSY"]);
      } finally {
        lease();
      }
    }),
);

test(
  "actual diagnostic helper reports current backend/grant/pairing failures without saving consent or starting workers",
  { skip: !process.env.TEST_AGENT_BINARY },
  async () =>
    withAgent(async ({ state, call }) => {
      const { createServer } = await import("node:http");
      const { randomUUID } = await import("node:crypto");
      const agentId = randomUUID(),
        workspaceId = randomUUID(),
        token = "t".repeat(43);
      let status = 200,
        allowed = false,
        generation = 1,
        calls = 0;
      const server = createServer((req, res) => {
        calls++;
        assert.equal(req.method, "GET");
        assert.equal(req.url, `/agents/${agentId}/configuration`);
        assert.equal(req.headers.authorization, `Bearer ${token}`);
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            schemaVersion: 1,
            agentId,
            workspaceId,
            generation,
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
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      try {
        const configPath = join(state, "config.json"),
          config = JSON.parse(await readFile(configPath, "utf8"));
        config.apiUrl = `http://127.0.0.1:${server.address().port}`;
        await writeFile(configPath, JSON.stringify(config));
        const bindingPath = join(state, "development-backend.json");
        await writeFile(
          bindingPath,
          JSON.stringify({
            value: JSON.stringify({
              agentId,
              workspaceId,
              generation: 1,
              token,
              apiUrl: config.apiUrl,
            }),
          }),
          { mode: 0o600 },
        );
        const binding = await readFile(bindingPath);
        for (const [nextStatus, nextAllowed, nextGeneration, code] of [
          [200, false, 1, "WORKSPACE_BACKGROUND_DENIED"],
          [200, true, 1, "WORKSPACE_BACKGROUND_ALLOWED"],
          [200, true, 2, "PAIRING_STALE"],
          [403, true, 1, "PAIRING_REJECTED"],
          [503, true, 1, "BACKEND_REJECTED"],
        ]) {
          status = nextStatus;
          allowed = nextAllowed;
          generation = nextGeneration;
          const result = await call("diagnose");
          assert.deepEqual(result.codes, [
            "SOCKET_ABSENT",
            "LOCAL_BACKGROUND_DISABLED",
            code,
          ]);
          assert.deepEqual(
            JSON.parse(await readFile(configPath, "utf8")),
            config,
          );
          assert.deepEqual(await readFile(bindingPath), binding);
          assert.doesNotMatch(
            JSON.stringify(result),
            new RegExp(`${token}|${agentId}|${workspaceId}|127\\.0\\.0\\.1`),
          );
        }
        assert.equal(calls, 5);
      } finally {
        await new Promise((yes) => server.close(yes));
      }
    }),
);
